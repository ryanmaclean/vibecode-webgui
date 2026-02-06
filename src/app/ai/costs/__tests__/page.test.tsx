import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/costs',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Calculator: (props: any) => <svg data-testid="calculator-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

// Mock CostDashboard component
jest.mock('@/components/ai/CostDashboard', () => {
  return {
    __esModule: true,
    default: (props: any) => (
      <div data-testid="cost-dashboard">
        <span data-testid="refresh-interval">{props.refreshInterval}</span>
      </div>
    ),
  };
});

// Mock CostEstimator component
jest.mock('@/components/ai/CostEstimator', () => {
  return {
    __esModule: true,
    default: (props: any) => (
      <div data-testid="cost-estimator">
        <span data-testid="estimator-model">{props.selectedModel}</span>
      </div>
    ),
  };
});

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

import AICostsPage from '../page';

describe('AICostsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AICostsPage />);
    expect(screen.getByText('AI Costs')).toBeInTheDocument();
  });

  it('shows page heading and description', () => {
    render(<AICostsPage />);
    expect(screen.getByText('AI Costs')).toBeInTheDocument();
    expect(screen.getByText(/Monitor spending, set budgets/)).toBeInTheDocument();
  });

  it('renders cost dashboard component', () => {
    render(<AICostsPage />);
    expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-interval')).toHaveTextContent('30000');
  });

  it('shows Cost Estimator button', () => {
    render(<AICostsPage />);
    expect(screen.getByText('Cost Estimator')).toBeInTheDocument();
  });

  it('toggles estimator panel when button is clicked', () => {
    render(<AICostsPage />);

    // Initially estimator is hidden
    expect(screen.queryByText('Quick Cost Estimate')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByText('Cost Estimator'));
    expect(screen.getByText('Quick Cost Estimate')).toBeInTheDocument();
    expect(screen.getByText('Close Estimator')).toBeInTheDocument();

    // Click to close
    fireEvent.click(screen.getByText('Close Estimator'));
    expect(screen.queryByText('Quick Cost Estimate')).not.toBeInTheDocument();
  });

  it('shows model selector in estimator panel', () => {
    render(<AICostsPage />);
    fireEvent.click(screen.getByText('Cost Estimator'));

    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Sample Message')).toBeInTheDocument();
  });

  it('has model options from multiple providers', () => {
    render(<AICostsPage />);
    fireEvent.click(screen.getByText('Cost Estimator'));

    const select = screen.getByLabelText('Model') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('gpt-4o');
    expect(options).toContain('claude-3.5-sonnet');
    expect(options).toContain('gemini-1.5-pro');
  });
});
