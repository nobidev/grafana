package kinds

import (
	"github.com/grafana/grafana/apps/alerting/adminconfig/kinds/v0alpha1"
)

adminConfigKind: {
	kind:       "AdminConfig"
	pluralName: "AdminConfigs"
}

adminConfigv0alpha1: adminConfigKind & {
	schema: {
		spec:   v0alpha1.AdminConfigSpec
		status: v0alpha1.AdminConfigStatus
	}
}
