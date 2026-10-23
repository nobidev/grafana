package webhook

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func TestIntegrationProvisioning_Webhook(t *testing.T) {
	for _, tt := range []struct {
		provider  webhooksuite.Provider
		newHelper func(t *testing.T) *common.GitTestHelper
	}{
		{githubMock, githubHelper},
	} {
		t.Run(tt.provider.Name(), func(t *testing.T) {
			webhooksuite.Run(t, tt.newHelper, tt.provider)
		})
	}
}
