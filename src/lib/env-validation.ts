/**
 * Environment Variable Validation Utility
 * Validates required environment variables and provides helpful error messages
 */

import { logger } from './logger';

export interface EnvironmentVariable {
  name: string;
  required: boolean;
  description: string;
  example?: string;
  validation?: (value: string) => boolean;
  errorMessage?: string;
}

export const ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  // Core Application
  {
    name: 'NEXTAUTH_URL',
    required: true,
    description: 'Base URL for NextAuth.js authentication',
    example: 'http://localhost:3000',
    validation: (value) => value.startsWith('http'),
    errorMessage: 'Must be a valid HTTP/HTTPS URL'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'Secret key for NextAuth.js (minimum 32 characters)',
    example: 'your-nextauth-secret-here-min-32-chars',
    validation: (value) => value.length >= 32,
    errorMessage: 'Must be at least 32 characters long for security'
  },

  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection string',
    example: 'postgresql://username:password@localhost:5432/vibecode',
    validation: (value) => value.startsWith('postgresql://'),
    errorMessage: 'Must be a valid PostgreSQL connection string'
  },
  {
    name: 'MONGODB_URL',
    required: false,
    description: 'MongoDB connection string for chat features',
    example: 'mongodb://localhost:27017/vibecode_chat'
  },

  // Cache
  {
    name: 'VALKEY_URL',
    required: true,
    description: 'Valkey/Redis cache connection string',
    example: 'redis://localhost:6379',
    validation: (value) => value.startsWith('redis://'),
    errorMessage: 'Must be a valid Redis connection string'
  },
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Legacy Redis URL (deprecated - use VALKEY_URL)',
    example: 'redis://localhost:6379'
  },

  // AI Services
  {
    name: 'OPENROUTER_API_KEY',
    required: true,
    description: 'OpenRouter API key for AI model access',
    example: 'sk-or-v1-...',
    validation: (value) => value.startsWith('sk-or-') || value.length > 20,
    errorMessage: 'Must be a valid OpenRouter API key'
  },

  // Monitoring
  {
    name: 'DD_API_KEY',
    required: true,
    description: 'Datadog API key for monitoring',
    example: 'your-datadog-api-key-here',
    validation: (value) => value.length >= 32,
    errorMessage: 'Must be a valid Datadog API key (32+ characters)'
  },
  {
    name: 'DD_APP_KEY',
    required: false,
    description: 'Datadog application key (optional)',
    example: 'your-datadog-app-key-here'
  },

  // Development Tools
  {
    name: 'CODE_SERVER_BASE_URL',
    required: false,
    description: 'Code server URL for workspace integration',
    example: 'http://localhost:8080'
  },
  {
    name: 'WORKSPACE_BASE_PATH',
    required: false,
    description: 'Base path for workspace files',
    example: '/workspace'
  },

  // Security
  {
    name: 'JWT_SECRET',
    required: false,
    description: 'JWT secret for API authentication',
    validation: (value) => value.length >= 32,
    errorMessage: 'Must be at least 32 characters long'
  }
];

export interface ValidationResult {
  isValid: boolean;
  missingRequired: string[];
  invalidValues: Array<{ name: string; error: string }>;
  warnings: string[];
  suggestions: string[];
}

export function validateEnvironmentVariables(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    missingRequired: [],
    invalidValues: [],
    warnings: [],
    suggestions: []
  };

  for (const envVar of ENVIRONMENT_VARIABLES) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      result.missingRequired.push(envVar.name);
      result.isValid = false;
    } else if (value && envVar.validation && !envVar.validation(value)) {
      result.invalidValues.push({
        name: envVar.name,
        error: envVar.errorMessage || 'Invalid value format'
      });
      result.isValid = false;
    }

    // Add specific warnings and suggestions
    if (envVar.name === 'REDIS_URL' && value && !process.env.VALKEY_URL) {
      result.warnings.push('REDIS_URL is deprecated. Please use VALKEY_URL instead.');
    }

    if (envVar.name === 'DD_API_KEY' && (!value || value === 'dummy-key-for-local-dev')) {
      result.suggestions.push('Consider setting up real Datadog monitoring keys for better observability.');
    }

    if (envVar.name === 'OPENAI_API_KEY' && !value && !process.env.OPENROUTER_API_KEY) {
      result.suggestions.push('Add OPENAI_API_KEY or OPENROUTER_API_KEY for AI functionality.');
    }
  }

  // Check for AI project generation dependencies
  if (process.env.AI_PROJECT_GENERATION_ENABLED === 'true') {
    const aiRequiredVars = ['OPENROUTER_API_KEY', 'CODE_SERVER_BASE_URL'];
    const missingAiVars = aiRequiredVars.filter(varName => !process.env[varName]);
    
    if (missingAiVars.length > 0) {
      result.warnings.push(`AI project generation is enabled but missing: ${missingAiVars.join(', ')}`);
    }
  }

  return result;
}

export function logValidationResults(result: ValidationResult, exitOnError: boolean = false): void {
  if (result.isValid) {
    logger.info('✅ Environment validation passed');
    return;
  }

  logger.error('❌ Environment validation failed');

  if (result.missingRequired.length > 0) {
    logger.error('Missing required environment variables:', {
      variables: result.missingRequired,
      suggestions: result.missingRequired.map(name => {
        const envVar = ENVIRONMENT_VARIABLES.find(v => v.name === name);
        return `${name}: ${envVar?.description || 'No description'} (example: ${envVar?.example || 'N/A'})`;
      })
    });
  }

  if (result.invalidValues.length > 0) {
    logger.error('Invalid environment variable values:', { invalidValues: result.invalidValues });
  }

  if (result.warnings.length > 0) {
    logger.warn('Environment warnings:', { warnings: result.warnings });
  }

  if (result.suggestions.length > 0) {
    logger.info('Environment suggestions:', { suggestions: result.suggestions });
  }

  logger.info('📖 See documentation: docs/wiki-archive/ENV_VARIABLES.md');
  logger.info('📋 Copy .env.local.example to .env.local and update values');

  if (exitOnError) {
    process.exit(1);
  }
}

/**
 * Quick validation function for startup scripts
 */
export function validateRequiredEnvVars(exitOnError: boolean = true): boolean {
  const result = validateEnvironmentVariables();
  
  if (!result.isValid) {
    logValidationResults(result, exitOnError);
  }
  
  return result.isValid;
}

/**
 * Get environment variable with fallback and validation
 */
export function getEnvVar(
  name: string,
  defaultValue?: string,
  required: boolean = false
): string | undefined {
  const value = process.env[name] || defaultValue;
  
  if (required && !value) {
    const envVar = ENVIRONMENT_VARIABLES.find(v => v.name === name);
    const description = envVar?.description || 'No description available';
    throw new Error(`Missing required environment variable: ${name} - ${description}`);
  }
  
  return value;
}

/**
 * Validate database connections
 */
export async function validateDatabaseConnections(): Promise<{ postgres: boolean; mongodb: boolean; redis: boolean }> {
  const results = {
    postgres: false,
    mongodb: false,
    redis: false
  };

  // Test PostgreSQL connection
  if (process.env.DATABASE_URL) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$connect();
      await prisma.$disconnect();
      results.postgres = true;
      logger.info('✅ PostgreSQL connection validated');
    } catch (error) {
      logger.error('❌ PostgreSQL connection failed:', error);
    }
  }

  // Test MongoDB connection
  if (process.env.MONGODB_URL) {
    try {
      const { connectToMongoDB } = await import('./mongodb');
      const connection = await connectToMongoDB();
      results.mongodb = true;
      logger.info('✅ MongoDB connection validated');
    } catch (error) {
      logger.error('❌ MongoDB connection failed:', error);
    }
  }

  // Test Redis/Valkey connection
  const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl);
      await redis.ping();
      await redis.disconnect();
      results.redis = true;
      logger.info('✅ Redis/Valkey connection validated');
    } catch (error) {
      logger.error('❌ Redis/Valkey connection failed:', error);
    }
  }

  return results;
}

export default {
  validateEnvironmentVariables,
  validateRequiredEnvVars,
  validateDatabaseConnections,
  logValidationResults,
  getEnvVar,
  ENVIRONMENT_VARIABLES
};