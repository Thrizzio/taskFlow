import { PrismaClient } from '@prisma/client';

/**
 * Singleton instance of Prisma Client for PostgreSQL operations.
 *
 * Used for:
 * - PostgreSQL analytics/reporting models (User, Task, AnalyticsSession).
 * - Multi-step transactional persistence with ACID guarantees.
 * - Raw SQL fallback queries via prisma.$queryRaw.
 */
export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
