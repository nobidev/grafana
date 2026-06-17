package annotation

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AnnotationKeyLegacyData carries the legacy annotation API's free-form `data`
// JSON blob during migration. It is stored as an object annotation rather than a
// label because the value is arbitrary JSON. This is a transitional compatibility
// concern and should be removed once the legacy `data` field is retired.
const AnnotationKeyLegacyData = "grafana.app/legacyData"

// getLegacyData reads the raw legacy data JSON from the object's annotations.
// Returns an empty string if absent.
func getLegacyData(obj metav1.Object) string {
	annotations := obj.GetAnnotations()
	if annotations == nil {
		return ""
	}
	return annotations[AnnotationKeyLegacyData]
}

// setLegacyData writes the raw legacy data JSON onto the object's annotations.
// Empty input is a no-op so we never persist an empty annotation.
func setLegacyData(obj metav1.Object, data string) {
	if data == "" {
		return
	}
	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string, 1)
	}
	annotations[AnnotationKeyLegacyData] = data
	obj.SetAnnotations(annotations)
}
