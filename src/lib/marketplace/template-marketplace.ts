/**
 * Template Marketplace Service
 * Service layer for template marketplace operations and management
 */

import { VectorChunk } from '../vector-db/vector-types';

export interface MarketplaceTemplate {
  id: string;
  marketplaceId?: string; // Alternative ID field for marketplace routing
  name: string;
  description: string;
  author: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'library';
  language: string;
  framework: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  stars: number;
  downloads: number;
  pricing: 'free' | 'paid';
  previewImage?: string;
  lastUpdated: string;
  featured: boolean;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  envVars: Array<{
    name: string;
    defaultValue?: string;
    description?: string;
  }>;
  documentation: {
    setup: string[];
    usage: string[];
    deployment: string[];
  };
  dockerSupport: boolean;
  kubernetesSupport: boolean;
  cicdTemplate: boolean;
  testingSetup: boolean;
  monitoringSetup: boolean;
}

export interface MarketplaceSearchOptions {
  query?: string;
  category?: string;
  language?: string;
  framework?: string;
  complexity?: string;
  pricing?: 'free' | 'paid' | 'all';
  sortBy?: 'relevance' | 'stars' | 'downloads' | 'updated' | 'name';
  tags?: string[];
  offset?: number;
  limit?: number;
}

export interface MarketplaceStats {
  totalTemplates: number;
  totalDownloads: number;
  totalAuthors: number;
  categories: Record<string, number>;
  languages: Record<string, number>;
  topTemplates: MarketplaceTemplate[];
  recentTemplates: MarketplaceTemplate[];
}

export interface TemplateSubmission {
  name: string;
  description: string;
  category: MarketplaceTemplate['category'];
  language: string;
  framework: string;
  complexity: MarketplaceTemplate['complexity'];
  tags: string[];
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  envVars: Array<{
    name: string;
    defaultValue?: string;
    description?: string;
  }>;
  documentation: {
    setup: string[];
    usage: string[];
    deployment: string[];
  };
  dockerSupport: boolean;
  kubernetesSupport: boolean;
  cicdTemplate: boolean;
  testingSetup: boolean;
  monitoringSetup: boolean;
  authorId: string;
  authorEmail: string;
}

/**
 * Template Marketplace Service
 */
export class TemplateMarketplaceService {
  private templates: Map<string, MarketplaceTemplate> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map(); // For efficient searching

  constructor() {
    this.initializeTemplates();
    this.buildSearchIndex();
  }

  /**
   * Initialize with sample templates
   */
  private initializeTemplates(): void {
    const sampleTemplates: MarketplaceTemplate[] = [
      {
        id: 'react-ts-vite',
        name: 'React TypeScript Vite',
        description: 'Modern React application with TypeScript and Vite build system',
        author: 'VibeCode Team',
        category: 'frontend',
        language: 'typescript',
        framework: 'react',
        complexity: 'intermediate',
        tags: ['react', 'typescript', 'vite', 'modern'],
        stars: 4.8,
        downloads: 15420,
        pricing: 'free',
        lastUpdated: '2024-01-15',
        featured: true,
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'typescript': '^4.9.5'
        },
        scripts: {
          'dev': 'vite',
          'build': 'tsc && vite build',
          'preview': 'vite preview',
          'test': 'vitest'
        },
        envVars: [
          {
            name: 'VITE_API_URL',
            defaultValue: 'http://localhost:3001',
            description: 'API server URL'
          }
        ],
        documentation: {
          setup: [
            'Install dependencies: npm install',
            'Start development server: npm run dev',
            'Open http://localhost:5173 in your browser'
          ],
          usage: [
            'Edit src/App.tsx to customize your application',
            'Add new components in src/components/',
            'Use TypeScript for type safety'
          ],
          deployment: [
            'Build for production: npm run build',
            'Deploy dist/ folder to your hosting provider',
            'Configure environment variables in production'
          ]
        },
        dockerSupport: true,
        kubernetesSupport: false,
        cicdTemplate: true,
        testingSetup: true,
        monitoringSetup: false
      },
      {
        id: 'nextjs-fullstack',
        name: 'Next.js Full Stack',
        description: 'Complete full-stack application with Next.js, API routes, and database',
        author: 'Community',
        category: 'fullstack',
        language: 'typescript',
        framework: 'nextjs',
        complexity: 'advanced',
        tags: ['nextjs', 'fullstack', 'api', 'database'],
        stars: 4.6,
        downloads: 8930,
        pricing: 'free',
        lastUpdated: '2024-01-10',
        featured: false,
        dependencies: {
          'next': '^14.0.0',
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'prisma': '^5.0.0',
          '@prisma/client': '^5.0.0'
        },
        scripts: {
          'dev': 'next dev',
          'build': 'prisma generate && next build',
          'start': 'next start',
          'db:generate': 'prisma generate',
          'db:push': 'prisma db push',
          'db:studio': 'prisma studio'
        },
        envVars: [
          {
            name: 'DATABASE_URL',
            defaultValue: 'postgresql://user:password@localhost:5432/mydb',
            description: 'Database connection URL'
          },
          {
            name: 'NEXTAUTH_SECRET',
            description: 'NextAuth.js secret for JWT encryption'
          }
        ],
        documentation: {
          setup: [
            'Install dependencies: npm install',
            'Set up database: npm run db:push',
            'Start development server: npm run dev'
          ],
          usage: [
            'API routes are in pages/api/',
            'Database models are in prisma/schema.prisma',
            'Authentication is handled by NextAuth.js'
          ],
          deployment: [
            'Build for production: npm run build',
            'Deploy to Vercel or your preferred platform',
            'Set DATABASE_URL in production environment'
          ]
        },
        dockerSupport: true,
        kubernetesSupport: true,
        cicdTemplate: true,
        testingSetup: true,
        monitoringSetup: true
      }
    ];

    sampleTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Build search index for efficient filtering
   */
  private buildSearchIndex(): void {
    this.searchIndex.clear();

    for (const template of this.templates.values()) {
      // Index by category
      if (!this.searchIndex.has(template.category)) {
        this.searchIndex.set(template.category, new Set());
      }
      this.searchIndex.get(template.category)!.add(template.id);

      // Index by language
      if (!this.searchIndex.has(`lang:${template.language}`)) {
        this.searchIndex.set(`lang:${template.language}`, new Set());
      }
      this.searchIndex.get(`lang:${template.language}`)!.add(template.id);

      // Index by framework
      if (!this.searchIndex.has(`framework:${template.framework}`)) {
        this.searchIndex.set(`framework:${template.framework}`, new Set());
      }
      this.searchIndex.get(`framework:${template.framework}`)!.add(template.id);

      // Index by tags
      template.tags.forEach(tag => {
        if (!this.searchIndex.has(`tag:${tag}`)) {
          this.searchIndex.set(`tag:${tag}`, new Set());
        }
        this.searchIndex.get(`tag:${tag}`)!.add(template.id);
      });
    }
  }

  /**
   * Search templates with advanced filtering
   */
  searchTemplates(options: MarketplaceSearchOptions = {}): MarketplaceTemplate[] {
    let results = Array.from(this.templates.values());

    // Apply search query filter
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (options.category) {
      results = results.filter(template => template.category === options.category);
    }

    // Apply language filter
    if (options.language) {
      results = results.filter(template => template.language === options.language);
    }

    // Apply framework filter
    if (options.framework) {
      results = results.filter(template => template.framework === options.framework);
    }

    // Apply complexity filter
    if (options.complexity) {
      results = results.filter(template => template.complexity === options.complexity);
    }

    // Apply pricing filter
    if (options.pricing && options.pricing !== 'all') {
      results = results.filter(template => template.pricing === options.pricing);
    }

    // Apply tags filter
    if (options.tags && options.tags.length > 0) {
      results = results.filter(template =>
        options.tags!.some(tag => template.tags.includes(tag))
      );
    }

    // Apply sorting
    results.sort((a, b) => {
      switch (options.sortBy) {
        case 'stars':
          return b.stars - a.stars;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'updated':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          // Default to featured first, then by relevance
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.stars - a.stars;
      }
    });

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): MarketplaceTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Submit a new template
   */
  async submitTemplate(submission: TemplateSubmission): Promise<MarketplaceTemplate> {
    // Validate submission
    if (!submission.name.trim() || !submission.description.trim()) {
      throw new Error('Template name and description are required');
    }

    // Create new template
    const template: MarketplaceTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: submission.name,
      description: submission.description,
      author: submission.authorEmail,
      category: submission.category,
      language: submission.language,
      framework: submission.framework,
      complexity: submission.complexity,
      tags: submission.tags,
      stars: 0,
      downloads: 0,
      pricing: 'free', // New submissions start as free
      lastUpdated: new Date().toISOString(),
      featured: false,
      dependencies: submission.dependencies,
      scripts: submission.scripts,
      envVars: submission.envVars,
      documentation: submission.documentation,
      dockerSupport: submission.dockerSupport,
      kubernetesSupport: submission.kubernetesSupport,
      cicdTemplate: submission.cicdTemplate,
      testingSetup: submission.testingSetup,
      monitoringSetup: submission.monitoringSetup
    };

    // Add to templates
    this.templates.set(template.id, template);

    // Update search index
    this.buildSearchIndex();

    return template;
  }

  /**
   * Update template metadata
   */
  async updateTemplate(id: string, updates: Partial<MarketplaceTemplate>): Promise<MarketplaceTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    const updatedTemplate = { ...template, ...updates, lastUpdated: new Date().toISOString() };
    this.templates.set(id, updatedTemplate);

    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.buildSearchIndex();
    }
    return deleted;
  }

  /**
   * Increment download count
   */
  async incrementDownloadCount(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      template.downloads += 1;
      template.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(id: string, rating: number): Promise<void> {
    const template = this.templates.get(id);
    if (template) {
      // Simple rating system - in a real app, this would be more sophisticated
      template.stars = (template.stars + rating) / 2; // Average with existing rating
      template.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Get marketplace statistics
   */
  getStats(): MarketplaceStats {
    const templates = Array.from(this.templates.values());

    const totalDownloads = templates.reduce((sum, t) => sum + t.downloads, 0);

    const categories: Record<string, number> = {};
    const languages: Record<string, number> = {};

    templates.forEach(template => {
      categories[template.category] = (categories[template.category] || 0) + 1;
      languages[template.language] = (languages[template.language] || 0) + 1;
    });

    const topTemplates = templates
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 10);

    const recentTemplates = templates
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 10);

    return {
      totalTemplates: templates.length,
      totalDownloads,
      totalAuthors: new Set(templates.map(t => t.author)).size,
      categories,
      languages,
      topTemplates,
      recentTemplates
    };
  }

  /**
   * Get available categories
   */
  getCategories(): Array<{ id: string; name: string; count: number }> {
    const templates = Array.from(this.templates.values());
    const categories: Record<string, number> = {};

    templates.forEach(template => {
      categories[template.category] = (categories[template.category] || 0) + 1;
    });

    return Object.entries(categories).map(([id, count]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      count
    }));
  }

  /**
   * Get available languages
   */
  getLanguages(): Array<{ id: string; name: string; count: number }> {
    const templates = Array.from(this.templates.values());
    const languages: Record<string, number> = {};

    templates.forEach(template => {
      languages[template.language] = (languages[template.language] || 0) + 1;
    });

    return Object.entries(languages).map(([id, count]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      count
    }));
  }

  /**
   * Get available frameworks
   */
  getFrameworks(): Array<{ id: string; name: string; count: number }> {
    const templates = Array.from(this.templates.values());
    const frameworks: Record<string, number> = {};

    templates.forEach(template => {
      frameworks[template.framework] = (frameworks[template.framework] || 0) + 1;
    });

    return Object.entries(frameworks).map(([id, count]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      count
    }));
  }

  /**
   * Get trending templates
   */
  getTrendingTemplates(limit = 10): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => {
        // Sort by combination of stars and recent downloads
        const aScore = a.stars * 0.7 + Math.log(a.downloads + 1) * 0.3;
        const bScore = b.stars * 0.7 + Math.log(b.downloads + 1) * 0.3;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  /**
   * Get featured templates
   */
  getFeaturedTemplates(limit = 10): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.featured)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, limit);
  }

  /**
   * Get templates by author
   */
  getTemplatesByAuthor(authorEmail: string): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.author === authorEmail)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }

  /**
   * Search templates by similarity using vector search
   */
  async searchSimilarTemplates(query: string, limit = 10): Promise<MarketplaceTemplate[]> {
    // This would integrate with vector database for semantic search
    // For now, return text-based search results
    const searchOptions: MarketplaceSearchOptions = {
      query,
      limit,
      sortBy: 'relevance'
    };

    return this.searchTemplates(searchOptions);
  }

  /**
   * Get template recommendations for user
   */
  getRecommendations(
    userPreferences?: {
      preferredLanguages?: string[];
      preferredCategories?: string[];
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
    limit = 10
  ): MarketplaceTemplate[] {
    let templates = Array.from(this.templates.values());

    // Filter by user preferences
    if (userPreferences?.preferredLanguages) {
      templates = templates.filter(template =>
        userPreferences.preferredLanguages!.includes(template.language)
      );
    }

    if (userPreferences?.preferredCategories) {
      templates = templates.filter(template =>
        userPreferences.preferredCategories!.includes(template.category)
      );
    }

    if (userPreferences?.skillLevel) {
      templates = templates.filter(template =>
        template.complexity === userPreferences.skillLevel
      );
    }

    // Score templates based on various factors
    templates.forEach(template => {
      let score = 0;

      // Boost score for featured templates
      if (template.featured) score += 2;

      // Boost score based on stars
      score += template.stars * 0.5;

      // Boost score based on downloads (log scale)
      score += Math.log(template.downloads + 1) * 0.2;

      // Boost score for recently updated templates
      const daysSinceUpdate = (Date.now() - new Date(template.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) score += 1;

      template.stars = score; // Temporarily use stars field for score
    });

    return templates
      .sort((a, b) => (b.stars as number) - (a.stars as number))
      .slice(0, limit);
  }

  /**
   * Validate template submission
   */
  validateTemplateSubmission(submission: TemplateSubmission): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!submission.name.trim()) {
      errors.push('Template name is required');
    }

    if (!submission.description.trim()) {
      errors.push('Template description is required');
    }

    if (!submission.language) {
      errors.push('Language is required');
    }

    if (!submission.framework) {
      errors.push('Framework is required');
    }

    if (submission.tags.length === 0) {
      errors.push('At least one tag is required');
    }

    if (Object.keys(submission.dependencies).length === 0) {
      errors.push('At least one dependency is required');
    }

    if (submission.documentation.setup.length === 0) {
      errors.push('Setup documentation is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate template preview
   */
  generateTemplatePreview(template: MarketplaceTemplate): {
    structure: string[];
    packageJson: any;
    readme: string;
  } {
    const structure = [
      'src/',
      '  components/',
      '  pages/',
      '  utils/',
      'public/',
      'package.json',
      'README.md',
      'tsconfig.json'
    ];

    const packageJson = {
      name: template.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: template.description,
      dependencies: template.dependencies,
      scripts: template.scripts,
      author: template.author,
      license: 'MIT'
    };

    const readme = `# ${template.name}

${template.description}

## Installation

${template.documentation.setup.join('\n')}

## Usage

${template.documentation.usage.join('\n')}

## Features

${template.features?.join('\n') || 'Modern development setup'}

## Contributing

Contributions are welcome!
`;

    return {
      structure,
      packageJson,
      readme
    };
  }

  /**
   * Export template as downloadable package
   */
  async exportTemplate(id: string): Promise<{
    files: Array<{ name: string; content: string; path: string }>;
    metadata: MarketplaceTemplate;
  }> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    const preview = this.generateTemplatePreview(template);
    const files = [
      {
        name: 'package.json',
        content: JSON.stringify(preview.packageJson, null, 2),
        path: 'package.json'
      },
      {
        name: 'README.md',
        content: preview.readme,
        path: 'README.md'
      }
    ];

    return {
      files,
      metadata: template
    };
  }

  /**
   * Import template from external source
   */
  async importTemplate(templateData: Partial<MarketplaceTemplate>): Promise<MarketplaceTemplate> {
    const template: MarketplaceTemplate = {
      id: `imported-${Date.now()}`,
      name: templateData.name || 'Imported Template',
      description: templateData.description || 'Imported template',
      author: templateData.author || 'Unknown',
      category: templateData.category || 'frontend',
      language: templateData.language || 'javascript',
      framework: templateData.framework || 'react',
      complexity: templateData.complexity || 'intermediate',
      tags: templateData.tags || [],
      stars: 0,
      downloads: 0,
      pricing: 'free',
      lastUpdated: new Date().toISOString(),
      featured: false,
      dependencies: templateData.dependencies || {},
      scripts: templateData.scripts || {},
      envVars: templateData.envVars || [],
      documentation: templateData.documentation || {
        setup: ['Setup instructions'],
        usage: ['Usage instructions'],
        deployment: ['Deployment guide']
      },
      dockerSupport: templateData.dockerSupport || false,
      kubernetesSupport: templateData.kubernetesSupport || false,
      cicdTemplate: templateData.cicdTemplate || false,
      testingSetup: templateData.testingSetup || false,
      monitoringSetup: templateData.monitoringSetup || false
    };

    this.templates.set(template.id, template);
    this.buildSearchIndex();

    return template;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): MarketplaceTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Clear all templates (for testing)
   */
  clearTemplates(): void {
    this.templates.clear();
    this.searchIndex.clear();
  }
}

// Export singleton instance
export const templateMarketplace = new TemplateMarketplaceService();
