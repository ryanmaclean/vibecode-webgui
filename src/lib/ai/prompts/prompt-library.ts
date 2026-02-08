/**
 * Prompt Library
 *
 * A reusable, versioned prompt library for AI-powered code assistance features.
 * Supports 321+ AI models via OpenRouter with structured templates,
 * variable substitution, and model-specific variations.
 */

import {
  PromptTemplate,
  PromptCategory,
  PromptVariables,
  PromptResult,
  PromptRenderOptions,
  PromptQueryOptions,
  PromptVersionEntry,
  PromptUsageStats,
  PromptLibraryConfig,
  isPromptTemplate,
  isValidCategory
} from '@/types/prompts';

/**
 * Default configuration for the prompt library
 */
const DEFAULT_CONFIG: Required<PromptLibraryConfig> = {
  trackUsage: true,
  enableVersioning: true,
  maxVersionsPerPrompt: 10,
  defaultModel: 'openai/gpt-4o-mini',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
  variableDelimiters: ['{{', '}}']
};

/**
 * Error class for prompt library operations
 */
export class PromptLibraryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PromptLibraryError';
  }
}

/**
 * PromptLibrary Class
 *
 * Manages a collection of reusable prompt templates for AI code assistance.
 * Provides versioning, variable substitution, and model-specific adaptations.
 */
export class PromptLibrary {
  private templates: Map<string, PromptTemplate> = new Map();
  private versionHistory: Map<string, PromptVersionEntry[]> = new Map();
  private usageStats: Map<string, PromptUsageStats> = new Map();
  private config: Required<PromptLibraryConfig>;

  constructor(config: PromptLibraryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    // Validate template structure
    if (!isPromptTemplate(template)) {
      throw new PromptLibraryError(
        'Invalid template structure',
        'INVALID_TEMPLATE',
        { templateId: (template as unknown as { id?: string })?.id }
      );
    }

    // Validate category
    if (!isValidCategory(template.category)) {
      throw new PromptLibraryError(
        `Invalid category: ${template.category}`,
        'INVALID_CATEGORY',
        { category: template.category }
      );
    }

    // Check for duplicate ID
    const existing = this.templates.get(template.id);
    if (existing) {
      // If versioning is enabled, save to history
      if (this.config.enableVersioning) {
        this.saveToHistory(existing, `Updated to version ${template.version}`);
      }
    }

    // Set timestamps
    const now = new Date();
    template.createdAt = existing?.createdAt || now;
    template.updatedAt = now;

    this.templates.set(template.id, template);

    // Initialize usage stats if tracking is enabled
    if (this.config.trackUsage && !this.usageStats.has(template.id)) {
      this.usageStats.set(template.id, {
        promptId: template.id,
        usageCount: 0
      });
    }
  }

  /**
   * Register multiple templates at once
   */
  registerTemplates(templates: PromptTemplate[]): void {
    for (const template of templates) {
      this.registerTemplate(template);
    }
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get a template by ID, throwing if not found
   */
  getTemplateOrThrow(id: string): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new PromptLibraryError(
        `Template not found: ${id}`,
        'TEMPLATE_NOT_FOUND',
        { templateId: id }
      );
    }
    return template;
  }

  /**
   * Query templates with filtering and sorting
   */
  queryTemplates(options: PromptQueryOptions = {}): PromptTemplate[] {
    let results = Array.from(this.templates.values());

    // Filter by category
    if (options.category) {
      results = results.filter(t => t.category === options.category);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags?.includes(tag))
      );
    }

    // Filter by search term
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(
        t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by model
    if (options.model) {
      results = results.filter(t =>
        t.recommendedModels.some(
          m => m.toLowerCase().includes(options.model!.toLowerCase())
        )
      );
    }

    // Filter by system/custom
    if (options.systemOnly) {
      results = results.filter(t => t.isSystem === true);
    }
    if (options.customOnly) {
      results = results.filter(t => t.isSystem !== true);
    }

    // Sort results
    if (options.sortBy) {
      const direction = options.sortDirection === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        let aVal: string | Date | undefined;
        let bVal: string | Date | undefined;

        switch (options.sortBy) {
          case 'name':
            aVal = a.name;
            bVal = b.name;
            break;
          case 'category':
            aVal = a.category;
            bVal = b.category;
            break;
          case 'createdAt':
            aVal = a.createdAt;
            bVal = b.createdAt;
            break;
          case 'updatedAt':
            aVal = a.updatedAt;
            bVal = b.updatedAt;
            break;
        }

        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    // Apply pagination
    if (options.offset !== undefined) {
      results = results.slice(options.offset);
    }
    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get templates by category
   */
  getByCategory(category: PromptCategory): PromptTemplate[] {
    return this.queryTemplates({ category });
  }

  /**
   * Get all template IDs
   */
  listTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get all templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Remove a template
   */
  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Render a prompt template with variables
   */
  renderPrompt(
    templateId: string,
    variables: PromptVariables,
    options: PromptRenderOptions = {}
  ): PromptResult {
    const template = this.templates.get(templateId);

    if (!template) {
      return {
        success: false,
        systemPrompt: '',
        userPrompt: '',
        template: {} as PromptTemplate,
        appliedVariables: variables,
        error: `Template not found: ${templateId}`,
        modelConfig: {
          recommendedModel: this.config.defaultModel,
          maxTokens: this.config.defaultMaxTokens,
          temperature: this.config.defaultTemperature
        }
      };
    }

    const warnings: string[] = [];

    // Validate required variables
    if (options.strictValidation !== false) {
      for (const varDef of template.variables) {
        if (varDef.required && variables[varDef.name] === undefined) {
          if (varDef.defaultValue !== undefined) {
            variables[varDef.name] = varDef.defaultValue;
            warnings.push(
              `Using default value for required variable: ${varDef.name}`
            );
          } else {
            return {
              success: false,
              systemPrompt: '',
              userPrompt: '',
              template,
              appliedVariables: variables,
              error: `Missing required variable: ${varDef.name}`,
              modelConfig: {
                recommendedModel: template.recommendedModels[0] || this.config.defaultModel,
                maxTokens: template.maxTokens || this.config.defaultMaxTokens,
                temperature: template.temperature ?? this.config.defaultTemperature
              }
            };
          }
        }
      }
    }

    // Apply defaults for missing optional variables
    for (const varDef of template.variables) {
      if (
        variables[varDef.name] === undefined &&
        varDef.defaultValue !== undefined
      ) {
        variables[varDef.name] = varDef.defaultValue;
      }
    }

    // Get system and user prompts (considering model variations)
    let systemPrompt = template.systemPrompt;
    let userPromptTemplate = template.userPromptTemplate;
    let modelMaxTokens = template.maxTokens;
    let modelTemperature = template.temperature;

    // Apply model-specific variations if enabled and model is specified
    if (options.applyModelVariations !== false && options.model && template.modelVariations) {
      const variation = template.modelVariations.find(v =>
        this.matchesModelPattern(options.model!, v.modelPattern)
      );

      if (variation) {
        if (variation.systemPrompt) systemPrompt = variation.systemPrompt;
        if (variation.userPromptTemplate) userPromptTemplate = variation.userPromptTemplate;
        if (variation.maxTokens) modelMaxTokens = variation.maxTokens;
        if (variation.temperature !== undefined) modelTemperature = variation.temperature;

        if (variation.additionalInstructions) {
          userPromptTemplate += `\n\n${variation.additionalInstructions}`;
        }
      }
    }

    // Substitute variables in prompts
    const renderedSystemPrompt = this.substituteVariables(systemPrompt, variables);
    const renderedUserPrompt = this.substituteVariables(userPromptTemplate, variables);

    // Determine model configuration
    const recommendedModel = options.model || template.recommendedModels[0] || this.config.defaultModel;
    const maxTokens = options.maxTokens || modelMaxTokens || this.config.defaultMaxTokens;
    const temperature = options.temperature ?? modelTemperature ?? this.config.defaultTemperature;

    // Track usage if enabled
    if (this.config.trackUsage) {
      this.recordUsage(templateId, recommendedModel);
    }

    return {
      success: true,
      systemPrompt: renderedSystemPrompt,
      userPrompt: renderedUserPrompt,
      template,
      appliedVariables: variables,
      warnings: warnings.length > 0 ? warnings : undefined,
      modelConfig: {
        recommendedModel,
        maxTokens,
        temperature
      }
    };
  }

  /**
   * Substitute variables in a template string
   */
  private substituteVariables(
    template: string,
    variables: PromptVariables
  ): string {
    const [openDelim, closeDelim] = this.config.variableDelimiters;
    const escapedOpen = openDelim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedClose = closeDelim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedOpen}\\s*([\\w.]+)\\s*${escapedClose}`, 'g');

    return template.replace(pattern, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
        return match; // Keep original if variable not provided
      }

      // Handle different value types
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') return JSON.stringify(value, null, 2);

      return String(value);
    });
  }

  /**
   * Check if a model ID matches a pattern
   */
  private matchesModelPattern(modelId: string, pattern: string): boolean {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(modelId);
  }

  /**
   * Record usage statistics for a template
   */
  private recordUsage(templateId: string, model: string): void {
    const stats = this.usageStats.get(templateId);
    if (stats) {
      stats.usageCount++;
      stats.lastUsed = new Date();
      stats.mostUsedModel = model; // Simplified - could track most common
    }
  }

  /**
   * Save a template version to history
   */
  private saveToHistory(template: PromptTemplate, changeDescription: string): void {
    const history = this.versionHistory.get(template.id) || [];

    history.unshift({
      version: template.version,
      timestamp: new Date(),
      changeDescription,
      template: { ...template },
      author: template.author
    });

    // Limit history size
    if (history.length > this.config.maxVersionsPerPrompt) {
      history.pop();
    }

    this.versionHistory.set(template.id, history);
  }

  /**
   * Get version history for a template
   */
  getVersionHistory(templateId: string): PromptVersionEntry[] {
    return this.versionHistory.get(templateId) || [];
  }

  /**
   * Restore a previous version of a template
   */
  restoreVersion(templateId: string, version: string): boolean {
    const history = this.versionHistory.get(templateId);
    if (!history) return false;

    const entry = history.find(e => e.version === version);
    if (!entry) return false;

    this.registerTemplate({
      ...entry.template,
      version: `${entry.version}-restored`,
      updatedAt: new Date()
    });

    return true;
  }

  /**
   * Get usage statistics for a template
   */
  getUsageStats(templateId: string): PromptUsageStats | undefined {
    return this.usageStats.get(templateId);
  }

  /**
   * Get all usage statistics
   */
  getAllUsageStats(): PromptUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get most used templates
   */
  getMostUsedTemplates(limit: number = 10): PromptTemplate[] {
    const sortedStats = Array.from(this.usageStats.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);

    return sortedStats
      .map(s => this.templates.get(s.promptId))
      .filter((t): t is PromptTemplate => t !== undefined);
  }

  /**
   * Clone a template with a new ID
   */
  cloneTemplate(
    sourceId: string,
    newId: string,
    overrides: Partial<PromptTemplate> = {}
  ): PromptTemplate {
    const source = this.getTemplateOrThrow(sourceId);

    const cloned: PromptTemplate = {
      ...source,
      ...overrides,
      id: newId,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isSystem: false
    };

    this.registerTemplate(cloned);
    return cloned;
  }

  /**
   * Export templates to JSON
   */
  exportToJson(templateIds?: string[]): string {
    const templates = templateIds
      ? templateIds.map(id => this.templates.get(id)).filter(Boolean)
      : Array.from(this.templates.values());

    return JSON.stringify(
      {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        templates
      },
      null,
      2
    );
  }

  /**
   * Import templates from JSON
   */
  importFromJson(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(json);

      if (!Array.isArray(data.templates)) {
        errors.push('Invalid JSON structure: missing templates array');
        return { imported, errors };
      }

      for (const template of data.templates) {
        try {
          this.registerTemplate(template);
          imported++;
        } catch (err) {
          errors.push(
            `Failed to import template ${template?.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      errors.push(`JSON parsing error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { imported, errors };
  }

  /**
   * Validate a template without registering it
   */
  validateTemplate(template: unknown): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isPromptTemplate(template)) {
      errors.push('Invalid template structure');
      return { valid: false, errors, warnings };
    }

    const t = template as PromptTemplate;

    // Check category
    if (!isValidCategory(t.category)) {
      errors.push(`Invalid category: ${t.category}`);
    }

    // Check version format
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(t.version)) {
      warnings.push(`Version "${t.version}" does not follow semantic versioning`);
    }

    // Check variables
    const templateVars = this.extractVariableNames(t.userPromptTemplate);
    const definedVars = new Set(t.variables.map(v => v.name));

    for (const varName of templateVars) {
      if (!definedVars.has(varName)) {
        warnings.push(`Variable "${varName}" used in template but not defined`);
      }
    }

    for (const varDef of t.variables) {
      if (!templateVars.has(varDef.name)) {
        warnings.push(
          `Variable "${varDef.name}" defined but not used in template`
        );
      }
    }

    // Check recommended models
    if (t.recommendedModels.length === 0) {
      warnings.push('No recommended models specified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract variable names from a template string
   */
  private extractVariableNames(template: string): Set<string> {
    const [openDelim, closeDelim] = this.config.variableDelimiters;
    const escapedOpen = openDelim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedClose = closeDelim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedOpen}\\s*([\\w.]+)\\s*${escapedClose}`, 'g');

    const names = new Set<string>();
    let match;
    while ((match = pattern.exec(template)) !== null) {
      names.add(match[1]);
    }
    return names;
  }

  /**
   * Get library statistics
   */
  getLibraryStats(): {
    totalTemplates: number;
    byCategory: Record<string, number>;
    totalUsage: number;
    versionsStored: number;
  } {
    const byCategory: Record<string, number> = {};
    for (const template of this.templates.values()) {
      byCategory[template.category] = (byCategory[template.category] || 0) + 1;
    }

    const totalUsage = Array.from(this.usageStats.values()).reduce(
      (sum, s) => sum + s.usageCount,
      0
    );

    const versionsStored = Array.from(this.versionHistory.values()).reduce(
      (sum, h) => sum + h.length,
      0
    );

    return {
      totalTemplates: this.templates.size,
      byCategory,
      totalUsage,
      versionsStored
    };
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.clear();
    this.versionHistory.clear();
    this.usageStats.clear();
  }
}

/**
 * Create a pre-configured prompt library instance
 */
export function createPromptLibrary(config?: PromptLibraryConfig): PromptLibrary {
  return new PromptLibrary(config);
}

/**
 * Singleton instance for global usage
 */
let globalLibrary: PromptLibrary | null = null;

/**
 * Get the global prompt library instance
 */
export function getPromptLibrary(): PromptLibrary {
  if (!globalLibrary) {
    globalLibrary = new PromptLibrary();
  }
  return globalLibrary;
}

/**
 * Initialize the global prompt library with built-in templates
 */
export async function initializePromptLibrary(): Promise<PromptLibrary> {
  const library = getPromptLibrary();

  // Dynamically import built-in templates
  const [
    codeReview,
    explainCode,
    refactor,
    generateTests,
    documentation
  ] = await Promise.all([
    import('./templates/code-review').then(m => m.codeReviewTemplates),
    import('./templates/explain-code').then(m => m.explainCodeTemplates),
    import('./templates/refactor').then(m => m.refactorTemplates),
    import('./templates/generate-tests').then(m => m.generateTestsTemplates),
    import('./templates/documentation').then(m => m.documentationTemplates)
  ]);

  // Register all built-in templates
  library.registerTemplates([
    ...codeReview,
    ...explainCode,
    ...refactor,
    ...generateTests,
    ...documentation
  ]);

  return library;
}

export default PromptLibrary;
