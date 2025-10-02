/**
 * Agent Adapters Index
 * Export all agent adapters and registry
 * @module protocols/adapters
 */

import { AiderAdapter } from './aider-adapter';
import { ClineAdapter } from './cline-adapter';
import { ContinueAdapter } from './continue-adapter';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { GooseAdapter } from './goose-adapter';
import { UniversalAdapter } from './universal-adapter';
import { AgentAdapterRegistry } from './base-adapter';

// Register all adapters
AgentAdapterRegistry.register('aider', AiderAdapter);
AgentAdapterRegistry.register('cline', ClineAdapter);
AgentAdapterRegistry.register('continue', ContinueAdapter);
AgentAdapterRegistry.register('claude-code', ClaudeCodeAdapter);
AgentAdapterRegistry.register('goose', GooseAdapter);
AgentAdapterRegistry.register('universal', UniversalAdapter);

// Re-export everything
export * from './base-adapter';
export * from './aider-adapter';
export * from './cline-adapter';
export * from './continue-adapter';
export * from './claude-code-adapter';
export * from './goose-adapter';
export * from './universal-adapter';

// Export registry
export { AgentAdapterRegistry };
