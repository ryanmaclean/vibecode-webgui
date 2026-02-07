import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  usePathname: () => '/',
}));

// Mock useAuth hook
const mockLogout = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-1', name: 'Test User', email: 'test@vibecode.dev' },
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn(),
    logout: mockLogout,
    signup: jest.fn(),
  }),
}));

// Mock lucide-react icons used by AppNavigation
jest.mock('lucide-react', () => ({
  LayoutDashboard: (props: any) => <svg data-testid="icon-dashboard" {...props} />,
  Monitor: (props: any) => <svg data-testid="icon-monitor" {...props} />,
  Camera: (props: any) => <svg data-testid="icon-camera" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="icon-message" {...props} />,
  Cpu: (props: any) => <svg data-testid="icon-cpu" {...props} />,
  DollarSign: (props: any) => <svg data-testid="icon-dollar" {...props} />,
  BookOpen: (props: any) => <svg data-testid="icon-book" {...props} />,
  HeartPulse: (props: any) => <svg data-testid="icon-heart" {...props} />,
  Activity: (props: any) => <svg data-testid="icon-activity" {...props} />,
  Settings: (props: any) => <svg data-testid="icon-settings" {...props} />,
  Menu: (props: any) => <svg data-testid="icon-menu" {...props} />,
  X: (props: any) => <svg data-testid="icon-x" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="icon-chevron" {...props} />,
  Bot: (props: any) => <svg data-testid="icon-bot" {...props} />,
  Keyboard: (props: any) => <svg data-testid="icon-keyboard" {...props} />,
  Command: (props: any) => <svg data-testid="icon-command" {...props} />,
}));

// Mock KeyboardShortcuts design-system component
jest.mock('@/design-system/components/KeyboardShortcuts', () => ({
  KeyboardShortcuts: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="keyboard-shortcuts-modal">Shortcuts</div> : null,
}));

// Mock useKeyboardShortcuts hook
jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    toggle: jest.fn(),
  }),
  shortcutCategories: [],
}));

import { AppNavigation } from '../AppNavigation';

describe('AppNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AppNavigation />);
    expect(screen.getByText('VibeCode')).toBeInTheDocument();
  });

  it('displays VibeCode branding with link to home', () => {
    render(<AppNavigation />);
    const brandLink = screen.getByText('VibeCode').closest('a');
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders all 6 top-level nav items', () => {
    render(<AppNavigation />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('VM')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders direct nav links for non-dropdown items', () => {
    render(<AppNavigation />);
    // Dashboard, Health, Monitoring, Settings are direct links
    const dashboardLink = screen.getAllByText('Dashboard')[0].closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/');

    const healthLink = screen.getByText('Health').closest('a');
    expect(healthLink).toHaveAttribute('href', '/health');

    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('shows user name when authenticated', () => {
    render(<AppNavigation />);
    expect(screen.getAllByText('Test User').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Sign Out button when authenticated', () => {
    render(<AppNavigation />);
    const signOutButtons = screen.getAllByText('Sign Out');
    expect(signOutButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls logout when Sign Out is clicked', () => {
    render(<AppNavigation />);
    const signOutButtons = screen.getAllByText('Sign Out');
    fireEvent.click(signOutButtons[0]);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('toggles mobile menu when hamburger button is clicked', () => {
    render(<AppNavigation />);
    // The mobile toggle button has aria-label
    const toggleButton = screen.getByLabelText('Open menu');
    expect(toggleButton).toBeInTheDocument();

    // Click to open mobile menu - mobile nav should appear with child items
    fireEvent.click(toggleButton);

    // After opening, the aria-label changes to "Close menu"
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
  });

  it('closes mobile menu when toggle is clicked again', () => {
    render(<AppNavigation />);
    const toggleButton = screen.getByLabelText('Open menu');

    // Open
    fireEvent.click(toggleButton);
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('shows dropdown children for VM when dropdown is opened', () => {
    render(<AppNavigation />);
    // VM is a dropdown button, not a link
    const vmButtons = screen.getAllByText('VM');
    // Click the desktop dropdown button (first occurrence)
    fireEvent.click(vmButtons[0]);
    // Should show child items: Dashboard, Snapshots
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
  });

  it('shows dropdown children for AI when dropdown is opened', () => {
    render(<AppNavigation />);
    const aiButtons = screen.getAllByText('AI');
    fireEvent.click(aiButtons[0]);
    // Should show child items: Chat, Models, Costs, Prompts
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
  });

  it('renders as a sticky header element', () => {
    render(<AppNavigation />);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky');
  });
});
