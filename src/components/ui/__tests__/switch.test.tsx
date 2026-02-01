import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../switch';

describe('Switch', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Switch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toBeInTheDocument();
    });

    it('renders unchecked by default', () => {
      render(<Switch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    });

    it('applies default styles', () => {
      render(<Switch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('peer');
      expect(switchElement).toHaveClass('inline-flex');
      expect(switchElement).toHaveClass('h-6');
      expect(switchElement).toHaveClass('w-11');
      expect(switchElement).toHaveClass('shrink-0');
      expect(switchElement).toHaveClass('cursor-pointer');
      expect(switchElement).toHaveClass('items-center');
      expect(switchElement).toHaveClass('rounded-full');
    });

    it('applies custom className', () => {
      render(<Switch className="custom-switch" />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('custom-switch');
    });
  });

  describe('checked state', () => {
    it('renders checked when checked prop is true', () => {
      render(<Switch checked />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'checked');
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('renders unchecked when checked prop is false', () => {
      render(<Switch checked={false} />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('toggles checked state on click', async () => {
      const user = userEvent.setup();
      render(<Switch />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('data-state', 'unchecked');

      await user.click(switchElement);

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('data-state', 'checked');
      });

      await user.click(switchElement);

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('data-state', 'unchecked');
      });
    });
  });

  describe('onCheckedChange callback', () => {
    it('calls onCheckedChange when clicked', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Switch onCheckedChange={handleCheckedChange} />);
      const switchElement = screen.getByRole('switch');

      await user.click(switchElement);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it('calls onCheckedChange with correct value on toggle', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Switch onCheckedChange={handleCheckedChange} />);
      const switchElement = screen.getByRole('switch');

      await user.click(switchElement);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      await user.click(switchElement);
      expect(handleCheckedChange).toHaveBeenCalledWith(false);
    });

    it('works with controlled checked state', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <Switch checked={false} onCheckedChange={handleCheckedChange} />
      );
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');

      await user.click(switchElement);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      rerender(<Switch checked={true} onCheckedChange={handleCheckedChange} />);
      expect(switchElement).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('disabled state', () => {
    it('renders disabled when disabled prop is true', () => {
      render(<Switch disabled />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toBeDisabled();
    });

    it('applies disabled styles', () => {
      render(<Switch disabled />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('disabled:cursor-not-allowed');
      expect(switchElement).toHaveClass('disabled:opacity-50');
    });

    it('does not call onCheckedChange when disabled', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Switch disabled onCheckedChange={handleCheckedChange} />);
      const switchElement = screen.getByRole('switch');

      await user.click(switchElement);
      expect(handleCheckedChange).not.toHaveBeenCalled();
    });

    it('does not toggle state when disabled', async () => {
      const user = userEvent.setup();
      render(<Switch disabled />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
      await user.click(switchElement);
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Switch ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('allows focus via ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Switch ref={ref} />);
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('accessibility', () => {
    it('has correct role', () => {
      render(<Switch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toBeInTheDocument();
    });

    it('associates with label using htmlFor', () => {
      render(
        <>
          <label htmlFor="notifications">Enable notifications</label>
          <Switch id="notifications" />
        </>
      );
      const switchElement = screen.getByLabelText('Enable notifications');
      expect(switchElement).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Switch aria-label="Toggle dark mode" />);
      const switchElement = screen.getByRole('switch', { name: 'Toggle dark mode' });
      expect(switchElement).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Switch aria-describedby="switch-desc" />
          <span id="switch-desc">Additional description</span>
        </>
      );
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-describedby', 'switch-desc');
    });

    it('has correct aria-checked attribute', async () => {
      const user = userEvent.setup();
      render(<Switch />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(switchElement);

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('keyboard interaction', () => {
    it('toggles on Space key', async () => {
      const user = userEvent.setup();
      render(<Switch />);
      const switchElement = screen.getByRole('switch');

      switchElement.focus();
      await user.keyboard(' ');

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('data-state', 'checked');
      });
    });

    it('toggles on Enter key', async () => {
      const user = userEvent.setup();
      render(<Switch />);
      const switchElement = screen.getByRole('switch');

      switchElement.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(switchElement).toHaveAttribute('data-state', 'checked');
      });
    });
  });

  describe('visual states', () => {
    it('applies unchecked background color', () => {
      render(<Switch />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('data-[state=unchecked]:bg-input');
    });

    it('applies checked background color', () => {
      render(<Switch checked />);
      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveClass('data-[state=checked]:bg-primary');
    });
  });
});
