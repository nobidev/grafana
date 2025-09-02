package correlation

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	correlation "github.com/grafana/grafana/apps/correlation/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	correlationsvc "github.com/grafana/grafana/pkg/services/correlations"
)

/*func LegacyUpdateCommandToUnstructured(cmd correlationsvc.UpdateCorrelationCommand) unstructured.Unstructured {
	items := []map[strng]string{}
	for _, item := range cmd.Items {
		items = append(items, map[string]string{
			"type":  item.Type,
			"value": item.Value,
		})
	}
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":    cmd.Name,
				"interval": cmd.Interval,
				"items":    items,
			},
		},
	}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}
	obj.SetName(cmd.UID)
	return obj
}

func UnstructuredToLegacyPlaylist(item unstructured.Unstructured) *playlistsvc.Playlist {
	spec := item.Object["spec"].(map[string]any)
	return &playlistsvc.Playlist{
		UID:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
}

func UnstructuredToLegacyPlaylistDTO(item unstructured.Unstructured) *playlistsvc.PlaylistDTO {
	spec := item.Object["spec"].(map[string]any)
	dto := &playlistsvc.PlaylistDTO{
		Uid:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
	items := spec["items"]
	if items != nil {
		b, err := json.Marshal(items)
		if err == nil {
			_ = json.Unmarshal(b, &dto.Items)
		}
	}
	return dto
}*/

func convertToK8sResource(v correlationsvc.Correlation, namespacer request.NamespaceMapper) *correlation.Correlation {
	spec := correlation.CorrelationSpec{
		SourceUid: v.SourceUID,
		TargetUid: *v.TargetUID,
		Label: v.Label,
		Description: v.Description,
		Config: correlation.CorrelationConfigSpec{
			Field: v.Config.Field,
			Target: v.Config.Target,
			Transformations: make([]correlation.CorrelationTransformationSpec, 0, len(v.Config.Transformations)),
		},
		Provisioned: v.Provisioned,
		Type: correlation.CorrelationCorrelationType(v.Type),
	}

		for _, transformation := range v.Config.Transformations {
		spec.Config.Transformations = append(spec.Config.Transformations, correlation.CorrelationTransformationSpec{
			Type: transformation.Type,
			Expression: transformation.Expression,
			Field: transformation.Field,
			MapValue: transformation.MapValue,
		})
	}

	c := &correlation.Correlation{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			UID:               types.UID(v.UID),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: spec,
	}
	
	return c
}

func convertToLegacyUpdateCommand(c *correlation.Correlation, orgId int64) (*correlationsvc.UpdateCorrelationCommand, error) {
	spec := c.Spec
	cmd := &correlationsvc.UpdateCorrelationCommand{
		UID: c.Name,
		SourceUID: spec.SourceUid,
		OrgId: orgId,
		Label: spec.Label,
		Description: spec.Description,
		Config: &correlationsvc.CorrelationConfigUpdateDTO{
			Field: spec.Config.Field,
			Target: (map[string]any)(spec.Config.Target),
			Transformations: make([]correlationsvc.Transformation, 0, len(spec.Config.Transformations)),
		},
		Type: (correlationsvc.CorrelationType)(spec.Type),
	}
	for _, transformation := range spec.Config.Transformations {
		cmd.Config.Transformations = append(cmd.Config.Transformations, correlationsvc.Transformation{
			Type: transformation.Type,
			Expression: transformation.Expression,
			Field: transformation.Field,
			MapValue: transformation.MapValue,
		})
	}
	return cmd, nil
}

// Read legacy ID from metadata annotations
func getLegacyID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}
