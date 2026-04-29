package folders

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// errutil-wrapped variants of the dashboards UID validation sentinels so the
// k8s apiserver renders them as structured 400 instead of "Unhandled Error" 500.
// Lives in this package (not pkg/services/folder) because folder cannot import
// dashboards without an import cycle. The %w chain preserves errors.Is matches
// on the legacy sentinels for the existing ToFolderErrorResponse handler.
var (
	ErrAPIInvalidUIDChars = errutil.BadRequest(
		"folder.invalid-uid-chars",
		errutil.WithPublicMessage("uid contains illegal characters"),
	).Errorf("%w", dashboards.ErrDashboardInvalidUid)

	ErrAPIUIDTooLong = errutil.BadRequest(
		"folder.uid-too-long",
		errutil.WithPublicMessage("uid too long, max 40 characters"),
	).Errorf("%w", dashboards.ErrDashboardUidTooLong)
)
