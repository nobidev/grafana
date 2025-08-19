package resource

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/ring"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ResourceServer implements all gRPC services
type ResourceSearchServer interface {
	resourcepb.ResourceIndexServer
	resourcepb.ManagedObjectIndexServer
	resourcepb.DiagnosticsServer
}

// Passed as input to the constructor
type SearchOptions struct {
	// The raw index backend (eg, bleve, frames, parquet, etc)
	Backend SearchBackend

	// The supported resource types
	Resources DocumentBuilderSupplier

	// How many threads should build indexes
	WorkerThreads int

	// Skip building index on startup for small indexes
	InitMinCount int

	// Build empty index on startup for large indexes so that
	// we don't re-attempt to build the index later.
	InitMaxCount int

	// Channel to watch for index events (for testing)
	IndexEventsChan chan *IndexEvent

	// Interval for periodic index rebuilds (0 disables periodic rebuilds)
	RebuildInterval time.Duration

	Ring *ring.Ring
}

type ResourceSearchServerOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Real storage backend
	Backend StorageBackend

	// The blob configuration
	Blob BlobConfig

	// Search options
	Search SearchOptions

	// Diagnostics
	Diagnostics resourcepb.DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteHooks WriteAccessHooks

	// Link RBAC
	AccessClient claims.AccessClient

	// Callbacks for startup and shutdown
	Lifecycle LifecycleHooks

	// Get the current time in unix millis
	Now func() int64

	// Registerer to register prometheus Metrics for the Resource server
	Reg prometheus.Registerer

	storageMetrics *StorageMetrics

	IndexMetrics *BleveIndexMetrics

	// MaxPageSizeBytes is the maximum size of a page in bytes.
	MaxPageSizeBytes int

	Ring           *ring.Ring
	RingLifecycler *ring.BasicLifecycler
}

func NewResourceSearchServer(opts ResourceSearchServerOptions) (ResourceSearchServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-server")
	}

	if opts.Backend == nil {
		return nil, fmt.Errorf("missing Backend implementation")
	}

	if opts.AccessClient == nil {
		opts.AccessClient = claims.FixedAccessClient(true) // everything OK
	}

	if opts.Diagnostics == nil {
		opts.Diagnostics = &noopService{}
	}

	if opts.Now == nil {
		opts.Now = func() int64 {
			return time.Now().UnixMilli()
		}
	}

	if opts.MaxPageSizeBytes <= 0 {
		// By default, we use 2MB for the page size.
		opts.MaxPageSizeBytes = 1024 * 1024 * 2
	}

	// Initialize the blob storage
	blobstore := opts.Blob.Backend
	if blobstore == nil {
		if opts.Blob.URL != "" {
			ctx := context.Background()
			bucket, err := OpenBlobBucket(ctx, opts.Blob.URL)
			if err != nil {
				return nil, err
			}

			blobstore, err = NewCDKBlobSupport(ctx, CDKBlobSupportOptions{
				Tracer: opts.Tracer,
				Bucket: NewInstrumentedBucket(bucket, opts.Reg, opts.Tracer),
			})
			if err != nil {
				return nil, err
			}
		} else {
			// Check if the backend supports blob storage
			blobstore, _ = opts.Backend.(BlobSupport)
		}
	}

	logger := slog.Default().With("logger", "resource-server")

	// Make this cancelable
	ctx, cancel := context.WithCancel(context.Background())
	s := &searchServer{
		tracer:           opts.Tracer,
		log:              logger,
		backend:          opts.Backend,
		blob:             blobstore,
		diagnostics:      opts.Diagnostics,
		access:           opts.AccessClient,
		writeHooks:       opts.WriteHooks,
		lifecycle:        opts.Lifecycle,
		now:              opts.Now,
		ctx:              ctx,
		cancel:           cancel,
		storageMetrics:   opts.storageMetrics,
		indexMetrics:     opts.IndexMetrics,
		maxPageSizeBytes: opts.MaxPageSizeBytes,
		reg:              opts.Reg,
	}

	if opts.Search.Resources != nil {
		var err error
		s.search, err = newSearchSupport(opts.Search, s.backend, s.access, s.blob, opts.Tracer, opts.IndexMetrics, opts.Ring, opts.RingLifecycler)
		if err != nil {
			return nil, err
		}
	}

	err := s.Init(ctx)
	if err != nil {
		s.log.Error("resource server init failed", "error", err)
		return nil, err
	}

	return s, nil
}

var _ ResourceSearchServer = &searchServer{}

type searchServer struct {
	tracer         trace.Tracer
	log            *slog.Logger
	backend        StorageBackend
	blob           BlobSupport
	search         *searchSupport
	diagnostics    resourcepb.DiagnosticsServer
	access         claims.AccessClient
	writeHooks     WriteAccessHooks
	lifecycle      LifecycleHooks
	now            func() int64
	mostRecentRV   atomic.Int64 // The most recent resource version seen by the server
	storageMetrics *StorageMetrics
	indexMetrics   *BleveIndexMetrics

	// Background watch task -- this has permissions for everything
	ctx         context.Context
	cancel      context.CancelFunc
	broadcaster Broadcaster[*WrittenEvent]

	// init checking
	once    sync.Once
	initErr error

	maxPageSizeBytes int
	reg              prometheus.Registerer
}

// Init implements ResourceServer.
func (s *searchServer) Init(ctx context.Context) error {
	s.once.Do(func() {
		// Call lifecycle hooks
		if s.lifecycle != nil {
			err := s.lifecycle.Init(ctx)
			if err != nil {
				s.initErr = fmt.Errorf("initialize Resource Server: %w", err)
			}
		}

		// initialize the search index
		if s.initErr == nil && s.search != nil {
			s.initErr = s.search.init(ctx)
		}

		if s.initErr != nil {
			s.log.Error("error running resource server init", "error", s.initErr)
		}
	})
	return s.initErr
}

func (s *searchServer) Stop(ctx context.Context) error {
	s.initErr = fmt.Errorf("service is stopping")

	var stopFailed bool
	if s.lifecycle != nil {
		err := s.lifecycle.Stop(ctx)
		if err != nil {
			stopFailed = true
			s.initErr = fmt.Errorf("service stopeed with error: %w", err)
		}
	}

	// Stops the streaming
	s.cancel()

	// mark the value as done
	if stopFailed {
		return s.initErr
	}
	s.initErr = fmt.Errorf("service is stopped")

	return nil
}

func (s *searchServer) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.Search(ctx, req)
}

// GetStats implements ResourceServer.
func (s *searchServer) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	if s.search == nil {
		// If the backend implements "GetStats", we can use it
		srv, ok := s.backend.(resourcepb.ResourceIndexServer)
		if ok {
			return srv.GetStats(ctx, req)
		}
		return nil, fmt.Errorf("search index not configured")
	}
	return s.search.GetStats(ctx, req)
}

func (s *searchServer) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	return s.search.ListManagedObjects(ctx, req)
}

func (s *searchServer) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	return s.search.CountManagedObjects(ctx, req)
}

// IsHealthy implements ResourceServer.
func (s *searchServer) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return s.diagnostics.IsHealthy(ctx, req)
}

