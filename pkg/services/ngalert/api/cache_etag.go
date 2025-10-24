package api

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strconv"
	"time"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// CacheControlHeader is the header name for cache control
	CacheControlHeader = "Cache-Control"
	// ETagHeader is the header name for ETag
	ETagHeader = "ETag"
	// IfNoneMatchHeader is the header name for If-None-Match
	IfNoneMatchHeader = "If-None-Match"
	// DefaultCacheTTL is the default TTL for cached responses (5 minutes)
	DefaultCacheTTL = 300
)

// ETagCacheConfig holds cache configuration
type ETagCacheConfig struct {
	Enabled    bool
	TTLSeconds int
}

// generateETagFromRules generates an ETag based on the list of rules and their update times
func generateETagFromRules(rules []*ngmodels.AlertRule) string {
	if len(rules) == 0 {
		return `"empty"`
	}

	// Find the most recent update time
	var maxUpdate time.Time
	for _, rule := range rules {
		if rule.Updated.After(maxUpdate) {
			maxUpdate = rule.Updated
		}
	}

	// Create a hash from the update time and rule count
	h := sha256.New()
	h.Write([]byte(maxUpdate.Format(time.RFC3339Nano)))
	h.Write([]byte(strconv.Itoa(len(rules))))

	return fmt.Sprintf(`"%x"`, h.Sum(nil))
}

// generateETagFromGroups generates an ETag based on rule groups
func generateETagFromGroups(groups map[ngmodels.AlertRuleGroupKey]ngmodels.RulesGroup) string {
	if len(groups) == 0 {
		return `"empty"`
	}

	var maxUpdate time.Time
	totalRules := 0

	for _, rules := range groups {
		totalRules += len(rules)
		for _, rule := range rules {
			if rule.Updated.After(maxUpdate) {
				maxUpdate = rule.Updated
			}
		}
	}

	// Create a hash from the update time, group count, and rule count
	h := sha256.New()
	h.Write([]byte(maxUpdate.Format(time.RFC3339Nano)))
	h.Write([]byte(strconv.Itoa(len(groups))))
	h.Write([]byte(strconv.Itoa(totalRules)))

	return fmt.Sprintf(`"%x"`, h.Sum(nil))
}

// SetCacheHeaders sets appropriate cache headers for the response
func SetCacheHeaders(c *contextmodel.ReqContext, etag string, ttlSeconds int) {
	c.Resp.Header().Set(ETagHeader, etag)
	c.Resp.Header().Set(CacheControlHeader, fmt.Sprintf("private, max-age=%d", ttlSeconds))
}

// CheckETagMatch checks if the provided ETag matches the If-None-Match header
// Returns true if the ETags match (client cache is valid)
func CheckETagMatch(c *contextmodel.ReqContext, currentETag string) bool {
	clientETag := c.Req.Header.Get(IfNoneMatchHeader)
	return clientETag != "" && clientETag == currentETag
}

// HandleCachedResponse handles the caching logic for rule responses
// Returns true if a 304 Not Modified response was sent
func HandleCachedResponse(c *contextmodel.ReqContext, rules []*ngmodels.AlertRule, config ETagCacheConfig) bool {
	if !config.Enabled {
		return false
	}

	etag := generateETagFromRules(rules)

	// Check if client's cached version is still valid
	if CheckETagMatch(c, etag) {
		c.Resp.WriteHeader(http.StatusNotModified)
		return true
	}

	// Set cache headers for the response
	SetCacheHeaders(c, etag, config.TTLSeconds)
	return false
}

// HandleCachedGroupResponse handles the caching logic for rule group responses
// Returns true if a 304 Not Modified response was sent
func HandleCachedGroupResponse(c *contextmodel.ReqContext, groups map[ngmodels.AlertRuleGroupKey]ngmodels.RulesGroup, config ETagCacheConfig) bool {
	if !config.Enabled {
		return false
	}

	etag := generateETagFromGroups(groups)

	// Check if client's cached version is still valid
	if CheckETagMatch(c, etag) {
		c.Resp.WriteHeader(http.StatusNotModified)
		return true
	}

	// Set cache headers for the response
	SetCacheHeaders(c, etag, config.TTLSeconds)
	return false
}