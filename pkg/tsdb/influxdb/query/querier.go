package query

import (
	"context"

	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type QueryReturn interface {
	*api.QueryTableResult | *flight.FlightInfo
}

type Querier[T QueryReturn] interface {
	Do(ctx context.Context, query string) (T, error)
	Close() error
}
