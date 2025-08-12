/**
 * Basic CRUD API Endpoint Example
 * 
 * This example demonstrates:
 * - Proper TypeScript typing
 * - Authentication middleware
 * - Input validation with Zod
 * - Error handling patterns
 * - Response formatting
 * - Database operations with Prisma
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Input validation schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).optional()
});

const updateWorkspaceSchema = createWorkspaceSchema.partial();

// Types
type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// Standard API response format
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  metadata?: {
    requestId: string;
    duration: number;
    cached?: boolean;
  };
}

// GET /api/workspaces - List all workspaces for authenticated user
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Authentication check
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.sub) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',');

    // Build database query
    const where: any = {
      userId: parseInt(token.sub)
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags
      };
    }

    // Execute queries in parallel
    const [workspaces, totalCount] = await Promise.all([
      prisma.workspace.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              projects: true,
              collaborators: true
            }
          }
        }
      }),
      prisma.workspace.count({ where })
    ]);

    const duration = Date.now() - startTime;

    return NextResponse.json<APIResponse>({
      success: true,
      data: {
        workspaces,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        }
      },
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    });

  } catch (error) {
    console.error('GET /api/workspaces error:', error);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to fetch workspaces',
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Authentication check
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.sub) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createWorkspaceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Invalid input',
        timestamp: new Date().toISOString(),
        metadata: {
          requestId,
          duration: Date.now() - startTime,
          validationErrors: validation.error.format()
        }
      }, { status: 400 });
    }

    const { name, description, isPublic, tags } = validation.data;

    // Check for duplicate workspace name (business logic)
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        userId: parseInt(token.sub),
        name
      }
    });

    if (existingWorkspace) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Workspace name already exists',
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        isPublic,
        tags: tags || [],
        userId: parseInt(token.sub),
        slug: generateSlug(name) // Helper function to create URL-friendly slug
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            projects: true,
            collaborators: true
          }
        }
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json<APIResponse>({
      success: true,
      data: workspace,
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/workspaces error:', error);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to create workspace',
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    }, { status: 500 });
  }
}

// PUT /api/workspaces/[id] - Update workspace
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Authentication check
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.sub) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    const workspaceId = parseInt(params.id);
    if (isNaN(workspaceId)) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Invalid workspace ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check workspace ownership
    const existingWorkspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: parseInt(token.sub)
      }
    });

    if (!existingWorkspace) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Workspace not found or access denied',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateWorkspaceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Invalid input',
        timestamp: new Date().toISOString(),
        metadata: {
          requestId,
          duration: Date.now() - startTime,
          validationErrors: validation.error.format()
        }
      }, { status: 400 });
    }

    const updateData = validation.data;

    // Update slug if name changed
    if (updateData.name && updateData.name !== existingWorkspace.name) {
      updateData.slug = generateSlug(updateData.name);
    }

    // Update workspace
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            projects: true,
            collaborators: true
          }
        }
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json<APIResponse>({
      success: true,
      data: workspace,
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    });

  } catch (error) {
    console.error('PUT /api/workspaces/[id] error:', error);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to update workspace',
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Authentication check
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.sub) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    const workspaceId = parseInt(params.id);
    if (isNaN(workspaceId)) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Invalid workspace ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check workspace ownership and get related data count
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: parseInt(token.sub)
      },
      include: {
        _count: {
          select: {
            projects: true,
            collaborators: true
          }
        }
      }
    });

    if (!workspace) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Workspace not found or access denied',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Prevent deletion if workspace has dependent data
    if (workspace._count.projects > 0) {
      return NextResponse.json<APIResponse>({
        success: false,
        error: 'Cannot delete workspace with existing projects',
        timestamp: new Date().toISOString(),
        metadata: {
          projectCount: workspace._count.projects
        }
      }, { status: 409 });
    }

    // Soft delete or hard delete based on business requirements
    // Using soft delete here (marking as deleted instead of removing)
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        deletedAt: new Date(),
        name: `${workspace.name}_deleted_${Date.now()}` // Prevent name conflicts
      }
    });

    const duration = Date.now() - startTime;

    return NextResponse.json<APIResponse>({
      success: true,
      data: {
        id: workspaceId,
        message: 'Workspace deleted successfully'
      },
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    });

  } catch (error) {
    console.error('DELETE /api/workspaces/[id] error:', error);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json<APIResponse>({
      success: false,
      error: 'Failed to delete workspace',
      timestamp: new Date().toISOString(),
      metadata: {
        requestId,
        duration
      }
    }, { status: 500 });
  }
}

// Helper Functions

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim() // Remove leading/trailing spaces
    .substring(0, 50); // Limit length
}

/**
 * Usage Examples:
 * 
 * GET /api/workspaces
 * GET /api/workspaces?page=1&limit=10&search=my-project&tags=frontend,typescript
 * 
 * POST /api/workspaces
 * {
 *   "name": "My New Workspace",
 *   "description": "A workspace for my project",
 *   "isPublic": false,
 *   "tags": ["frontend", "react", "typescript"]
 * }
 * 
 * PUT /api/workspaces/123
 * {
 *   "name": "Updated Workspace Name",
 *   "description": "Updated description"
 * }
 * 
 * DELETE /api/workspaces/123
 */