package services

import (
	"net/http"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

// FluxService is a service for executing Flux queries against InfluxDB using Flux.
type FluxService struct {
	// Client is the InfluxDB client used to execute Flux queries.
	Client influxdb2.Client
	// Options holds the configuration options for the Flux service.
	Options *FluxServiceOptions
}

// FluxServiceOptions holds the configuration options for the FluxService.
type FluxServiceOptions struct {
	Token      string
	Timeout    time.Duration
	HTTPClient *http.Client
}

// NewClient creates a FluxService configured by functional options.
func NewFluxService(addr string, opts *FluxServiceOptions) (*FluxService, error) {
	srv := &FluxService{
		Options: opts,
	}

	fluxOpts := influxdb2.DefaultOptions()
	fluxOpts.HTTPOptions().SetHTTPClient(opts.HTTPClient)
	fluxOpts.SetHTTPRequestTimeout(uint(opts.Timeout.Seconds()))

	srv.Client = influxdb2.NewClientWithOptions(addr, opts.Token, fluxOpts)

	return srv, nil
}
