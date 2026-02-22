import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureAvailabilityPanel } from '../FeatureAvailabilityPanel';
import {
  type FeatureAvailabilityStatus,
  FeatureStatus,
  FeatureCategory,
} from '@/lib/offline-features';

// Mock fetch globally
global.fetch = jest.fn();

describe('FeatureAvailabilityPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFeatureStatus: FeatureAvailabilityStatus = {
    ai: {
      status: FeatureStatus.AVAILABLE,
      available: true,
      ollamaAvailable: true,
      installedModels: ['codellama', 'llama2'],
      recommendedModels: ['codellama', 'llama2'],
      missingModels: [],
      hasRecommendedModel: true,
      modelCount: 2,
      timestamp: Date.now(),
    },
    vectorDb: {
      status: FeatureStatus.AVAILABLE,
      available: true,
      connected: true,
      pgVectorInstalled: true,
      provider: 'postgres',
      timestamp: Date.now(),
    },
    cache: {
      status: FeatureStatus.AVAILABLE,
      available: true,
      enabled: true,
      backend: 'memory',
      timestamp: Date.now(),
    },
    templates: {
      status: FeatureStatus.AVAILABLE,
      available: true,
      templateCount: 5,
      localOnly: true,
      timestamp: Date.now(),
    },
    offlineReady: true,
    availableFeatures: [
      FeatureCategory.AI,
      FeatureCategory.VECTOR_DB,
      FeatureCategory.CACHE,
      FeatureCategory.TEMPLATES,
    ],
    unavailableFeatures: [],
    timestamp: Date.now(),
  };

  describe('rendering', () => {
    it('renders loading state initially', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<FeatureAvailabilityPanel />);
      expect(screen.getByTestId('feature-availability-panel')).toBeInTheDocument();
      expect(screen.getByText('Loading feature status...')).toBeInTheDocument();
    });

    it('renders feature availability panel with all features', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('System is ready for offline operation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('ai-feature')).toBeInTheDocument();
      expect(screen.getByTestId('vector-db-feature')).toBeInTheDocument();
      expect(screen.getByTestId('cache-feature')).toBeInTheDocument();
      expect(screen.getByTestId('templates-feature')).toBeInTheDocument();
    });

    it('applies custom className', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel className="custom-class" />);

      await waitFor(() => {
        const panel = screen.getByTestId('feature-availability-panel');
        expect(panel).toHaveClass('custom-class');
      });
    });
  });

  describe('AI feature status', () => {
    it('displays AI feature with available status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('AI Models')).toBeInTheDocument();
      });

      expect(screen.getByText('Ollama: Running')).toBeInTheDocument();
      expect(screen.getByText('Installed Models: 2')).toBeInTheDocument();

      const availableBadges = screen.getAllByText('Available');
      expect(availableBadges.length).toBeGreaterThan(0);
    });

    it('displays AI feature with missing models warning', async () => {
      const statusWithMissingModels = {
        ...mockFeatureStatus,
        ai: {
          ...mockFeatureStatus.ai,
          status: FeatureStatus.DEGRADED,
          missingModels: ['mistral'],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithMissingModels }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Missing recommended: mistral')).toBeInTheDocument();
      });
    });

    it('displays AI feature when Ollama is not available', async () => {
      const statusWithOllamaUnavailable = {
        ...mockFeatureStatus,
        ai: {
          ...mockFeatureStatus.ai,
          status: FeatureStatus.UNAVAILABLE,
          available: false,
          ollamaAvailable: false,
          error: 'Ollama service not available',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithOllamaUnavailable }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Ollama: Not available')).toBeInTheDocument();
      });
    });
  });

  describe('Vector DB feature status', () => {
    it('displays Vector DB feature with available status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Vector Search')).toBeInTheDocument();
      });

      expect(screen.getByText('Database: Connected')).toBeInTheDocument();
      expect(screen.getByText('Provider: postgres')).toBeInTheDocument();
      expect(screen.getByText(/pgvector:.*Installed/)).toBeInTheDocument();
    });

    it('displays Vector DB feature when not connected', async () => {
      const statusWithVectorDbDisconnected = {
        ...mockFeatureStatus,
        vectorDb: {
          ...mockFeatureStatus.vectorDb,
          status: FeatureStatus.UNAVAILABLE,
          available: false,
          connected: false,
          error: 'Database connection failed',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithVectorDbDisconnected }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Database: Not connected')).toBeInTheDocument();
      });
    });
  });

  describe('Cache feature status', () => {
    it('displays Cache feature with available status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Cache')).toBeInTheDocument();
      });

      expect(screen.getByText('Status: Enabled')).toBeInTheDocument();
      expect(screen.getByText('Backend: memory')).toBeInTheDocument();
    });

    it('displays Cache feature when disabled', async () => {
      const statusWithCacheDisabled = {
        ...mockFeatureStatus,
        cache: {
          ...mockFeatureStatus.cache,
          status: FeatureStatus.UNAVAILABLE,
          available: false,
          enabled: false,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithCacheDisabled }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Status: Disabled')).toBeInTheDocument();
      });
    });
  });

  describe('Templates feature status', () => {
    it('displays Templates feature with available status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });

      expect(screen.getByText('Available Templates: 5')).toBeInTheDocument();
      expect(screen.getByText('Storage: Local')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error message when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      });
    });

    it('displays error message when API returns non-200 status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(
          screen.getByText(/Error: Failed to fetch feature status: Internal Server Error/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('offline readiness', () => {
    it('displays ready message when system is offline ready', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('System is ready for offline operation')).toBeInTheDocument();
      });
    });

    it('displays limited message when system is not offline ready', async () => {
      const statusNotReady = {
        ...mockFeatureStatus,
        offlineReady: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusNotReady }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Some features may be limited offline')).toBeInTheDocument();
      });
    });
  });

  describe('status badges', () => {
    it('displays correct status badges for all features', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatureStatus }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        const badges = screen.getAllByText('Available');
        expect(badges).toHaveLength(4); // AI, Vector DB, Cache, Templates
      });
    });

    it('displays degraded status badge correctly', async () => {
      const statusWithDegraded = {
        ...mockFeatureStatus,
        ai: {
          ...mockFeatureStatus.ai,
          status: FeatureStatus.DEGRADED,
          missingModels: ['mistral'],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithDegraded }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Degraded')).toBeInTheDocument();
      });
    });

    it('displays unavailable status badge correctly', async () => {
      const statusWithUnavailable = {
        ...mockFeatureStatus,
        cache: {
          ...mockFeatureStatus.cache,
          status: FeatureStatus.UNAVAILABLE,
          available: false,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ features: statusWithUnavailable }),
      });

      render(<FeatureAvailabilityPanel />);

      await waitFor(() => {
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
      });
    });
  });
});
