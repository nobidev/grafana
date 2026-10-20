package resource

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/infra/log"
)

// localManifestPollInterval is how often in-process storage re-reads the
// router's manifests. The call never leaves the process, so it can run far more
// often than a poll of a remote server.
const localManifestPollInterval = time.Minute

// LocalManifestDiscovery is an http.RoundTripper that serves the router's
// /apis/discovery tree in-process, so storage running inside Grafana reads the
// same manifests a remote client would, without a listener or token exchange.
// The router depends on the resource client, so it supplies its handler after
// construction via Set; requests wait until then.
type LocalManifestDiscovery struct {
	ready chan struct{}
	once  sync.Once
	serve func(*http.Request) (*http.Response, error)
}

func ProvideLocalManifestDiscovery() *LocalManifestDiscovery {
	return &LocalManifestDiscovery{ready: make(chan struct{})}
}

// Set supplies the handler for the /apis/discovery tree. Later calls are ignored.
func (d *LocalManifestDiscovery) Set(handler http.Handler) {
	d.once.Do(func() {
		d.serve = responsewriter.WrapHandler(handler)
		close(d.ready)
	})
}

// RoundTrip serves req as the Grafana service identity, which the router
// accepts in place of an access token.
func (d *LocalManifestDiscovery) RoundTrip(req *http.Request) (*http.Response, error) {
	select {
	case <-d.ready:
	case <-req.Context().Done():
		return nil, fmt.Errorf("waiting for the router's manifest discovery: %w", req.Context().Err())
	}
	return d.serve(req.WithContext(identity.WithServiceIdentityContext(req.Context(), 0)))
}

// NewLocalManifestWatcher creates a ManifestWatcher that reads only the
// router's discovery manifests through d. The router is wired after storage
// and fills the set on its first reconcile, so the initial poll usually finds
// nothing; the watcher retries quickly until it lists a set. Start it with
// StartAsync: waiting for Running would block on the router.
func NewLocalManifestWatcher(d *LocalManifestDiscovery, reg prometheus.Registerer, onChange func([]*app.ManifestData), logger log.Logger) (*ManifestWatcher, error) {
	client, err := dynamic.NewForConfig(&rest.Config{
		// The host is never dialed; the transport serves every request.
		Host:      "http://localhost",
		APIPath:   "/apis",
		Timeout:   manifestPollTimeout,
		Transport: d,
	})
	if err != nil {
		return nil, fmt.Errorf("creating local discovery dynamic client: %w", err)
	}
	w := newManifestWatcher([]manifestSource{{name: manifestSourceDiscovery, client: client, gvr: ManifestDiscoveryGVR}}, localManifestPollInterval, onChange, logger)
	w.metrics = newManifestWatcherMetrics(reg)
	w.Service = services.NewBasicService(w.starting, w.running, nil)
	return w, nil
}
