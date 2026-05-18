// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AdminConfigSpec struct {
	// UID of the Mimir/Cortex Alertmanager datasource to sync configuration from.
	// Empty (omitted) means no per-org sync is configured. The operator-level
	// unified_alerting.external_alertmanager_uid ini setting still wins over this
	// when set; see the `status.sync.origin` field to disambiguate.
	ExternalAlertmanagerUid *string `json:"externalAlertmanagerUid,omitempty"`
}

// NewAdminConfigSpec creates a new AdminConfigSpec object.
func NewAdminConfigSpec() *AdminConfigSpec {
	return &AdminConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigSpec.
func (AdminConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigSpec"
}
