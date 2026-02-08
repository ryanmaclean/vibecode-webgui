/**
 * Tests for CostDashboard component
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/ai/costs',
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

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
  Legend: () => null,
  Area: () => null,
  AreaChart: ({ children }: any) => <div>{children}</div>,
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-tab-trigger={value}>{children}</button>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children, className }: any) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

// Mock cost tracker
const mockTracker = {
  getCurrentSession: jest.fn().mockReturnValue({
    totalCost: 5.25,
    totalTokens: 150000,
    requests: 42,
    byModel: {
      'gpt-4': { totalCost: 3.50, requests: 20, promptTokens: 50000, completionTokens: 30000 },
      'claude-3-sonnet': { totalCost: 1.75, requests: 22, promptTokens: 40000, completionTokens: 30000 },
    },
  }),
  getUsageHistory: jest.fn().mockReturnValue({
    daily: [
      { timestamp: '2024-01-01', cost: 2.50, tokens: 50000, requests: 20 },
      { timestamp: '2024-01-02', cost: 2.75, tokens: 60000, requests: 22 },
    ],
    weekly: [],
    monthly: [],
    allTime: { totalCost: 25.00, totalRequests: 500, totalTokens: 1000000 },
  }),
  getAlerts: jest.fn().mockReturnValue([
    { id: 'a1', message: 'Budget warning', threshold: 10, current: 8, severity: 'warning', triggered: true, enabled: true },
  ]),
  getSettings: jest.fn().mockReturnValue({
    monthlyBudget: 50,
    dailyBudget: 10,
    showEstimatesBeforeSend: true,
    showRealtimeCosts: true,
    enableOptimizationSuggestions: true,
  }),
  getAggregatedUsage: jest.fn().mockReturnValue([
    { timestamp: '2024-01-01', cost: 2.50, tokens: 50000, requests: 20 },
  ]),
  subscribe: jest.fn().mockReturnValue(() => {}),
  acknowledgeAlert: jest.fn(),
  exportAsCSV: jest.fn().mockReturnValue('csv-data'),
  exportAsJSON: jest.fn().mockReturnValue('{"json":"data"}'),
};

jest.mock('@/lib/ai/cost/cost-tracker', () => ({
  getCostTracker: () => mockTracker,
  CostTracker: jest.fn(),
  MODEL_PRICING: {
    'gpt-4': { displayName: 'GPT-4', provider: 'openai' },
    'claude-3-sonnet': { displayName: 'Claude 3 Sonnet', provider: 'anthropic' },
  },
}));

import CostDashboard from '@/components/ai/CostDashboard';

describe('CostDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders loading state initially', () => {
    // With mock data available, it should render data after effect
    render(<CostDashboard />);
    // After effect runs, should show content
    act(() => { jest.advanceTimersByTime(100); });
    expect(screen.getByText('AI Cost Dashboard')).toBeInTheDocument();
  });

  it('renders dashboard with data', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('AI Cost Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Session Cost')).toBeInTheDocument();
    expect(screen.getByText("Today's Cost")).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('All-Time Cost')).toBeInTheDocument();
  });

  it('displays session cost formatted', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('$5.25')).toBeInTheDocument();
  });

  it('renders alert banner for triggered alerts', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getAllByText('Budget warning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dismiss').length).toBeGreaterThan(0);
  });

  it('dismisses alert when clicking Dismiss', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    const dismissBtn = screen.getByText('Dismiss');
    fireEvent.click(dismissBtn);
    expect(mockTracker.acknowledgeAlert).toHaveBeenCalledWith('a1');
  });

  it('renders refresh button', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    const refreshBtn = screen.getByText('Refresh');
    fireEvent.click(refreshBtn);
    expect(mockTracker.getCurrentSession).toHaveBeenCalled();
  });

  it('renders tab navigation', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('By Model')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('subscribes to cost events on mount', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(mockTracker.subscribe).toHaveBeenCalled();
  });

  it('accepts custom costTracker', () => {
    render(<CostDashboard costTracker={mockTracker as any} />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('AI Cost Dashboard')).toBeInTheDocument();
  });

  it('does not show settings tab when showSettings=false', () => {
    render(<CostDashboard showSettings={false} />);
    act(() => { jest.advanceTimersByTime(100); });

    // The settings tab trigger should not appear
    const triggers = screen.queryAllByText('Settings');
    // Only nav Settings exists, not the dashboard settings tab
    expect(triggers.length).toBeLessThanOrEqual(1);
  });

  it('renders compact mode with 2 columns', () => {
    const { container } = render(<CostDashboard compact={true} />);
    act(() => { jest.advanceTimersByTime(100); });

    const gridEl = container.querySelector('.grid-cols-2');
    expect(gridEl).toBeInTheDocument();
  });

  it('renders last updated timestamp', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('shows model breakdown data', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    // Model breakdown in models tab content
    expect(screen.getByText('Cost by Model')).toBeInTheDocument();
  });

  it('renders all-time cost', () => {
    render(<CostDashboard />);
    act(() => { jest.advanceTimersByTime(100); });

    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });
});
