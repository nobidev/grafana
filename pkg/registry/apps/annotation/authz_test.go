package annotation

import (
	"context"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	registryrest "k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// fakeAccessClient delegates Check decisions to fn allowing per-request allow/deny control in tests.
type fakeAccessClient struct {
	fn func(req authtypes.CheckRequest) bool
}

func (c *fakeAccessClient) Check(_ context.Context, _ authtypes.AuthInfo, req authtypes.CheckRequest, _ string) (authtypes.CheckResponse, error) {
	return authtypes.CheckResponse{Allowed: c.fn(req)}, nil
}

func (c *fakeAccessClient) Compile(_ context.Context, _ authtypes.AuthInfo, _ authtypes.ListRequest) (authtypes.ItemChecker, authtypes.Zookie, error) {
	return nil, nil, nil
}

func (c *fakeAccessClient) BatchCheck(_ context.Context, _ authtypes.AuthInfo, _ authtypes.BatchCheckRequest) (authtypes.BatchCheckResponse, error) {
	return authtypes.BatchCheckResponse{}, nil
}

func TestCanAccessAnnotation(t *testing.T) {
	ns := "org-1"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	var captured authtypes.CheckRequest
	accessClient := &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
		captured = req
		return true
	}}

	t.Run("org annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "annotation.grafana.app", captured.Group)
		assert.Equal(t, "annotations", captured.Resource)
		assert.Equal(t, "organization", captured.Name)
		assert.Equal(t, ns, captured.Namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
		assert.Equal(t, "", captured.Subresource)
	})

	t.Run("dashboard annotation", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{Name: "dash-anno", Namespace: ns},
			Spec:       annotationV0.AnnotationSpec{DashboardUID: &dashUID},
		}
		allowed, err := canAccessAnnotation(ctx, accessClient, ns, anno, utils.VerbGet)
		require.NoError(t, err)
		require.True(t, allowed)

		assert.Equal(t, "dashboard.grafana.app", captured.Group)
		assert.Equal(t, "dashboards", captured.Resource)
		assert.Equal(t, "annotations", captured.Subresource)
		assert.Equal(t, dashUID, captured.Name)
		assert.Equal(t, ns, captured.Namespace)
		assert.Equal(t, utils.VerbGet, captured.Verb)
	})
}

func TestK8sRESTAdapter_UpdateScopeEscalation(t *testing.T) {
	const ns = "org-1"
	dashUID := "dash-abc"

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), ns)

	orgAnno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{Name: "org-anno", Namespace: ns},
	}

	store := NewMemoryStore()
	_, err := store.Create(ctx, orgAnno)
	require.NoError(t, err)

	// Allow writes on org annotations (annotation.grafana.app) but deny on dashboard scope.
	// The update attempts to move an org annotation onto a dashboard the caller cannot write.
	adapter := &k8sRESTAdapter{
		store: store,
		accessClient: &fakeAccessClient{fn: func(req authtypes.CheckRequest) bool {
			return req.Group == "annotation.grafana.app"
		}},
	}

	orgAnno.Spec.DashboardUID = &dashUID
	_, _, err = adapter.Update(ctx, orgAnno.Name, registryrest.DefaultUpdatedObjectInfo(orgAnno), nil, nil, false, nil)
	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err))
}
