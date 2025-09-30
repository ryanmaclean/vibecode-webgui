import { CodeDevelopmentState, WorkflowStepDefinition, CODE_DEVELOPMENT_STEPS } from './workflow-state';

/**
 * Visual debugging and monitoring for LangGraph workflows
 */
export class WorkflowDebugger {
  private states: Map<string, CodeDevelopmentState[]> = new Map();
  private stepTimings: Map<string, Record<string, number>> = new Map();

  /**
   * Record a state change during workflow execution
   */
  recordState(sessionId: string, state: CodeDevelopmentState): void {
    if (!this.states.has(sessionId)) {
      this.states.set(sessionId, []);
    }
    
    // Deep clone the state to avoid reference issues
    const clonedState = JSON.parse(JSON.stringify(state));
    clonedState.timestamp = new Date().toISOString();
    
    this.states.get(sessionId)!.push(clonedState);
  }

  /**
   * Record timing for a workflow step
   */
  recordStepTiming(sessionId: string, stepName: string, duration: number): void {
    if (!this.stepTimings.has(sessionId)) {
      this.stepTimings.set(sessionId, {});
    }
    
    this.stepTimings.get(sessionId)![stepName] = duration;
  }

  /**
   * Get workflow execution trace for a session
   */
  getExecutionTrace(sessionId: string): WorkflowExecutionTrace | null {
    const states = this.states.get(sessionId);
    const timings = this.stepTimings.get(sessionId);
    
    if (!states || states.length === 0) {
      return null;
    }

    const finalState = states[states.length - 1];
    const steps = this.generateStepTrace(states, timings || {});
    
    return {
      sessionId,
      startTime: states[0].metadata.startTime,
      endTime: finalState.metadata.endTime,
      totalDuration: timings ? Object.values(timings).reduce((a, b) => a + b, 0) : 0,
      steps,
      currentStep: finalState.currentStep,
      status: this.determineStatus(finalState),
      completedSteps: finalState.metadata.completedSteps,
      failedSteps: finalState.metadata.failedSteps,
      states: states.length,
    };
  }

  /**
   * Generate visual workflow graph data
   */
  getWorkflowGraph(sessionId?: string): WorkflowGraphData {
    const steps = Object.values(CODE_DEVELOPMENT_STEPS);
    const nodes = steps.map(step => ({
      id: step.name,
      label: step.name.charAt(0).toUpperCase() + step.name.slice(1),
      description: step.description,
      status: sessionId ? this.getStepStatus(sessionId, step.name) : 'pending',
      timing: sessionId ? this.stepTimings.get(sessionId)?.[step.name] : undefined,
    }));

    const edges = this.generateEdges(steps);

    return {
      nodes,
      edges,
      sessionId,
    };
  }

  /**
   * Get performance metrics for a workflow session
   */
  getPerformanceMetrics(sessionId: string): WorkflowPerformanceMetrics | null {
    const states = this.states.get(sessionId);
    const timings = this.stepTimings.get(sessionId);
    
    if (!states || !timings) {
      return null;
    }

    const finalState = states[states.length - 1];
    const totalDuration = Object.values(timings).reduce((a, b) => a + b, 0);
    const stepCount = Object.keys(timings).length;
    const averageStepTime = totalDuration / stepCount;

    const slowestStep = Object.entries(timings).reduce((a, b) => 
      a[1] > b[1] ? a : b
    );

    const fastestStep = Object.entries(timings).reduce((a, b) => 
      a[1] < b[1] ? a : b
    );

    return {
      sessionId,
      totalDuration,
      averageStepTime,
      stepCount,
      retryCount: finalState.error?.retryCount || 0,
      failureCount: finalState.metadata.failedSteps.length,
      successRate: (finalState.metadata.completedSteps.length / stepCount) * 100,
      slowestStep: { name: slowestStep[0], duration: slowestStep[1] },
      fastestStep: { name: fastestStep[0], duration: fastestStep[1] },
      memoryUsage: this.calculateMemoryUsage(states),
    };
  }

  /**
   * Get all active workflow sessions
   */
  getActiveSessions(): WorkflowSessionSummary[] {
    return Array.from(this.states.entries()).map(([sessionId, states]) => {
      const finalState = states[states.length - 1];
      const timings = this.stepTimings.get(sessionId) || {};
      
      return {
        sessionId,
        startTime: states[0].metadata.startTime,
        currentStep: finalState.currentStep,
        status: this.determineStatus(finalState),
        progress: (finalState.metadata.completedSteps.length / Object.keys(CODE_DEVELOPMENT_STEPS).length) * 100,
        duration: Object.values(timings).reduce((a, b) => a + b, 0),
        stateCount: states.length,
      };
    });
  }

  /**
   * Clear debugging data for a session
   */
  clearSession(sessionId: string): void {
    this.states.delete(sessionId);
    this.stepTimings.delete(sessionId);
  }

  /**
   * Clear all debugging data
   */
  clearAll(): void {
    this.states.clear();
    this.stepTimings.clear();
  }

  /**
   * Export debugging data for analysis
   */
  exportDebugData(sessionId?: string): any {
    if (sessionId) {
      return {
        sessionId,
        states: this.states.get(sessionId),
        timings: this.stepTimings.get(sessionId),
        trace: this.getExecutionTrace(sessionId),
        performance: this.getPerformanceMetrics(sessionId),
      };
    }

    return {
      allSessions: Array.from(this.states.keys()),
      states: Object.fromEntries(this.states),
      timings: Object.fromEntries(this.stepTimings),
      summary: this.getActiveSessions(),
    };
  }

  // Private helper methods

  private generateStepTrace(states: CodeDevelopmentState[], timings: Record<string, number>): StepTrace[] {
    const steps: StepTrace[] = [];
    const processedSteps = new Set<string>();

    states.forEach((state, index) => {
      const stepName = state.currentStep;
      
      if (!processedSteps.has(stepName) && stepName !== 'completed') {
        const stepDef = CODE_DEVELOPMENT_STEPS[stepName];
        if (stepDef) {
          steps.push({
            name: stepName,
            description: stepDef.description,
            startTime: (state as any).timestamp || state.metadata.startTime,
            duration: timings[stepName] || 0,
            status: state.metadata.completedSteps.includes(stepName) ? 'completed' :
                   state.metadata.failedSteps.includes(stepName) ? 'failed' : 'running',
            output: state.outputs[stepName],
            error: state.error?.step === stepName ? state.error.message : undefined,
          });
          processedSteps.add(stepName);
        }
      }
    });

    return steps;
  }

  private generateEdges(steps: WorkflowStepDefinition[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = [];
    
    steps.forEach(step => {
      step.dependencies.forEach(dep => {
        edges.push({
          from: dep,
          to: step.name,
          type: 'flow',
        });
      });
    });

    return edges;
  }

  private getStepStatus(sessionId: string, stepName: string): 'pending' | 'running' | 'completed' | 'failed' {
    const states = this.states.get(sessionId);
    if (!states) return 'pending';

    const finalState = states[states.length - 1];
    
    if (finalState.metadata.completedSteps.includes(stepName)) {
      return 'completed';
    }
    if (finalState.metadata.failedSteps.includes(stepName)) {
      return 'failed';
    }
    if (finalState.currentStep === stepName) {
      return 'running';
    }
    
    return 'pending';
  }

  private determineStatus(state: CodeDevelopmentState): 'running' | 'completed' | 'failed' {
    if (state.error && state.error.retryCount >= 3) {
      return 'failed';
    }
    if (state.currentStep === 'completed' || state.metadata.endTime) {
      return 'completed';
    }
    return 'running';
  }

  private calculateMemoryUsage(states: CodeDevelopmentState[]): number {
    // Rough estimation of memory usage in bytes
    const jsonString = JSON.stringify(states);
    return new Blob([jsonString]).size;
  }
}

// Type definitions for debugging

export interface WorkflowExecutionTrace {
  sessionId: string;
  startTime: string;
  endTime?: string;
  totalDuration: number;
  steps: StepTrace[];
  currentStep: string;
  status: 'running' | 'completed' | 'failed';
  completedSteps: string[];
  failedSteps: string[];
  states: number;
}

export interface StepTrace {
  name: string;
  description: string;
  startTime: string;
  duration: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
}

export interface WorkflowGraphData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sessionId?: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timing?: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  type: 'flow' | 'error';
}

export interface WorkflowPerformanceMetrics {
  sessionId: string;
  totalDuration: number;
  averageStepTime: number;
  stepCount: number;
  retryCount: number;
  failureCount: number;
  successRate: number;
  slowestStep: { name: string; duration: number };
  fastestStep: { name: string; duration: number };
  memoryUsage: number;
}

export interface WorkflowSessionSummary {
  sessionId: string;
  startTime: string;
  currentStep: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  duration: number;
  stateCount: number;
}

// Singleton instance for global debugging
export const workflowDebugger = new WorkflowDebugger();

export default WorkflowDebugger;