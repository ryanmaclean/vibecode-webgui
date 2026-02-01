import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '../badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Badge>New</Badge>);
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(<Badge>Status: Active</Badge>);
      expect(screen.getByText('Status: Active')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Badge className="custom-badge">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('custom-badge');
    });

    it('applies default styles', () => {
      render(<Badge data-testid="badge">Badge</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('border');
      expect(badge).toHaveClass('px-2.5');
      expect(badge).toHaveClass('py-0.5');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('font-semibold');
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<Badge variant="default" data-testid="badge">Default</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-primary');
      expect(badge).toHaveClass('text-primary-foreground');
    });

    it('applies secondary variant styles', () => {
      render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-secondary');
      expect(badge).toHaveClass('text-secondary-foreground');
    });

    it('applies destructive variant styles', () => {
      render(<Badge variant="destructive" data-testid="badge">Destructive</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-destructive');
      expect(badge).toHaveClass('text-destructive-foreground');
    });

    it('applies outline variant styles', () => {
      render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('text-foreground');
    });

    it('uses default variant when not specified', () => {
      render(<Badge data-testid="badge">No Variant</Badge>);
      const badge = screen.getByTestId('badge');
      expect(badge).toHaveClass('bg-primary');
    });
  });

  describe('badgeVariants function', () => {
    it('returns correct class string for default variant', () => {
      const classes = badgeVariants({ variant: 'default' });
      expect(classes).toContain('bg-primary');
      expect(classes).toContain('text-primary-foreground');
    });

    it('returns correct class string for secondary variant', () => {
      const classes = badgeVariants({ variant: 'secondary' });
      expect(classes).toContain('bg-secondary');
      expect(classes).toContain('text-secondary-foreground');
    });

    it('returns correct class string for destructive variant', () => {
      const classes = badgeVariants({ variant: 'destructive' });
      expect(classes).toContain('bg-destructive');
      expect(classes).toContain('text-destructive-foreground');
    });

    it('returns correct class string for outline variant', () => {
      const classes = badgeVariants({ variant: 'outline' });
      expect(classes).toContain('text-foreground');
    });

    it('returns base styles without variant specified', () => {
      const classes = badgeVariants({});
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('rounded-full');
    });
  });

  describe('additional props', () => {
    it('spreads additional props correctly', () => {
      render(<Badge data-testid="badge" role="status">Status</Badge>);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
    });

    it('applies onClick handler', () => {
      const handleClick = jest.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      const badge = screen.getByText('Clickable');
      badge.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
