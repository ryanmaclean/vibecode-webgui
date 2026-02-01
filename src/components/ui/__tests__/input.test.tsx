import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Input className="custom-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input');
    });

    it('renders with id attribute', () => {
      render(<Input id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'test-input');
    });
  });

  describe('input types', () => {
    it('renders as a textbox by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('renders text type when explicitly set', () => {
      render(<Input type="text" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders email type', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders password type', () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('renders number type', () => {
      render(<Input type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('user interaction', () => {
    it('handles value changes', async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'Hello World');
      expect(input).toHaveValue('Hello World');
    });

    it('calls onChange handler', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'a');
      expect(handleChange).toHaveBeenCalled();
    });

    it('handles controlled value', () => {
      const { rerender } = render(<Input value="initial" readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial');

      rerender(<Input value="updated" readOnly />);
      expect(input).toHaveValue('updated');
    });
  });

  describe('states', () => {
    it('handles disabled state', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:opacity-50');
    });

    it('handles readOnly state', () => {
      render(<Input readOnly value="readonly" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('handles required state', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
    });
  });

  describe('error handling', () => {
    it('applies error styles when error prop is provided', () => {
      render(<Input error="This field is required" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('sets aria-invalid when error prop is provided', () => {
      render(<Input error="Invalid input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-invalid to false when no error', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('sets aria-describedby with generated error id', () => {
      render(<Input id="email" error="Email is required" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
    });

    it('uses custom errorId when provided', () => {
      render(<Input error="Error" errorId="custom-error-id" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'custom-error-id');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('allows focus via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('accessibility', () => {
    it('associates label with input using htmlFor', () => {
      render(
        <>
          <label htmlFor="email-input">Email</label>
          <Input id="email-input" />
        </>
      );
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Input aria-label="Search" />);
      const input = screen.getByRole('textbox', { name: 'Search' });
      expect(input).toBeInTheDocument();
    });
  });
});
