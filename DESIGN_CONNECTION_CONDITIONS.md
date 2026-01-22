# Connection Controller: Enhanced Condition Reasons

## Goal

Replace simple `Available`/`Unavailable` reasons with actionable reasons that help automation and users distinguish between:
- **Configuration errors** (user needs to fix spec/secrets)
- **External errors** (transient, wait/retry automatically)

## Current State

```go
const (
    ReasonAvailable   = "Available"
    ReasonUnavailable = "Unavailable"
)
```

All failures map to `Unavailable` with details in Message field only.

## Proposed State

```go
const (
    ReasonAvailable          = "Available"
    ReasonConfigurationError = "ConfigurationError"  // User action required
    ReasonExternalError      = "ExternalError"       // Transient, retry
)
```

## Error Scenario Mapping

Based on Connection Controller analysis:

| Scenario | HTTP Code | Current Mapping | New Mapping | Rationale |
|----------|-----------|-----------------|-------------|-----------|
| Missing required field | 422 | Unavailable | ConfigurationError | User must add field to spec |
| Invalid field format | 422 | Unavailable | ConfigurationError | User must fix spec |
| Secret decryption failure | 500 | Unavailable | ConfigurationError | User must fix secret in vault |
| Invalid secret format | 500 | Unavailable | ConfigurationError | User must provide valid secret |
| Token generation failure | 500 | Unavailable | ConfigurationError | Usually due to invalid private key |
| Token expired | N/A | Unavailable | ConfigurationError | Token needs refresh (auto-attempted) |
| Invalid credentials | 400 | Unavailable | ConfigurationError | Wrong appID, installationID, or token |
| AppID mismatch | 400 | Unavailable | ConfigurationError | Spec appID doesn't match token's app |
| Invalid installationID | 400 | Unavailable | ConfigurationError | Installation not found |
| Service unavailable | 503 | Unavailable | ExternalError | GitHub/GitLab API down |
| Network timeout | 400/503 | Unavailable | ExternalError | Network issue, might be transient |
| Rate limited | 429 | Unavailable | ExternalError | External service rate limit |

## Classification Logic

### Option 1: HTTP Status Code Based (Recommended)

```go
func classifyConnectionError(testResults *provisioning.TestResults, err error) string {
    if testResults.Success {
        return provisioning.ReasonAvailable
    }

    // Map HTTP status codes to reasons
    switch testResults.Code {
    case 422: // Unprocessable Entity - validation failed
        return provisioning.ReasonConfigurationError
    case 400, 401, 403: // Client errors - credentials/config issue
        return provisioning.ReasonConfigurationError
    case 500, 502: // Server errors during build - usually secret issues
        return provisioning.ReasonConfigurationError
    case 503, 504, 429: // Service unavailable, timeout, rate limit
        return provisioning.ReasonExternalError
    default:
        // Default to configuration error for unknown cases
        // This is safer as it prompts user to investigate
        return provisioning.ReasonConfigurationError
    }
}
```

**Pros**:
- Simple, clean logic
- HTTP codes are already semantic
- Easy to maintain

**Cons**:
- Might misclassify some errors
- Doesn't distinguish secret decryption from validation

### Option 2: Error Type Based

Add error type information to TestResults or HealthStatus, then classify based on error type.

**Pros**:
- More precise classification
- Can distinguish secret errors from validation errors

**Cons**:
- Requires changes to TestResults structure
- More complex

### Recommendation: Option 1

Start with HTTP status code classification. It's simple, semantic, and works with current structure.

## Implementation Plan

### 1. Update Constants (health.go)

```go
// Condition reasons for the Ready condition
const (
	// ReasonAvailable indicates the resource is available and ready for use.
	ReasonAvailable = "Available"

	// ReasonConfigurationError indicates the resource has a configuration issue
	// that requires user action (invalid spec, bad credentials, secret errors).
	// Automation should NOT retry - wait for user to fix configuration.
	ReasonConfigurationError = "ConfigurationError"

	// ReasonExternalError indicates an external service issue (API down, network error).
	// Automation CAN retry - issue is transient and outside user control.
	ReasonExternalError = "ExternalError"
)
```

### 2. Add Classification Function (connection_health.go)

```go
// classifyConnectionError determines the appropriate Ready condition reason based on test results
func classifyConnectionError(testResults *provisioning.TestResults) string {
	if testResults.Success {
		return provisioning.ReasonAvailable
	}

	// Map HTTP status codes to condition reasons
	switch testResults.Code {
	case 422: // Unprocessable Entity - spec validation failed
		return provisioning.ReasonConfigurationError
	case 400, 401, 403: // Client errors - credentials/config issue
		return provisioning.ReasonConfigurationError
	case 500, 502: // Server errors - usually secret/build issues
		return provisioning.ReasonConfigurationError
	case 503, 504: // Service unavailable, gateway timeout
		return provisioning.ReasonExternalError
	case 429: // Too many requests - rate limited
		return provisioning.ReasonExternalError
	default:
		// Unknown error - default to configuration error to prompt investigation
		return provisioning.ReasonConfigurationError
	}
}
```

### 3. Update buildReadyConditionFromHealth (conditions.go)

**Current**:
```go
func buildReadyConditionFromHealth(healthStatus provisioning.HealthStatus) metav1.Condition {
	if healthStatus.Healthy {
		return metav1.Condition{
			Type:    provisioning.ConditionTypeReady,
			Status:  metav1.ConditionTrue,
			Reason:  provisioning.ReasonAvailable,
			Message: "Resource is available",
		}
	}

	message := "Resource is unavailable"
	if len(healthStatus.Message) > 0 {
		message = healthStatus.Message[0]
	}

	return metav1.Condition{
		Type:    provisioning.ConditionTypeReady,
		Status:  metav1.ConditionFalse,
		Reason:  provisioning.ReasonUnavailable,
		Message: message,
	}
}
```

**Problem**: Current function doesn't have test results to classify error!

**Solution**: Need to pass more context or refactor signature.

### 4. Update RefreshHealthWithPatchOps (connection_health.go)

**Current Flow**:
```go
func (hc *ConnectionHealthChecker) RefreshHealthWithPatchOps(...) {
    testResults, newHealthStatus, err := hc.refreshHealth(...)

    // Health patch
    if hc.hasHealthStatusChanged(old, new) {
        patchOps = append(patchOps, healthPatch)
    }

    // Condition patch
    readyCondition := buildReadyConditionFromHealth(newHealthStatus)
    if conditionPatchOps := buildConditionPatchOpsFromExisting(...); conditionPatchOps != nil {
        patchOps = append(patchOps, conditionPatchOps...)
    }
}
```

**New Flow**:
```go
func (hc *ConnectionHealthChecker) RefreshHealthWithPatchOps(...) {
    testResults, newHealthStatus, err := hc.refreshHealth(...)

    // Health patch (unchanged)
    if hc.hasHealthStatusChanged(old, new) {
        patchOps = append(patchOps, healthPatch)
    }

    // Condition patch with error classification
    reason := classifyConnectionError(testResults, newHealthStatus)
    readyCondition := buildReadyCondition(newHealthStatus, reason)
    if conditionPatchOps := buildConditionPatchOpsFromExisting(...); conditionPatchOps != nil {
        patchOps = append(patchOps, conditionPatchOps...)
    }
}
```

**Need**:
- New `buildReadyCondition(healthStatus, reason string)` function
- Or: Update `buildReadyConditionFromHealth` to accept reason parameter

### 5. Refactor Approach

**Option A**: Add reason parameter to buildReadyConditionFromHealth
```go
func buildReadyConditionFromHealth(healthStatus provisioning.HealthStatus, reason string) metav1.Condition
```

**Option B**: Create new function for Connections specifically
```go
func buildReadyConditionForConnection(healthStatus provisioning.HealthStatus, testResults *provisioning.TestResults) metav1.Condition
```

**Option C**: Store test results in HealthStatus
- Add `HealthStatus.HTTPCode int` field
- Classification logic can live in buildReadyConditionFromHealth

**Recommendation**: Option B for now (least invasive), can refactor later.

## Testing Strategy

### Unit Tests (connection_health_test.go)

Add test cases for error classification:

```go
func TestClassifyConnectionError(t *testing.T) {
    tests := []struct {
        name           string
        testResults    *provisioning.TestResults
        expectedReason string
    }{
        {
            name: "validation error (422) → ConfigurationError",
            testResults: &provisioning.TestResults{
                Success: false,
                Code:    422,
                Errors:  []provisioning.ErrorDetails{{Detail: "missing appID"}},
            },
            expectedReason: provisioning.ReasonConfigurationError,
        },
        {
            name: "auth error (401) → ConfigurationError",
            testResults: &provisioning.TestResults{
                Success: false,
                Code:    401,
                Errors:  []provisioning.ErrorDetails{{Detail: "invalid token"}},
            },
            expectedReason: provisioning.ReasonConfigurationError,
        },
        {
            name: "service unavailable (503) → ExternalError",
            testResults: &provisioning.TestResults{
                Success: false,
                Code:    503,
                Errors:  []provisioning.ErrorDetails{{Detail: "GitHub API unavailable"}},
            },
            expectedReason: provisioning.ReasonExternalError,
        },
        // ... more test cases
    }
}
```

### Integration Tests (connection_test.go)

Update existing integration tests to check for proper reasons:

```go
// When connection has invalid credentials
assert.Equal(t, metav1.ConditionFalse, readyCondition.Status)
assert.Equal(t, provisioning.ReasonConfigurationError, readyCondition.Reason)

// When external service is down (if we can simulate it)
assert.Equal(t, metav1.ConditionFalse, readyCondition.Status)
assert.Equal(t, provisioning.ReasonExternalError, readyCondition.Reason)
```

## Migration Path

1. ✅ **Phase 1** (Current PR): Add basic Ready condition with Available/Unavailable
2. 🔄 **Phase 2** (This PR): Add ConfigurationError/ExternalError reasons for Connections
3. 🔜 **Phase 3** (Future PR): Apply same pattern to Repositories
4. 🔜 **Phase 4** (Future PR): Deprecate Health.Healthy field, use conditions as source of truth

## Benefits

### For Users (kubectl)
```bash
$ kubectl get connections
NAME              READY   STATUS                    AGE
github-prod       False   ConfigurationError        5m    # User knows to check config
github-staging    False   ExternalError             2m    # User knows it's transient
```

### For Automation
```go
// Retry logic
if readyCondition.Status == metav1.ConditionFalse {
    if readyCondition.Reason == provisioning.ReasonExternalError {
        // Retry - transient issue
        return ctrl.Result{RequeueAfter: 1 * time.Minute}, nil
    } else if readyCondition.Reason == provisioning.ReasonConfigurationError {
        // Don't retry - wait for user to fix
        return ctrl.Result{}, nil
    }
}
```

### For UI
- Show different icons/colors for ConfigurationError vs ExternalError
- Provide actionable guidance based on reason
- ConfigurationError → "Check your credentials"
- ExternalError → "Service temporarily unavailable"

## Open Questions

1. **Should Repository use the same reasons?**
   - Yes, for consistency
   - Repository has similar error scenarios (git auth failures, network issues)

2. **Should we add more granular reasons later?**
   - Possible: AuthenticationError, NetworkError, SecretError, etc.
   - Start simple, add if needed based on feedback

3. **How to handle secret expiration?**
   - Currently auto-refreshed on reconciliation
   - If refresh fails → ConfigurationError (user needs to update secret)
   - Could add separate TokenExpired reason in future

4. **Should we expose HTTP code in condition?**
   - No - Reason is semantic, Message has details
   - HTTP code is implementation detail

## Files to Modify

1. **API Changes**:
   - `apps/provisioning/pkg/apis/provisioning/v0alpha1/health.go` - Add new reason constants

2. **Controller Logic**:
   - `pkg/registry/apis/provisioning/controller/conditions.go` - Add/update condition builder
   - `pkg/registry/apis/provisioning/controller/connection_health.go` - Add classification logic

3. **Tests**:
   - `pkg/registry/apis/provisioning/controller/connection_health_test.go` - Unit tests
   - `pkg/registry/apis/provisioning/controller/conditions_test.go` - Condition builder tests
   - `pkg/tests/apis/provisioning/connection_test.go` - Integration tests

4. **Code Generation**:
   - Run `./hack/update-codegen.sh provisioning` after API changes
