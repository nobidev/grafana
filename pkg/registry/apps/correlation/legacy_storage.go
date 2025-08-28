package correlation

import (
	"context"
	"errors"
	"fmt"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	correlation "github.com/grafana/grafana/apps/correlation/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	correlationsvc "github.com/grafana/grafana/pkg/services/correlations"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        correlationsvc.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return correlation.CorrelationKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(correlation.CorrelationKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return correlation.CorrelationKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetCorrelations(ctx, correlationsvc.GetCorrelationsQuery{
		OrgId: info.OrgID,
		Page:  1,
		Limit: 100000, // arbitrary large number to get all correlations
	})
	if err != nil {
		return nil, err
	}

	list := &correlation.CorrelationList{}
	for _, cor := range res.Correlations {
		list.Items = append(list.Items, correlationsvc.ConvertToK8sResource(cor, s.namespacer))
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	c, err := s.service.GetCorrelation(ctx, correlationsvc.GetCorrelationQuery{
		UID:   name,
		OrgId: info.OrgID,
	})
	if err != nil {
		if errors.Is(err, correlationsvc.ErrCorrelationNotFound) || err == nil {
			err = k8serrors.NewNotFound(schema.GroupResource{
				Group:    correlation.CorrelationKind().Group(),
				Resource: correlation.CorrelationKind().Plural(),
			}, name)
		}
		return nil, err
	}

	obj := correlationsvc.ConvertToK8sResource(c, s.namespacer)
	return &obj, nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	c, ok := obj.(*correlation.Correlation)
	if !ok {
		return nil, fmt.Errorf("expected correlation?")
	}

	out, err := s.service.CreateCorrelation(ctx, correlationsvc.ConvertToLegacyCreateCommand(c, info.OrgID))
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.UID, nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}
	p, ok := obj.(*correlation.Correlation)
	if !ok {
		return nil, created, fmt.Errorf("expected correlation after update")
	}

	r, err := s.service.UpdateCorrelation(ctx, correlationsvc.ConvertToLegacyUpdateCommand(p, info.OrgID))
	if err != nil {
		return nil, false, err
	}

	converted := correlationsvc.ConvertToK8sResource(r, s.namespacer)
	return &converted, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	p, ok := v.(*correlation.Correlation)
	if !ok {
		return v, false, fmt.Errorf("expected a correlation response from Get")
	}
	err = s.service.DeleteCorrelation(ctx, correlationsvc.DeleteCorrelationCommand{
		UID:   name,
		OrgId: info.OrgID,
	})
	return p, true, err // true is instant delete
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for correlationS not implemented")
}