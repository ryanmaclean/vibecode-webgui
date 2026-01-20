import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const generateProjectSchema = z.object({
  prompt: z.string().min(1, 'Project prompt is required'),
});

/**
 * Core project generation logic (exported for testing)
 */
export async function generateProjectWithAI(prompt: string, options?: Record<string, any>) {
  // This is a placeholder implementation
  // In production, this would call an AI service
  return {
    name: 'generated-project',
    description: prompt,
    files: [],
    scripts: {},
    dependencies: {},
    devDependencies: {},
    envVars: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = generateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await generateProjectWithAI(validation.data.prompt);

    return NextResponse.json({
      status: 'success',
      message: 'Project generation endpoint is working',
      timestamp: new Date().toISOString(),
      project: result
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
