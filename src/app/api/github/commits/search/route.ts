import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GitHubIntegration } from '@/lib/github/integration';

export const dynamic = 'force-dynamic'

const searchCommitsSchema = z.object({
  query: z.string().min(1),
  accessToken: z.string().min(1),
  sort: z.enum(['author-date', 'committer-date']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  per_page: z.number().min(1).max(100).optional(),
  page: z.number().min(1).optional(),
});

/**
 * POST /api/github/commits/search
 * Search commits across repositories
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = searchCommitsSchema.parse(body);

    const github = new GitHubIntegration(validated.accessToken);
    await github.initialize();

    const results = await github.searchCommits(validated.query, {
      sort: validated.sort,
      order: validated.order,
      per_page: validated.per_page,
      page: validated.page,
    });

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error searching commits:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search commits' },
      { status: 500 }
    );
  }
}
