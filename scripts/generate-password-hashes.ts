#!/usr/bin/env tsx
/**
 * Generate password hashes for AUTH_TEST_USERS environment variable
 *
 * Usage:
 *   npx tsx scripts/generate-password-hashes.ts
 *
 * This script generates secure password hashes for test user accounts
 * to be used in development environments. The output can be copied
 * to your .env.local file as the AUTH_TEST_USERS variable.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}.${derivedKey.toString('hex')}`;
}

interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
}

const testUsers: TestUser[] = [
  { id: 'test-admin', email: 'admin@example.test', password: 'admin-dev-only', name: 'Admin User', role: 'admin' },
  { id: 'test-developer', email: 'developer@example.test', password: 'dev-dev-only', name: 'Developer User', role: 'developer' },
  { id: 'test-lead', email: 'lead@example.test', password: 'lead-dev-only', name: 'Lead User', role: 'lead' },
];

async function generateHashes() {
  console.log('🔐 Generating secure password hashes for test users...\n');

  const usersWithHashes = await Promise.all(
    testUsers.map(async (user) => {
      const passwordHash = await hashPassword(user.password);
      return {
        id: user.id,
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
      };
    })
  );

  console.log('✅ Generated hashes for', usersWithHashes.length, 'test users\n');
  console.log('📋 Copy this to your .env.local file:\n');
  console.log('AUTH_TEST_USERS=\'' + JSON.stringify(usersWithHashes, null, 2) + '\'');
  console.log('\n');
  console.log('📝 Test Credentials (for reference only - DO NOT commit):');
  testUsers.forEach(user => {
    console.log(`   ${user.email} → ${user.password}`);
  });
  console.log('\n⚠️  IMPORTANT: These are development-only credentials.');
  console.log('   Never use these passwords in production!\n');
}

generateHashes().catch(console.error);
