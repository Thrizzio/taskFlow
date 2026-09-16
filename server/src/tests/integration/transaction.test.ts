import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory mock database state for testing transaction rollback
let mockUsersTable: Record<string, { id: string; name: string }> = {};
let mockTasksTable: Record<string, { id: string; title: string; userId: string }> = {};
let mockSessionsTable: Array<{ id: number; taskId: string; userId: string; duration: number }> = {};

// Mock Prisma client with real transaction simulation
vi.mock('../../db/prisma', () => ({
    prisma: {
        $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
            // Snapshot current state to simulate atomic rollback on transaction failure
            const userSnapshot = JSON.parse(JSON.stringify(mockUsersTable));
            const taskSnapshot = JSON.parse(JSON.stringify(mockTasksTable));
            const sessionSnapshot = JSON.parse(JSON.stringify(mockSessionsTable));

            const txMock = {
                user: {
                    upsert: vi.fn(async ({ where, update, create }: any) => {
                        const existing = mockUsersTable[where.id];
                        if (existing) {
                            mockUsersTable[where.id] = { ...existing, ...update };
                        } else {
                            mockUsersTable[where.id] = create;
                        }
                        return mockUsersTable[where.id];
                    }),
                },
                task: {
                    upsert: vi.fn(async ({ where, update, create }: any) => {
                        const existing = mockTasksTable[where.id];
                        if (existing) {
                            mockTasksTable[where.id] = { ...existing, ...update };
                        } else {
                            mockTasksTable[where.id] = create;
                        }
                        return mockTasksTable[where.id];
                    }),
                },
                analyticsSession: {
                    create: vi.fn(async ({ data }: any) => {
                        const record = { id: mockSessionsTable.length + 1, ...data };
                        mockSessionsTable.push(record);
                        return record;
                    }),
                },
            };

            try {
                const result = await callback(txMock);
                // On success, state changes are committed
                return result;
            } catch (error) {
                // ACID Atomicity: Roll back to previous snapshot on failure
                mockUsersTable = userSnapshot;
                mockTasksTable = taskSnapshot;
                mockSessionsTable = sessionSnapshot;
                throw error;
            }
        }),
        $queryRaw: vi.fn(async () => [
            { userName: 'Alice', taskTitle: 'Physics Study', totalSeconds: 3600 },
            { userName: 'Alice', taskTitle: 'Algorithms Review', totalSeconds: 1800 },
        ]),
    },
}));

import { persistAnalyticsSessionTx } from '../../controllers/sessionController';
import { getTimeSpentPerUserPerTaskPrisma } from '../../db/queries/analyticsQueries';

describe('Database Transactions & ORM Usage (Prisma + PostgreSQL)', () => {
    beforeEach(() => {
        mockUsersTable = {};
        mockTasksTable = {};
        mockSessionsTable = [];
    });

    describe('ACID Transaction: Multi-Step Analytics Persistence', () => {
        it('commits all operations atomically when all steps succeed', async () => {
            const result = await persistAnalyticsSessionTx({
                userId: 'user-100',
                userName: 'Alice Smith',
                taskId: 'task-200',
                taskTitle: 'Database Optimization',
                duration: 1500,
                startedAt: new Date(),
                endedAt: new Date(),
            });

            expect(result).toHaveProperty('id');
            expect(result.duration).toBe(1500);

            // Verify all 3 tables were updated
            expect(mockUsersTable['user-100']).toEqual({ id: 'user-100', name: 'Alice Smith' });
            expect(mockTasksTable['task-200']).toEqual({
                id: 'task-200',
                title: 'Database Optimization',
                userId: 'user-100',
            });
            expect(mockSessionsTable).toHaveLength(1);
            expect(mockSessionsTable[0].duration).toBe(1500);
        });

        it('demonstrates rollback behavior: rolls back earlier writes if a subsequent step fails', async () => {
            // Attempt a transaction where step 3 (session insertion) fails
            await expect(
                persistAnalyticsSessionTx({
                    userId: 'user-reverted',
                    userName: 'Reverted User',
                    taskId: 'task-reverted',
                    taskTitle: 'Reverted Task',
                    duration: 900,
                    startedAt: new Date(),
                    endedAt: new Date(),
                    simulateFailureInStep: 3, // Injected failure at step 3
                })
            ).rejects.toThrow('Simulated transaction failure at step 3');

            // Verify Atomicity: earlier writes to user and task are NOT persisted
            expect(mockUsersTable['user-reverted']).toBeUndefined();
            expect(mockTasksTable['task-reverted']).toBeUndefined();
            expect(mockSessionsTable).toHaveLength(0);
        });

        it('rolls back step 1 if step 2 fails', async () => {
            await expect(
                persistAnalyticsSessionTx({
                    userId: 'user-fail-step2',
                    userName: 'Fail Step 2',
                    taskId: 'task-fail-step2',
                    taskTitle: 'Fail Task',
                    duration: 600,
                    startedAt: new Date(),
                    endedAt: new Date(),
                    simulateFailureInStep: 2,
                })
            ).rejects.toThrow('Simulated transaction failure at step 2');

            expect(mockUsersTable['user-fail-step2']).toBeUndefined();
            expect(mockTasksTable['task-fail-step2']).toBeUndefined();
        });
    });

    describe('ORM Query (Prisma Client)', () => {
        it('executes analytics query with preserved grouping, filtering, and ordering semantics', async () => {
            const rows = await getTimeSpentPerUserPerTaskPrisma('user-100');

            expect(Array.isArray(rows)).toBe(true);
            expect(rows).toHaveLength(2);
            expect(rows[0]).toHaveProperty('userName', 'Alice');
            expect(rows[0]).toHaveProperty('taskTitle', 'Physics Study');
            expect(rows[0]).toHaveProperty('totalSeconds', 3600);
            expect(rows[1].totalSeconds).toBeLessThan(rows[0].totalSeconds); // Descending order
        });
    });
});
