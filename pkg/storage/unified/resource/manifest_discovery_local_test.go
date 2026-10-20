package resource

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// The local watcher reads the router's list through LocalManifestDiscovery,
// waits for the router to be set, and keeps retrying while the router has not
// published any manifests yet.
func TestLocalManifestWatcher_ReadsDiscoveryOnceRouterPublishes(t *testing.T) {
	var published atomic.Bool
	var withIdentity atomic.Bool
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		require.Equal(t, "/apis/discovery/v1alpha2/manifests", req.URL.Path)
		if _, err := identity.GetRequester(req.Context()); err == nil {
			withIdentity.Store(true)
		}
		list := map[string]any{"apiVersion": "apps.grafana.app/v1alpha2", "kind": "AppManifestList", "metadata": map[string]any{}, "items": []any{}}
		if published.Load() {
			list["items"] = []any{testAppManifestObj("folder.grafana.app", "folders", "folder.grafana.app", "Folder", "title").Object}
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(list))
	})

	discovery := ProvideLocalManifestDiscovery()
	got := make(chan []*app.ManifestData, 1)
	w, err := NewLocalManifestWatcher(discovery, prometheus.NewPedanticRegistry(), func(m []*app.ManifestData) { got <- m }, nil)
	require.NoError(t, err)
	require.NoError(t, w.StartAsync(t.Context()))
	t.Cleanup(func() { w.StopAsync() })

	discovery.Set(handler)
	require.Eventually(t, func() bool { return w.State().String() == "Running" }, 5*time.Second, 10*time.Millisecond)
	require.Empty(t, w.Manifests())

	published.Store(true)
	select {
	case m := <-got:
		require.Len(t, m, 1)
		require.Equal(t, "folder.grafana.app", m[0].Group)
	case <-time.After(3 * manifestRetryMin):
		t.Fatal("watcher did not retry after an empty first poll")
	}
	require.True(t, withIdentity.Load(), "requests must carry the service identity")
}
