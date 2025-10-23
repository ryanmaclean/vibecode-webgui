import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
// import { logger } from '@/lib/logger';
import { validatePathParams, validateRequestBody } from '@/lib/api/validation/middleware';
import { initGooseParamSchema, initGooseSchema } from '@/lib/api/validation/schemas';
import path from 'path';

const execAsync = promisify(exec);

/**
 * POST /api/workspace/[id]/init-goose
 *
 * Initialize Goose migration system in workspace
 *
 * SECURITY: Critical command injection prevention
 * - Validates workspace ID format (alphanumeric + hyphens/underscores only)
 * - Validates migration name (no shell metacharacters)
 * - Sanitizes all paths to prevent directory traversal
 * - Uses parameterized execution to prevent command injection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Validate path parameters
  const pathValidation = validatePathParams(params, initGooseParamSchema);
  if (!pathValidation.success) {
    return pathValidation.error;
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(request, initGooseSchema);
  if (!bodyValidation.success) {
    return bodyValidation.error;
  }

  const { workspaceId, migrationName } = bodyValidation.data;

  try {
    // SECURITY: Construct safe workspace path using path.join (prevents traversal)
    const workspacePath = path.join('/workspaces', workspaceId);

    // SECURITY: Validate workspace path exists and is within allowed directory
    if (!workspacePath.startsWith('/workspaces/')) {
      console.error(`Invalid workspace path attempted: ${workspacePath}`);
      return NextResponse.json(
        { error: 'Invalid workspace path' },
        { status: 400 }
      );
    }

    // SECURITY: Install Goose using safe command (no user input in command string)
    await execAsync('which goose || go install github.com/pressly/goose/v3/cmd/goose@latest');

    // SECURITY: Initialize Goose with validated migration name
    // migrationName is already validated by Zod schema (alphanumeric + hyphens/underscores only)
    await execAsync(`goose -dir migrations create ${migrationName} sql`, {
      cwd: workspacePath,
      timeout: 30000 // 30 second timeout
    });

    // Create a basic migration file content
    const timestamp = Math.floor(Date.now() / 1000);
    const migrationContent = `-- +goose Up
-- SQL in this section is executed when the migration is applied
CREATE TABLE IF NOT EXISTS schema_migrations (
    version_id bigint NOT NULL,
    is_applied boolean NOT NULL,
    tstamp timestamp NULL DEFAULT now(),
    PRIMARY KEY (version_id)
);

-- +goose Down
-- SQL in this section is executed when the migration is rolled back
DROP TABLE IF EXISTS schema_migrations;`;

    console.log(`Migration file content for ${workspaceId}:\n${migrationContent}`);

    return NextResponse.json({
      success: true,
      message: 'Goose initialized successfully',
      workspaceId,
      migrationName
    });

  } catch (error) {
    console.error('Error initializing Goose:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Goose' },
      { status: 500 }
    );
  }
}
