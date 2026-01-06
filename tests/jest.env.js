// Jest environment configuration
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = 'test-openrouter-key';
// DD_API_KEY should be set via environment variable - fallback to mock key for tests
process.env.DD_API_KEY = process.env.DD_API_KEY || 'test-datadog-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'; 