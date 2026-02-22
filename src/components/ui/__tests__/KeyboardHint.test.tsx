import React from 'react';
import { render, screen } from '@testing-library/react';
import { KeyboardHint, KeyBadge, keyboardHintVariants, keyBadgeVariants } from '../KeyboardHint';

describe('KeyboardHint', () => {
  describe('rendering', () => {
    it('renders with single key', () => {
      render(<KeyboardHint keys={['Enter']} />);
      expect(screen.getByLabelText('Keyboard shortcut: Enter')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: Enter')).toBeInTheDocument();
    });

    it('renders with multiple keys', () => {
      render(<KeyboardHint keys={['⌘', 'K']} />);
      expect(screen.getByLabelText('Keyboard shortcut: ⌘ K')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: ⌘')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: K')).toBeInTheDocument();
    });

    it('renders with three keys', () => {
      render(<KeyboardHint keys={['Ctrl', 'Shift', 'P']} />);
      expect(screen.getByLabelText('Keyboard shortcut: Ctrl Shift P')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: Ctrl')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: Shift')).toBeInTheDocument();
      expect(screen.getByLabelText('Key: P')).toBeInTheDocument();
    });

    it('returns null when keys array is empty', () => {
      const { container } = render(<KeyboardHint keys={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('applies custom className', () => {
      render(<KeyboardHint keys={['Esc']} className="custom-hint" />);
      const hint = screen.getByLabelText('Keyboard shortcut: Esc');
      expect(hint).toHaveClass('custom-hint');
    });

    it('applies default styles', () => {
      render(<KeyboardHint keys={['Tab']} data-testid="hint" />);
      const hint = screen.getByTestId('hint');
      expect(hint).toHaveClass('inline-flex');
      expect(hint).toHaveClass('items-center');
      expect(hint).toHaveClass('gap-1');
    });

    it('has correct ARIA role', () => {
      render(<KeyboardHint keys={['Space']} />);
      const hint = screen.getByRole('img');
      expect(hint).toBeInTheDocument();
    });
  });

  describe('separator', () => {
    it('displays default separator (+) between keys', () => {
      const { container } = render(<KeyboardHint keys={['Cmd', 'K']} />);
      expect(container.textContent).toContain('+');
    });

    it('displays custom separator between keys', () => {
      const { container } = render(<KeyboardHint keys={['Cmd', 'K']} separator=" then " />);
      expect(container.textContent).toContain(' then ');
    });

    it('hides separator when showSeparator is false', () => {
      const { container } = render(<KeyboardHint keys={['Cmd', 'K']} showSeparator={false} />);
      expect(container.textContent).not.toContain('+');
    });

    it('does not display separator after last key', () => {
      const { container } = render(<KeyboardHint keys={['A', 'B', 'C']} />);
      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      expect(separators).toHaveLength(2); // Only 2 separators for 3 keys
    });
  });

  describe('sizes', () => {
    it('applies small size styles', () => {
      render(<KeyboardHint keys={['Esc']} size="sm" data-testid="hint" />);
      const hint = screen.getByTestId('hint');
      expect(hint).toHaveClass('text-xs');
      const badge = screen.getByLabelText('Key: Esc');
      expect(badge).toHaveClass('min-w-[24px]');
      expect(badge).toHaveClass('h-6');
    });

    it('applies medium size styles (default)', () => {
      render(<KeyboardHint keys={['Tab']} data-testid="hint" />);
      const hint = screen.getByTestId('hint');
      expect(hint).toHaveClass('text-sm');
      const badge = screen.getByLabelText('Key: Tab');
      expect(badge).toHaveClass('min-w-[28px]');
      expect(badge).toHaveClass('h-7');
    });

    it('applies large size styles', () => {
      render(<KeyboardHint keys={['Enter']} size="lg" data-testid="hint" />);
      const hint = screen.getByTestId('hint');
      expect(hint).toHaveClass('text-base');
      const badge = screen.getByLabelText('Key: Enter');
      expect(badge).toHaveClass('min-w-[32px]');
      expect(badge).toHaveClass('h-8');
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<KeyboardHint keys={['Enter']} variant="default" />);
      const badge = screen.getByLabelText('Key: Enter');
      expect(badge).toHaveClass('border-neutral-300');
      expect(badge).toHaveClass('bg-neutral-100');
    });

    it('applies muted variant styles', () => {
      render(<KeyboardHint keys={['Esc']} variant="muted" />);
      const badge = screen.getByLabelText('Key: Esc');
      expect(badge).toHaveClass('border-neutral-200');
      expect(badge).toHaveClass('bg-neutral-50');
    });

    it('applies primary variant styles', () => {
      render(<KeyboardHint keys={['Space']} variant="primary" />);
      const badge = screen.getByLabelText('Key: Space');
      expect(badge).toHaveClass('border-primary-300');
      expect(badge).toHaveClass('bg-primary-100');
    });
  });

  describe('additional props', () => {
    it('spreads additional props correctly', () => {
      render(<KeyboardHint keys={['Del']} data-testid="custom-hint" title="Delete key" />);
      const hint = screen.getByTestId('custom-hint');
      expect(hint).toHaveAttribute('title', 'Delete key');
    });

    it('applies onClick handler', () => {
      const handleClick = jest.fn();
      render(<KeyboardHint keys={['Click']} onClick={handleClick} />);
      const hint = screen.getByLabelText('Keyboard shortcut: Click');
      hint.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});

describe('KeyBadge', () => {
  describe('rendering', () => {
    it('renders key name', () => {
      render(<KeyBadge keyName="Ctrl" />);
      expect(screen.getByLabelText('Key: Ctrl')).toBeInTheDocument();
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
    });

    it('renders with different key names', () => {
      render(<KeyBadge keyName="⌘" />);
      expect(screen.getByLabelText('Key: ⌘')).toBeInTheDocument();
      expect(screen.getByText('⌘')).toBeInTheDocument();
    });

    it('applies default styles', () => {
      render(<KeyBadge keyName="Tab" />);
      const badge = screen.getByLabelText('Key: Tab');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('justify-center');
      expect(badge).toHaveClass('rounded');
      expect(badge).toHaveClass('border');
      expect(badge).toHaveClass('font-mono');
      expect(badge).toHaveClass('font-semibold');
    });

    it('uses kbd element', () => {
      render(<KeyBadge keyName="Enter" />);
      const badge = screen.getByLabelText('Key: Enter');
      expect(badge.tagName).toBe('KBD');
    });
  });

  describe('sizes', () => {
    it('applies small size', () => {
      render(<KeyBadge keyName="A" size="sm" />);
      const badge = screen.getByLabelText('Key: A');
      expect(badge).toHaveClass('min-w-[24px]');
      expect(badge).toHaveClass('h-6');
      expect(badge).toHaveClass('text-[10px]');
    });

    it('applies medium size (default)', () => {
      render(<KeyBadge keyName="B" />);
      const badge = screen.getByLabelText('Key: B');
      expect(badge).toHaveClass('min-w-[28px]');
      expect(badge).toHaveClass('h-7');
      expect(badge).toHaveClass('text-xs');
    });

    it('applies large size', () => {
      render(<KeyBadge keyName="C" size="lg" />);
      const badge = screen.getByLabelText('Key: C');
      expect(badge).toHaveClass('min-w-[32px]');
      expect(badge).toHaveClass('h-8');
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('variants', () => {
    it('applies default variant', () => {
      render(<KeyBadge keyName="X" variant="default" />);
      const badge = screen.getByLabelText('Key: X');
      expect(badge).toHaveClass('border-neutral-300');
      expect(badge).toHaveClass('bg-neutral-100');
    });

    it('applies muted variant', () => {
      render(<KeyBadge keyName="Y" variant="muted" />);
      const badge = screen.getByLabelText('Key: Y');
      expect(badge).toHaveClass('border-neutral-200');
      expect(badge).toHaveClass('bg-neutral-50');
    });

    it('applies primary variant', () => {
      render(<KeyBadge keyName="Z" variant="primary" />);
      const badge = screen.getByLabelText('Key: Z');
      expect(badge).toHaveClass('border-primary-300');
      expect(badge).toHaveClass('bg-primary-100');
    });
  });
});

describe('keyboardHintVariants function', () => {
  it('returns correct class string for small size', () => {
    const classes = keyboardHintVariants({ size: 'sm' });
    expect(classes).toContain('text-xs');
  });

  it('returns correct class string for medium size', () => {
    const classes = keyboardHintVariants({ size: 'md' });
    expect(classes).toContain('text-sm');
  });

  it('returns correct class string for large size', () => {
    const classes = keyboardHintVariants({ size: 'lg' });
    expect(classes).toContain('text-base');
  });

  it('returns base styles without size specified', () => {
    const classes = keyboardHintVariants({});
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('items-center');
    expect(classes).toContain('gap-1');
  });
});

describe('keyBadgeVariants function', () => {
  it('returns correct class string for small size', () => {
    const classes = keyBadgeVariants({ size: 'sm' });
    expect(classes).toContain('min-w-[24px]');
    expect(classes).toContain('h-6');
  });

  it('returns correct class string for medium size', () => {
    const classes = keyBadgeVariants({ size: 'md' });
    expect(classes).toContain('min-w-[28px]');
    expect(classes).toContain('h-7');
  });

  it('returns correct class string for large size', () => {
    const classes = keyBadgeVariants({ size: 'lg' });
    expect(classes).toContain('min-w-[32px]');
    expect(classes).toContain('h-8');
  });

  it('returns correct class string for default variant', () => {
    const classes = keyBadgeVariants({ variant: 'default' });
    expect(classes).toContain('border-neutral-300');
    expect(classes).toContain('bg-neutral-100');
  });

  it('returns correct class string for muted variant', () => {
    const classes = keyBadgeVariants({ variant: 'muted' });
    expect(classes).toContain('border-neutral-200');
    expect(classes).toContain('bg-neutral-50');
  });

  it('returns correct class string for primary variant', () => {
    const classes = keyBadgeVariants({ variant: 'primary' });
    expect(classes).toContain('border-primary-300');
    expect(classes).toContain('bg-primary-100');
  });

  it('returns base styles without variant specified', () => {
    const classes = keyBadgeVariants({});
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('rounded');
    expect(classes).toContain('border');
  });
});
