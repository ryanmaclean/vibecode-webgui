import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GitHubIntegration } from '@/lib/github/integration';

const getCommitDetailsSchema = z.object({
  repoName: z.string().min(1),
  commitSha: z.string().min(1),
  accessToken: z.string().min(1),
});

/**
 * POST /api/github/commits/details
 * Get detailed information for a specific commit
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = getCommitDetailsSchema.parse(body);

    const github = new GitHubIntegration(validated.accessToken);
    await github.initialize();

    const commit = await github.getCommitDetails(
      validated.repoName,
      validated.commitSha
    );

    return NextResponse.json({
      success: true,
      commit,
    });
  } catch (error) {
    console.error('Error fetching commit details:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch commit details' },
      { status: 500 }
    );
  }
}
