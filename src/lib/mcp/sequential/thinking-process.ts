/**
 * MCP Sequential Thinking Process
 * Core implementation of the Sequential Thinking framework
 */

import {
  ThinkingState,
  Thought,
  ThinkingBranch,
  ISequentialThinkingProcess
} from './interfaces';
import { logger } from '@/lib/logger';

/**
 * Implementation of the Sequential Thinking Process
 */
export class SequentialThinkingProcess implements ISequentialThinkingProcess {
  private thoughts: Thought[] = [];
  private branches: Map<string, ThinkingBranch> = new Map();
  
  /**
   * Adds a new thought to the thinking process
   * @param content The thought content
   * @param thoughtNumber Current thought number
   * @param totalThoughts Estimated total thoughts needed
   * @param nextThoughtNeeded Whether another thought is needed (defaults to true)
   * @returns The created thought
   */
  addThought(
    content: string,
    thoughtNumber: number,
    totalThoughts: number,
    nextThoughtNeeded: boolean = true
  ): Thought {
    const state: ThinkingState = {
      thoughtNumber,
      totalThoughtsEstimated: totalThoughts,
      nextThoughtNeeded,
    };
    
    const thought: Thought = {
      content,
      state,
      timestamp: Date.now()
    };
    
    // Add to main thoughts array
    this.thoughts.push(thought);
    
    return thought;
  }
  
  /**
   * Revise a previous thought
   * @param thoughtNumber The thought number to revise
   * @param newContent The revised content
   * @returns The revised thought
   */
  reviseThought(thoughtNumber: number, newContent: string): Thought {
    const originalThought = this.getThought(thoughtNumber);
    if (!originalThought) {
      throw new Error(`Thought ${thoughtNumber} not found`);
    }
    
    const newThoughtNumber = this.thoughts.length + 1;
    
    const state: ThinkingState = {
      thoughtNumber: newThoughtNumber,
      totalThoughtsEstimated: originalThought.state.totalThoughtsEstimated,
      nextThoughtNeeded: true,
      isRevision: true,
      revisesThought: thoughtNumber
    };
    
    const revisedThought: Thought = {
      content: newContent,
      state,
      timestamp: Date.now()
    };
    
    // Add revised thought to main thoughts array
    this.thoughts.push(revisedThought);
    
    return revisedThought;
  }
  
  /**
   * Create a new branch from a thought
   * @param fromThoughtNumber The thought number to branch from
   * @param branchName The name of the branch
   * @returns The created branch
   */
  createBranch(fromThoughtNumber: number, branchName: string): ThinkingBranch {
    const parentThought = this.getThought(fromThoughtNumber);
    if (!parentThought) {
      throw new Error(`Thought ${fromThoughtNumber} not found`);
    }
    
    const branchId = `branch-${Date.now()}-${fromThoughtNumber}`;
    
    const branch: ThinkingBranch = {
      id: branchId,
      name: branchName,
      parentThoughtNumber: fromThoughtNumber,
      thoughts: []
    };
    
    this.branches.set(branchId, branch);
    
    return branch;
  }
  
  /**
   * Add a thought to a specific branch
   * @param branchId The branch identifier
   * @param content The thought content
   * @param thoughtNumber Current thought number
   * @param totalThoughts Estimated total thoughts needed
   * @returns The created thought
   */
  addThoughtToBranch(
    branchId: string,
    content: string,
    thoughtNumber: number,
    totalThoughts: number
  ): Thought {
    const branch = this.getBranch(branchId);
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }
    
    const state: ThinkingState = {
      thoughtNumber,
      totalThoughtsEstimated: totalThoughts,
      nextThoughtNeeded: true,
      branchFromThought: branch.parentThoughtNumber,
      branchId
    };
    
    const thought: Thought = {
      content,
      state,
      timestamp: Date.now()
    };
    
    // Add to branch thoughts array
    branch.thoughts.push(thought);
    
    return thought;
  }
  
  /**
   * Get all thoughts in the main sequence
   * @returns Array of thoughts
   */
  getThoughts(): Thought[] {
    return [...this.thoughts];
  }
  
  /**
   * Get a specific thought by number
   * @param thoughtNumber The thought number to retrieve
   * @returns The thought or null if not found
   */
  getThought(thoughtNumber: number): Thought | null {
    return this.thoughts.find(t => t.state.thoughtNumber === thoughtNumber) || null;
  }
  
  /**
   * Get all branches
   * @returns Array of branches
   */
  getBranches(): ThinkingBranch[] {
    return Array.from(this.branches.values());
  }
  
  /**
   * Get a specific branch by id
   * @param branchId The branch identifier
   * @returns The branch or null if not found
   */
  getBranch(branchId: string): ThinkingBranch | null {
    return this.branches.get(branchId) || null;
  }
  
  /**
   * Get all thoughts in a specific branch
   * @param branchId The branch identifier
   * @returns Array of thoughts in the branch
   */
  getBranchThoughts(branchId: string): Thought[] {
    const branch = this.getBranch(branchId);
    return branch ? [...branch.thoughts] : [];
  }
  
  /**
   * Serialize the thinking process to a string
   * @returns Serialized thinking process
   */
  serialize(): string {
    const data = {
      thoughts: this.thoughts,
      branches: Array.from(this.branches.entries())
    };
    
    return JSON.stringify(data);
  }
  
  /**
   * Deserialize a thinking process from a string
   * @param serialized Serialized thinking process
   * @returns Success flag
   */
  deserialize(serialized: string): boolean {
    try {
      const data = JSON.parse(serialized);
      
      this.thoughts = data.thoughts || [];
      
      this.branches = new Map();
      if (data.branches) {
        for (const [key, value] of data.branches) {
          this.branches.set(key, value);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to deserialize thinking process:', error);
      return false;
    }
  }
  
  /**
   * Get a summary of the thinking process
   * @returns Summary string
   */
  getSummary(): string {
    const mainThoughtsCount = this.thoughts.length;
    const branchesCount = this.branches.size;
    const revisionsCount = this.thoughts.filter(t => t.state.isRevision).length;
    
    let summary = `Sequential Thinking Process: ${mainThoughtsCount} thoughts`;
    
    if (branchesCount > 0) {
      summary += `, ${branchesCount} branches`;
    }
    
    if (revisionsCount > 0) {
      summary += `, ${revisionsCount} revisions`;
    }
    
    const lastThought = this.thoughts[this.thoughts.length - 1];
    if (lastThought) {
      summary += `\nLast thought (#${lastThought.state.thoughtNumber}): ${lastThought.content.substring(0, 50)}${lastThought.content.length > 50 ? '...' : ''}`;
      summary += `\nNext thought needed: ${lastThought.state.nextThoughtNeeded ? 'Yes' : 'No'}`;
    }
    
    return summary;
  }
  
  /**
   * Create SequentialThinkingProcess from serialized string
   * @param serialized Serialized thinking process
   * @returns New SequentialThinkingProcess instance
   */
  static deserialize(serialized: string): SequentialThinkingProcess {
    const process = new SequentialThinkingProcess();
    process.deserialize(serialized);
    return process;
  }
}