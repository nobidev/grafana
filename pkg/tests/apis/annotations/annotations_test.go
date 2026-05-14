package annotations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvr = schema.GroupVersionResource{
	Group:    "annotation.grafana.app",
	Version:  "v0alpha1",
	Resource: "annotations",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnnotationPatch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:           false,
		DisableAnonymous:            true,
		EnableAnnotationAppPlatform: true,
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	ctx := context.Background()

	// Create an annotation
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "annotation.grafana.app/v0alpha1",
			"kind":       "Annotation",
			"metadata": map[string]any{
				"generateName": "a-",
			},
			"spec": map[string]any{
				"text": "original text",
				"time": int64(1700000000000),
				"tags": []any{"tag1", "tag2"},
			},
		},
	}

	created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	name := created.GetName()

	// Verify GET works
	fetched, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
	require.NoError(t, err)
	text, _, _ := unstructured.NestedString(fetched.Object, "spec", "text")
	require.Equal(t, "original text", text)

	// PATCH the text and tags
	patched, err := client.Resource.Patch(ctx, name, types.MergePatchType, []byte(`{
		"spec": {
			"text": "patched text",
			"tags": ["patched"]
		}
	}`), metav1.PatchOptions{})
	require.NoError(t, err)

	patchedText, _, _ := unstructured.NestedString(patched.Object, "spec", "text")
	require.Equal(t, "patched text", patchedText)

	patchedTags, _, _ := unstructured.NestedStringSlice(patched.Object, "spec", "tags")
	require.Equal(t, []string{"patched"}, patchedTags)

	// Verify the PATCH persisted via GET
	fetched, err = client.Resource.Get(ctx, name, metav1.GetOptions{})
	require.NoError(t, err)
	text, _, _ = unstructured.NestedString(fetched.Object, "spec", "text")
	require.Equal(t, "patched text", text)
}
