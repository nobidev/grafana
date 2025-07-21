package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

type SQLQueryModel struct {
	*sqlutil.Query
}

// SQLQueryRequest is an inbound query request as part of a batch of queries sent
// to [(*FlightSQLDatasource).QueryData].
type SQLQueryRequest struct {
	RefID                string `json:"refId"`
	RawQuery             string `json:"rawSql"`
	IntervalMilliseconds int    `json:"intervalMs"`
	MaxDataPoints        int64  `json:"maxDataPoints"`
	Format               string `json:"format"`
}

func NewSQLQueryModel(dataQuery backend.DataQuery) (*SQLQueryModel, error) {
	var q SQLQueryRequest
	if err := json.Unmarshal(dataQuery.JSON, &q); err != nil {
		return nil, fmt.Errorf("unmarshal json: %w", err)
	}

	var format sqlutil.FormatQueryOption
	switch q.Format {
	case "time_series":
		format = sqlutil.FormatOptionTimeSeries
	case "table":
		format = sqlutil.FormatOptionTable
	default:
		format = sqlutil.FormatOptionTimeSeries
	}

	query := &sqlutil.Query{
		RawSQL:        q.RawQuery,
		RefID:         q.RefID,
		MaxDataPoints: q.MaxDataPoints,
		Interval:      time.Duration(q.IntervalMilliseconds) * time.Millisecond,
		TimeRange:     dataQuery.TimeRange,
		Format:        format,
	}

	// Process macros and generate raw fsql to be sent to
	// influxdb backend for execution.
	// sql, err := sqlutil.Interpolate(query, flightsql.Macros)
	// if err != nil {
	// 	return nil, fmt.Errorf("macro interpolation: %w", err)
	// }
	// query.RawSQL = sql

	return &SQLQueryModel{query}, nil
}
