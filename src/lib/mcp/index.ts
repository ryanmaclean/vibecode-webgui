/**
 * Master Control Program (MCP) - Core framework components
 * @module mcp
 */

// Import actual implementations
import * as SequentialInterfaces from './sequential/interfaces.js';
import { SequentialThinkingProcess } from './sequential/thinking-process.js';

// Export module namespaces with placeholder objects
export const Context7 = {
  // Will contain Context7 components when implemented
  Interfaces: {}, 
  Manager: {}
};

export const Sequential = {
  // Sequential thinking implementation
  Interfaces: SequentialInterfaces,
  ThinkingProcess: SequentialThinkingProcess
};

export const Playwright = {
  // Will contain Playwright components when implemented
  Config: {},
  Extensions: {
    Accessibility: {}
  },
  PageObjects: {}
};

export const Serena = {
  // Will contain Serena components when implemented
  Interfaces: {},
  ProjectManager: {},
  CodeServerClient: {},
  MemoryStore: {}
};

// Re-export sequential thinking types and classes for direct import
export * from './sequential/interfaces.js';
export { SequentialThinkingProcess } from './sequential/thinking-process.js';

// Module paths for dynamic imports
export const ModulePaths = {
  context7: './context7',
  sequential: './sequential',
  playwright: './playwright',
  serena: './serena'
};