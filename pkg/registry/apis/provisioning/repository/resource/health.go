package resource

import (
	"context"
	"net/http"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TODO: Move tester to a more suitable location out of the connector.
type RepositoryTester struct {
	// Repository+Jobs
	client client.ProvisioningV0alpha1Interface
	getter RepositoryGetter
}

// This function will check if the repository is configured and functioning as expected
func (t *RepositoryTester) UpdateHealthStatus(ctx context.Context, cfg *provisioning.Repository, res *provisioning.TestResults) (*provisioning.Repository, error) {
	if res == nil {
		res = &provisioning.TestResults{
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Detail: "missing health status",
			}},
		}
	}

	repo := cfg.DeepCopy()
	repo.Status.Health = provisioning.HealthStatus{
		Healthy: res.Success,
		Checked: time.Now().UnixMilli(),
	}
	for _, err := range res.Errors {
		if err.Detail != "" {
			repo.Status.Health.Message = append(repo.Status.Health.Message, err.Detail)
		}
	}

	_, err := t.client.Repositories(repo.GetNamespace()).
		UpdateStatus(ctx, repo, metav1.UpdateOptions{})
	return repo, err
}

func (t *RepositoryTester) GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error) {
	repo, err := t.getter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	status := repo.Config().Status.Health
	if !status.Healthy {
		if timeSince(status.Checked) > time.Second*25 {
			ctx, _, err = identity.WithProvisioningIdentity(ctx, repo.Config().Namespace)
			if err != nil {
				return nil, err // The status
			}

			// Check health again
			s, err := repository.TestRepository(ctx, repo)
			if err != nil {
				return nil, err // The status
			}

			// Write and return the repo with current status
			cfg, _ := t.UpdateHealthStatus(ctx, repo.Config(), s)
			if cfg != nil {
				status = cfg.Status.Health
				if cfg.Status.Health.Healthy && cfg.Status.Health.Checked.Before(time.Now().Add(-time.Second*25)) {
					status = cfg.Status.Health
					repo, err = t.getter.AsRepository(ctx, cfg)
					if err != nil {
						return nil, err
					}
				}
			}
		}
		if !status.Healthy {
			return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
				Code:    http.StatusFailedDependency,
				Message: "The repository configuration is not healthy",
			}}
		}
	}
	return repo, err
}

func timeSince(when int64) time.Duration {
	return time.Duration(time.Now().UnixMilli()-when) * time.Millisecond
}
