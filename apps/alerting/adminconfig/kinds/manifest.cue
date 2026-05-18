package kinds

manifest: {
	appName:       "alerting-adminconfig"
	groupOverride: "adminconfig.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				adminConfigv0alpha1,
			]
		}
	}
	roles: {}
}
