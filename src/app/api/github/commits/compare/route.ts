import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GitHubIntegration } from '@/lib/github/integration';

const compareCommitsSchema = z.object({
  repoName: z.string().min(1),
  accessToken: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
});

/**
 * POST /api/github/commits/compare
 * Compare two commits or branches
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = compareCommitsSchema.parse(body);

    const github = new GitHubIntegration(validated.accessToken);
    await github.initialize();

    const comparison = await github.compareCommits(
      validated.repoName,
      validated.base,
      validated.head
    );

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error('Error comparing commits:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compare commits' },
      { status: 500 }
    );
  }
}
