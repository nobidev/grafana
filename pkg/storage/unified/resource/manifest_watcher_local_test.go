package resource

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

type fakeManifestDiscovery struct {
	items atomic.Pointer[[]appmanifestv1alpha2.AppManifest]
}

func (f *fakeManifestDiscovery) List(context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	list := &appmanifestv1alpha2.AppManifestList{}
	if items := f.items.Load(); items != nil {
		list.Items = *items
	}
	return list, nil
}

func (f *fakeManifestDiscovery) Get(context.Context, string) (*appmanifestv1alpha2.AppManifest, error) {
	return nil, nil
}

func testTypedAppManifest(t *testing.T, name, appName, group, kind string, searchFields ...string) appmanifestv1alpha2.AppManifest {
	t.Helper()
	body, err := json.Marshal(testAppManifestObj(name, appName, group, kind, searchFields...).Object)
	require.NoError(t, err)
	var m appmanifestv1alpha2.AppManifest
	require.NoError(t, json.Unmarshal(body, &m))
	return m
}

// The local watcher waits for the router to be set, and keeps retrying while
// the router has not published any manifests yet.
func TestLocalManifestWatcher_ReadsDiscoveryOnceRouterPublishes(t *testing.T) {
	eventual := ProvideEventualManifestDiscovery()
	got := make(chan []*app.ManifestData, 1)
	w := NewLocalManifestWatcher(eventual, prometheus.NewPedanticRegistry(), func(m []*app.ManifestData) { got <- m }, nil)
	require.NoError(t, w.StartAsync(t.Context()))
	t.Cleanup(func() { w.StopAsync() })

	router := &fakeManifestDiscovery{}
	eventual.Set(router)
	require.Eventually(t, func() bool { return w.State().String() == "Running" }, 5*time.Second, 10*time.Millisecond)
	require.Empty(t, w.Manifests())

	items := []appmanifestv1alpha2.AppManifest{testTypedAppManifest(t, "folder.grafana.app", "folders", "folder.grafana.app", "Folder", "title")}
	router.items.Store(&items)
	select {
	case m := <-got:
		require.Len(t, m, 1)
		require.Equal(t, "folder.grafana.app", m[0].Group)
		require.Equal(t, "title", m[0].Versions[0].Kinds[0].SearchFields[0].Name)
	case <-time.After(3 * manifestRetryMin):
		t.Fatal("watcher did not retry after an empty first poll")
	}
}
