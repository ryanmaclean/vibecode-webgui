/**
 * Seed legacy authentication demo accounts used by the Playwright smoke tests.
 *
 * Usage:
 *   npx tsx scripts/tests/seed-legacy-auth.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LEGACY_USERS = [
  { email: 'admin@vibecode.dev', name: 'Admin User', role: 'admin' },
  { email: 'lead@vibecode.dev', name: 'Lead User', role: 'admin' },
  { email: 'developer@vibecode.dev', name: 'Developer User', role: 'developer' },
  { email: 'frontend@vibecode.dev', name: 'Frontend User', role: 'user' },
  { email: 'backend@vibecode.dev', name: 'Backend User', role: 'user' },
  { email: 'fullstack@vibecode.dev', name: 'Fullstack User', role: 'user' },
  { email: 'designer@vibecode.dev', name: 'Designer User', role: 'user' },
  { email: 'tester@vibecode.dev', name: 'Tester User', role: 'user' },
  { email: 'devops@vibecode.dev', name: 'DevOps User', role: 'user' },
  { email: 'security@vibecode.dev', name: 'Security User', role: 'user' },
]

async function main() {
  console.log('🧪 Seeding legacy authentication users...')

  for (const user of LEGACY_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
    console.log(`  • ensured ${user.email} (${user.role})`)
  }

  console.log('✅ Legacy users ready')
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed legacy users:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
