import { renderHook, act, waitFor } from '@testing-library/react';
import { useModelSwitcher } from '../useModelSwitcher';

// Mock the useModelSelection hook
const mockSelectModel = jest.fn();
const mockToggleFavorite = jest.fn();
const mockIsFavorite = jest.fn();
const mockDismissNotification = jest.fn();
const mockRevertToPreviousModel = jest.fn();

const mockModelSelection = {
  selectedModel: {
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
  previousModel: null,
  recentModels: [],
  selectModel: mockSelectModel,
  toggleFavorite: mockToggleFavorite,
  isFavorite: mockIsFavorite,
  isLoading: false,
  error: null,
  notification: null,
  dismissNotification: mockDismissNotification,
  revertToPreviousModel: mockRevertToPreviousModel,
};

jest.mock('../useModelSelection', () => ({
  useModelSelection: jest.fn(() => mockModelSelection),
}));

// Mock intelligentModelSelection service
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
  {
    id: 'meta/llama-3-8b',
    name: 'Llama 3 8B',
    provider: 'openrouter',
    costTier: 'free',
    speedTier: 'fast',
    qualityTier: 'good',
    contextLength: 8192,
    strengths: ['general'],
    supportsStreaming: true,
    supportsImages: false,
    supportsCode: true,
    supportsFunctionCalling: false,
  },
];

jest.mock('@/lib/services/intelligent-model-selection', () => ({
  intelligentModelSelection: {
    getAllModels: jest.fn(() => mockModels),
    getModelById: jest.fn((id: string) => mockModels.find((m) => m.id === id)),
  },
}));

describe('useModelSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFavorite.mockReturnValue(false);
  });

  afterEach(() => {
    // Clean up event listeners
    jest.restoreAllMocks();
  });

  describe('initial state', () => {
    it('initializes with panel closed', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.isOpen).toBe(false);
    });

    it('initializes with empty search query', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.searchQuery).toBe('');
    });

    it('loads all models', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.allModels).toHaveLength(3);
    });

    it('initializes with selected model from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.selectedModel?.id).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('panel state management', () => {
    it('opens panel with openPanel', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.openPanel();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes panel with closePanel', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.openPanel();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closePanel();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('clears search query when closing panel', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.openPanel();
        result.current.setSearchQuery('test');
      });

      expect(result.current.searchQuery).toBe('test');

      act(() => {
        result.current.closePanel();
      });

      expect(result.current.searchQuery).toBe('');
    });

    it('toggles panel state with togglePanel', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.togglePanel();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.togglePanel();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('search functionality', () => {
    it('filters models by name', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('Sonnet');
      });

      expect(result.current.filteredModels).toHaveLength(1);
      expect(result.current.filteredModels[0].name).toBe('Claude 3.5 Sonnet');
    });

    it('filters models by id', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('gpt-4o');
      });

      expect(result.current.filteredModels).toHaveLength(1);
      expect(result.current.filteredModels[0].id).toBe('openai/gpt-4o');
    });

    it('filters models by provider', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('openrouter');
      });

      expect(result.current.filteredModels.length).toBeGreaterThan(0);
    });

    it('filters models by strengths', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('code');
      });

      expect(result.current.filteredModels.length).toBeGreaterThan(0);
      expect(
        result.current.filteredModels.every((m) =>
          m.strengths.some((s) => s.toLowerCase().includes('code'))
        )
      ).toBe(true);
    });

    it('is case insensitive', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('CLAUDE');
      });

      expect(result.current.filteredModels.length).toBeGreaterThan(0);
    });

    it('returns all models when search query is empty', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.filteredModels).toHaveLength(mockModels.length);
    });

    it('returns all models when search query is whitespace', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.setSearchQuery('   ');
      });

      expect(result.current.filteredModels).toHaveLength(mockModels.length);
    });
  });

  describe('favorite models', () => {
    it('returns empty array when no favorites', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.favoriteModels).toHaveLength(0);
    });

    it('returns favorite models', () => {
      mockIsFavorite.mockImplementation((id: string) => id === 'openai/gpt-4o');

      const { result } = renderHook(() => useModelSwitcher());

      expect(result.current.favoriteModels.length).toBeGreaterThan(0);
    });
  });

  describe('recent models', () => {
    it('returns empty array when no recent models', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.recentModels).toHaveLength(0);
    });

    it('returns recent models', () => {
      const { useModelSelection } = require('../useModelSelection');
      useModelSelection.mockReturnValue({
        ...mockModelSelection,
        recentModels: ['openai/gpt-4o', 'meta/llama-3-8b'],
      });

      const { result } = renderHook(() => useModelSwitcher());

      expect(result.current.recentModels).toHaveLength(2);
      expect(result.current.recentModels[0].id).toBe('openai/gpt-4o');
      expect(result.current.recentModels[1].id).toBe('meta/llama-3-8b');
    });

    it('filters out undefined models from recent list', () => {
      const { useModelSelection } = require('../useModelSelection');
      useModelSelection.mockReturnValue({
        ...mockModelSelection,
        recentModels: ['openai/gpt-4o', 'non-existent-model'],
      });

      const { result } = renderHook(() => useModelSwitcher());

      expect(result.current.recentModels).toHaveLength(1);
      expect(result.current.recentModels[0].id).toBe('openai/gpt-4o');
    });
  });

  describe('model selection', () => {
    it('calls modelSelection.selectModel when selecting a model', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.selectModel('openai/gpt-4o');
      });

      expect(mockSelectModel).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('closes panel after selecting model when autoCloseOnSelect is true', () => {
      const { result } = renderHook(() => useModelSwitcher({ autoCloseOnSelect: true }));

      act(() => {
        result.current.openPanel();
        result.current.selectModel('openai/gpt-4o');
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('does not close panel after selecting model when autoCloseOnSelect is false', () => {
      const { result } = renderHook(() => useModelSwitcher({ autoCloseOnSelect: false }));

      act(() => {
        result.current.openPanel();
        result.current.selectModel('openai/gpt-4o');
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('keyboard shortcuts', () => {
    it('toggles panel on Cmd+M', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('toggles panel on Ctrl+M', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes panel on Escape when open', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      act(() => {
        result.current.openPanel();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('does not handle Escape when panel is closed', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('ignores shortcuts when typing in input', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true, bubbles: true });
        Object.defineProperty(event, 'target', { value: input, enumerable: true });
        input.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);

      document.body.removeChild(input);
    });

    it('ignores shortcuts when typing in textarea', () => {
      const { result } = renderHook(() => useModelSwitcher({ enableKeyboardShortcuts: true }));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true, bubbles: true });
        Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
        textarea.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);

      document.body.removeChild(textarea);
    });

    it('does not register shortcuts when disabled', () => {
      const { result } = renderHook(() =>
        useModelSwitcher({ enableKeyboardShortcuts: false })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('options', () => {
    it('accepts default options', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.isOpen).toBe(false);
    });

    it('respects autoCloseOnSelect option', () => {
      const { result } = renderHook(() => useModelSwitcher({ autoCloseOnSelect: false }));

      act(() => {
        result.current.openPanel();
        result.current.selectModel('openai/gpt-4o');
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('respects enableKeyboardShortcuts option', () => {
      const { result } = renderHook(() =>
        useModelSwitcher({ enableKeyboardShortcuts: false })
      );

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm', metaKey: true });
        document.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('integration with useModelSelection', () => {
    it('exposes toggleFavorite from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.toggleFavorite('openai/gpt-4o');
      });

      expect(mockToggleFavorite).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('exposes isFavorite from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      result.current.isFavorite('openai/gpt-4o');
      expect(mockIsFavorite).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('exposes previousModel from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.previousModel).toBe(mockModelSelection.previousModel);
    });

    it('exposes isLoading from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.isLoading).toBe(mockModelSelection.isLoading);
    });

    it('exposes error from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.error).toBe(mockModelSelection.error);
    });

    it('exposes notification from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());
      expect(result.current.notification).toBe(mockModelSelection.notification);
    });

    it('exposes dismissNotification from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.dismissNotification();
      });

      expect(mockDismissNotification).toHaveBeenCalled();
    });

    it('exposes revertToPreviousModel from useModelSelection', () => {
      const { result } = renderHook(() => useModelSwitcher());

      act(() => {
        result.current.revertToPreviousModel();
      });

      expect(mockRevertToPreviousModel).toHaveBeenCalled();
    });
  });
});
