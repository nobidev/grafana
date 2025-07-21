package query

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/services"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

// FluxQuerier is a querier for executing Flux queries against InfluxDB.
type FluxQuerier struct {
	Querier[*api.QueryTableResult]

	// Service is the Flux service used to execute queries.
	Service *services.FluxService

	// dsInfo holds the datasource information for the InfluxDB instance.
	dsInfo *models.DatasourceInfo
}

// NewFluxQuerier creates a new FluxQuerier instance.
func NewFluxQuerier(dsInfo *models.DatasourceInfo) (*FluxQuerier, error) {
	if dsInfo.URL == "" {
		return nil, fmt.Errorf("missing URL in datasource configuration")
	}

	if dsInfo.Organization == "" {
		return nil, fmt.Errorf("missing organization in datasource configuration")
	}

	opts := &services.FluxServiceOptions{
		Token:      dsInfo.Token,
		Timeout:    dsInfo.Timeout,
		HTTPClient: dsInfo.HTTPClient,
	}

	service, err := services.NewFluxService(dsInfo.URL, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to create Flux service: %w", err)
	}

	return &FluxQuerier{Service: service, dsInfo: dsInfo}, nil
}

// RunQuery executes a Flux query against the InfluxDB instance.
func (fq *FluxQuerier) Do(ctx context.Context, query string) (*api.QueryTableResult, error) {
	qa := fq.Service.Client.QueryAPI(fq.dsInfo.Organization)
	if qa == nil {
		return nil, fmt.Errorf("failed to create query API client")
	}
	return qa.Query(ctx, query)
}

// Close closes the InfluxDB client connection.
func (fq *FluxQuerier) Close() error {
	if fq.Service.Client != nil {
		fq.Service.Client.Close()
	}
	return nil
}
