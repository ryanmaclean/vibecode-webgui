import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../checkbox';

describe('Checkbox', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('renders unchecked by default', () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('applies custom className', () => {
      render(<Checkbox className="custom-checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('custom-checkbox');
    });

    it('applies default styles', () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('h-4');
      expect(checkbox).toHaveClass('w-4');
      expect(checkbox).toHaveClass('rounded-sm');
      expect(checkbox).toHaveClass('border');
    });
  });

  describe('checked state', () => {
    it('renders checked when checked prop is true', () => {
      render(<Checkbox checked />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('renders unchecked when checked prop is false', () => {
      render(<Checkbox checked={false} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('toggles checked state on click', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');

      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('onCheckedChange callback', () => {
    it('calls onCheckedChange when clicked', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Checkbox onCheckedChange={handleCheckedChange} />);
      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it('calls onCheckedChange with correct value on toggle', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Checkbox onCheckedChange={handleCheckedChange} />);
      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      await user.click(checkbox);
      expect(handleCheckedChange).toHaveBeenCalledWith(false);
    });

    it('works with controlled checked state', () => {
      const handleCheckedChange = jest.fn();
      const { rerender } = render(
        <Checkbox checked={false} onCheckedChange={handleCheckedChange} />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      rerender(<Checkbox checked={true} onCheckedChange={handleCheckedChange} />);
      expect(checkbox).toBeChecked();
    });
  });

  describe('disabled state', () => {
    it('renders disabled when disabled prop is true', () => {
      render(<Checkbox disabled />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('applies disabled styles', () => {
      render(<Checkbox disabled />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('disabled:cursor-not-allowed');
      expect(checkbox).toHaveClass('disabled:opacity-50');
    });

    it('does not call onCheckedChange when disabled', async () => {
      const handleCheckedChange = jest.fn();
      const user = userEvent.setup();
      render(<Checkbox disabled onCheckedChange={handleCheckedChange} />);
      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);
      expect(handleCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('allows focus via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} />);
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('accessibility', () => {
    it('associates with label using htmlFor', () => {
      render(
        <>
          <label htmlFor="terms">Accept terms</label>
          <Checkbox id="terms" />
        </>
      );
      const checkbox = screen.getByLabelText('Accept terms');
      expect(checkbox).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Checkbox aria-label="Enable notifications" />);
      const checkbox = screen.getByRole('checkbox', { name: 'Enable notifications' });
      expect(checkbox).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Checkbox aria-describedby="checkbox-desc" />
          <span id="checkbox-desc">Additional description</span>
        </>
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-describedby', 'checkbox-desc');
    });
  });

  describe('keyboard interaction', () => {
    it('toggles on Space key', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      const checkbox = screen.getByRole('checkbox');

      checkbox.focus();
      await user.keyboard(' ');
      expect(checkbox).toBeChecked();
    });
  });
});
