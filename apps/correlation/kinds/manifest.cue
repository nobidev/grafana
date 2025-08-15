package kinds

manifest: {
	appName:          "correlation"
	groupOverride:    "correlation.grafana.app"
	preferredVersion: "v0alpha1"

	codegen: {
		go: {
			enabled: true
		}
		ts: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": {
			kinds: [
				correlationv0alpha1,
			]
		}
	}
}