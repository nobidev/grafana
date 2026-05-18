// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// SyncStatus reports the most recent external Alertmanager sync attempt for the org.
// Written by the sync worker; clients read only. Tick-by-tick liveness (when the
// last attempt happened) is observable via the syncer's metrics rather than this
// resource — see ExternalAMConfigSyncTotal / ExternalAMConfigSyncDuration.
// +k8s:openapi-gen=true
type AdminConfigSyncStatus struct {
	// UID actually used on the last sync run. May differ from
	// `spec.externalAlertmanagerUid` immediately after a spec change, until the
	// next tick. When `origin = "operator"`, this is the operator-ini value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// Which source supplied datasourceUid on the last run. The operator-level
	// ini setting takes precedence over spec; this field lets clients see when
	// an ini override is in effect without having to know the precedence rule.
	Origin *AdminConfigSyncStatusOrigin `json:"origin,omitempty"`
	// Unix epoch seconds of the last successful sync attempt. Omitted when
	// no sync has ever succeeded for this org.
	LastSuccessAt *int64 `json:"lastSuccessAt,omitempty"`
	// Error from the most recent sync attempt. Empty (omitted) when the most
	// recent attempt succeeded.
	LastError *string `json:"lastError,omitempty"`
	// Unix epoch seconds at which the current failure streak began. Set on the
	// first failure following a success (or the first attempt if no prior
	// success exists). Cleared on the next successful sync.
	FailingSince *int64 `json:"failingSince,omitempty"`
}

// NewAdminConfigSyncStatus creates a new AdminConfigSyncStatus object.
func NewAdminConfigSyncStatus() *AdminConfigSyncStatus {
	return &AdminConfigSyncStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigSyncStatus.
func (AdminConfigSyncStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigSyncStatus"
}

// +k8s:openapi-gen=true
type AdminConfigstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AdminConfigStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAdminConfigstatusOperatorState creates a new AdminConfigstatusOperatorState object.
func NewAdminConfigstatusOperatorState() *AdminConfigstatusOperatorState {
	return &AdminConfigstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigstatusOperatorState.
func (AdminConfigstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigstatusOperatorState"
}

// +k8s:openapi-gen=true
type AdminConfigStatus struct {
	// Sync block carries the runtime state of the external Alertmanager sync
	// worker for this org. Omitted until the syncer has run at least once.
	Sync *AdminConfigSyncStatus `json:"sync,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AdminConfigstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAdminConfigStatus creates a new AdminConfigStatus object.
func NewAdminConfigStatus() *AdminConfigStatus {
	return &AdminConfigStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigStatus.
func (AdminConfigStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigStatus"
}

// +k8s:openapi-gen=true
type AdminConfigSyncStatusOrigin string

const (
	AdminConfigSyncStatusOriginSpec     AdminConfigSyncStatusOrigin = "spec"
	AdminConfigSyncStatusOriginOperator AdminConfigSyncStatusOrigin = "operator"
)

// OpenAPIModelName returns the OpenAPI model name for AdminConfigSyncStatusOrigin.
func (AdminConfigSyncStatusOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigSyncStatusOrigin"
}

// +k8s:openapi-gen=true
type AdminConfigStatusOperatorStateState string

const (
	AdminConfigStatusOperatorStateStateSuccess    AdminConfigStatusOperatorStateState = "success"
	AdminConfigStatusOperatorStateStateInProgress AdminConfigStatusOperatorStateState = "in_progress"
	AdminConfigStatusOperatorStateStateFailed     AdminConfigStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for AdminConfigStatusOperatorStateState.
func (AdminConfigStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.adminconfig.pkg.apis.alertingadminconfig.v0alpha1.AdminConfigStatusOperatorStateState"
}
