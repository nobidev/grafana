package services

import (
	"context"
	"crypto/x509"
	"fmt"
	"net"

	"github.com/apache/arrow-go/v18/arrow/flight/flightsql"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

var (
	glog = log.New("tsdb.influxdb.service.sql")
)

// SQLService is a service for executing SQL queries against InfluxDB using FlightSQL.
type SQLService struct {
	Client  *flightsql.Client
	Options *SQLServiceOptions
}

// SQLServiceOptions holds the configuration options for the SQLService.
type SQLServiceOptions struct {
	Secure   bool
	Proxy    proxy.Client
	Metadata metadata.MD
}

// NewClient creates a SQLService configured by functional options.
func NewSQLService(addr string, opts *SQLServiceOptions) (*SQLService, error) {
	srv := &SQLService{
		Options: opts,
	}

	// build dial options
	dialOpts, err := srv.buildDialOptions()
	if err != nil {
		return nil, fmt.Errorf("build dial options: %w", err)
	}

	// The passthrough scheme is required when using a proxy because gRPC's default DNS resolver
	// may not work correctly with custom dialers, such as those used for secure SOCKS proxies.
	// By specifying the passthrough scheme, we ensure that the address is passed directly to the custom dialer
	// without any name resolution, allowing the proxy to handle the connection as intended.
	if srv.Options.Proxy.SecureSocksProxyEnabled() {
		addr = "passthrough:///" + addr
	}

	client, err := flightsql.NewClient(addr, nil, nil, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("new flightsql client: %w", err)
	}

	srv.Client = client

	return srv, nil
}

// buildDialOptions constructs the gRPC dial options based on the service configuration.
// It handles secure connections, proxy settings, and metadata.
func (srv *SQLService) buildDialOptions() ([]grpc.DialOption, error) {
	var cred grpc.DialOption

	if srv.Options.Secure {
		pool, err := x509.SystemCertPool()

		if err != nil {
			return nil, fmt.Errorf("load system cert pool: %w", err)
		}

		cred = grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(pool, ""))
	} else {
		cred = grpc.WithTransportCredentials(insecure.NewCredentials())
	}

	opts := []grpc.DialOption{cred}

	// optional secure socks proxy (PDC)
	if srv.Options.Proxy != nil && srv.Options.Proxy.SecureSocksProxyEnabled() {
		dialer, err := srv.Options.Proxy.NewSecureSocksProxyContextDialer()
		if err != nil {
			return nil, fmt.Errorf("create proxy dialer: %w", err)
		}

		dialFunc := func(ctx context.Context, addr string) (net.Conn, error) {
			logger := glog.FromContext(ctx)
			logger.Debug("Dialing secure socks proxy", "host", addr)

			conn, err := dialer.Dial("tcp", addr)
			if err != nil {
				return nil, fmt.Errorf("proxy dial error: %w", err)
			}
			return conn, nil
		}

		opts = append(opts, grpc.WithContextDialer(dialFunc))
	}

	return opts, nil
}
