package integration

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

//t.Run("Unauthenticated users shouldn't be able to create correlations", func(t *testing.T) {
//	t.Run("non org admin shouldn't be able to create correlations", func(t *testing.T) {
// ditto above for delete
// rbac tests for datasources
