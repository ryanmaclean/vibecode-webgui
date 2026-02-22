/**
 * Pinned Context Items API Route
 *
 * POST /api/ai/context/pinned - Pin or unpin context items
 * GET /api/ai/context/pinned - Get list of pinned items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic';

// Rate limiting: 60 requests per minute for write operations
const apiRateLimit = createAPIRateLimit(60);

// In-memory storage for pinned items
// In a production environment, this should be persisted to a database
interface PinnedItem {
  path: string;
  type?: 'file' | 'function';
  pinnedAt: Date;
  metadata?: {
    language?: string;
    description?: string;
  };
}

// Global store for pinned items (keyed by path)
const pinnedItems = new Map<string, PinnedItem>();

/**
 * GET /api/ai/context/pinned
 * Get all currently pinned context items
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      );
    }

    // Convert Map to array
    const items = Array.from(pinnedItems.values());

    return NextResponse.json({
      success: true,
      data: {
        pinnedItems: items,
        count: items.length
      }
    });
  } catch (error) {
    console.error('Error fetching pinned items:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pinned items',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/context/pinned
 * Pin or unpin a context item
 *
 * Request body:
 * {
 *   action: 'pin' | 'unpin' | 'clear',
 *   path?: string,
 *   type?: 'file' | 'function',
 *   metadata?: { language?: string, description?: string }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, path, type, metadata } = body;

    // Validate action
    if (!action || !['pin', 'unpin', 'clear'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "pin", "unpin", or "clear"',
        },
        { status: 400 }
      );
    }

    // Handle clear action
    if (action === 'clear') {
      const clearedCount = pinnedItems.size;
      pinnedItems.clear();

      return NextResponse.json({
        success: true,
        data: {
          action: 'clear',
          clearedCount,
          message: `Cleared ${clearedCount} pinned item(s)`
        }
      });
    }

    // Validate path for pin/unpin actions
    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Path is required for pin/unpin actions',
        },
        { status: 400 }
      );
    }

    // Handle pin action
    if (action === 'pin') {
      const item: PinnedItem = {
        path,
        type: type || 'file',
        pinnedAt: new Date(),
        metadata
      };

      pinnedItems.set(path, item);

      return NextResponse.json({
        success: true,
        data: {
          action: 'pin',
          item,
          message: `Pinned ${type || 'file'}: ${path}`,
          totalPinned: pinnedItems.size
        }
      });
    }

    // Handle unpin action
    if (action === 'unpin') {
      const existed = pinnedItems.has(path);
      pinnedItems.delete(path);

      return NextResponse.json({
        success: true,
        data: {
          action: 'unpin',
          path,
          existed,
          message: existed ? `Unpinned: ${path}` : `Path was not pinned: ${path}`,
          totalPinned: pinnedItems.size
        }
      });
    }

    // Should never reach here, but just in case
    return NextResponse.json(
      {
        success: false,
        error: 'Unknown error occurred',
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error managing pinned items:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to manage pinned items',
      },
      { status: 500 }
    );
  }
}

/**
 * Get pinned items (exported for use in other modules)
 */
export function getPinnedItems(): PinnedItem[] {
  return Array.from(pinnedItems.values());
}

/**
 * Check if a path is pinned (exported for use in other modules)
 */
export function isPinned(path: string): boolean {
  return pinnedItems.has(path);
}
