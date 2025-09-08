package auditing

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime/schema"
	auditinternal "k8s.io/apiserver/pkg/apis/audit"
	"k8s.io/apiserver/pkg/audit"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// PolicyRuleEvaluator alias for easier imports.
type PolicyRuleEvaluator = audit.PolicyRuleEvaluator

// UnionPolicyRuleEvaluator dispatches to the specific PolicyRuleEvaluator depending on the API group+version in the request.
type UnionPolicyRuleEvaluator struct {
	evaluators map[schema.GroupVersion]PolicyRuleEvaluator
}

var _ PolicyRuleEvaluator = &UnionPolicyRuleEvaluator{}

func NewUnionPolicyRuleEvaluator(evaluators map[schema.GroupVersion]PolicyRuleEvaluator) *UnionPolicyRuleEvaluator {
	return &UnionPolicyRuleEvaluator{evaluators}
}

func (e *UnionPolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	evaluator, ok := e.evaluators[schema.GroupVersion{Group: attrs.GetAPIGroup(), Version: attrs.GetAPIVersion()}]
	if !ok {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return evaluator.EvaluatePolicyRule(attrs)
}

// DefaultGrafanaPolicyRuleEvaluator provides a sane default configuration for audit logging for API group+versions.
// It logs all resource requests (at the `ResponseComplete` stage) except for watch requests.
type defaultGrafanaPolicyRuleEvaluator struct{}

var _ PolicyRuleEvaluator = &defaultGrafanaPolicyRuleEvaluator{}

func NewDefaultGrafanaPolicyRuleEvaluator() defaultGrafanaPolicyRuleEvaluator {
	return defaultGrafanaPolicyRuleEvaluator{}
}

func (defaultGrafanaPolicyRuleEvaluator) EvaluatePolicyRule(attrs authorizer.Attributes) audit.RequestAuditConfig {
	// Skip non-resource and watch requests otherwise it is too noisy.
	if !attrs.IsResourceRequest() || attrs.GetVerb() == utils.VerbWatch {
		return audit.RequestAuditConfig{
			Level: auditinternal.LevelNone,
		}
	}

	return audit.RequestAuditConfig{
		Level: auditinternal.LevelMetadata,
		OmitStages: []auditinternal.Stage{
			auditinternal.StageRequestReceived,
			auditinternal.StageResponseStarted,
			auditinternal.StagePanic,
		},
		OmitManagedFields: true,
	}
}
