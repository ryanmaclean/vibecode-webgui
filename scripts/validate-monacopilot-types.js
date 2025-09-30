#!/usr/bin/env node
/**
 * Validation script for Monacopilot TypeScript types
 * 
 * This script validates that our types compile correctly and can be used
 * in TypeScript projects without errors.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Monacopilot TypeScript types...\n');

// Check if files exist
const typesFile = path.join(__dirname, '../src/types/monacopilot.d.ts');
const integrationFile = path.join(__dirname, '../src/lib/monaco/monacopilot-integration.ts');
const apiFile = path.join(__dirname, '../src/app/api/code-completion/route.ts');

console.log('✅ Checking if type definition files exist...');
console.log(`   Types file: ${fs.existsSync(typesFile) ? '✅' : '❌'} ${typesFile}`);
console.log(`   Integration file: ${fs.existsSync(integrationFile) ? '✅' : '❌'} ${integrationFile}`);
console.log(`   API route file: ${fs.existsSync(apiFile) ? '✅' : '❌'} ${apiFile}`);

// Create a test TypeScript file to validate types
const testContent = `
import * as monaco from 'monaco-editor';
import { setupMonacopilot, setupMonacopilotMulti } from './src/lib/monaco/monacopilot-integration';
import type { 
  MonacopilotConfig, 
  EnhancedMonacopilotConfig,
  AIProvider,
  OpenAIModel,
  MistralModel,
  AnthropicModel,
  GroqModel
} from './src/types/monacopilot';

// Test basic configuration
const basicConfig: MonacopilotConfig = {
  endpoint: '/api/code-completion',
  language: 'typescript',
  debug: true,
  headers: { 'Authorization': 'Bearer token' }
};

// Test enhanced configuration
const enhancedConfig: EnhancedMonacopilotConfig = {
  endpoint: '/api/code-completion',
  language: 'typescript',
  provider: 'openai',
  model: 'gpt-4-turbo',
  debug: true,
  trigger: 'onIdle',
  filename: 'test.ts',
  technologies: ['react', 'nextjs'],
  maxContextLines: 100,
  enableCaching: true,
  allowFollowUpCompletions: true,
  modelParameters: {
    temperature: 0.2,
    maxTokens: 1000,
    topP: 0.95
  },
  onCompletionAccepted: () => console.log('Completion accepted'),
  onError: (error) => console.error(error)
};

// Test provider-specific configurations
const providers: AIProvider[] = ['openai', 'mistral', 'anthropic', 'groq'];
const openaiModels: OpenAIModel[] = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const mistralModels: MistralModel[] = ['codestral', 'codestral-latest'];

console.log('TypeScript types validation successful!');
export {};
`;

const testFile = path.join(__dirname, '../types-test.ts');
fs.writeFileSync(testFile, testContent);

try {
  console.log('\n🔍 Running TypeScript compilation test...');
  execSync(`npx tsc --noEmit --skipLibCheck ${testFile}`, { 
    cwd: path.dirname(__dirname),
    stdio: 'pipe'
  });
  console.log('✅ TypeScript types compile successfully!');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout?.toString());
  console.log(error.stderr?.toString());
} finally {
  // Cleanup test file
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
}

// Validate type definitions content
console.log('\n🔍 Validating type definitions content...');
const typesContent = fs.readFileSync(typesFile, 'utf8');

const requiredTypes = [
  'AIProvider',
  'OpenAIModel',
  'MistralModel', 
  'AnthropicModel',
  'GroqModel',
  'MonacopilotConfig',
  'EnhancedMonacopilotConfig',
  'CompletionTrigger',
  'SupportedLanguage',
  'ModelParameters',
  'RelatedFile'
];

console.log('   Required type exports:');
requiredTypes.forEach(type => {
  const hasType = typesContent.includes(`export type ${type}`) || typesContent.includes(`export interface ${type}`);
  console.log(`   ${hasType ? '✅' : '❌'} ${type}`);
});

// Check AI providers
const aiProviders = ['openai', 'mistral', 'anthropic', 'groq', 'cohere'];
console.log('\n   AI provider support:');
aiProviders.forEach(provider => {
  const hasProvider = typesContent.includes(`'${provider}'`);
  console.log(`   ${hasProvider ? '✅' : '❌'} ${provider}`);
});

console.log('\n🎉 Monacopilot TypeScript types validation completed!');