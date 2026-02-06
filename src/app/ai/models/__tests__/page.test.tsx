import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/models',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Brain: (props: any) => <svg data-testid="brain-icon" {...props} />,
  Sparkles: (props: any) => <svg data-testid="sparkles-icon" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-icon" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="refresh-icon" {...props} />,
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

// Mock child components
jest.mock('@/components/ai/ModelSelector', () => {
  return {
    __esModule: true,
    default: (props: any) => <div data-testid="model-selector">ModelSelector</div>,
  };
});

jest.mock('@/components/ai/ModelComparison', () => {
  return {
    __esModule: true,
    default: (props: any) => <div data-testid="model-comparison">ModelComparison</div>,
  };
});

jest.mock('@/components/ai/ModelDetails', () => {
  return {
    __esModule: true,
    default: (props: any) => <div data-testid="model-details">ModelDetails</div>,
  };
});

import AIModelsPage from '../page';

describe('AIModelsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
      },
      writable: true,
    });
  });

  it('renders without crashing', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<AIModelsPage />);
    expect(screen.getByText('AI Models')).toBeInTheDocument();
  });

  it('shows page description', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<AIModelsPage />);
    expect(screen.getByText(/Browse, compare, and get recommendations/)).toBeInTheDocument();
  });

  it('shows loading state while fetching models', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<AIModelsPage />);
    expect(screen.getByText('Loading models...')).toBeInTheDocument();
  });

  it('renders model selector and comparison after loading', async () => {
    const mockModels = [
      { id: 'gpt-4o', name: 'GPT-4o', provider: { id: 'openai', name: 'OpenAI' } },
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { models: mockModels } }),
      })
    ) as jest.Mock;

    render(<AIModelsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('model-comparison')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    ) as jest.Mock;

    render(<AIModelsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch models: 500/)).toBeInTheDocument();
    });
  });

  it('shows recommendation panel with task type selector', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { models: [] } }),
      })
    ) as jest.Mock;

    render(<AIModelsPage />);

    await waitFor(() => {
      const recTexts = screen.getAllByText('Get Recommendation');
      expect(recTexts.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Task Type')).toBeInTheDocument();
  });
});
