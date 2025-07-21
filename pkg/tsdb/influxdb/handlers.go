package influxdb

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/flightsql"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/query"
)

// HandleFluxQuery handles Flux queries for InfluxDB data sources.
func HandleFluxQuery(ctx context.Context, dsInfo *models.DatasourceInfo, req backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	qd := backend.NewQueryDataResponse()

	logger.Debug(fmt.Sprintf("received a query request: %d queries, datasource: %d", len(req.Queries), req.PluginContext.DataSourceInstanceSettings.ID))

	querier, err := query.NewFluxQuerier(dsInfo)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	defer func() {
		err := querier.Close()
		if err != nil {
			logger.Warn("failed to close flux client", "err", err)
		}
	}()

	if qd.Responses == nil {
		qd.Responses = make(map[string]backend.DataResponse, len(req.Queries))
	}

	for _, query := range req.Queries {
		qm, err := models.NewFluxQueryModel(query, query.TimeRange, dsInfo)
		if err != nil {
			qd.Responses[query.RefID] = backend.ErrDataResponseWithSource(backend.StatusValidationFailed, backend.ErrorSourceDownstream, fmt.Sprintf("flux: bad request: %s", err))
			continue
		}

		logger.Info(fmt.Sprintf("executing flux: %s", qm.RawQuery))

		// If the default changes also update labels/placeholder in config page.
		maxSeries := dsInfo.MaxSeries

		tables, err := querier.Do(ctx, qm.RawQuery)
		if err != nil {
			var influxHttpError *http.Error
			if errors.As(err, &influxHttpError) {
				dr.ErrorSource = backend.ErrorSourceFromHTTPStatus(influxHttpError.StatusCode)
				dr.Status = backend.Status(influxHttpError.StatusCode)
			}
			logger.Warn("Flux query failed", "err", err, "query", flux)
			qd.Responses[query.RefID] = backend.DataResponse{Error: err}
			continue
		}

		logger.Info(fmt.Sprintf("returned %d records. creating data frame.", tables))

		// qd.Responses[query.RefID] = backend.DataResponse{Frames: res.Frames}
	}

	return qd, nil
}

// HandleSQLQuery handles SQL queries for InfluxDB data sources using FlightSQL.
func HandleSQLQuery(ctx context.Context, dsInfo *models.DatasourceInfo, req backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	qd := backend.NewQueryDataResponse()

	logger.Debug(fmt.Sprintf("received a query request: %d queries, datasource: %d", len(req.Queries), req.PluginContext.DataSourceInstanceSettings.ID))

	querier, err := query.NewSQLQuerier(dsInfo)
	if err != nil {
		return qd, err
	}

	defer func() {
		err := querier.Close()
		if err != nil {
			logger.Warn("failed to close flightsql client", "err", err)
		}
	}()

	if querier.Metadata.Len() != 0 {
		ctx = metadata.NewOutgoingContext(ctx, querier.Metadata)
	}

	for _, q := range req.Queries {
		qm, err := models.NewSQLQueryModel(q)
		if err != nil {
			qd.Responses[q.RefID] = backend.ErrDataResponseWithSource(backend.StatusValidationFailed, backend.ErrorSourceDownstream, fmt.Sprintf("flightsql: bad request: %s", err))
			continue
		}

		logger.Info(fmt.Sprintf("executing SQL: %s", qm.RawSQL))

		result, err := querier.Do(ctx, qm.RawSQL)
		if err != nil {
			qd.Responses[q.RefID] = errorFromGRPCResponse(err)
			return qd, nil
		}

		logger.Info(fmt.Sprintf("returned %d records. creating data frame.", result.Info.TotalRecords))

		frame, err := flightsql.NewFrame(result.Reader.Raw(), *qm.Query, querier.Metadata)
		if err != nil {
			qd.Responses[q.RefID] = backend.ErrDataResponseWithSource(backend.StatusInternal, backend.ErrorSourceDownstream, fmt.Sprintf("flightsql: could not create frame: %s", err))
			continue
		}

		if frame.Rows() == 0 {
			qd.Responses[q.RefID] = backend.DataResponse{Frames: data.Frames{}}
			continue
		}

		qd.Responses[q.RefID] = backend.DataResponse{Frames: data.Frames{frame}}
	}

	return qd, nil
}

// errorFromGRPCResponse creates a backend.DataResponse from an error.
func errorFromGRPCResponse(err error) backend.DataResponse {
	errStr := fmt.Sprintf("flightsql: %s", err)

	st, ok := status.FromError(err)
	if !ok {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("unexpected error: %s", err))
	}

	switch st.Code() {
	case codes.InvalidArgument:
		return backend.ErrDataResponseWithSource(backend.StatusValidationFailed, backend.ErrorSourceDownstream, errStr)
	case codes.PermissionDenied:
		return backend.ErrDataResponseWithSource(backend.StatusForbidden, backend.ErrorSourceDownstream, errStr)
	case codes.NotFound:
		return backend.ErrDataResponseWithSource(backend.StatusNotFound, backend.ErrorSourceDownstream, errStr)
	case codes.Unavailable:
		return backend.ErrDataResponseWithSource(http.StatusServiceUnavailable, backend.ErrorSourceDownstream, errStr)
	default:
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("flightsql: %s", errStr))
	}
}
