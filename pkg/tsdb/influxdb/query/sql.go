package query

import (
	"context"
	"fmt"
	"net/url"

	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flightsql"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/services"
	"google.golang.org/grpc/metadata"
)

// SQLQuerier is a querier for executing SQL queries against InfluxDB using FlightSQL.
type SQLQuerier struct {
	Querier[*flight.FlightInfo]

	Service  *services.SQLService
	Metadata metadata.MD
}

// SQLQuerierResponse is the response type for SQL queries.
type SQLQuerierResponse struct {
	Info    *flight.FlightInfo
	Reader  *flightsql.FlightReader
	Headers metadata.MD
}

// NewSQLQuerier creates a new SQLQuerier instance.
func NewSQLQuerier(dsInfo *models.DatasourceInfo) (*SQLQuerier, error) {
	if dsInfo.URL == "" {
		return nil, fmt.Errorf("missing URL in datasource configuration")
	}

	url, err := parseURLFromConfig(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q: %w", dsInfo.URL, err)
	}

	md := metadata.New(nil)
	if dsInfo.DbName != "" {
		md.Set("database", dsInfo.DbName)
	}
	if dsInfo.Token != "" {
		md.Set("authorization", fmt.Sprintf("Bearer %s", dsInfo.Token))
	}

	opts := &services.SQLServiceOptions{
		Secure:   !dsInfo.InsecureGrpc,
		Proxy:    dsInfo.ProxyClient,
		Metadata: md,
	}

	service, err := services.NewSQLService(url, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to create FlightSQL client: %w", err)
	}

	return &SQLQuerier{Service: service, Metadata: md}, nil
}

// Do runs a SQL query against the InfluxDB instance using the FlightSQL client.
func (sq *SQLQuerier) Do(ctx context.Context, query string) (*SQLQuerierResponse, error) {
	if sq.Service == nil {
		return nil, fmt.Errorf("FlightSQL client is not initialized")
	}

	info, err := sq.Service.Client.Execute(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute SQL query: %w", err)
	}

	if len(info.Endpoint) != 1 {
		return nil, fmt.Errorf("unsupported endpoint count in response: %d", len(info.Endpoint))
	}

	// we use `DoGet` in this manner because we want to get both the headers and the data stream
	stream, err := sq.Service.Client.Client.DoGet(ctx, info.Endpoint[0].Ticket)
	if err != nil {
		return nil, fmt.Errorf("failed to get flight stream: %w", err)
	}

	reader, err := flightsql.NewFlightReader(stream)
	if err != nil {
		return nil, fmt.Errorf("failed to create flight reader: %w", err)
	}

	defer reader.Release()

	headers, err := reader.Header()
	if err != nil {
		logger.Error(fmt.Sprintf("failed to extract headers: %s", err))
	}

	return &SQLQuerierResponse{
		Info:    info,
		Reader:  reader,
		Headers: headers,
	}, nil
}

// Close closes the FlightSQL client connection.
func (sq *SQLQuerier) Close() error {
	if sq.Service != nil {
		return sq.Service.Client.Close()
	}
	return nil
}

// parseURLFromConfig parses the URL from the datasource configuration and returns the address.
// It ensures the URL is valid and returns an error if it is not.
func parseURLFromConfig(endpoint string) (string, error) {
	if endpoint == "" {
		return "", fmt.Errorf("missing URL from datasource configuration")
	}

	u, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("bad URL : %s", err)
	}

	addr := u.Host
	if u.Port() == "" {
		addr += ":443"
	}

	// If the user has specified an address with no scheme it can still be valid
	// So we use the raw URL value
	if u.Host == "" {
		addr = endpoint
	}

	return addr, nil
}
