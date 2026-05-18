package v0alpha1

AdminConfigSpec: {
	// UID of the Mimir/Cortex Alertmanager datasource to sync configuration from.
	// Empty (omitted) means no per-org sync is configured. The operator-level
	// unified_alerting.external_alertmanager_uid ini setting still wins over this
	// when set; see the `status.sync.origin` field to disambiguate.
	externalAlertmanagerUid?: string
}

AdminConfigStatus: {
	// Sync block carries the runtime state of the external Alertmanager sync
	// worker for this org. Omitted until the syncer has run at least once.
	sync?: #SyncStatus
}

// SyncStatus reports the most recent external Alertmanager sync attempt for the org.
// Written by the sync worker; clients read only. Tick-by-tick liveness (when the
// last attempt happened) is observable via the syncer's metrics rather than this
// resource — see ExternalAMConfigSyncTotal / ExternalAMConfigSyncDuration.
#SyncStatus: {
	// UID actually used on the last sync run. May differ from
	// `spec.externalAlertmanagerUid` immediately after a spec change, until the
	// next tick. When `origin = "operator"`, this is the operator-ini value.
	datasourceUid?: string

	// Which source supplied datasourceUid on the last run. The operator-level
	// ini setting takes precedence over spec; this field lets clients see when
	// an ini override is in effect without having to know the precedence rule.
	origin?: "spec" | "operator"

	// Unix epoch seconds of the last successful sync attempt. Omitted when
	// no sync has ever succeeded for this org.
	lastSuccessAt?: int

	// Error from the most recent sync attempt. Empty (omitted) when the most
	// recent attempt succeeded.
	lastError?: string

	// Unix epoch seconds at which the current failure streak began. Set on the
	// first failure following a success (or the first attempt if no prior
	// success exists). Cleared on the next successful sync.
	failingSince?: int
}
