import { NextRequest, NextResponse } from 'next/server';
import { EnhancedAIManager } from '../../../../lib/ai/enhanced-ai-manager';
import { WorkflowInputSchema } from '../../../../lib/ai/workflows/workflow-state';
import { z } from 'zod';

// Create AI manager instance
const aiManager = new EnhancedAIManager({
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4',
    temperature: 0.1,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = WorkflowInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Execute LangGraph workflow
    const result = await aiManager.executeLangGraphWorkflow(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error('LangGraph workflow execution error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Get workflow debugging information
    const debugInfo = aiManager.getWorkflowDebugInfo(sessionId || undefined);

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('LangGraph workflow status error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}