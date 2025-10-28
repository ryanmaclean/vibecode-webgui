import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const generateProjectSchema = z.object({
  prompt: z.string().min(1, 'Project prompt is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = generateProjectSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Project generation endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
