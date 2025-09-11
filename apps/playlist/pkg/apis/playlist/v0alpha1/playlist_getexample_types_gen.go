// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetExample struct {
	Id      *string `json:"id,omitempty"`
	Message string  `json:"message"`
}

// NewGetExample creates a new GetExample object.
func NewGetExample() *GetExample {
	return &GetExample{}
}
