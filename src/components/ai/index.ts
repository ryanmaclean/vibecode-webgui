/**
 * AI Components Barrel Export
 *
 * Centralized export for all AI-related components including agent UI,
 * chat interfaces, and conversation management.
 *
 * @module components/ai
 */

// Agent UI Components
export { AgentSelectorPanel } from './AgentSelectorPanel'
export { UnifiedAgentChat } from './UnifiedAgentChat'
export { MultiAgentWorkspace } from './MultiAgentWorkspace'
export { ConversationHistory } from './ConversationHistory'

// Legacy AI Components (existing) - default exports re-exported as named
export { AIChatInterface } from './AIChatInterface'
export { default as AIChatPanel } from './AIChatPanel'
export { default as AICodeAssistant } from './AICodeAssistant'
export { default as AICodeReview } from './AICodeReview'
export { default as AIModelSelector } from './AIModelSelector'
export { default as AIProjectGenerator } from './AIProjectGenerator'
export { default as CodeAssistant } from './CodeAssistant'
export { default as CodeServerIntegration } from './CodeServerIntegration'
export { default as LiteLLMInterface } from './LiteLLMInterface'
export { ModelOrchestratorDashboard } from './ModelOrchestratorDashboard'
export { default as PromptEnhancer } from './PromptEnhancer'
export { default as PromptTemplates } from './PromptTemplates'
export { default as VSCodeIntegration } from './VSCodeIntegration'
