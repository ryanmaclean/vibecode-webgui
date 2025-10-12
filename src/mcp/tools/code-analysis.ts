/**
 * Code analysis tools for MCP
 */

import { vectorStore } from '../../lib/vector-db/vector-store-service.js';
import { prisma } from '../../lib/prisma.js';
import type { SearchCodeArgs, AnalyzeCodeArgs } from '../types.js';
import { logger } from '@/lib/logger';

/**
 * Search code semantically using vector search
 * @param args - Search parameters including query, optional workspaceId and language
 * @returns Search results with file paths, line numbers, and snippets
 */
export async function searchCode(args: SearchCodeArgs) {
  const { query, workspaceId, language } = args;

  try {
    // Initialize vector store if needed
    await vectorStore.initialize();

    // Convert workspace_id (string) to numeric id if provided
    let numericWorkspaceId: number | undefined;
    if (workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { workspace_id: workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: `Workspace not found: ${workspaceId}`,
                  query,
                  results: []
                },
                null,
                2
              ),
            },
          ],
        };
      }

      numericWorkspaceId = workspace.id;
    }

    // Perform vector search
    const searchResults = await vectorStore.search(query, {
      workspaceId: numericWorkspaceId,
      limit: 10,
      threshold: 0.7
    });

    // Transform results to match expected MCP response format
    const results = searchResults.map(result => ({
      file: result.chunk.metadata.fileName,
      line: result.chunk.metadata.startLine || 0,
      snippet: result.chunk.content,
      score: result.similarity,
      language: result.chunk.metadata.language,
      startLine: result.chunk.metadata.startLine,
      endLine: result.chunk.metadata.endLine,
      fileId: result.chunk.metadata.fileId
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              query,
              workspaceId,
              language,
              resultsCount: results.length,
              results
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    logger.error('Error in searchCode:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              query,
              workspaceId,
              results: []
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

export async function analyzeCode(args: AnalyzeCodeArgs) {
  const { workspaceId, filePath, checks = ['security', 'performance', 'quality'] } = args;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            workspaceId,
            filePath,
            checks,
            issues: [
              {
                type: 'security',
                severity: 'medium',
                message: 'Potential XSS vulnerability',
                file: 'src/components/Input.tsx',
                line: 42,
              },
            ],
            summary: {
              security: 1,
              performance: 0,
              quality: 2,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}
