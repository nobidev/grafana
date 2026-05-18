package adminconfig

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/adminconfig/pkg/apis/manifestdata"
	adminconfigApp "github.com/grafana/grafana/apps/alerting/adminconfig/pkg/app"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

// GetAuthorizer permits all requests for now. The resource is gated behind an
// experimental feature flag and an admin-only RBAC policy belongs here before
// the flag graduates — see ticket zma-3bpp.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	)
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AppInstaller, error) {
	if ng != nil && ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting AdminConfig apiserver (adminconfig.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}
	//nolint:staticcheck // experimental feature, not yet migrated to OpenFeature
	if ng != nil && !ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingAdminConfigAPI) {
		log.New("app-registry").Info("Skipping Kubernetes Alerting AdminConfig apiserver: feature flag alerting.adminConfigAPI is off")
		return nil, nil
	}

	return NewAppInstaller()
}

func NewAppInstaller() (*AppInstaller, error) {
	installer := &AppInstaller{}

	localManifest := manifestdata.LocalManifest()

	provider := simple.NewAppProvider(localManifest, nil, adminconfigApp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *localManifest.ManifestData,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
