// Prisma 7.x configuration
// `defineConfig` moved: it's exported from `@prisma/config` (re-exported at
// `prisma/config`), not from `@prisma/client`.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
