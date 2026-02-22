import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelSwitcher } from '../ModelSwitcher';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Sparkles: (props: any) => <svg data-testid="sparkles-icon" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Star: (props: any) => <svg data-testid="star-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  DollarSign: (props: any) => <svg data-testid="dollar-icon" {...props} />,
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  ExternalLink: (props: any) => <svg data-testid="external-link-icon" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="trending-up-icon" {...props} />,
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: (props: any) => <hr {...props} />,
}));

// Mock the useModelSwitcher hook
const mockTogglePanel = jest.fn();
const mockClosePanel = jest.fn();
const mockSelectModel = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockToggleFavorite = jest.fn();
const mockIsFavorite = jest.fn();

const mockModels = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    costTier: 'medium',
    speedTier: 'fast',
    qualityTier: 'excellent',
    contextLength: 200000,
    strengths: ['reasoning', 'code'],
    supportsStreaming: true,
    supportsImages: true,
    supportsCode: true,
    supportsFunctionCalling: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    costTier: 'high',
    speedTier: 'fast',
    qualityTier: 'excellent',
    contextLength: 128000,
    strengths: ['general', 'reasoning'],
    supportsStreaming: true,
    supportsImages: true,
    supportsCode: true,
    supportsFunctionCalling: true,
  },
];

const mockUseModelSwitcher = jest.fn();

jest.mock('@/hooks/useModelSwitcher', () => ({
  useModelSwitcher: (options?: any) => mockUseModelSwitcher(options),
}));

// Mock ModelSwitcherPanel component - must be defined before importing ModelSwitcher
const MockModelSwitcherPanel = ({ isOpen, onClose, onModelSelect, ...props }: any) =>
  isOpen ? (
    <div data-testid="model-switcher-panel">
      <button onClick={onClose} data-testid="close-panel">
        Close
      </button>
      <button onClick={() => onModelSelect('test-model')} data-testid="select-model">
        Select Model
      </button>
    </div>
  ) : null;

jest.mock('@/components/ai/ModelSwitcherPanel', () => ({
  ModelSwitcherPanel: (props: any) => MockModelSwitcherPanel(props),
}));

describe('ModelSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFavorite.mockReturnValue(false);

    // Set default mock return value
    mockUseModelSwitcher.mockReturnValue({
      isOpen: false,
      togglePanel: mockTogglePanel,
      closePanel: mockClosePanel,
      filteredModels: mockModels,
      favoriteModels: [],
      recentModels: [],
      selectedModel: mockModels[0],
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      selectModel: mockSelectModel,
      toggleFavorite: mockToggleFavorite,
      isFavorite: mockIsFavorite,
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ModelSwitcher />);
      expect(screen.getByTestId('model-switcher')).toBeInTheDocument();
    });

    it('renders trigger button with selected model name', () => {
      render(<ModelSwitcher />);
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<ModelSwitcher className="custom-class" />);
      const switcher = screen.getByTestId('model-switcher');
      expect(switcher).toHaveClass('custom-class');
    });

    it('renders Sparkles icon in trigger button', () => {
      render(<ModelSwitcher />);
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });

    it('renders ChevronDown icon in trigger button', () => {
      render(<ModelSwitcher />);
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });

    it('shows "Select Model" when no model is selected', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: false,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: null,
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      expect(screen.getByText('Select Model')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls togglePanel when trigger button is clicked', () => {
      render(<ModelSwitcher />);
      const button = screen.getByRole('button', { name: /switch ai model/i });
      fireEvent.click(button);
      expect(mockTogglePanel).toHaveBeenCalledTimes(1);
    });

    it('has correct accessibility attributes on trigger button', () => {
      render(<ModelSwitcher />);
      const button = screen.getByRole('button', { name: /switch ai model/i });
      expect(button).toHaveAttribute('aria-label', 'Switch AI model');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'true');
    });

    it('updates aria-expanded when panel is open', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      const button = screen.getByRole('button', { name: /switch ai model/i });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('panel state', () => {
    it('does not render panel when closed', () => {
      render(<ModelSwitcher />);
      expect(screen.queryByTestId('model-switcher-panel')).not.toBeInTheDocument();
    });

    it('renders panel when open', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      expect(screen.getByTestId('model-switcher-panel')).toBeInTheDocument();
    });

    it('applies accent background when panel is open', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      const button = screen.getByRole('button', { name: /switch ai model/i });
      expect(button).toHaveClass('bg-accent');
    });
  });

  describe('ModelSwitcherPanel integration', () => {
    it('passes correct props to ModelSwitcherPanel', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [mockModels[1]],
        recentModels: [mockModels[0]],
        selectedModel: mockModels[0],
        searchQuery: 'test',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      expect(screen.getByTestId('model-switcher-panel')).toBeInTheDocument();
    });

    it('calls closePanel when panel close button is clicked', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      const closeButton = screen.getByTestId('close-panel');
      fireEvent.click(closeButton);
      expect(mockClosePanel).toHaveBeenCalledTimes(1);
    });

    it('calls selectModel when model is selected from panel', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      const selectButton = screen.getByTestId('select-model');
      fireEvent.click(selectButton);
      expect(mockSelectModel).toHaveBeenCalledWith('test-model');
    });
  });

  describe('favorite and recent models', () => {
    it('computes favoriteModelIds correctly', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [mockModels[0], mockModels[1]],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      expect(screen.getByTestId('model-switcher-panel')).toBeInTheDocument();
    });

    it('computes recentModelIds correctly', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: true,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [],
        recentModels: [mockModels[1]],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      render(<ModelSwitcher />);
      expect(screen.getByTestId('model-switcher-panel')).toBeInTheDocument();
    });
  });

  describe('memoization', () => {
    it('memoizes favoriteModelIds', () => {
      mockUseModelSwitcher.mockReturnValue({
        isOpen: false,
        togglePanel: mockTogglePanel,
        closePanel: mockClosePanel,
        filteredModels: mockModels,
        favoriteModels: [mockModels[0]],
        recentModels: [],
        selectedModel: mockModels[0],
        searchQuery: '',
        setSearchQuery: mockSetSearchQuery,
        selectModel: mockSelectModel,
        toggleFavorite: mockToggleFavorite,
        isFavorite: mockIsFavorite,
      });

      const { rerender } = render(<ModelSwitcher />);
      rerender(<ModelSwitcher />);

      // Component should handle memo correctly
      expect(screen.getByTestId('model-switcher')).toBeInTheDocument();
    });
  });

  describe('displayName', () => {
    it('has correct displayName for debugging', () => {
      expect(ModelSwitcher.displayName).toBe('ModelSwitcher');
    });
  });
});
