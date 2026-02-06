import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GitHubIntegration } from '@/lib/github/integration';

const listCommitsSchema = z.object({
  repoName: z.string().min(1),
  accessToken: z.string().min(1),
  branch: z.string().optional(),
  path: z.string().optional(),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  per_page: z.number().min(1).max(100).optional(),
  page: z.number().min(1).optional(),
});

/**
 * POST /api/github/commits/list
 * List commits for a repository with optional filters
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = listCommitsSchema.parse(body);

    const github = new GitHubIntegration(validated.accessToken);
    await github.initialize();

    const commits = await github.getCommitHistory(validated.repoName, {
      branch: validated.branch,
      path: validated.path,
      author: validated.author,
      since: validated.since,
      until: validated.until,
      per_page: validated.per_page,
      page: validated.page,
    });

    return NextResponse.json({
      success: true,
      commits,
      page: validated.page || 1,
      per_page: validated.per_page || 30,
    });
  } catch (error) {
    console.error('Error listing commits:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list commits' },
      { status: 500 }
    );
  }
}
