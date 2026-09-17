package middleware

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestReplacePolicyVariables(t *testing.T) {
	t.Run("replaces $NONCE", func(t *testing.T) {
		result := ReplacePolicyVariables("script-src $NONCE", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "script-src 'nonce-abc123'", result)
	})

	t.Run("replaces $ROOT_PATH", func(t *testing.T) {
		result := ReplacePolicyVariables("connect-src ws://$ROOT_PATH", "https://grafana.example.com/", CSPHostLists{}, "abc123")
		assert.Equal(t, "connect-src ws://grafana.example.com/", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with 'none' when empty", func(t *testing.T) {
		result := ReplacePolicyVariables("frame-ancestors $ALLOW_EMBEDDING_HOSTS", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "frame-ancestors 'none'", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with host list", func(t *testing.T) {
		hosts := CSPHostLists{FrameAncestorHosts: []string{"wiki.example.com", "foo.example.com"}}
		result := ReplacePolicyVariables("frame-ancestors $ALLOW_EMBEDDING_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "frame-ancestors wiki.example.com foo.example.com", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with empty string when no hosts configured", func(t *testing.T) {
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "form-action 'self' ", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with additional hosts", func(t *testing.T) {
		hosts := CSPHostLists{FormActionAdditionalHosts: []string{"login.example.com", "auth.example.com"}}
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "form-action 'self' login.example.com auth.example.com", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with wildcard", func(t *testing.T) {
		hosts := CSPHostLists{FormActionAdditionalHosts: []string{"*"}}
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "form-action 'self' *", result)
	})

	t.Run("replaces both $ALLOW_EMBEDDING_HOSTS and $FORM_ACTION_ADDITIONAL_HOSTS in same template", func(t *testing.T) {
		hosts := CSPHostLists{
			FrameAncestorHosts:        []string{"embed.example.com"},
			FormActionAdditionalHosts: []string{"login.example.com"},
		}
		template := "frame-ancestors $ALLOW_EMBEDDING_HOSTS; form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS"
		result := ReplacePolicyVariables(template, "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "frame-ancestors embed.example.com; form-action 'self' login.example.com", result)
	})

	t.Run("replaces $CDN_ROOT_URL with empty string when no CDN is configured", func(t *testing.T) {
		result := ReplacePolicyVariables("worker-src 'self' blob: $CDN_ROOT_URL", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "worker-src 'self' blob: ", result)
	})

	t.Run("replaces $CDN_ROOT_URL with the CDN origin", func(t *testing.T) {
		hosts := CSPHostLists{CDNRootURL: "https://assets.example.com"}
		result := ReplacePolicyVariables("worker-src 'self' blob: $CDN_ROOT_URL", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "worker-src 'self' blob: https://assets.example.com", result)
	})

	t.Run("replaces all variables in a full CSP template", func(t *testing.T) {
		hosts := CSPHostLists{
			FrameAncestorHosts:        []string{"embed.example.com"},
			FormActionAdditionalHosts: []string{"login.example.com"},
			CDNRootURL:                "https://assets.example.com",
		}
		template := "script-src 'self' $NONCE; connect-src ws://$ROOT_PATH; frame-ancestors $ALLOW_EMBEDDING_HOSTS; form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS; worker-src 'self' blob: $CDN_ROOT_URL"
		result := ReplacePolicyVariables(template, "https://grafana.example.com/", hosts, "testnonce")
		assert.Equal(t, "script-src 'self' 'nonce-testnonce'; connect-src ws://grafana.example.com/; frame-ancestors embed.example.com; form-action 'self' login.example.com; worker-src 'self' blob: https://assets.example.com", result)
	})
}

func TestCDNOrigin(t *testing.T) {
	t.Run("returns empty string when no CDN is configured", func(t *testing.T) {
		assert.Equal(t, "", CDNOrigin(nil))
	})

	t.Run("returns empty string for a URL without a host", func(t *testing.T) {
		parsed, err := url.Parse("/relative/path")
		require.NoError(t, err)
		assert.Equal(t, "", CDNOrigin(parsed))
	})

	t.Run("drops the path so the result is a CSP source expression", func(t *testing.T) {
		parsed, err := url.Parse("https://assets.example.com/grafana-oss/")
		require.NoError(t, err)
		assert.Equal(t, "https://assets.example.com", CDNOrigin(parsed))
	})

	t.Run("keeps a non-default port", func(t *testing.T) {
		parsed, err := url.Parse("http://localhost:8080")
		require.NoError(t, err)
		assert.Equal(t, "http://localhost:8080", CDNOrigin(parsed))
	})
}

func TestNewCSPHostLists(t *testing.T) {
	t.Run("carries every config-derived source", func(t *testing.T) {
		cdnURL, err := url.Parse("https://assets.example.com/grafana-oss/")
		require.NoError(t, err)

		hosts := NewCSPHostLists(&setting.Cfg{
			FormActionAdditionalHosts: []string{"login.example.com"},
			CDNRootURL:                cdnURL,
		})

		assert.Equal(t, []string{"login.example.com"}, hosts.FormActionAdditionalHosts)
		assert.Equal(t, "https://assets.example.com", hosts.CDNRootURL)
	})

	t.Run("leaves CDNRootURL empty when no CDN is configured", func(t *testing.T) {
		hosts := NewCSPHostLists(&setting.Cfg{})

		assert.Equal(t, "", hosts.CDNRootURL)
	})
}
