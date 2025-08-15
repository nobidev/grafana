// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CorrelationSpec struct {
	SourceUid   string `json:"source_uid"`
	TargetUid   string `json:"target_uid"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Config      string `json:"config"`
	Provisioned int64  `json:"provisioned"`
	Type        string `json:"type"`
}

// NewCorrelationSpec creates a new CorrelationSpec object.
func NewCorrelationSpec() *CorrelationSpec {
	return &CorrelationSpec{}
}
