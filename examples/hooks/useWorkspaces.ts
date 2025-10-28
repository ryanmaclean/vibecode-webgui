/**
 * useWorkspaces Hook Example
 * 
 * This example demonstrates:
 * - Custom React hook patterns
 * - SWR for data fetching and caching
 * - TypeScript with generics
 * - Error handling and loading states
 * - Optimistic updates
 * - Cache invalidation strategies
 */

'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';

// Types
interface Workspace {
  id: number;
  name: string;
  description?: string;
  slug: string;
  isPublic: boolean;
  tags: string[];
  userId: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  _count: {
    projects: number;
    collaborators: number;
  };
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface WorkspacesResponse {
  workspaces: Workspace[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

interface UpdateWorkspaceInput extends Partial<CreateWorkspaceInput> {
  id: number;
}

interface UseWorkspacesOptions {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  enabled?: boolean;
  refreshInterval?: number;
}

interface UseWorkspacesReturn {
  // Data
  workspaces: Workspace[];
  pagination: WorkspacesResponse['pagination'] | null;
  
  // State
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Actions
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  updateWorkspace: (input: UpdateWorkspaceInput) => Promise<Workspace>;
  deleteWorkspace: (id: number) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  
  // Utilities
  getWorkspaceById: (id: number) => Workspace | undefined;
  getWorkspaceBySlug: (slug: string) => Workspace | undefined;
  filterWorkspacesByTags: (tags: string[]) => Workspace[];
}

// API client functions
const fetcher = async (url: string): Promise<WorkspacesResponse> => {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
};

const createWorkspaceAPI = async (input: CreateWorkspaceInput): Promise<Workspace> => {
  const response = await fetch('/api/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create workspace');
  }
  
  const data = await response.json();
  return data.data;
};

const updateWorkspaceAPI = async (input: UpdateWorkspaceInput): Promise<Workspace> => {
  const { id, ...updateData } = input;
  
  const response = await fetch(`/api/workspaces/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update workspace');
  }
  
  const data = await response.json();
  return data.data;
};

const deleteWorkspaceAPI = async (id: number): Promise<void> => {
  const response = await fetch(`/api/workspaces/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete workspace');
  }
};

// Main hook
export function useWorkspaces(options: UseWorkspacesOptions = {}): UseWorkspacesReturn {
  const {
    page = 1,
    limit = 10,
    search,
    tags,
    enabled = true,
    refreshInterval = 0,
  } = options;

  const { data: session } = useSession();
  const { toast } = useToast();

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) params.set('search', search);
    if (tags && tags.length > 0) params.set('tags', tags.join(','));
    
    return params.toString();
  }, [page, limit, search, tags]);

  // SWR key - includes user session for cache isolation
  const swrKey = session?.user?.id 
    ? `/api/workspaces?${queryParams}` 
    : null;

  // SWR configuration
  const {
    data,
    error,
    isLoading,
    mutate: mutateSWR
  } = useSWR(
    enabled ? swrKey : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      errorRetryCount: 3,
      onError: (error: Error) => {
        console.error('Workspaces fetch error:', error);
        toast({
          title: 'Error',
          description: 'Failed to load workspaces. Please try again.',
          variant: 'destructive',
        });
      },
    }
  );

  // Memoized derived data
  const workspaces = useMemo(() => data?.workspaces || [], [data?.workspaces]);
  const pagination = useMemo(() => data?.pagination || null, [data?.pagination]);

  // Create workspace with optimistic update
  const createWorkspace = useCallback(async (input: CreateWorkspaceInput): Promise<Workspace> => {
    try {
      // Optimistic update
      const tempId = Date.now(); // Temporary ID for optimistic update
      const optimisticWorkspace: Workspace = {
        id: tempId,
        ...input,
        slug: input.name.toLowerCase().replace(/\s+/g, '-'),
        isPublic: input.isPublic || false,
        tags: input.tags || [],
        userId: session?.user?.id ? parseInt(session.user.id) : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { projects: 0, collaborators: 0 },
        user: {
          id: session?.user?.id ? parseInt(session.user.id) : 0,
          name: session?.user?.name || 'Unknown',
          email: session?.user?.email || 'unknown@example.com',
        },
      };

      // Update cache optimistically
      if (data) {
        mutateSWR(
          {
            ...data,
            workspaces: [optimisticWorkspace, ...data.workspaces],
            pagination: {
              ...data.pagination,
              total: data.pagination.total + 1,
            },
          },
          false // Don't revalidate immediately
        );
      }

      // Make API call
      const newWorkspace = await createWorkspaceAPI(input);
      
      // Update cache with real data
      await mutateSWR();
      
      toast({
        title: 'Success',
        description: 'Workspace created successfully.',
      });

      return newWorkspace;
    } catch (error) {
      // Revert optimistic update on error
      await mutateSWR();
      
      const message = error instanceof Error ? error.message : 'Failed to create workspace';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [data, mutateSWR, session, toast]);

  // Update workspace with optimistic update
  const updateWorkspace = useCallback(async (input: UpdateWorkspaceInput): Promise<Workspace> => {
    try {
      // Optimistic update
      if (data) {
        const optimisticWorkspaces = data.workspaces.map(workspace => 
          workspace.id === input.id 
            ? { ...workspace, ...input, updatedAt: new Date().toISOString() }
            : workspace
        );
        
        mutateSWR(
          { ...data, workspaces: optimisticWorkspaces },
          false
        );
      }

      const updatedWorkspace = await updateWorkspaceAPI(input);
      
      // Revalidate with real data
      await mutateSWR();
      
      toast({
        title: 'Success',
        description: 'Workspace updated successfully.',
      });

      return updatedWorkspace;
    } catch (error) {
      // Revert optimistic update on error
      await mutateSWR();
      
      const message = error instanceof Error ? error.message : 'Failed to update workspace';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [data, mutateSWR, toast]);

  // Delete workspace with optimistic update
  const deleteWorkspace = useCallback(async (id: number): Promise<void> => {
    try {
      // Optimistic update
      if (data) {
        const filteredWorkspaces = data.workspaces.filter(workspace => workspace.id !== id);
        
        mutateSWR(
          {
            ...data,
            workspaces: filteredWorkspaces,
            pagination: {
              ...data.pagination,
              total: data.pagination.total - 1,
            },
          },
          false
        );
      }

      await deleteWorkspaceAPI(id);
      
      // Revalidate
      await mutateSWR();
      
      toast({
        title: 'Success',
        description: 'Workspace deleted successfully.',
      });
    } catch (error) {
      // Revert optimistic update on error
      await mutateSWR();
      
      const message = error instanceof Error ? error.message : 'Failed to delete workspace';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [data, mutateSWR, toast]);

  // Refresh workspaces
  const refreshWorkspaces = useCallback(async (): Promise<void> => {
    await mutateSWR();
  }, [mutateSWR]);

  // Utility functions
  const getWorkspaceById = useCallback((id: number): Workspace | undefined => {
    return workspaces.find(workspace => workspace.id === id);
  }, [workspaces]);

  const getWorkspaceBySlug = useCallback((slug: string): Workspace | undefined => {
    return workspaces.find(workspace => workspace.slug === slug);
  }, [workspaces]);

  const filterWorkspacesByTags = useCallback((filterTags: string[]): Workspace[] => {
    if (filterTags.length === 0) return workspaces;
    
    return workspaces.filter(workspace =>
      filterTags.every(tag => workspace.tags.includes(tag))
    );
  }, [workspaces]);

  return {
    // Data
    workspaces,
    pagination,
    
    // State
    isLoading: isLoading && enabled,
    isError: !!error,
    error: error || null,
    
    // Actions
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
    
    // Utilities
    getWorkspaceById,
    getWorkspaceBySlug,
    filterWorkspacesByTags,
  };
}

// Specialized hooks for common use cases
export function useWorkspace(id: number) {
  const { workspaces, isLoading, error, getWorkspaceById } = useWorkspaces();
  
  const workspace = useMemo(() => getWorkspaceById(id), [getWorkspaceById, id]);
  
  return {
    workspace,
    isLoading,
    error,
    exists: !!workspace,
  };
}

export function useWorkspaceBySlug(slug: string) {
  const { workspaces, isLoading, error, getWorkspaceBySlug } = useWorkspaces();
  
  const workspace = useMemo(() => getWorkspaceBySlug(slug), [getWorkspaceBySlug, slug]);
  
  return {
    workspace,
    isLoading,
    error,
    exists: !!workspace,
  };
}

// Hook for workspace search with debouncing
export function useWorkspaceSearch(initialQuery = '', debounceMs = 300) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const { workspaces, isLoading, error } = useWorkspaces({
    search: debouncedQuery,
  });

  return {
    query,
    setQuery,
    workspaces,
    isLoading,
    error,
    hasResults: workspaces.length > 0,
    isSearching: query !== debouncedQuery,
  };
}

/**
 * Usage Examples:
 * 
 * Basic usage:
 * const { workspaces, isLoading, createWorkspace } = useWorkspaces();
 * 
 * With pagination:
 * const { workspaces, pagination } = useWorkspaces({ page: 2, limit: 20 });
 * 
 * With search and filtering:
 * const { workspaces } = useWorkspaces({ 
 *   search: 'my project', 
 *   tags: ['frontend', 'react'] 
 * });
 * 
 * Single workspace:
 * const { workspace, exists } = useWorkspace(123);
 * 
 * Search with debouncing:
 * const { query, setQuery, workspaces, isSearching } = useWorkspaceSearch();
 */