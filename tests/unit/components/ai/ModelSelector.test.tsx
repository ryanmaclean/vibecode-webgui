/**
 * Tests for ModelSelector component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react
jest.mock('lucide-react', () =>
  new Proxy({}, {
    get: (_, name) => {
      if (name === '__esModule') return false;
      return (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
    },
  })
);

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => <span className={className} {...props}>{children}</span>,
}));

jest.mock('@/components/ui/input', () => {
  const MockReact = require('react');
  return {
    Input: MockReact.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  };
});

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...props} />
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

import ModelSelector from '@/components/ai/ModelSelector';
import type { ModelProfile } from '@/types/model-comparison';

// Test model data
const mockModels: ModelProfile[] = [
  {
    id: 'openai/gpt-4',
    name: 'GPT-4',
    description: 'Most capable OpenAI model',
    provider: { id: 'openai', name: 'OpenAI', tier: 'premium' as any, available: true, website: '', models: [] },
    qualityTier: 'state_of_art',
    pricing: { inputPer1K: 0.03, outputPer1K: 0.06, currency: 'USD' },
    limits: { contextWindow: 128000, maxOutputTokens: 4096 },
    performance: { speedTier: 'medium', averageLatency: 2000, tokensPerSecond: 50 },
    capabilities: { coding: 95, reasoning: 95, creative: 90, vision: 85, function_calling: true, streaming: true },
    tags: ['coding', 'reasoning'],
    deprecated: false,
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and affordable Anthropic model',
    provider: { id: 'anthropic', name: 'Anthropic', tier: 'premium' as any, available: true, website: '', models: [] },
    qualityTier: 'good',
    pricing: { inputPer1K: 0.00025, outputPer1K: 0.00125, currency: 'USD' },
    limits: { contextWindow: 200000, maxOutputTokens: 4096 },
    performance: { speedTier: 'very_fast', averageLatency: 500, tokensPerSecond: 200 },
    capabilities: { coding: 70, reasoning: 75, creative: 70, vision: 0, function_calling: true, streaming: true },
    tags: ['fast', 'affordable'],
    deprecated: false,
  },
  {
    id: 'meta/llama-3-70b',
    name: 'Llama 3 70B',
    description: 'Open-source Meta model',
    provider: { id: 'meta', name: 'Meta', tier: 'free' as any, available: true, website: '', models: [] },
    qualityTier: 'excellent',
    pricing: { inputPer1K: 0, outputPer1K: 0, currency: 'USD' },
    limits: { contextWindow: 8192, maxOutputTokens: 2048 },
    performance: { speedTier: 'fast', averageLatency: 1000, tokensPerSecond: 100 },
    capabilities: { coding: 80, reasoning: 85, creative: 75, vision: 0, function_calling: false, streaming: true },
    tags: ['open-source', 'free'],
    deprecated: false,
  },
];

describe('ModelSelector', () => {
  const defaultProps = {
    models: mockModels,
    onModelSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with label', () => {
    render(<ModelSelector {...defaultProps} />);
    expect(screen.getByText('AI Model')).toBeInTheDocument();
  });

  it('shows placeholder when no model selected', () => {
    render(<ModelSelector {...defaultProps} />);
    expect(screen.getByText('Select a model...')).toBeInTheDocument();
  });

  it('shows custom placeholder', () => {
    render(<ModelSelector {...defaultProps} placeholder="Choose model" />);
    expect(screen.getByText('Choose model')).toBeInTheDocument();
  });

  it('shows selected model name', () => {
    render(<ModelSelector {...defaultProps} selectedModelId="openai/gpt-4" />);
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<ModelSelector {...defaultProps} />);
    const trigger = screen.getByText('Select a model...');
    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    expect(screen.getByText('3 models')).toBeInTheDocument();
  });

  it('renders quick filter presets', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    expect(screen.getByText('Best for Coding')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();
    expect(screen.getByText('Fastest')).toBeInTheDocument();
    expect(screen.getByText('Free Models')).toBeInTheDocument();
  });

  it('filters models by search query', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'GPT' } });

    expect(screen.getByText('1 models')).toBeInTheDocument();
  });

  it('shows no results message', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No models found')).toBeInTheDocument();
  });

  it('clears search on X click', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'GPT' } });
    expect(screen.getByText('1 models')).toBeInTheDocument();

    // Clear search
    const clearBtn = searchInput.parentElement?.querySelector('button');
    if (clearBtn) {
      fireEvent.click(clearBtn);
      expect(screen.getByText('3 models')).toBeInTheDocument();
    }
  });

  it('closes dropdown on Escape', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<ModelSelector {...defaultProps} disabled={true} />);
    fireEvent.click(screen.getByText('Select a model...'));
    expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
  });

  it('toggles quick filter', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    // Apply Fastest filter
    fireEvent.click(screen.getByText('Fastest'));

    // Should filter to models with fast or very_fast speed
    // Both Claude 3 Haiku (very_fast) and Llama 3 70B (fast) match
    expect(screen.getByText('2 models')).toBeInTheDocument();

    // Toggle off
    fireEvent.click(screen.getByText('Fastest'));
    expect(screen.getByText('3 models')).toBeInTheDocument();
  });

  it('shows favorites section when favorite models provided', () => {
    render(<ModelSelector {...defaultProps} favoriteModelIds={['openai/gpt-4']} />);
    fireEvent.click(screen.getByText('Select a model...'));

    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('shows recent section when recent models provided', () => {
    render(<ModelSelector {...defaultProps} recentModelIds={['anthropic/claude-3-haiku']} />);
    fireEvent.click(screen.getByText('Select a model...'));

    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('calls onFavoriteToggle when star clicked', () => {
    const onFavoriteToggle = jest.fn();
    render(
      <ModelSelector
        {...defaultProps}
        onFavoriteToggle={onFavoriteToggle}
        favoriteModelIds={[]}
      />
    );
    fireEvent.click(screen.getByText('Select a model...'));

    // Expand a provider to see models
    const providers = screen.getAllByRole('button');
    const openaiProvider = providers.find(p => p.textContent?.includes('OpenAI'));
    if (openaiProvider) {
      fireEvent.click(openaiProvider);
    }

    // Find and click favorite button
    const favoriteButtons = screen.getAllByLabelText('Add to favorites');
    if (favoriteButtons.length > 0) {
      fireEvent.click(favoriteButtons[0]);
      expect(onFavoriteToggle).toHaveBeenCalled();
    }
  });

  it('renders custom label', () => {
    render(<ModelSelector {...defaultProps} label="Choose AI Model" />);
    expect(screen.getByText('Choose AI Model')).toBeInTheDocument();
  });

  it('has more filters toggle', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Select a model...'));

    expect(screen.getByText('More filters')).toBeInTheDocument();
    fireEvent.click(screen.getByText('More filters'));

    expect(screen.getByText('Min Quality')).toBeInTheDocument();
    expect(screen.getByText('Min Speed')).toBeInTheDocument();
  });
});
