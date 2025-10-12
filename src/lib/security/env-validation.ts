/**
 * Environment Variable Validation
 * Ensures all required secrets are present and properly configured
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';
// Define required environment variables with validation rules
const envSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Database
  DATABASE_URL: z.string().url(),
  POSTGRES_PASSWORD: z.string().min(16, 'Database password must be at least 16 characters'),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // API Keys (if configured)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
  DATADOG_APP_KEY: z.string().optional(),

  // Security  
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine(val => val !== 'dev-secret-key', 'JWT_SECRET cannot be the default value'),

  // Optional Production Settings
  DD_API_KEY: z.string().optional(),
  DD_SERVICE: z.string().optional(),
  DD_ENV: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Validate environment variables on application startup
 * @throws {Error} if validation fails
 */
export function validateEnvironment(): ValidatedEnv {
  try {
    const env = envSchema.parse(process.env);
    logger.info('✅ Environment validation successful');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        logger.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment configuration. Check console for details.');
    }
    throw error;
  }
}

/**
 * Check for insecure default values in production
 */
export function checkInsecureDefaults(): string[] {
  const warnings: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    // Check for default secrets
    const insecureDefaults = {
      'JWT_SECRET': 'dev-secret-key',
      'NEXTAUTH_SECRET': 'dev-secret',
      'POSTGRES_PASSWORD': 'password',
      'POSTGRES_PASSWORD': 'postgres',
    };

    Object.entries(insecureDefaults).forEach(([key, defaultValue]) => {
      if (process.env[key] === defaultValue) {
        warnings.push(`${key} is set to an insecure default value`);
      }
    });

    // Check secret length
    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
      warnings.push('NEXTAUTH_SECRET should be at least 32 characters');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters');
    }

    // Check for HTTPS requirement
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('https://')) {
      warnings.push('NEXTAUTH_URL should use HTTPS in production');
    }
  }

  return warnings;
}

/**
 * Generate secure random secret (for development)
 */
export function generateSecureSecret(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let secret = '';
  const randomValues = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      secret += charset[randomValues[i] % charset.length];
    }
  } else {
    // Fallback for Node.js
    const crypto = require('crypto');
    secret = crypto.randomBytes(length).toString('base64').slice(0, length);
  }
  
  return secret;
}

/**
 * Validate environment on module load in non-test environments
 */
if (process.env.NODE_ENV !== 'test' && typeof window === 'undefined') {
  // Only validate on server-side, skip during build
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      validateEnvironment();
      const warnings = checkInsecureDefaults();
      if (warnings.length > 0) {
        logger.warn('⚠️  Security warnings:');
        warnings.forEach(warning => logger.warn(`  - ${warning}`));
      }
    } catch (error) {
      // Log error but don't crash during import
      logger.error('Environment validation error:', error);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
