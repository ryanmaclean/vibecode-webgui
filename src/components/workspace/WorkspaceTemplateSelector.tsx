/**
 * WorkspaceTemplateSelector Component
 * Browse and select workspace templates for creating new workspaces
 *
 * Features:
 * - Display template cards with name, description, metadata
 * - Filter by framework, language, visibility
 * - Search by template name
 * - Select templates to create workspace or clone
 * - Loading states and error handling
 * - Pagination support
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Types
export interface WorkspaceTemplate {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  workspace_config: Record<string, unknown>;
  is_public: boolean;
  tags: string | null;
  framework: string | null;
  language: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkspaceTemplateSelectorProps {
  /** Callback when a template is selected */
  onSelect?: (template: WorkspaceTemplate) => void;
  /** Callback when create from template is clicked */
  onCreateFromTemplate?: (template: WorkspaceTemplate) => void;
  /** Callback when clone template is clicked */
  onCloneTemplate?: (template: WorkspaceTemplate) => void;
  /** Show only public templates */
  publicOnly?: boolean;
  /** Pre-selected framework filter */
  defaultFramework?: string;
  /** Pre-selected language filter */
  defaultLanguage?: string;
  /** Custom CSS class */
  className?: string;
}

interface TemplatesResponse {
  success: boolean;
  templates: WorkspaceTemplate[];
  pagination: {
    page: number;
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
  };
  filters: {
    framework?: string;
    language?: string;
    isPublic?: boolean;
  };
  metadata: {
    requestId: string;
    cached: boolean;
  };
}

interface Filters {
  search: string;
  framework: string;
  language: string;
  isPublic?: boolean;
}

/**
 * WorkspaceTemplateSelector
 * Component for browsing and selecting workspace templates
 */
export function WorkspaceTemplateSelector({
  onSelect,
  onCreateFromTemplate,
  onCloneTemplate,
  publicOnly = false,
  defaultFramework = '',
  defaultLanguage = '',
  className,
}: WorkspaceTemplateSelectorProps) {
  // State
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    framework: defaultFramework,
    language: defaultLanguage,
    isPublic: publicOnly ? true : undefined,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  /**
   * Fetch templates from API
   */
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[WorkspaceTemplateSelector] Fetching templates', {
        filters,
        page,
      });

      // Build query params
      const params = new URLSearchParams();
      if (filters.framework) params.append('framework', filters.framework);
      if (filters.language) params.append('language', filters.language);
      if (filters.isPublic !== undefined) params.append('isPublic', String(filters.isPublic));
      params.append('page', String(page));
      params.append('limit', '12'); // Show 12 templates per page

      const response = await fetch(`/api/workspace-templates?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to fetch templates');
      }

      const data: TemplatesResponse = await response.json();

      console.log('[WorkspaceTemplateSelector] Templates fetched successfully', {
        count: data.templates.length,
        hasMore: data.pagination.hasMore,
      });

      setTemplates(data.templates);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      console.error('[WorkspaceTemplateSelector] Error fetching templates:', err);
      setError(message);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  /**
   * Load templates on mount and when filters change
   */
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Update filter value
   */
  const updateFilter = useCallback((key: keyof Filters, value: string | boolean | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  }, []);

  /**
   * Handle search input change (debounced filtering)
   */
  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      framework: '',
      language: '',
      isPublic: publicOnly ? true : undefined,
    });
    setPage(1);
  }, [publicOnly]);

  /**
   * Filter templates by search query (client-side)
   */
  const filteredTemplates = useMemo(() => {
    if (!filters.search) return templates;

    const searchLower = filters.search.toLowerCase();
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.tags?.toLowerCase().includes(searchLower)
    );
  }, [templates, filters.search]);

  /**
   * Parse tags from comma-separated string
   */
  const parseTags = useCallback((tags: string | null): string[] => {
    if (!tags) return [];
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }, []);

  /**
   * Handle template selection
   */
  const handleSelect = useCallback(
    (template: WorkspaceTemplate) => {
      console.log('[WorkspaceTemplateSelector] Template selected', {
        templateId: template.id,
        templateName: template.name,
      });

      if (onSelect) {
        onSelect(template);
      }
    },
    [onSelect]
  );

  /**
   * Handle create from template
   */
  const handleCreateFromTemplate = useCallback(
    (template: WorkspaceTemplate) => {
      console.log('[WorkspaceTemplateSelector] Creating from template', {
        templateId: template.id,
        templateName: template.name,
      });

      if (onCreateFromTemplate) {
        onCreateFromTemplate(template);
      }
    },
    [onCreateFromTemplate]
  );

  /**
   * Handle clone template
   */
  const handleCloneTemplate = useCallback(
    (template: WorkspaceTemplate) => {
      console.log('[WorkspaceTemplateSelector] Cloning template', {
        templateId: template.id,
        templateName: template.name,
      });

      if (onCloneTemplate) {
        onCloneTemplate(template);
      }
    },
    [onCloneTemplate]
  );

  /**
   * Load more templates (pagination)
   */
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [isLoading, hasMore]);

  // Render loading state
  if (isLoading && templates.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" aria-label="Loading search input" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" aria-label="Loading framework filter" />
            <Skeleton className="h-10 w-32" aria-label="Loading language filter" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} aria-label={`Loading template ${i + 1}`} />
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error && templates.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div
          className="rounded-md bg-red-50 border border-red-200 p-4"
          role="alert"
          aria-live="polite"
        >
          <h3 className="text-sm font-medium text-red-800">Error loading templates</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <Button onClick={fetchTemplates} variant="outline" size="sm" className="mt-3">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="template-search">Search Templates</Label>
          <Input
            id="template-search"
            type="search"
            placeholder="Search by name, description, or tags..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Framework and Language Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="framework-filter" className="sr-only">
              Framework
            </Label>
            <Input
              id="framework-filter"
              placeholder="Framework (e.g., Next.js)"
              value={filters.framework}
              onChange={(e) => updateFilter('framework', e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="language-filter" className="sr-only">
              Language
            </Label>
            <Input
              id="language-filter"
              placeholder="Language (e.g., TypeScript)"
              value={filters.language}
              onChange={(e) => updateFilter('language', e.target.value)}
            />
          </div>
          {!publicOnly && (
            <Button
              variant="outline"
              onClick={() =>
                updateFilter('isPublic', filters.isPublic === undefined ? true : undefined)
              }
              className={cn(filters.isPublic !== undefined && 'border-primary')}
            >
              {filters.isPublic === true ? 'Public Only' : 'All Templates'}
            </Button>
          )}
          <Button variant="ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filters.search || filters.framework || filters.language
              ? 'No templates match your filters. Try adjusting your search criteria.'
              : 'No templates available. Create your first template to get started.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelect(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
                    {template.is_public && (
                      <Badge variant="secondary" className="shrink-0">
                        Public
                      </Badge>
                    )}
                  </div>
                  {template.description && (
                    <CardDescription className="line-clamp-2">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="space-y-2">
                    {/* Framework and Language */}
                    {(template.framework || template.language) && (
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        {template.framework && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Framework:</span> {template.framework}
                          </span>
                        )}
                        {template.language && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Language:</span> {template.language}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {template.tags && (
                      <div className="flex flex-wrap gap-1">
                        {parseTags(template.tags).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2">
                  {onCreateFromTemplate && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFromTemplate(template);
                      }}
                      className="flex-1"
                    >
                      Use Template
                    </Button>
                  )}
                  {onCloneTemplate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneTemplate(template);
                      }}
                      className="flex-1"
                    >
                      Clone
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button onClick={loadMore} disabled={isLoading} variant="outline">
                {isLoading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

WorkspaceTemplateSelector.displayName = 'WorkspaceTemplateSelector';

export { WorkspaceTemplateSelector as default };
