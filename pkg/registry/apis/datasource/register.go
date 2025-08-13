package datasource

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	datasources ScopedPluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
	reg prometheus.Registerer,
	extensionGetter OpenAPIExtensionGetter,
) (*DataSourceAPIBuilder, error) {
	// We want to expose just a limited set of plugins
	explictPluginList := features.IsEnabledGlobally(featuremgmt.FlagDatasourceAPIServers)

	// This requires devmode!
	if !explictPluginList && !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	var err error
	var builder *DataSourceAPIBuilder
	all := pluginStore.Plugins(context.Background(), plugins.TypeDataSource)
	ids := []string{
		"grafana-testdata-datasource",
		"prometheus",
		"graphite",
	}

	for _, ds := range all {
		if explictPluginList && !slices.Contains(ids, ds.ID) {
			continue // skip this one
		}

		if !ds.Backend {
			continue // skip frontend only plugins
		}

		builder, err = NewDataSourceAPIBuilder(ds.JSONData,
			pluginClient,
			datasources.GetDatasourceProvider(ds.JSONData),
			contextProvider,
			accessControl,
			features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryTypes),
			extensionGetter,
		)
		if err != nil {
			return nil, err
		}

		builder.specProvider = builder.GetSpecProvider()

		apiRegistrar.RegisterAPI(builder)
	}
	return builder, nil // only used for wire
}
