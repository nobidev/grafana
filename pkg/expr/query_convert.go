package expr

import (
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

func convertBackendQueryToDataQuery(q backend.DataQuery) (data.DataQuery, error) {
	// we first restore it from the raw json data,
	// this should take care of all datasource-specific (for example, specific
	// for prometheus or loki) fields
	var dataQuery data.DataQuery
	err := json.Unmarshal(q.JSON, &dataQuery)
	if err != nil {
		return data.DataQuery{}, err
	}

	// then we override the result with values that are available as fields in backend.DataQuery
	dataQuery.RefID = q.RefID
	dataQuery.QueryType = q.QueryType
	dataQuery.MaxDataPoints = q.MaxDataPoints
	dataQuery.IntervalMS = float64(q.Interval.Nanoseconds()) / 1000000.0
	dataQuery.TimeRange = &data.TimeRange{
		From: strconv.FormatInt(q.TimeRange.From.UnixMilli(), 10),
		To:   strconv.FormatInt(q.TimeRange.To.UnixMilli(), 10),
	}

	return dataQuery, nil
}

func ConvertBackendRequestToDataRequest(req *backend.QueryDataRequest) (*data.QueryDataRequest, error) {
	// all requests are required to have a timeRange field, even if it's nested in the queries:
	// public spec: https://grafana.com/docs/grafana/latest/developers/http_api/data_source/#query-a-data-source
	// later in the sdk we use these top level time ranges and move them to inside the queries
	// https://github.com/grafana/grafana-plugin-sdk-go/blob/8b1caaf3866a17dbddbaf9fd20cd0a7b11cc3c24/experimental/apis/data/v0alpha1/conversions.go#L14-L23
	// if requests are grouped by datasource they must also be grouped by time range, so that it is safe to use the first nested query's time range
	k8sReq := &data.QueryDataRequest{
		TimeRange: data.TimeRange{
			From: req.Queries[0].TimeRange.From.String(),
			To:   req.Queries[0].TimeRange.To.String(),
		},
	}

	for _, q := range req.Queries {
		dataQuery, err := convertBackendQueryToDataQuery(q)
		if err != nil {
			return nil, err
		}

		k8sReq.Queries = append(k8sReq.Queries, dataQuery)
	}

	return k8sReq, nil
}
