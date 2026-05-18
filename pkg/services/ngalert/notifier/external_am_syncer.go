package notifier

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	adminconfigv0alpha1 "github.com/grafana/grafana/apps/alerting/adminconfig/pkg/apis/alertingadminconfig/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

// adminConfigSingletonName is the fixed object name for the singleton-per-org
// AdminConfig resource. Per-org namespacing means each org has exactly one
// resource at this name.
const adminConfigSingletonName = "default"

// mimirConfigResponse is the Mimir/Cortex alertmanager configuration API response.
type mimirConfigResponse struct {
	AlertmanagerConfig string            `yaml:"alertmanager_config" json:"alertmanager_config"`
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
}

// External AM sync failure reasons used as the `reason` label on
// ExternalAMConfigSyncFailures.
const (
	syncReasonDatasourceLookup   = "datasource_lookup"
	syncReasonMimirFetch         = "mimir_fetch"
	syncReasonSave               = "save"
	syncReasonIdentifierMismatch = "identifier_mismatch"
)

// ExternalAMSyncer fetches the alertmanager configuration from an org's external
// Mimir/Cortex datasource. It does not own persistence — callers (MultiOrgAlertmanager
// per-org sync loop) take the returned ExtraConfiguration and persist via
// SaveAndApplyExtraConfiguration, then call MarkSaved to confirm the hash so future
// ticks can dedup.
//
// Per-tick dedup hashes the raw response body and compares against the previous
// successful save's hash, held in memory. The map is per-process: each org pays one
// save per restart before dedup engages, accepted as the cost of avoiding sidecar
// persistence for the hash.
type ExternalAMSyncer struct {
	adminConfigStore   store.AdminConfigurationStore
	datasourceService  datasources.DataSourceService
	httpClientProvider httpclient.Provider
	requestValidator   validations.DataSourceRequestValidator
	settings           *setting.Cfg
	metrics            *metrics.MultiOrgAlertmanager
	logger             log.Logger

	lastSyncHashMu sync.RWMutex
	lastSyncHash   map[int64]uint64

	// AdminConfig k8s API integration. When useAdminConfigAPI is true, the
	// syncer reads `spec.externalAlertmanagerUid` from the AdminConfig
	// resource instead of the legacy admin_config table, and persists status
	// to `status.sync`. clientGenerator + namespaceMapper are nil when the
	// experimental feature flag is off.
	clientGenerator   resource.ClientGenerator
	namespaceMapper   request.NamespaceMapper
	useAdminConfigAPI bool

	adminCfgClientOnce sync.Once
	adminCfgClient     *adminconfigv0alpha1.AdminConfigClient
}

// NewExternalAMSyncer constructs an ExternalAMSyncer. requestValidator may not be
// nil; pass &validations.OSSDataSourceRequestValidator{} for the no-op default.
// clientGenerator + namespaceMapper may be nil when the AdminConfig API feature
// flag is off; in that case the syncer falls back to the legacy admin_config
// store for UID resolution and skips status writes.
func NewExternalAMSyncer(
	adminConfigStore store.AdminConfigurationStore,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
	settings *setting.Cfg,
	m *metrics.MultiOrgAlertmanager,
	logger log.Logger,
	clientGenerator resource.ClientGenerator,
	namespaceMapper request.NamespaceMapper,
	useAdminConfigAPI bool,
) *ExternalAMSyncer {
	return &ExternalAMSyncer{
		adminConfigStore:   adminConfigStore,
		datasourceService:  datasourceService,
		httpClientProvider: httpClientProvider,
		requestValidator:   requestValidator,
		settings:           settings,
		metrics:            m,
		logger:             logger,
		lastSyncHash:       make(map[int64]uint64),
		clientGenerator:    clientGenerator,
		namespaceMapper:    namespaceMapper,
		useAdminConfigAPI:  useAdminConfigAPI,
	}
}

// getAdminConfigClient returns the lazily-initialised AdminConfig k8s client.
// Returns nil when the AdminConfig API flag is off, when no client generator is
// wired (test paths), or when client construction fails (e.g. apiserver not
// ready). On failure the caller should fall back to the legacy admin_config
// path; subsequent calls retry construction.
func (s *ExternalAMSyncer) getAdminConfigClient() *adminconfigv0alpha1.AdminConfigClient {
	if !s.useAdminConfigAPI || s.clientGenerator == nil {
		return nil
	}
	s.adminCfgClientOnce.Do(func() {
		c, err := adminconfigv0alpha1.NewAdminConfigClientFromGenerator(s.clientGenerator)
		if err != nil {
			s.logger.Warn("Failed to construct AdminConfig client, falling back to legacy admin_config", "error", err)
			return
		}
		s.adminCfgClient = c
	})
	return s.adminCfgClient
}

// orgServiceContext returns ctx wrapped with a service identity scoped to the
// org's namespace, suitable for in-process k8s client calls on behalf of the
// sync worker. Returns the unmodified ctx and an empty namespace when
// namespaceMapper is nil.
func (s *ExternalAMSyncer) orgServiceContext(ctx context.Context, orgID int64) (context.Context, string) {
	if s.namespaceMapper == nil {
		return ctx, ""
	}
	ns := s.namespaceMapper(orgID)
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns), ns
}

// FetchExtraConfig fetches the external Alertmanager configuration for the given
// org. Returns a non-nil ExtraConfiguration only when there's a new config to save:
//   - sync feature flag is on
//   - sync is configured for the org (operator-level ini OR per-org admin_config UID)
//   - the fetch succeeded
//   - the response body hash differs from the last successful save
//
// Returns (nil, 0) in all other cases — the caller should just continue with its
// normal per-org apply path. The returned hash is paired with the ExtraConfig:
// callers MUST pass it to MarkSaved after a successful persist, otherwise dedup
// never engages and every fetch will return a non-nil ExtraConfig.
//
// Per-org failures (datasource lookup, HTTP fetch, parse) are logged and emit the
// failure metric here; the caller does not need to handle the error specifically.
func (s *ExternalAMSyncer) FetchExtraConfig(ctx context.Context, orgID int64) (*apimodels.ExtraConfiguration, uint64) {
	client := openfeature.NewDefaultClient()
	if !client.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
		return nil, 0
	}

	uid, origin, err := s.resolveExternalAMUIDForOrg(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to resolve external AM UID", "org_id", orgID, "error", err)
		return nil, 0
	}
	if uid == "" {
		return nil, 0
	}

	orgIDStr := fmt.Sprintf("%d", orgID)
	start := time.Now()

	ec, newHash, reason, fetchErr := s.fetchExtraConfig(ctx, orgID, uid)
	if fetchErr != nil {
		s.logger.Warn("Failed to fetch external AM configuration", "org_id", orgID, "reason", reason, "error", fetchErr)
		s.metrics.ExternalAMConfigSyncFailures.WithLabelValues(orgIDStr, reason).Inc()
		s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())
		s.recordSyncResult(ctx, orgID, uid, origin, fetchErr)
		return nil, 0
	}

	// Count every fetch that reaches upstream successfully. The hash gauge is
	// set on MarkSaved (after the caller has actually persisted), so it
	// always reflects the last persisted config, not the last fetched one.
	s.metrics.ExternalAMConfigSyncTotal.WithLabelValues(orgIDStr).Inc()
	s.metrics.ExternalAMConfigSyncDuration.WithLabelValues(orgIDStr).Observe(time.Since(start).Seconds())

	// Cross-tick dedup. If the response body hashes the same as the last
	// successful save, return (nil, _) so the caller doesn't re-save.
	s.lastSyncHashMu.RLock()
	prevHash, hasPrev := s.lastSyncHash[orgID]
	s.lastSyncHashMu.RUnlock()
	if hasPrev && prevHash == newHash {
		s.logger.Debug("Skipping external AM config save: response unchanged since last sync", "org_id", orgID)
		return nil, 0
	}

	return &ec, newHash
}

// MarkSaved records that an ExtraConfig with the given hash has been successfully
// persisted for the given org. Callers MUST invoke this after the matching save
// returned by FetchExtraConfig has been persisted, otherwise dedup never engages
// and every tick will re-save the same config. Updates the hash gauge here (not
// inside FetchExtraConfig) so the metric value always reflects the last persisted
// config rather than the last fetched one.
//
// Also writes a success entry to the AdminConfig resource's .status.sync when the
// AdminConfig API is enabled. Status writes are best-effort and do not affect the
// save-side bookkeeping.
func (s *ExternalAMSyncer) MarkSaved(ctx context.Context, orgID int64, hash uint64) {
	s.lastSyncHashMu.Lock()
	s.lastSyncHash[orgID] = hash
	s.lastSyncHashMu.Unlock()
	s.metrics.ExternalAMConfigSyncHash.WithLabelValues(fmt.Sprintf("%d", orgID)).Set(float64(hash & mask53))
	s.writeSyncStatusFor(ctx, orgID, nil)
}

// MarkFailed records a save-side failure for the given org. Caller (MAM) invokes
// this when SaveAndApplyExtraConfiguration returns an error for an ExtraConfig
// produced by FetchExtraConfig. Writes a failure entry to .status.sync on the
// AdminConfig resource when the API is enabled; status writes are best-effort.
func (s *ExternalAMSyncer) MarkFailed(ctx context.Context, orgID int64, syncErr error) {
	s.writeSyncStatusFor(ctx, orgID, syncErr)
}

// writeSyncStatusFor re-resolves the (uid, origin) tuple for the org and writes
// the corresponding status. Callers (MarkSaved, MarkFailed, FetchExtraConfig
// failure branch) use this rather than threading the resolved values through
// the save path. The extra resolve call is cheap and avoids state coupling.
func (s *ExternalAMSyncer) writeSyncStatusFor(ctx context.Context, orgID int64, syncErr error) {
	if s.getAdminConfigClient() == nil {
		return
	}
	uid, origin, err := s.resolveExternalAMUIDForOrg(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to re-resolve UID for status write", "org_id", orgID, "error", err)
		return
	}
	s.recordSyncResult(ctx, orgID, uid, origin, syncErr)
}

// recordSyncResult writes the latest sync outcome to .status.sync on the org's
// AdminConfig resource. Best-effort: on error we log and move on. Status writes
// run after each meaningful sync event (success, save failure, fetch failure);
// unified storage's byte-equality no-op detection handles dedup against the
// previous write, so unchanged status produces no history row.
//
// Upsert semantics: when the resource doesn't exist (operator-ini override on a
// fresh stack), we create it with empty spec and the computed status.
//
// Concurrency: optimistic concurrency on resourceVersion. Concurrent spec edits
// (via the API) are preserved because we re-read the resource before each write.
// The 5-attempt retry budget is well above the conflict rate we expect at the
// 1-minute sync cadence.
func (s *ExternalAMSyncer) recordSyncResult(ctx context.Context, orgID int64, uid string, origin adminconfigv0alpha1.AdminConfigSyncStatusOrigin, syncErr error) {
	c := s.getAdminConfigClient()
	if c == nil {
		return
	}
	nsCtx, ns := s.orgServiceContext(ctx, orgID)
	if ns == "" {
		return
	}
	id := resource.Identifier{Namespace: ns, Name: adminConfigSingletonName}
	now := time.Now().Unix()

	for retries := 0; retries < 5; retries++ {
		existing, err := c.Get(nsCtx, id)
		if k8serrors.IsNotFound(err) {
			newStatus := computeSyncStatus(nil, uid, origin, syncErr, now)
			ac := &adminconfigv0alpha1.AdminConfig{
				ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: adminConfigSingletonName},
				Status:     adminconfigv0alpha1.AdminConfigStatus{Sync: &newStatus},
			}
			if _, createErr := c.Create(nsCtx, ac, resource.CreateOptions{}); createErr != nil {
				if k8serrors.IsAlreadyExists(createErr) {
					continue
				}
				s.logger.Warn("Failed to create AdminConfig with sync status", "org_id", orgID, "error", createErr)
				return
			}
			return
		}
		if err != nil {
			s.logger.Warn("Failed to get AdminConfig for status write", "org_id", orgID, "error", err)
			return
		}
		newStatus := computeSyncStatus(existing.Status.Sync, uid, origin, syncErr, now)
		existing.Status.Sync = &newStatus
		if _, updateErr := c.UpdateStatus(nsCtx, id, existing.Status, resource.UpdateOptions{ResourceVersion: existing.ResourceVersion}); updateErr != nil {
			if k8serrors.IsConflict(updateErr) {
				continue
			}
			s.logger.Warn("Failed to update AdminConfig sync status", "org_id", orgID, "error", updateErr)
			return
		}
		return
	}
	s.logger.Warn("Exhausted retries writing AdminConfig sync status", "org_id", orgID)
}

// computeSyncStatus folds the outcome of the current sync attempt into the
// previous status. lastSuccessAt advances only on success; lastError is cleared
// on success and set on failure; failingSince is set on the first failure after
// success and preserved across consecutive failures.
func computeSyncStatus(prev *adminconfigv0alpha1.AdminConfigSyncStatus, uid string, origin adminconfigv0alpha1.AdminConfigSyncStatusOrigin, syncErr error, now int64) adminconfigv0alpha1.AdminConfigSyncStatus {
	uidCopy := uid
	originCopy := origin
	st := adminconfigv0alpha1.AdminConfigSyncStatus{
		DatasourceUid: &uidCopy,
		Origin:        &originCopy,
	}
	if syncErr == nil {
		nowCopy := now
		st.LastSuccessAt = &nowCopy
		return st
	}
	errStr := syncErr.Error()
	st.LastError = &errStr
	if prev != nil {
		st.LastSuccessAt = prev.LastSuccessAt
	}
	if prev != nil && prev.LastError != nil && *prev.LastError != "" && prev.FailingSince != nil {
		st.FailingSince = prev.FailingSince
	} else {
		nowCopy := now
		st.FailingSince = &nowCopy
	}
	return st
}

// fetchExtraConfig looks up the org's external AM datasource and fetches the current
// alertmanager configuration from it. The 10s timeout caps a single fetch attempt;
// Mimir/Cortex returns the config straight from storage so a healthy GET completes
// well under a second, but a hung connection on a transient network blip should not
// block MAM's per-org sync loop indefinitely. The timeout is owned via defer here
// so an early return cannot leak the cancel — callers don't need to care about
// timeout management when adding new failure paths.
//
// Returns the FNV-1a hash of the raw response body so the caller can dedup across
// ticks. The returned reason matches the label on ExternalAMConfigSyncFailures so
// the caller can emit the metric without re-classifying.
func (s *ExternalAMSyncer) fetchExtraConfig(ctx context.Context, orgID int64, uid string) (apimodels.ExtraConfiguration, uint64, string, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	ds, err := s.datasourceService.GetDataSource(fetchCtx, &datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: orgID,
	})
	if err != nil {
		return apimodels.ExtraConfiguration{}, 0, syncReasonDatasourceLookup, fmt.Errorf("look up datasource: %w", err)
	}

	mimirCfg, hash, err := s.fetchMimirConfig(fetchCtx, ds)
	if err != nil {
		return apimodels.ExtraConfiguration{}, 0, syncReasonMimirFetch, fmt.Errorf("fetch upstream config: %w", err)
	}

	return apimodels.ExtraConfiguration{
		Identifier:         uid,
		AlertmanagerConfig: mimirCfg.AlertmanagerConfig,
		TemplateFiles:      mimirCfg.TemplateFiles,
	}, hash, "", nil
}

// resolveExternalAMUIDForOrg returns the datasource UID to use for external AM
// sync for the given org and where it came from. The operator-level
// ExternalAlertmanagerUID ini setting takes precedence over per-org config.
// Per-org config comes from the AdminConfig k8s resource when the AdminConfig
// API feature flag is enabled; otherwise it falls back to the legacy
// admin_config table. Returns "" when neither is set (sync should be skipped).
// Returns an error only on storage failure looking up the per-org config.
func (s *ExternalAMSyncer) resolveExternalAMUIDForOrg(ctx context.Context, orgID int64) (string, adminconfigv0alpha1.AdminConfigSyncStatusOrigin, error) {
	if uid := s.settings.UnifiedAlerting.ExternalAlertmanagerUID; uid != "" {
		return uid, adminconfigv0alpha1.AdminConfigSyncStatusOriginOperator, nil
	}

	if c := s.getAdminConfigClient(); c != nil {
		nsCtx, ns := s.orgServiceContext(ctx, orgID)
		ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: adminConfigSingletonName})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				return "", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
			}
			return "", "", err
		}
		if ac.Spec.ExternalAlertmanagerUid == nil {
			return "", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
		}
		return *ac.Spec.ExternalAlertmanagerUid, adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
	}

	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil {
		if errors.Is(err, store.ErrNoAdminConfiguration) {
			return "", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
		}
		return "", "", err
	}
	if cfg.ExternalAlertmanagerUID == nil {
		return "", adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
	}
	return *cfg.ExternalAlertmanagerUID, adminconfigv0alpha1.AdminConfigSyncStatusOriginSpec, nil
}

// IsConfiguredForOrg reports whether external Alertmanager sync is configured
// for the given org. True when the operator-level ini setting is non-empty
// (applies to all orgs) OR a non-empty externalAlertmanagerUid is set on the
// AdminConfig resource (or legacy admin_config table when the API flag is off).
func (s *ExternalAMSyncer) IsConfiguredForOrg(ctx context.Context, orgID int64) (bool, error) {
	if s.settings.UnifiedAlerting.ExternalAlertmanagerUID != "" {
		return true, nil
	}

	if c := s.getAdminConfigClient(); c != nil {
		nsCtx, ns := s.orgServiceContext(ctx, orgID)
		ac, err := c.Get(nsCtx, resource.Identifier{Namespace: ns, Name: adminConfigSingletonName})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}
		return ac.Spec.ExternalAlertmanagerUid != nil && *ac.Spec.ExternalAlertmanagerUid != "", nil
	}

	cfg, err := s.adminConfigStore.GetAdminConfiguration(orgID)
	if err != nil && !errors.Is(err, store.ErrNoAdminConfiguration) {
		return false, err
	}
	return cfg != nil && cfg.ExternalAlertmanagerUID != nil && *cfg.ExternalAlertmanagerUID != "", nil
}

// classifySyncError maps a SaveAndApplyExtraConfiguration error to a stable reason
// label. ErrAlertmanagerMultipleExtraConfigsUnsupported is split out as
// "identifier_mismatch" so operators can distinguish it from generic save errors.
func classifySyncError(err error) string {
	if errors.Is(err, ErrAlertmanagerMultipleExtraConfigsUnsupported.Base) {
		return syncReasonIdentifierMismatch
	}
	return syncReasonSave
}

// fetchMimirConfig fetches the alertmanager configuration from a Mimir/Cortex
// datasource. Uses the datasource service's HTTP transport so TLS, basic auth,
// bearer tokens, custom headers and OAuth pass-through configured on the datasource
// are all honoured. Returns the FNV-1a hash of the raw response body alongside the
// parsed value; callers use the hash for cross-tick dedup without needing to keep
// the body bytes around.
func (s *ExternalAMSyncer) fetchMimirConfig(ctx context.Context, ds *datasources.DataSource) (*mimirConfigResponse, uint64, error) {
	configURL, err := s.buildMimirConfigURL(ds)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build config URL: %w", err)
	}

	transport, err := s.datasourceService.GetHTTPTransport(ctx, ds, s.httpClientProvider)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build datasource HTTP transport: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Apply allow/deny-list validation to the outbound request before sending.
	// The validator is the same one the user-driven datasource proxy runs
	// (datasourceproxy.go), so the sync worker honours whatever policy is
	// configured for the underlying datasource.
	if s.requestValidator != nil {
		if err := s.requestValidator.Validate(ds.URL, ds.JsonData, req); err != nil {
			return nil, 0, fmt.Errorf("datasource request validation failed: %w", err)
		}
	}

	resp, err := transport.RoundTrip(req)
	if err != nil {
		return nil, 0, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, 0, fmt.Errorf("unexpected HTTP status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read response body: %w", err)
	}

	var cfg mimirConfigResponse
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, 0, fmt.Errorf("failed to parse response: %w", err)
	}

	h := fnv.New64a()
	_, _ = h.Write(body)
	return &cfg, h.Sum64(), nil
}

// buildMimirConfigURL constructs the Mimir alertmanager configuration API URL.
// The config endpoint is /api/v1/alerts directly on the datasource URL.
func (s *ExternalAMSyncer) buildMimirConfigURL(ds *datasources.DataSource) (string, error) {
	parsed, err := url.Parse(ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}

	return parsed.JoinPath("/api/v1/alerts").String(), nil
}
