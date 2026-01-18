/**
 * MCP Sequential Thinking Interfaces
 * Defines the interfaces for thoughts, thinking state, and process
 */

/**
 * Thought state interface
 */
export interface ThinkingState {
  thoughtNumber: number;              // Current thought number
  totalThoughtsEstimated: number;     // Estimated total thoughts needed
  nextThoughtNeeded: boolean;         // Whether another thought is needed
  isRevision?: boolean;               // Whether this is a revision of a previous thought
  revisesThought?: number;            // Which thought is being revised
  branchFromThought?: number;         // Branching point thought number
  branchId?: string;                  // Branch identifier
  needsMoreThoughts?: boolean;        // If more thoughts are needed
}

/**
 * Thought interface
 */
export interface Thought {
  content: string;                    // The thought content
  state: ThinkingState;               // State information for the thought
  timestamp: number;                  // When the thought was created
}

/**
 * Branch interface
 */
export interface ThinkingBranch {
  id: string;                         // Branch identifier
  name: string;                       // Branch name
  parentThoughtNumber: number;        // Parent thought number
  thoughts: Thought[];                // Thoughts in this branch
}

/**
 * Sequential Thinking Process interface
 */
export interface ISequentialThinkingProcess {
  // Core methods
  addThought(content: string, thoughtNumber: number, totalThoughts: number, nextThoughtNeeded?: boolean): Thought;
  reviseThought(thoughtNumber: number, newContent: string): Thought;
  createBranch(fromThoughtNumber: number, branchName: string): ThinkingBranch;
  addThoughtToBranch(branchId: string, content: string, thoughtNumber: number, totalThoughts: number): Thought;
  
  // Getters
  getThoughts(): Thought[];
  getThought(thoughtNumber: number): Thought | null;
  getBranches(): ThinkingBranch[];
  getBranch(branchId: string): ThinkingBranch | null;
  getBranchThoughts(branchId: string): Thought[];
  
  // Utility methods
  serialize(): string;
  deserialize(serialized: string): boolean;
  getSummary(): string;
}