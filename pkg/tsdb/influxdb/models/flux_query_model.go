package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// FluxQueryOptions represents datasource configuration options
type FluxQueryOptions struct {
	Bucket        string `json:"bucket"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
}

// FluxQueryModel represents a query.
type FluxQueryModel struct {
	RawQuery string           `json:"query"`
	Options  FluxQueryOptions `json:"options"`

	// Not from JSON
	TimeRange     backend.TimeRange `json:"-"`
	MaxDataPoints int64             `json:"-"`
	MaxSeries     int               `json:"-"`
	Interval      time.Duration     `json:"-"`
}

func NewFluxQueryModel(query backend.DataQuery, timeRange backend.TimeRange,
	dsInfo *DatasourceInfo) (*FluxQueryModel, error) {
	model := &FluxQueryModel{}
	if err := json.Unmarshal(query.JSON, model); err != nil {
		return nil, fmt.Errorf("error reading query: %w", err)
	}
	if model.Options.DefaultBucket == "" {
		model.Options.DefaultBucket = dsInfo.DefaultBucket
	}
	if model.Options.Bucket == "" {
		model.Options.Bucket = model.Options.DefaultBucket
	}
	if model.Options.Organization == "" {
		model.Options.Organization = dsInfo.Organization
	}

	// Copy directly from the well typed query
	model.TimeRange = timeRange
	model.MaxDataPoints = query.MaxDataPoints
	if model.MaxDataPoints == 0 {
		model.MaxDataPoints = 10000 // 10k/series should be a reasonable place to abort!
	}
	model.Interval = query.Interval
	if model.Interval.Milliseconds() == 0 {
		model.Interval = time.Millisecond // 1ms
	}
	return model, nil
}
