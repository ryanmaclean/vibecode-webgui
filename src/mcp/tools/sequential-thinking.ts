/**
 * Sequential Thinking Tool for MCP
 *
 * Provides structured, step-by-step thinking capabilities for AI agents.
 * Supports branching, revision, and context management.
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking
 */

import { SequentialThinkingProcess } from '../../lib/mcp/sequential/thinking-process.js';
import type { SequentialThinkingArgs } from '../types.js';

// Global thinking process instance for maintaining state across tool calls
let thinkingProcess: SequentialThinkingProcess | null = null;

/**
 * Initialize or get the current thinking process
 */
function getThinkingProcess(): SequentialThinkingProcess {
  if (!thinkingProcess) {
    thinkingProcess = new SequentialThinkingProcess();
  }
  return thinkingProcess;
}

/**
 * Reset the thinking process to start fresh
 */
export function resetThinkingProcess(): void {
  thinkingProcess = null;
}

/**
 * Process a sequential thinking step
 *
 * This tool allows AI agents to break down complex problems into
 * discrete, manageable steps. It supports:
 * - Linear thought progression
 * - Revising previous thoughts
 * - Branching into alternative reasoning paths
 * - Dynamic adjustment of total steps
 *
 * @param args - The sequential thinking arguments
 * @returns MCP response with the processed thought
 */
export async function sequentialThinking(args: SequentialThinkingArgs) {
  const {
    thought,
    thoughtNumber,
    totalThoughts,
    nextThoughtNeeded,
    isRevision,
    revisesThought,
    branchFromThought,
    branchId,
  } = args;

  const process = getThinkingProcess();

  try {
    let result;
    let thoughtType: 'standard' | 'revision' | 'branch' = 'standard';

    // Handle revision of a previous thought
    if (isRevision && revisesThought !== undefined) {
      result = process.reviseThought(revisesThought, thought);
      thoughtType = 'revision';
      
      console.error(`🔄 Thought ${thoughtNumber}: Revised thought #${revisesThought}`);
    }
    // Handle branching from a previous thought
    else if (branchFromThought !== undefined) {
      let targetBranchId = branchId;
      
      // If branchId is provided, use it; otherwise create a new branch
      if (targetBranchId && process.getBranch(targetBranchId)) {
        // Use existing branch
      } else {
        // Create a new branch and use its generated ID
        const newBranch = process.createBranch(branchFromThought, `Branch from thought ${branchFromThought}`);
        targetBranchId = newBranch.id;
      }
      
      result = process.addThoughtToBranch(
        targetBranchId,
        thought,
        thoughtNumber,
        totalThoughts
      );
      thoughtType = 'branch';
      
      console.error(`🌿 Thought ${thoughtNumber}: Added to branch ${targetBranchId} from thought #${branchFromThought}`);
    }
    // Standard thought addition
    else {
      result = process.addThought(thought, thoughtNumber, totalThoughts, nextThoughtNeeded);
      
      console.error(`💭 Thought ${thoughtNumber}/${totalThoughts}: ${thought.substring(0, 50)}${thought.length > 50 ? '...' : ''}`);
    }

    // Build response
    const response = {
      success: true,
      thought: {
        content: result.content,
        number: result.state.thoughtNumber,
        totalEstimated: result.state.totalThoughtsEstimated,
        nextNeeded: result.state.nextThoughtNeeded,
        type: thoughtType,
        timestamp: result.timestamp,
      },
      state: {
        thoughtCount: process.getThoughts().length,
        branchCount: process.getBranches().length,
        isComplete: !nextThoughtNeeded,
      },
      summary: process.getSummary(),
    };

    // If thinking is complete, include all thoughts
    if (!nextThoughtNeeded) {
      console.error(`✅ Sequential thinking complete: ${process.getThoughts().length} thoughts`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...response,
                allThoughts: process.getThoughts().map(t => ({
                  number: t.state.thoughtNumber,
                  content: t.content,
                  isRevision: t.state.isRevision,
                  revisesThought: t.state.revisesThought,
                  branchId: t.state.branchId,
                })),
                branches: process.getBranches().map(b => ({
                  id: b.id,
                  name: b.name,
                  parentThought: b.parentThoughtNumber,
                  thoughtCount: b.thoughts.length,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };

  } catch (error) {
    console.error('❌ Sequential thinking error:', error);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              thought: {
                number: thoughtNumber,
                content: thought,
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Get the current state of the thinking process
 */
export async function getThinkingState() {
  const process = getThinkingProcess();
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            thoughts: process.getThoughts().map(t => ({
              number: t.state.thoughtNumber,
              content: t.content,
              nextNeeded: t.state.nextThoughtNeeded,
              isRevision: t.state.isRevision,
              revisesThought: t.state.revisesThought,
              branchId: t.state.branchId,
            })),
            branches: process.getBranches().map(b => ({
              id: b.id,
              name: b.name,
              parentThought: b.parentThoughtNumber,
              thoughts: b.thoughts.map(t => ({
                number: t.state.thoughtNumber,
                content: t.content,
              })),
            })),
            summary: process.getSummary(),
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Serialize the current thinking process for persistence
 */
export function serializeThinkingProcess(): string {
  const process = getThinkingProcess();
  return process.serialize();
}

/**
 * Restore a thinking process from serialized state
 */
export function deserializeThinkingProcess(serialized: string): boolean {
  const process = getThinkingProcess();
  return process.deserialize(serialized);
}
