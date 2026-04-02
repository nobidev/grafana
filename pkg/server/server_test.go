package server

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs/adapter"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type testService struct {
	started        chan struct{}
	runErr         error
	isDisabled     bool
	failAfterReady <-chan struct{} // if set with runErr, wait until this is closed before failing
}

func newTestService(runErr error, disabled bool) *testService {
	return &testService{
		started:    make(chan struct{}),
		runErr:     runErr,
		isDisabled: disabled,
	}
}

// newTestServiceFailsAfterPeerRunning returns a service that returns runErr only after peer
// has reached its steady Run() state (peer closes started). Avoids dskit races when one
// service fails while another is still starting.
func newTestServiceFailsAfterPeerRunning(peer *testService, runErr error) *testService {
	return &testService{
		started:        make(chan struct{}),
		runErr:         runErr,
		failAfterReady: peer.started,
	}
}

func (s *testService) Run(ctx context.Context) error {
	if s.isDisabled {
		return fmt.Errorf("Shouldn't run disabled service")
	}

	if s.runErr != nil {
		if s.failAfterReady != nil {
			select {
			case <-s.failAfterReady:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func (s *testService) IsDisabled() bool {
	return s.isDisabled
}

func testServer(t *testing.T, services ...registry.BackgroundService) *Server {
	t.Helper()
	s, err := newServer(Options{}, setting.NewCfg(), nil, &acimpl.Service{}, nil, backgroundsvcs.NewBackgroundServiceRegistry(services...), tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), prometheus.NewRegistry())
	require.NoError(t, err)
	s.managerAdapter.WithDependencies(map[string][]string{
		adapter.Core:               {},
		adapter.BackgroundServices: {adapter.Core},
	})
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	testErr := errors.New("boom")
	stable := newTestService(nil, false)
	failing := newTestServiceFailsAfterPeerRunning(stable, testErr)
	s := testServer(t, stable, failing)
	err := s.Run()
	require.Error(t, err)
	require.Contains(t, err.Error(), testErr.Error())
}

func TestServer_Shutdown(t *testing.T) {
	t.Run("successful shutdown", func(t *testing.T) {
		ctx := context.Background()
		s := testServer(t, newTestService(nil, false), newTestService(nil, true))
		ch := make(chan error)
		go func() {
			defer close(ch)
			err := s.managerAdapter.AwaitRunning(ctx)
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()
			err = s.Shutdown(ctx, "test interrupt")
			ch <- err
		}()
		err := s.Run()
		require.NoError(t, err)

		err = <-ch
		require.NoError(t, err)
	})
}
