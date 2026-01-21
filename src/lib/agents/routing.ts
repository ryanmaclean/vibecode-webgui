/**
 * Intelligent Agent Routing & Cost Optimization
 * Issue #890: Route tasks to agents based on capabilities and cost
 */

import { AgentIdentity, AgentType } from './identity-protocol';

/**
 * Cost model for agent operations
 */
export interface CostModel {
  perTokenInput: number;
  perTokenOutput: number;
  perRequest: number;
  currency: 'USD' | 'credits';
}

/**
 * Routing decision with cost estimate
 */
export interface RoutingDecision {
  agentId: string;
  agentName: string;
  score: number;
  estimatedCost: number;
  reasoning: string;
  alternativeAgents: string[];
}

/**
 * Task requirements for routing
 */
export interface TaskRequirements {
  requiredCapabilities: string[];
  preferredCapabilities?: string[];
  maxCost?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTokens?: number;
}

/**
 * Agent with cost information
 */
export interface AgentWithCost extends AgentIdentity {
  costModel: CostModel;
  currentLoad: number;
  maxConcurrency: number;
  avgResponseTime: number;
}

/**
 * Agent Router - Routes tasks to optimal agents
 */
export class AgentRouter {
  private agents: Map<string, AgentWithCost> = new Map();
  private routingHistory: RoutingDecision[] = [];

  /**
   * Register an agent with cost information
   */
  registerAgent(agent: AgentWithCost): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Route a task to the best available agent
   */
  routeTask(requirements: TaskRequirements): RoutingDecision | null {
    const candidates = this.findCandidates(requirements);

    if (candidates.length === 0) {
      return null;
    }

    // Score each candidate
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: this.scoreAgent(agent, requirements),
      cost: this.estimateCost(agent, requirements),
    }));

    // Sort by score (higher is better)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0];
    const decision: RoutingDecision = {
      agentId: best.agent.id,
      agentName: best.agent.name,
      score: best.score,
      estimatedCost: best.cost,
      reasoning: this.generateReasoning(best.agent, requirements, best.score),
      alternativeAgents: scoredCandidates.slice(1, 4).map(c => c.agent.id),
    };

    this.routingHistory.push(decision);
    return decision;
  }

  /**
   * Find agents that meet minimum requirements
   */
  private findCandidates(requirements: TaskRequirements): AgentWithCost[] {
    return Array.from(this.agents.values()).filter(agent => {
      // Must have all required capabilities
      const hasRequired = requirements.requiredCapabilities.every(
        cap => agent.capabilities.includes(cap)
      );

      // Must be available (not at max load)
      const isAvailable = agent.currentLoad < agent.maxConcurrency;

      // Must be within budget if specified
      const withinBudget = !requirements.maxCost ||
        this.estimateCost(agent, requirements) <= requirements.maxCost;

      return hasRequired && isAvailable && withinBudget;
    });
  }

  /**
   * Score an agent for a task (0-100)
   */
  private scoreAgent(agent: AgentWithCost, requirements: TaskRequirements): number {
    let score = 50; // Base score

    // Capability match bonus
    const preferredMatches = requirements.preferredCapabilities?.filter(
      cap => agent.capabilities.includes(cap)
    ).length || 0;
    score += preferredMatches * 10;

    // Load penalty (prefer less loaded agents)
    const loadRatio = agent.currentLoad / agent.maxConcurrency;
    score -= loadRatio * 20;

    // Cost efficiency bonus
    const cost = this.estimateCost(agent, requirements);
    if (requirements.maxCost && cost < requirements.maxCost * 0.5) {
      score += 15; // Significant savings
    }

    // Response time bonus
    if (agent.avgResponseTime < 1000) {
      score += 10; // Fast agent
    }

    // Priority adjustment
    if (requirements.priority === 'critical' && agent.type === 'specialist') {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate cost for a task
   */
  private estimateCost(agent: AgentWithCost, requirements: TaskRequirements): number {
    const tokens = requirements.estimatedTokens || 1000;
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (
      agent.costModel.perRequest +
      inputTokens * agent.costModel.perTokenInput +
      outputTokens * agent.costModel.perTokenOutput
    );
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    agent: AgentWithCost,
    requirements: TaskRequirements,
    score: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${agent.name} (score: ${score.toFixed(1)})`);
    reasons.push(`Capabilities: ${agent.capabilities.join(', ')}`);
    reasons.push(`Current load: ${agent.currentLoad}/${agent.maxConcurrency}`);

    return reasons.join('. ');
  }

  /**
   * Get routing statistics
   */
  getStats(): { totalRoutings: number; avgScore: number; topAgents: string[] } {
    const totalRoutings = this.routingHistory.length;
    const avgScore = totalRoutings > 0
      ? this.routingHistory.reduce((sum, d) => sum + d.score, 0) / totalRoutings
      : 0;

    const agentCounts = new Map<string, number>();
    this.routingHistory.forEach(d => {
      agentCounts.set(d.agentId, (agentCounts.get(d.agentId) || 0) + 1);
    });

    const topAgents = Array.from(agentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    return { totalRoutings, avgScore, topAgents };
  }
}

export const globalRouter = new AgentRouter();
