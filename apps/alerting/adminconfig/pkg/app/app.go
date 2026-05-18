package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/adminconfig/pkg/apis/alertingadminconfig/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "alerting.adminconfig",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{Kind: v0alpha1.AdminConfigKind()},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return a, nil
}
