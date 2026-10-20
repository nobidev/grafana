package resource

import (
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
)

// localManifestPollInterval is how often in-process storage re-reads the
// router's manifests. The call never leaves the process, so it can run far more
// often than a poll of a remote server.
const localManifestPollInterval = time.Minute

// NewLocalManifestWatcher creates a ManifestWatcher that reads only the
// manifests the router publishes, through discovery. The router is wired after
// storage and fills the set on its first reconcile, so the initial poll usually
// finds nothing; the watcher retries quickly until it lists a set. Start it
// with StartAsync: waiting for Running would block on the router.
func NewLocalManifestWatcher(discovery ManifestDiscovery, reg prometheus.Registerer, onChange func([]*app.ManifestData), logger log.Logger) *ManifestWatcher {
	w := newManifestWatcher([]manifestSource{discoveryManifestSource(discovery)}, localManifestPollInterval, onChange, logger)
	w.metrics = newManifestWatcherMetrics(reg)
	w.Service = services.NewBasicService(w.starting, w.running, nil)
	return w
}
