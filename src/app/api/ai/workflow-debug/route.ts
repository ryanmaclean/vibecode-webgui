import { NextRequest, NextResponse } from 'next/server';
import { workflowDebugger } from '../../../../lib/ai/workflows/workflow-debugger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session debug information
      const trace = workflowDebugger.getExecutionTrace(sessionId);
      const performance = workflowDebugger.getPerformanceMetrics(sessionId);
      const graph = workflowDebugger.getWorkflowGraph(sessionId);

      if (!trace) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        trace,
        performance,
        graph,
      });
    } else {
      // Get all active sessions and general workflow graph
      const activeSessions = workflowDebugger.getActiveSessions();
      const graph = workflowDebugger.getWorkflowGraph();

      return NextResponse.json({
        activeSessions,
        graph,
      });
    }
  } catch (error) {
    console.error('Workflow debug API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      workflowDebugger.clearSession(sessionId);
      return NextResponse.json({ success: true });
    } else {
      workflowDebugger.clearAll();
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Workflow debug clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}