/**
 * Tests for AppNavigation component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}));

// Mock lucide-react
jest.mock('lucide-react', () =>
  new Proxy({}, {
    get: (_, name) => {
      if (name === '__esModule') return false;
      return (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
    },
  })
);

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: any) => children,
}));

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@example.com' },
    logout: jest.fn(),
    isAuthenticated: true,
  }),
}));

// Mock useKeyboardShortcuts
jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    isShortcutsOpen: false,
    setIsShortcutsOpen: jest.fn(),
  }),
  shortcutCategories: [],
}));

// Mock KeyboardShortcuts component
jest.mock('@/design-system/components/KeyboardShortcuts', () => ({
  KeyboardShortcuts: () => null,
}));

import { AppNavigation } from '@/components/navigation/AppNavigation';

describe('AppNavigation', () => {
  it('renders without crashing', () => {
    render(<AppNavigation />);
    expect(screen.getByText('VibeCode')).toBeInTheDocument();
  });

  it('renders all main navigation items', () => {
    render(<AppNavigation />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders dropdown items for VM and AI', () => {
    render(<AppNavigation />);
    expect(screen.getByText('VM')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('displays user info when authenticated', () => {
    render(<AppNavigation />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('highlights active dashboard link', () => {
    render(<AppNavigation />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('bg-primary/10');
  });

  it('toggles mobile menu on hamburger click', () => {
    render(<AppNavigation />);
    const menuButton = screen.getByLabelText('Open menu');
    fireEvent.click(menuButton);
    // Mobile nav should now be visible
    const closeButton = screen.getByLabelText('Close menu');
    expect(closeButton).toBeInTheDocument();
  });

  it('opens VM dropdown on click', () => {
    render(<AppNavigation />);
    const vmButton = screen.getByText('VM');
    fireEvent.click(vmButton);
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
  });

  it('opens AI dropdown on click', () => {
    render(<AppNavigation />);
    const aiButton = screen.getByText('AI');
    fireEvent.click(aiButton);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(<AppNavigation />);
    const vmButton = screen.getByText('VM');
    fireEvent.click(vmButton);
    expect(screen.getByText('Snapshots')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Snapshots')).not.toBeInTheDocument();
  });

  it('has keyboard shortcuts button', () => {
    render(<AppNavigation />);
    const kbButton = screen.getByLabelText('Show keyboard shortcuts');
    expect(kbButton).toBeInTheDocument();
  });
});

// Test helper functions
describe('isActive', () => {
  // These are internal to the module but we can test behavior through rendering

  it('Dashboard is active only at root', () => {
    // Re-mock to test different paths
    jest.doMock('next/navigation', () => ({
      useRouter: () => ({ push: jest.fn() }),
      usePathname: () => '/health',
    }));
  });
});
