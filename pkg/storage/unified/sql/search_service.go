package sql

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

var (
	_ UnifiedStorageGrpcService = (*searchService)(nil)
)

type searchService struct {
	*services.BasicService

	// Subservices manager
	subservices        *services.Manager
	subservicesWatcher *services.FailureWatcher
	hasSubservices     bool

	cfg       *setting.Cfg
	features  featuremgmt.FeatureToggles
	db        infraDB.DB
	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing trace.Tracer

	authenticator func(ctx context.Context) (context.Context, error)

	log            log.Logger
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics
	indexMetrics   *resource.BleveIndexMetrics

	docBuilders resource.DocumentBuilderSupplier

	searchRing     *ring.Ring
	ringLifecycler *ring.BasicLifecycler

	scheduler *scheduler.Scheduler
}

func ProvideUnifiedSearchGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
) (UnifiedStorageGrpcService, error) {
	var err error
	tracer := otel.Tracer("unified-storage")

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	s := &searchService{
		cfg:                cfg,
		features:           features,
		stopCh:             make(chan struct{}),
		authenticator:      authn,
		tracing:            tracer,
		db:                 db,
		log:                log,
		reg:                reg,
		docBuilders:        docBuilders,
		storageMetrics:     storageMetrics,
		indexMetrics:       indexMetrics,
		searchRing:         searchRing,
		subservicesWatcher: services.NewFailureWatcher(),
	}

	subservices := []services.Service{}
	if cfg.EnableSharding {
		ringStore, err := kv.NewClient(
			memberlistKVConfig,
			ring.GetCodec(),
			kv.RegistererWithKVName(reg, resource.RingName),
			log,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create KV store client: %s", err)
		}

		lifecyclerCfg, err := toLifecyclerConfig(cfg, log)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize storage-ring lifecycler config: %s", err)
		}

		// Define lifecycler delegates in reverse order (last to be called defined first because they're
		// chained via "next delegate").
		delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, resource.RingNumTokens))
		delegate = ring.NewLeaveOnStoppingDelegate(delegate, log)
		delegate = ring.NewAutoForgetDelegate(resource.RingHeartbeatTimeout*2, delegate, log)

		s.ringLifecycler, err = ring.NewBasicLifecycler(
			lifecyclerCfg,
			resource.RingName,
			resource.RingKey,
			ringStore,
			delegate,
			log,
			reg,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize storage-ring lifecycler: %s", err)
		}

		s.ringLifecycler.SetKeepInstanceInTheRingOnShutdown(true)
		subservices = append(subservices, s.ringLifecycler)
	}

	if len(subservices) > 0 {
		s.hasSubservices = true
		s.subservices, err = services.NewManager(subservices...)
		if err != nil {
			return nil, fmt.Errorf("failed to create subservices manager: %w", err)
		}
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
}

func (s *searchService) starting(ctx context.Context) error {
	if s.hasSubservices {
		s.subservicesWatcher.WatchManager(s.subservices)
		if err := services.StartManagerAndAwaitHealthy(ctx, s.subservices); err != nil {
			return fmt.Errorf("failed to start subservices: %w", err)
		}
	}

	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing)
	if err != nil {
		return err
	}

	searchOptions, err := search.NewSearchOptions(s.features, s.cfg, s.tracing, s.docBuilders, s.indexMetrics)
	if err != nil {
		return err
	}

	serverOptions := ServerOptions{
		DB:             s.db,
		Cfg:            s.cfg,
		Tracer:         s.tracing,
		Reg:            s.reg,
		AccessClient:   authzClient,
		SearchOptions:  searchOptions,
		StorageMetrics: s.storageMetrics,
		IndexMetrics:   s.indexMetrics,
		Features:       s.features,
		Ring:           s.searchRing,
		RingLifecycler: s.ringLifecycler,
	}
	fmt.Println("CALLING NEW SEARCH SERVR")
	server, err := NewResourceSearchServer(serverOptions)
	if err != nil {
		return err
	}
	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, interceptors.AuthenticatorFunc(s.authenticator), s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(server)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	resourcepb.RegisterResourceIndexServer(srv, server)
	resourcepb.RegisterManagedObjectIndexServer(srv, server)
	resourcepb.RegisterDiagnosticsServer(srv, server)
	grpc_health_v1.RegisterHealthServer(srv, healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

	if s.cfg.EnableSharding {
		s.log.Info("waiting until resource server is JOINING in the ring")
		lfcCtx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()
		if err := ring.WaitInstanceState(lfcCtx, s.searchRing, s.ringLifecycler.GetInstanceID(), ring.JOINING); err != nil {
			return fmt.Errorf("error switching to JOINING in the ring: %s", err)
		}
		s.log.Info("resource server is JOINING in the ring")

		if err := s.ringLifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
			return fmt.Errorf("error switching to ACTIVE in the ring: %s", err)
		}
		s.log.Info("resource server is ACTIVE in the ring")
	}

	// start the gRPC server
	go func() {
		err := s.handler.Run(ctx)
		if err != nil {
			s.stoppedCh <- err
		} else {
			s.stoppedCh <- nil
		}
	}()
	return nil
}

// GetAddress returns the address of the gRPC server.
func (s *searchService) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *searchService) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
	case err := <-s.subservicesWatcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}

func (s *searchService) stopping(_ error) error {
	if s.hasSubservices {
		err := services.StopManagerAndAwaitStopped(context.Background(), s.subservices)
		if err != nil {
			return fmt.Errorf("failed to stop subservices: %w", err)
		}
	}
	return nil
}

