/**
 * Plugin Install API Route
 * Handles plugin installation from URL or file upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { createServiceLogger } from '@/lib/logging';
import { getPluginManager } from '@/lib/plugins/plugin-manager';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { z } from '@/lib/zod-compat';

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugins-install' });

export const dynamic = 'force-dynamic';

const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

// File upload limits for plugin packages
const MAX_PLUGIN_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed MIME types for plugin packages
const ALLOWED_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/octet-stream',
] as const;

/**
 * Request body schema for URL-based installation
 */
const installRequestSchema = z.object({
  source: z.string().min(1, 'Plugin source is required'),
  version: z.string().optional(),
  force: z.boolean().optional(),
  skipValidation: z.boolean().optional(),
  autoEnable: z.boolean().optional(),
});

/**
 * Validate filename for security
 */
function validateFilename(filename: string): { valid: boolean; error?: string } {
  // Check for directory traversal
  if (filename.includes('../') || filename.includes('..\\') || filename.includes('..')) {
    return { valid: false, error: 'Invalid filename: directory traversal detected' };
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return { valid: false, error: 'Invalid filename: null byte detected' };
  }

  // Check for path separators in base filename
  const basename = path.basename(filename);
  if (basename !== filename) {
    return { valid: false, error: 'Invalid filename: path separators not allowed' };
  }

  // Check length
  if (filename.length > 255) {
    return { valid: false, error: 'Invalid filename: too long' };
  }

  return { valid: true };
}

/**
 * Get temporary directory for plugin uploads
 */
function getTempPluginDir(): string {
  const tempDir = process.env.TEMP_DIR || path.join(process.cwd(), 'data', 'temp');
  return path.join(tempDir, 'plugin-uploads');
}

/**
 * Ensure temp directories exist
 */
async function ensureTempDirectory(): Promise<void> {
  const tempDir = getTempPluginDir();
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }
}

/**
 * POST /api/plugins/install
 * Install a plugin from URL or file upload
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

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let pluginSource: string;
    let installOptions: {
      version?: string;
      force?: boolean;
      skipValidation?: boolean;
      autoEnable?: boolean;
    } = {};

    // Handle multipart/form-data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'Missing file parameter' },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_PLUGIN_SIZE) {
        return NextResponse.json(
          {
            error: `Plugin package exceeds ${MAX_PLUGIN_SIZE / 1024 / 1024}MB limit`,
            details: `File size: ${Math.round(file.size / 1024 / 1024)}MB`,
          },
          { status: 413 }
        );
      }

      // Validate filename
      const filenameValidation = validateFilename(file.name);
      if (!filenameValidation.valid) {
        return NextResponse.json(
          { error: filenameValidation.error },
          { status: 400 }
        );
      }

      // Validate MIME type (optional - plugins can be various archive types)
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
        logger.warn('Plugin uploaded with unexpected MIME type', {
          fileName: file.name,
          mimeType: file.type,
          userId: session.user.id || session.user.email,
        });
      }

      // Save uploaded file to temp directory
      await ensureTempDirectory();
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${fileId}-${file.name}`;
      const tempFilePath = path.join(getTempPluginDir(), fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(tempFilePath, buffer);

      pluginSource = tempFilePath;

      // Get install options from form data
      installOptions = {
        force: formData.get('force') === 'true',
        skipValidation: formData.get('skipValidation') === 'true',
        autoEnable: formData.get('autoEnable') === 'true',
      };

      logger.info('Plugin file uploaded', {
        fileName: file.name,
        fileSize: file.size,
        tempPath: tempFilePath,
        userId: session.user.id || session.user.email,
      });
    }
    // Handle application/json (URL-based installation)
    else if (contentType.includes('application/json')) {
      const body = await request.json();

      // Validate request body
      const parseResult = installRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: parseResult.error.issues,
          },
          { status: 400 }
        );
      }

      const { source, version, force, skipValidation, autoEnable } = parseResult.data;
      pluginSource = source;
      installOptions = { version, force, skipValidation, autoEnable };

      logger.info('Plugin installation requested', {
        source,
        version,
        userId: session.user.id || session.user.email,
      });
    } else {
      return NextResponse.json(
        {
          error: 'Invalid content type',
          details: 'Expected multipart/form-data or application/json',
        },
        { status: 415 }
      );
    }

    // Initialize plugin manager
    const manager = getPluginManager();
    await manager.initialize();

    // Install plugin
    const result = await manager.install({
      source: pluginSource,
      ...installOptions,
    });

    if (!result.success) {
      logger.error('Plugin installation failed', {
        source: pluginSource,
        error: result.error,
        warnings: result.warnings,
        userId: session.user.id || session.user.email,
      });

      return NextResponse.json(
        {
          error: result.error || 'Failed to install plugin',
          warnings: result.warnings,
        },
        { status: 400 }
      );
    }

    logger.info('Plugin installed successfully', {
      pluginId: result.pluginId,
      source: pluginSource,
      userId: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Plugin '${result.pluginId}' installed successfully`,
      pluginId: result.pluginId,
      warnings: result.warnings,
    });
  } catch (error) {
    logger.error('Plugin install API error', { error });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
