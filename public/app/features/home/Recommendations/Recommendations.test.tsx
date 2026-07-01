import { act, render, screen, userEvent } from 'test/test-utils';

import Recommendations from './Recommendations';

describe('Recommendations', () => {
  it('collapses and expands the recommendations card', async () => {
    const { user } = render(<Recommendations />);

    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));

    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('navigates recommendations with previous/next buttons and dots', async () => {
    const { user } = render(<Recommendations />);

    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 2' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to recommendation 3' }));

    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 3' })).not.toBeInTheDocument();
  });

  it('pauses and resumes autoplay', async () => {
    jest.useFakeTimers();

    try {
      render(<Recommendations />);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const pauseButton = screen.getByRole('button', { name: 'Pause' });
      await user.click(pauseButton);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Resume' }));

      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
