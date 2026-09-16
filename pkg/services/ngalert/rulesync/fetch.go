package rulesync

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/dsproxyclient"
	"github.com/grafana/grafana/pkg/util"
)

// RulerConfig is the namespace-grouped rule configuration returned by a
// Mimir ruler config API — the exact shape the convert API already
// accepts (map[namespace][]PrometheusRuleGroup).
type RulerConfig = map[string][]apimodels.PrometheusRuleGroup

// ErrNotARuler indicates the datasource returned a 2xx response that does not
// parse as namespace-grouped rule configs — i.e. it is not a Mimir ruler config
// API — letting callers distinguish a misconfigured datasource from a fetch
// failure (any non-2xx is classified as a transient fetch error). An empty ruler
// (no rule groups) is NOT an error; see Fetch.
var ErrNotARuler = errors.New("datasource does not expose a Mimir ruler config API")

// rulerSyncLogin identifies this worker in the service-identity user the
// datasource proxy access-checks (surfaced in logs/audit only).
const rulerSyncLogin = "grafana_external_ruler_sync"

// RulerFetcher fetches namespace-grouped rule configs from a Mimir ruler
// datasource by routing the ruler config GET through Grafana's datasource proxy
// service (transport, auth and egress validation are all handled there).
type RulerFetcher struct {
	client *dsproxyclient.Client
}

// NewRulerFetcher constructs a RulerFetcher around the datasource proxy
// service. Mimir serves the ruler config API as YAML.
func NewRulerFetcher(proxy dsproxyclient.Proxy, logger log.Logger) *RulerFetcher {
	return &RulerFetcher{client: dsproxyclient.New(proxy, logger, "config/v1/rules", rulerSyncLogin, "application/yaml")}
}

// Fetch retrieves the ruler configuration from ds, returning the parsed configs
// and the FNV-1a hash of the raw body (for cross-tick dedup). Any non-2xx
// (including a 404) is a fetch failure — the ruler config list API returns 200
// with an empty object when there are no rule groups, so a 404 is never "no
// rules"; a 2xx body that isn't a rule-config object yields ErrNotARuler.
func (f *RulerFetcher) Fetch(ctx context.Context, ds *datasources.DataSource) (RulerConfig, uint64, error) {
	res, err := f.client.Get(ctx, ds)
	if err != nil {
		return nil, 0, err
	}

	// The ruler config list API returns HTTP 200 with an empty object when there
	// are no rule groups (see Mimir's ListRules), so a non-2xx is never "no rules":
	// a 404 here is a proxy-local error (datasource/plugin not found) or an upstream
	// failure, not an empty ruler. Treat every non-2xx as a fetch failure so
	// apply/prune never runs and synced rules aren't wiped.
	if res.Status/100 != 2 {
		return nil, 0, fmt.Errorf("ruler config API returned HTTP %d: %s", res.Status, util.TruncateUTF8(string(res.Body), 1024))
	}

	body := res.Body
	var cfg RulerConfig
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, 0, fmt.Errorf("%w: failed to parse response as ruler config: %v", ErrNotARuler, err)
	}
	// A real ruler returns "{}" (a non-nil empty map) when it has no rule groups. A
	// nil map means the body was empty, null ("null"/"~"), or otherwise not a
	// rule-config object — treating that as "no rules" would prune every synced
	// rule, so reject it as not-a-ruler.
	if cfg == nil {
		return nil, 0, fmt.Errorf("%w: response is empty or null, not a rule-config object", ErrNotARuler)
	}

	h := fnv.New64a()
	_, _ = h.Write(body)
	return cfg, h.Sum64(), nil
}
