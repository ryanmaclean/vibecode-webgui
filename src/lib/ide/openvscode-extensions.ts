/**
 * OpenVSCode Extension Manager
 * Manages VS Code extensions via the Marketplace API
 */

import { v4 as uuidv4 } from 'uuid';

export interface VSCodeExtension {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description?: string;
  iconUrl?: string;
  downloadUrl?: string;
  rating?: number;
  installCount?: number;
  categories?: string[];
  tags?: string[];
}

export interface ExtensionSearchOptions {
  query?: string;
  category?: string;
  sortBy?: 'installs' | 'rating' | 'name' | 'publishedDate';
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  pageNumber?: number;
}

export interface ExtensionSearchResult {
  extensions: VSCodeExtension[];
  total: number;
  pageSize: number;
  pageNumber: number;
}

export interface InstalledExtension {
  id: string;
  extensionId: string;
  sessionId: string;
  version: string;
  installedAt: Date;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export class OpenVSCodeExtensionManager {
  private installedExtensions: Map<string, InstalledExtension> = new Map();
  private marketplaceUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery';
  private openVsxUrl = 'https://open-vsx.org/api';

  /**
   * Search for extensions in the VS Code Marketplace
   */
  async searchExtensions(options: ExtensionSearchOptions = {}): Promise<ExtensionSearchResult> {
    const {
      query = '',
      category,
      sortBy = 'installs',
      sortOrder = 'desc',
      pageSize = 20,
      pageNumber = 1,
    } = options;

    // In a real implementation, this would call the VS Code Marketplace API
    // For now, we'll return mock data
    const mockExtensions: VSCodeExtension[] = [
      {
        id: 'ms-python.python',
        name: 'python',
        displayName: 'Python',
        publisher: 'ms-python',
        version: '2023.10.0',
        description: 'IntelliSense, linting, debugging, code formatting, refactoring, and more',
        iconUrl: 'https://ms-python.gallerycdn.vsassets.io/extensions/ms-python/python/2023.10.0/icon.png',
        rating: 4.5,
        installCount: 50000000,
        categories: ['Programming Languages', 'Linters', 'Debuggers'],
        tags: ['python', 'intellisense', 'jupyter'],
      },
      {
        id: 'dbaeumer.vscode-eslint',
        name: 'vscode-eslint',
        displayName: 'ESLint',
        publisher: 'dbaeumer',
        version: '2.4.2',
        description: 'Integrates ESLint JavaScript into VS Code',
        iconUrl: 'https://dbaeumer.gallerycdn.vsassets.io/extensions/dbaeumer/vscode-eslint/2.4.2/icon.png',
        rating: 4.7,
        installCount: 25000000,
        categories: ['Linters'],
        tags: ['eslint', 'javascript', 'linter'],
      },
    ];

    // Filter by query if provided
    let filtered = mockExtensions;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (ext) =>
          ext.displayName.toLowerCase().includes(lowerQuery) ||
          ext.description?.toLowerCase().includes(lowerQuery) ||
          ext.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Filter by category if provided
    if (category) {
      filtered = filtered.filter((ext) => ext.categories?.includes(category));
    }

    // Sort extensions
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'installs':
          comparison = (b.installCount || 0) - (a.installCount || 0);
          break;
        case 'rating':
          comparison = (b.rating || 0) - (a.rating || 0);
          break;
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });

    // Paginate
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      extensions: paginated,
      total: filtered.length,
      pageSize,
      pageNumber,
    };
  }

  /**
   * Get extension details by ID
   */
  async getExtension(extensionId: string): Promise<VSCodeExtension | null> {
    // In a real implementation, this would call the Marketplace API
    const searchResult = await this.searchExtensions({});
    return searchResult.extensions.find((ext) => ext.id === extensionId) || null;
  }

  /**
   * Install an extension in a session
   */
  async installExtension(
    sessionId: string,
    extensionId: string,
    version?: string
  ): Promise<InstalledExtension> {
    // Check if already installed
    const existingKey = `${sessionId}:${extensionId}`;
    const existing = this.installedExtensions.get(existingKey);
    if (existing) {
      return existing;
    }

    // Get extension details
    const extension = await this.getExtension(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found in marketplace`);
    }

    // In a real implementation, this would:
    // 1. Download the extension .vsix file from the marketplace
    // 2. Execute Docker command to install in the OpenVSCode container
    //    Example: docker exec <container> code-server --install-extension <path-to-vsix>
    // For now, we'll create a record of the installation

    const installed: InstalledExtension = {
      id: uuidv4(),
      extensionId,
      sessionId,
      version: version || extension.version,
      installedAt: new Date(),
      enabled: true,
      metadata: {
        displayName: extension.displayName,
        publisher: extension.publisher,
      },
    };

    this.installedExtensions.set(existingKey, installed);
    return installed;
  }

  /**
   * Uninstall an extension from a session
   */
  async uninstallExtension(sessionId: string, extensionId: string): Promise<void> {
    const key = `${sessionId}:${extensionId}`;
    const installed = this.installedExtensions.get(key);

    if (!installed) {
      throw new Error(`Extension ${extensionId} is not installed in session ${sessionId}`);
    }

    // In a real implementation, this would execute Docker command:
    // docker exec <container> code-server --uninstall-extension <extensionId>

    this.installedExtensions.delete(key);
  }

  /**
   * List all installed extensions for a session
   */
  async listInstalledExtensions(sessionId: string): Promise<InstalledExtension[]> {
    const installed: InstalledExtension[] = [];

    for (const [key, extension] of this.installedExtensions.entries()) {
      if (extension.sessionId === sessionId) {
        installed.push(extension);
      }
    }

    return installed;
  }

  /**
   * Enable or disable an extension
   */
  async toggleExtension(
    sessionId: string,
    extensionId: string,
    enabled: boolean
  ): Promise<void> {
    const key = `${sessionId}:${extensionId}`;
    const installed = this.installedExtensions.get(key);

    if (!installed) {
      throw new Error(`Extension ${extensionId} is not installed in session ${sessionId}`);
    }

    // In a real implementation, this would call the VS Code API to enable/disable
    installed.enabled = enabled;
    this.installedExtensions.set(key, installed);
  }

  /**
   * Update an extension to the latest version
   */
  async updateExtension(sessionId: string, extensionId: string): Promise<InstalledExtension> {
    const key = `${sessionId}:${extensionId}`;
    const installed = this.installedExtensions.get(key);

    if (!installed) {
      throw new Error(`Extension ${extensionId} is not installed in session ${sessionId}`);
    }

    // Get latest version from marketplace
    const extension = await this.getExtension(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found in marketplace`);
    }

    // In a real implementation, this would download and install the new version
    installed.version = extension.version;
    installed.metadata = {
      ...installed.metadata,
      updatedAt: new Date(),
    };

    this.installedExtensions.set(key, installed);
    return installed;
  }

  /**
   * Check if an extension is installed in a session
   */
  async isExtensionInstalled(sessionId: string, extensionId: string): Promise<boolean> {
    const key = `${sessionId}:${extensionId}`;
    return this.installedExtensions.has(key);
  }

  /**
   * Get marketplace categories
   */
  async getCategories(): Promise<string[]> {
    // Common VS Code extension categories
    return [
      'Programming Languages',
      'Snippets',
      'Linters',
      'Debuggers',
      'Formatters',
      'Keymaps',
      'SCM Providers',
      'Other',
      'Extension Packs',
      'Language Packs',
      'Data Science',
      'Machine Learning',
      'Visualization',
      'Notebooks',
      'Testing',
    ];
  }

  /**
   * Clear all installed extensions for a session (cleanup on session stop)
   */
  async clearSessionExtensions(sessionId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, extension] of this.installedExtensions.entries()) {
      if (extension.sessionId === sessionId) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.installedExtensions.delete(key));
  }
}
