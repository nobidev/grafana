package resource

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/local"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type Extra interface {
	AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error)
	RepositoryTypes() []provisioning.RepositoryType
	Mutators() []controller.Mutator
}

type ExtraBuilder func(b *storageGetter) Extra

type RepositoryGetter interface {
	RuntimeObjectAsRepository(ctx context.Context, obj runtime.Object) (repository.Repository, error)
	AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error)
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

type storageGetter struct {
	rest.Getter
	extras            []Extra
	localFileResolver *local.LocalFolderResolver
	repositorySecrets secrets.RepositorySecrets
	ghFactory         *github.Factory
	tester            *RepositoryTester
}

func (g *storageGetter) GetRepository(ctx context.Context, name string) (repository.Repository, error) {
	obj, err := g.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	return g.RuntimeObjectAsRepository(ctx, obj)
}

func (g *storageGetter) RuntimeObjectAsRepository(ctx context.Context, obj runtime.Object) (repository.Repository, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing repository object")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository configuration")
	}
	return g.AsRepository(ctx, r)
}

func (g *storageGetter) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	// Try first with any extra
	for _, extra := range g.extras {
		r, err := extra.AsRepository(ctx, r)
		if err != nil {
			return nil, fmt.Errorf("convert repository for extra %T: %w", extra, err)
		}

		if r != nil {
			return r, nil
		}
	}

	switch r.Spec.Type {
	case provisioning.BitbucketRepositoryType:
		return nil, errors.New("repository type bitbucket is not available")
	case provisioning.GitLabRepositoryType:
		return nil, errors.New("repository type gitlab is not available")
	case provisioning.LocalRepositoryType:
		return local.NewLocal(r, g.localFileResolver), nil
	case provisioning.GitRepositoryType:
		// Decrypt token if needed
		token := r.Spec.Git.Token
		if token == "" && len(r.Spec.Git.EncryptedToken) > 0 {
			decrypted, err := g.repositorySecrets.Decrypt(ctx, r, string(r.Spec.Git.EncryptedToken))
			if err != nil {
				return nil, fmt.Errorf("decrypt git token: %w", err)
			}
			token = string(decrypted)
		}

		cfg := git.RepositoryConfig{
			URL:            r.Spec.Git.URL,
			Branch:         r.Spec.Git.Branch,
			Path:           r.Spec.Git.Path,
			TokenUser:      r.Spec.Git.TokenUser,
			Token:          token,
			EncryptedToken: r.Spec.Git.EncryptedToken,
		}

		return git.NewGitRepository(ctx, r, cfg, g.repositorySecrets)
	case provisioning.GitHubRepositoryType:
		logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
		logger.Info("Instantiating Github repository")

		ghCfg := r.Spec.GitHub
		if ghCfg == nil {
			return nil, fmt.Errorf("github configuration is required for nano git")
		}

		// Decrypt GitHub token if needed
		ghToken := ghCfg.Token
		if ghToken == "" && len(ghCfg.EncryptedToken) > 0 {
			decrypted, err := g.repositorySecrets.Decrypt(ctx, r, string(ghCfg.EncryptedToken))
			if err != nil {
				return nil, fmt.Errorf("decrypt github token: %w", err)
			}
			ghToken = string(decrypted)
		}

		gitCfg := git.RepositoryConfig{
			URL:            ghCfg.URL,
			Branch:         ghCfg.Branch,
			Path:           ghCfg.Path,
			Token:          ghToken,
			EncryptedToken: ghCfg.EncryptedToken,
		}

		gitRepo, err := git.NewGitRepository(ctx, r, gitCfg, g.repositorySecrets)
		if err != nil {
			return nil, fmt.Errorf("error creating git repository: %w", err)
		}

		ghRepo, err := github.NewGitHub(ctx, r, gitRepo, g.ghFactory, ghToken, g.repositorySecrets)
		if err != nil {
			return nil, fmt.Errorf("error creating github repository: %w", err)
		}

		return ghRepo, nil
	default:
		return nil, fmt.Errorf("unknown repository type (%s)", r.Spec.Type)
	}
}
