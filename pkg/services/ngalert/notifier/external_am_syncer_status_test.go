package notifier

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	adminconfigv0alpha1 "github.com/grafana/grafana/apps/alerting/adminconfig/pkg/apis/alertingadminconfig/v0alpha1"
)

func TestComputeSyncStatus(t *testing.T) {
	const now int64 = 1_700_000_000
	const earlier int64 = 1_600_000_000

	strPtr := func(s string) *string { return &s }
	originPtr := func(o adminconfigv0alpha1.AdminConfigSyncStatusOrigin) *adminconfigv0alpha1.AdminConfigSyncStatusOrigin {
		return &o
	}
	intPtr := func(i int64) *int64 { return &i }

	t.Run("success from clean state sets lastSuccessAt and clears error fields", func(t *testing.T) {
		got := computeSyncStatus(nil, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil, now)

		assert.Equal(t, strPtr("uid-a"), got.DatasourceUid)
		assert.Equal(t, originPtr(adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec), got.Origin)
		assert.Equal(t, intPtr(now), got.LastSuccessAt)
		assert.Nil(t, got.LastError)
		assert.Nil(t, got.FailingSince)
	})

	t.Run("failure from clean state sets lastError and failingSince", func(t *testing.T) {
		got := computeSyncStatus(nil, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, errors.New("fetch broke"), now)

		assert.Equal(t, strPtr("uid-a"), got.DatasourceUid)
		assert.Equal(t, strPtr("fetch broke"), got.LastError)
		assert.Equal(t, intPtr(now), got.FailingSince)
		assert.Nil(t, got.LastSuccessAt)
	})

	t.Run("consecutive failures preserve the original failingSince", func(t *testing.T) {
		prev := &adminconfigv0alpha1.AdminConfigSyncStatus{
			DatasourceUid: strPtr("uid-a"),
			LastError:     strPtr("first failure"),
			FailingSince:  intPtr(earlier),
		}

		got := computeSyncStatus(prev, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, errors.New("second failure"), now)

		assert.Equal(t, strPtr("second failure"), got.LastError)
		assert.Equal(t, intPtr(earlier), got.FailingSince, "failingSince should mark when the streak began, not the latest failure")
	})

	t.Run("failure after a prior success preserves lastSuccessAt and sets fresh failingSince", func(t *testing.T) {
		prev := &adminconfigv0alpha1.AdminConfigSyncStatus{
			DatasourceUid: strPtr("uid-a"),
			LastSuccessAt: intPtr(earlier),
		}

		got := computeSyncStatus(prev, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, errors.New("transient"), now)

		assert.Equal(t, intPtr(earlier), got.LastSuccessAt)
		assert.Equal(t, intPtr(now), got.FailingSince)
		assert.Equal(t, strPtr("transient"), got.LastError)
	})

	t.Run("success after a failure clears lastError and failingSince and advances lastSuccessAt", func(t *testing.T) {
		prev := &adminconfigv0alpha1.AdminConfigSyncStatus{
			DatasourceUid: strPtr("uid-a"),
			LastError:     strPtr("was broken"),
			FailingSince:  intPtr(earlier),
		}

		got := computeSyncStatus(prev, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil, now)

		assert.Nil(t, got.LastError, "lastError must be cleared on recovery")
		assert.Nil(t, got.FailingSince, "failingSince must be cleared on recovery")
		assert.Equal(t, intPtr(now), got.LastSuccessAt)
	})

	t.Run("origin is propagated regardless of outcome", func(t *testing.T) {
		gotSuccess := computeSyncStatus(nil, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginOperator, nil, now)
		gotFailure := computeSyncStatus(nil, "uid-a", adminconfigv0alpha1.AdminConfigSyncStatusOriginOperator, errors.New("x"), now)

		assert.Equal(t, originPtr(adminconfigv0alpha1.AdminConfigSyncStatusOriginOperator), gotSuccess.Origin)
		assert.Equal(t, originPtr(adminconfigv0alpha1.AdminConfigSyncStatusOriginOperator), gotFailure.Origin)
	})

	t.Run("datasourceUid reflects the attempted UID, not the prior one", func(t *testing.T) {
		prev := &adminconfigv0alpha1.AdminConfigSyncStatus{
			DatasourceUid: strPtr("old-uid"),
			LastSuccessAt: intPtr(earlier),
		}

		got := computeSyncStatus(prev, "new-uid", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil, now)

		assert.Equal(t, strPtr("new-uid"), got.DatasourceUid)
	})
}
