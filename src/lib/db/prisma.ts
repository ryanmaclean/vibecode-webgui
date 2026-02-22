/**
 * Re-export of Prisma client for database operations
 * This file provides a consistent import path for Prisma from the db directory
 */

export { prisma, prisma as default } from '@/lib/prisma';
export type { PrismaClient } from '@prisma/client';
