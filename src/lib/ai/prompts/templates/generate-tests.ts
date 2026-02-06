/**
 * Test Generation Prompt Templates
 *
 * Templates for AI-powered test generation covering:
 * - Unit tests
 * - Integration tests
 * - E2E tests
 * - Test-driven development
 * - Edge case testing
 */

import { PromptTemplate, PromptCategory } from '@/types/prompts';

/**
 * Standard unit test generation
 */
export const generateTestsUnit: PromptTemplate = {
  id: 'generate-tests-unit',
  name: 'Generate Unit Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate comprehensive unit tests for functions, classes, and modules',
  systemPrompt: `You are an expert test engineer specializing in unit testing. Generate thorough, well-structured unit tests following best practices:

1. Test one thing per test (single assertion principle)
2. Use descriptive test names that explain the expected behavior
3. Follow the Arrange-Act-Assert (AAA) pattern
4. Cover happy paths, edge cases, and error conditions
5. Use appropriate mocking for dependencies
6. Ensure tests are independent and repeatable
7. Consider boundary conditions and null/undefined cases

Write tests that serve as documentation for the code's behavior.`,

  userPromptTemplate: `Generate unit tests for this {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#testRequirements}}
Specific requirements: {{testRequirements}}
{{/testRequirements}}

{{#coverageTarget}}
Coverage target: {{coverageTarget}}
{{/coverageTarget}}

Please generate:
1. **Test Suite**: Complete test file with all tests
2. **Test Categories**: Organized by functionality
3. **Happy Path Tests**: Normal expected behavior
4. **Edge Cases**: Boundary conditions, empty inputs, etc.
5. **Error Cases**: Exception handling and error conditions
6. **Mocking**: Any required mocks/stubs
7. **Coverage Notes**: Which lines/branches are covered`,

  variables: [
    {
      name: 'code',
      description: 'The code to generate tests for',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'Testing framework to use',
      required: true,
      type: 'string',
      defaultValue: 'jest',
      example: 'jest, vitest, mocha, pytest'
    },
    {
      name: 'testRequirements',
      description: 'Specific testing requirements or focus areas',
      required: false,
      type: 'string',
      example: 'focus on error handling, test async behavior'
    },
    {
      name: 'coverageTarget',
      description: 'Target code coverage percentage',
      required: false,
      type: 'string',
      defaultValue: '80%'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  modelRequirements: {
    minContextWindow: 8000,
    codeCapable: true,
    capabilities: ['code', 'reasoning']
  },

  tags: ['test', 'unit-test', 'tdd', 'coverage'],
  isSystem: true,

  examples: [
    {
      description: 'Generate tests for a utility function',
      variables: {
        code: `export function formatCurrency(amount: number, currency: string = 'USD'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid amount');
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}`,
        language: 'typescript',
        framework: 'jest'
      }
    }
  ]
};

/**
 * Integration test generation
 */
export const generateTestsIntegration: PromptTemplate = {
  id: 'generate-tests-integration',
  name: 'Generate Integration Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate integration tests for testing component interactions',
  systemPrompt: `You are an expert at integration testing. Generate tests that verify how different parts of the system work together.

Focus on:
1. Testing real interactions between components
2. Database operations (with test database/transactions)
3. API endpoint testing
4. External service integration (with appropriate mocking)
5. Data flow through multiple layers
6. Transaction boundaries and rollbacks
7. Configuration and environment variations

Balance between using real implementations and mocking where necessary.`,

  userPromptTemplate: `Generate integration tests for this {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#integrationPoints}}
Integration points to test: {{integrationPoints}}
{{/integrationPoints}}

{{#dependencies}}
External dependencies: {{dependencies}}
{{/dependencies}}

Please generate:
1. **Integration Test Suite**: Tests for component interactions
2. **Setup/Teardown**: Database and service setup
3. **API Tests**: Endpoint testing (if applicable)
4. **Data Flow Tests**: Test data through multiple layers
5. **Error Scenarios**: Integration failure handling
6. **Test Fixtures**: Sample data and configurations
7. **Environment Notes**: Required test environment setup`,

  variables: [
    {
      name: 'code',
      description: 'The code/module to test integration for',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'Testing framework',
      required: true,
      type: 'string',
      defaultValue: 'jest',
      example: 'jest, vitest, supertest, pytest'
    },
    {
      name: 'integrationPoints',
      description: 'Specific integration points to test',
      required: false,
      type: 'string',
      example: 'database, external API, message queue'
    },
    {
      name: 'dependencies',
      description: 'External dependencies the code uses',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['test', 'integration-test', 'api-test', 'database-test'],
  isSystem: true
};

/**
 * E2E test generation
 */
export const generateTestsE2E: PromptTemplate = {
  id: 'generate-tests-e2e',
  name: 'Generate E2E Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate end-to-end tests for user workflows and scenarios',
  systemPrompt: `You are an expert at end-to-end testing. Generate tests that simulate real user interactions and workflows.

Focus on:
1. Critical user journeys
2. Page navigation and interactions
3. Form submissions and validation
4. Authentication flows
5. Error states and recovery
6. Performance and loading states
7. Accessibility checks
8. Cross-browser considerations

Write tests that verify the application works from the user's perspective.`,

  userPromptTemplate: `Generate E2E tests for this application component using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#userFlows}}
User flows to test: {{userFlows}}
{{/userFlows}}

{{#pageUrl}}
Page URL: {{pageUrl}}
{{/pageUrl}}

Please generate:
1. **E2E Test Suite**: Complete test scenarios
2. **User Journeys**: Tests for critical paths
3. **Page Object Model**: Reusable page objects (if applicable)
4. **Test Data**: Test accounts and data fixtures
5. **Assertions**: Visual and functional assertions
6. **Error Scenarios**: User-facing error handling
7. **Accessibility Tests**: Basic a11y checks
8. **CI/CD Notes**: How to run in CI pipeline`,

  variables: [
    {
      name: 'code',
      description: 'The component/page code to test',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'E2E testing framework',
      required: true,
      type: 'string',
      defaultValue: 'playwright',
      example: 'playwright, cypress, puppeteer'
    },
    {
      name: 'userFlows',
      description: 'User workflows to test',
      required: false,
      type: 'string',
      example: 'login, checkout, profile update'
    },
    {
      name: 'pageUrl',
      description: 'Base URL or route for the tests',
      required: false,
      type: 'string',
      example: '/dashboard, /checkout'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['test', 'e2e', 'playwright', 'cypress', 'user-journey'],
  isSystem: true
};

/**
 * React component test generation
 */
export const generateTestsReact: PromptTemplate = {
  id: 'generate-tests-react',
  name: 'Generate React Component Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate tests specifically for React components',
  systemPrompt: `You are an expert at testing React components. Generate comprehensive tests using React Testing Library best practices.

Follow these principles:
1. Test behavior, not implementation
2. Query elements the way users would (by role, text, label)
3. Avoid testing internal state directly
4. Test user interactions and their effects
5. Use proper async utilities (waitFor, findBy)
6. Mock context providers and external modules
7. Test accessibility where relevant

Write tests that give confidence the component works correctly for users.`,

  userPromptTemplate: `Generate tests for this React component using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#componentContext}}
Component context: {{componentContext}}
{{/componentContext}}

{{#propsToTest}}
Props to test: {{propsToTest}}
{{/propsToTest}}

Please generate:
1. **Component Tests**: Full test suite
2. **Rendering Tests**: Component renders correctly
3. **Interaction Tests**: User events and responses
4. **Props Tests**: Different prop combinations
5. **State Tests**: State changes from interactions
6. **Async Tests**: Loading states, data fetching
7. **Mock Setup**: Required mocks and providers
8. **Snapshot Tests**: If appropriate`,

  variables: [
    {
      name: 'code',
      description: 'The React component code',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'TypeScript or JavaScript',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'Testing framework combination',
      required: true,
      type: 'string',
      defaultValue: 'jest + @testing-library/react',
      example: 'jest + RTL, vitest + RTL'
    },
    {
      name: 'componentContext',
      description: 'Context about the component purpose',
      required: false,
      type: 'string'
    },
    {
      name: 'propsToTest',
      description: 'Specific props or prop combinations to test',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['test', 'react', 'component-test', 'rtl', 'frontend'],
  isSystem: true
};

/**
 * API endpoint test generation
 */
export const generateTestsAPI: PromptTemplate = {
  id: 'generate-tests-api',
  name: 'Generate API Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate tests for REST/GraphQL API endpoints',
  systemPrompt: `You are an expert at API testing. Generate comprehensive tests for API endpoints covering:

1. Request/response validation
2. Authentication and authorization
3. Input validation and sanitization
4. Error responses and status codes
5. Rate limiting and throttling
6. Content negotiation
7. Pagination and filtering
8. Performance benchmarks

Test both the happy path and edge cases for each endpoint.`,

  userPromptTemplate: `Generate API tests for this {{apiType}} endpoint using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#endpointSpec}}
Endpoint specification:
{{endpointSpec}}
{{/endpointSpec}}

{{#authMethod}}
Authentication method: {{authMethod}}
{{/authMethod}}

Please generate:
1. **API Test Suite**: Complete endpoint tests
2. **Request Tests**: Valid and invalid requests
3. **Response Tests**: Status codes, body structure
4. **Auth Tests**: Authentication/authorization
5. **Validation Tests**: Input validation
6. **Error Tests**: Error handling and messages
7. **Performance Tests**: Response time checks
8. **Test Fixtures**: Request/response samples`,

  variables: [
    {
      name: 'code',
      description: 'The API endpoint/handler code',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'API testing framework',
      required: true,
      type: 'string',
      defaultValue: 'supertest + jest',
      example: 'supertest, axios, requests'
    },
    {
      name: 'apiType',
      description: 'Type of API',
      required: false,
      type: 'string',
      defaultValue: 'REST',
      example: 'REST, GraphQL, gRPC'
    },
    {
      name: 'endpointSpec',
      description: 'OpenAPI/endpoint specification',
      required: false,
      type: 'string'
    },
    {
      name: 'authMethod',
      description: 'Authentication method used',
      required: false,
      type: 'string',
      example: 'JWT, OAuth, API Key'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 6144,
  temperature: 0.3,

  tags: ['test', 'api', 'rest', 'graphql', 'endpoint'],
  isSystem: true
};

/**
 * Edge case test generation
 */
export const generateTestsEdgeCases: PromptTemplate = {
  id: 'generate-tests-edge-cases',
  name: 'Generate Edge Case Tests',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Generate tests specifically for edge cases and boundary conditions',
  systemPrompt: `You are an expert at finding and testing edge cases. Your goal is to identify scenarios that might break the code.

Consider:
1. Boundary values (0, -1, MAX_INT, etc.)
2. Empty inputs (null, undefined, empty string, empty array)
3. Invalid types and malformed data
4. Concurrent access and race conditions
5. Large inputs and performance limits
6. Unicode and special characters
7. Time-based edge cases (midnight, DST, timezones)
8. Network failures and timeouts

Think adversarially - what inputs would cause unexpected behavior?`,

  userPromptTemplate: `Generate edge case tests for this {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#knownEdgeCases}}
Known edge cases to address: {{knownEdgeCases}}
{{/knownEdgeCases}}

Please generate:
1. **Edge Case Analysis**: Identify all potential edge cases
2. **Boundary Tests**: Minimum, maximum, and boundary values
3. **Null/Undefined Tests**: Handling of missing data
4. **Invalid Input Tests**: Malformed and unexpected inputs
5. **Concurrency Tests**: Race conditions (if applicable)
6. **Performance Edge Cases**: Large inputs, timeouts
7. **Priority Ranking**: Most critical edge cases to test`,

  variables: [
    {
      name: 'code',
      description: 'The code to test edge cases for',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'Testing framework',
      required: true,
      type: 'string',
      defaultValue: 'jest'
    },
    {
      name: 'knownEdgeCases',
      description: 'Known edge cases to include',
      required: false,
      type: 'string'
    }
  ],

  recommendedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4-turbo'
  ],

  maxTokens: 4096,
  temperature: 0.4,

  tags: ['test', 'edge-cases', 'boundary', 'robust'],
  isSystem: true
};

/**
 * Quick test generation
 */
export const generateTestsQuick: PromptTemplate = {
  id: 'generate-tests-quick',
  name: 'Quick Test Generation',
  category: PromptCategory.TEST,
  version: '1.0.0',
  description:
    'Fast generation of essential tests',
  systemPrompt: `Generate essential tests quickly. Focus on the most important test cases that provide the most value. Be concise but comprehensive.`,

  userPromptTemplate: `Generate essential tests for this {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

Generate:
1. Basic happy path test
2. One error case test
3. One edge case test`,

  variables: [
    {
      name: 'code',
      description: 'The code to test',
      required: true,
      type: 'code'
    },
    {
      name: 'language',
      description: 'Programming language',
      required: true,
      type: 'string',
      defaultValue: 'typescript'
    },
    {
      name: 'framework',
      description: 'Testing framework',
      required: true,
      type: 'string',
      defaultValue: 'jest'
    }
  ],

  recommendedModels: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3-haiku',
    'google/gemini-flash-1.5'
  ],

  maxTokens: 2048,
  temperature: 0.3,

  tags: ['test', 'quick', 'essential'],
  isSystem: true
};

/**
 * Export all test generation templates
 */
export const generateTestsTemplates: PromptTemplate[] = [
  generateTestsUnit,
  generateTestsIntegration,
  generateTestsE2E,
  generateTestsReact,
  generateTestsAPI,
  generateTestsEdgeCases,
  generateTestsQuick
];

export default generateTestsTemplates;
