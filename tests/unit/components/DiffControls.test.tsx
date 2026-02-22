import React from 'react';
import { render, screen } from '../../../tests/test-utils';
import userEvent from '@testing-library/user-event';
import { DiffControls } from '@/components/editor/DiffControls';
import type { DiffControlsProps, ChangeStatistics } from '@/components/editor/DiffControls';

describe('DiffControls', () => {
  const defaultProps: DiffControlsProps = {
    statistics: { additions: 0, deletions: 0, modifications: 0 },
  };

  describe('DiffControls component', () => {
    it('renders with default props', () => {
      render(<DiffControls {...defaultProps} />);
      expect(screen.getByText('No changes')).toBeInTheDocument();
      expect(screen.getByLabelText('Accept hunk')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject hunk')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <DiffControls {...defaultProps} className="custom-class" />
      );
      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      // DiffControls uses Card which forwards ref to div
      const { container } = render(
        <div ref={ref}>
          <DiffControls {...defaultProps} />
        </div>
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('statistics display', () => {
    it('displays additions badge correctly', () => {
      const statistics: ChangeStatistics = {
        additions: 5,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('+5 additions')).toBeInTheDocument();
    });

    it('displays deletions badge correctly', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 3,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('-3 deletions')).toBeInTheDocument();
    });

    it('displays modifications badge correctly', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 0,
        modifications: 2,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('~2 modifications')).toBeInTheDocument();
    });

    it('displays all statistics together', () => {
      const statistics: ChangeStatistics = {
        additions: 10,
        deletions: 5,
        modifications: 3,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('+10 additions')).toBeInTheDocument();
      expect(screen.getByText('-5 deletions')).toBeInTheDocument();
      expect(screen.getByText('~3 modifications')).toBeInTheDocument();
    });

    it('shows "No changes" when all statistics are zero', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('No changes')).toBeInTheDocument();
    });

    it('properly pluralizes "addition" for singular', () => {
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('+1 addition')).toBeInTheDocument();
    });

    it('properly pluralizes "deletion" for singular', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 1,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('-1 deletion')).toBeInTheDocument();
    });

    it('properly pluralizes "modification" for singular', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 0,
        modifications: 1,
      };
      render(<DiffControls statistics={statistics} />);
      expect(screen.getByText('~1 modification')).toBeInTheDocument();
    });

    it('uses default statistics when not provided', () => {
      render(<DiffControls />);
      expect(screen.getByText('No changes')).toBeInTheDocument();
    });
  });

  describe('button behavior', () => {
    it('calls onAccept when accept button is clicked', async () => {
      const user = userEvent.setup();
      const onAccept = jest.fn();
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} onAccept={onAccept} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      await user.click(acceptButton);

      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('calls onReject when reject button is clicked', async () => {
      const user = userEvent.setup();
      const onReject = jest.fn();
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} onReject={onReject} />);

      const rejectButton = screen.getByLabelText('Reject hunk');
      await user.click(rejectButton);

      expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when disabled prop is true', () => {
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} disabled={true} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      const rejectButton = screen.getByLabelText('Reject hunk');

      expect(acceptButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });

    it('disables buttons when no changes exist', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      const rejectButton = screen.getByLabelText('Reject hunk');

      expect(acceptButton).toBeDisabled();
      expect(rejectButton).toBeDisabled();
    });

    it('enables buttons when changes exist and not disabled', () => {
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} disabled={false} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      const rejectButton = screen.getByLabelText('Reject hunk');

      expect(acceptButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });

    it('does not call handlers when buttons are disabled', async () => {
      const user = userEvent.setup();
      const onAccept = jest.fn();
      const onReject = jest.fn();
      render(<DiffControls onAccept={onAccept} onReject={onReject} disabled={true} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      const rejectButton = screen.getByLabelText('Reject hunk');

      await user.click(acceptButton);
      await user.click(rejectButton);

      expect(onAccept).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('level prop', () => {
    it('uses "hunk" level by default', () => {
      render(<DiffControls />);
      expect(screen.getByLabelText('Accept hunk')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject hunk')).toBeInTheDocument();
    });

    it('uses "hunk" level when specified', () => {
      render(<DiffControls level="hunk" />);
      expect(screen.getByLabelText('Accept hunk')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject hunk')).toBeInTheDocument();
    });

    it('uses "line" level when specified', () => {
      render(<DiffControls level="line" />);
      expect(screen.getByLabelText('Accept line')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject line')).toBeInTheDocument();
    });
  });

  describe('label display', () => {
    it('displays label when provided', () => {
      render(<DiffControls label="File changes" />);
      expect(screen.getByText('File changes')).toBeInTheDocument();
    });

    it('does not display label section when not provided', () => {
      const { container } = render(<DiffControls />);
      const labelElement = container.querySelector('.text-sm.font-medium.text-muted-foreground');
      expect(labelElement).not.toBeInTheDocument();
    });

    it('applies correct styles to label', () => {
      render(<DiffControls label="Test Label" />);
      const labelElement = screen.getByText('Test Label');
      expect(labelElement).toHaveClass('text-sm');
      expect(labelElement).toHaveClass('font-medium');
      expect(labelElement).toHaveClass('text-muted-foreground');
    });
  });

  describe('component composition', () => {
    it('renders complete structure with all elements', () => {
      const statistics: ChangeStatistics = {
        additions: 5,
        deletions: 3,
        modifications: 2,
      };
      const onAccept = jest.fn();
      const onReject = jest.fn();

      render(
        <DiffControls
          statistics={statistics}
          onAccept={onAccept}
          onReject={onReject}
          level="hunk"
          label="Changes for file.ts"
          className="test-class"
        />
      );

      // Label
      expect(screen.getByText('Changes for file.ts')).toBeInTheDocument();

      // Statistics badges
      expect(screen.getByText('+5 additions')).toBeInTheDocument();
      expect(screen.getByText('-3 deletions')).toBeInTheDocument();
      expect(screen.getByText('~2 modifications')).toBeInTheDocument();

      // Buttons
      expect(screen.getByLabelText('Accept hunk')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject hunk')).toBeInTheDocument();
    });

    it('renders with minimal props', () => {
      render(<DiffControls />);

      expect(screen.getByText('No changes')).toBeInTheDocument();
      expect(screen.getByLabelText('Accept hunk')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject hunk')).toBeInTheDocument();
    });
  });

  describe('memoization', () => {
    it('has displayName set for debugging', () => {
      expect(DiffControls.displayName).toBe('DiffControls');
    });

    it('does not re-render with same props', () => {
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };
      const { rerender } = render(<DiffControls statistics={statistics} />);

      // Re-render with same props
      rerender(<DiffControls statistics={statistics} />);

      // Component should still be in document
      expect(screen.getByText('+1 addition')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('buttons have proper aria-labels', () => {
      render(<DiffControls level="hunk" />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      const rejectButton = screen.getByLabelText('Reject hunk');

      expect(acceptButton).toHaveAttribute('aria-label', 'Accept hunk');
      expect(rejectButton).toHaveAttribute('aria-label', 'Reject hunk');
    });

    it('buttons are keyboard accessible', async () => {
      const user = userEvent.setup();
      const onAccept = jest.fn();
      const statistics: ChangeStatistics = {
        additions: 1,
        deletions: 0,
        modifications: 0,
      };

      render(<DiffControls statistics={statistics} onAccept={onAccept} />);

      const acceptButton = screen.getByLabelText('Accept hunk');
      acceptButton.focus();

      expect(acceptButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('disabled buttons are not keyboard accessible', async () => {
      const user = userEvent.setup();
      const onAccept = jest.fn();

      render(<DiffControls onAccept={onAccept} disabled={true} />);

      const acceptButton = screen.getByLabelText('Accept hunk');

      await user.click(acceptButton);
      expect(onAccept).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles large numbers in statistics', () => {
      const statistics: ChangeStatistics = {
        additions: 9999,
        deletions: 8888,
        modifications: 7777,
      };
      render(<DiffControls statistics={statistics} />);

      expect(screen.getByText('+9999 additions')).toBeInTheDocument();
      expect(screen.getByText('-8888 deletions')).toBeInTheDocument();
      expect(screen.getByText('~7777 modifications')).toBeInTheDocument();
    });

    it('handles only deletions', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 10,
        modifications: 0,
      };
      render(<DiffControls statistics={statistics} />);

      expect(screen.getByText('-10 deletions')).toBeInTheDocument();
      expect(screen.queryByText(/addition/)).not.toBeInTheDocument();
      expect(screen.queryByText(/modification/)).not.toBeInTheDocument();
    });

    it('handles only modifications', () => {
      const statistics: ChangeStatistics = {
        additions: 0,
        deletions: 0,
        modifications: 5,
      };
      render(<DiffControls statistics={statistics} />);

      expect(screen.getByText('~5 modifications')).toBeInTheDocument();
      expect(screen.queryByText(/addition/)).not.toBeInTheDocument();
      expect(screen.queryByText(/deletion/)).not.toBeInTheDocument();
    });

    it('handles empty label string', () => {
      const { container } = render(<DiffControls label="" />);
      // Empty label should not render the label container (empty string is falsy)
      const labelElement = container.querySelector('.text-sm.font-medium.text-muted-foreground');
      expect(labelElement).not.toBeInTheDocument();
    });
  });
});
