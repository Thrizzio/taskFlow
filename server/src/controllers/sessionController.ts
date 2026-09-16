import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FocusSession } from '../models/FocusSession';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { prisma } from '../db/prisma';

export interface AnalyticsTransactionParams {
    userId: string;
    userName: string;
    taskId: string;
    taskTitle: string;
    duration: number;
    startedAt: string | Date;
    endedAt: string | Date;
    simulateFailureInStep?: number;
}

/**
 * Executes a PostgreSQL database transaction across users, tasks, and analytics_sessions.
 * Demonstrates ACID transaction semantics: if inserting the analytics session fails,
 * all preceding writes in the transaction are rolled back cleanly.
 *
 * Architecture Boundary Note:
 * MongoDB and PostgreSQL are separate database systems. A local database transaction
 * cannot atomically span across both heterogeneous engines without distributed 2PC.
 * Thus, the transaction boundary is explicitly encapsulated within the PostgreSQL analytics store.
 */
export async function persistAnalyticsSessionTx(params: AnalyticsTransactionParams) {
    return await prisma.$transaction(async (tx) => {
        // Step 1: Upsert User record
        await tx.user.upsert({
            where: { id: params.userId },
            update: { name: params.userName },
            create: { id: params.userId, name: params.userName },
        });

        if (params.simulateFailureInStep === 2) {
            throw new Error('Simulated transaction failure at step 2');
        }

        // Step 2: Upsert Task record
        await tx.task.upsert({
            where: { id: params.taskId },
            update: { title: params.taskTitle },
            create: {
                id: params.taskId,
                title: params.taskTitle,
                userId: params.userId,
            },
        });

        if (params.simulateFailureInStep === 3) {
            throw new Error('Simulated transaction failure at step 3');
        }

        // Step 3: Insert Analytics Session record
        const session = await tx.analyticsSession.create({
            data: {
                taskId: params.taskId,
                userId: params.userId,
                duration: params.duration,
                startedAt: new Date(params.startedAt),
                endedAt: new Date(params.endedAt),
            },
        });

        return session;
    });
}

export const createFocusSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { taskId, duration, startedAt, endedAt } = req.body;
        const userId = req.user?.userId;

        if (!taskId || duration === undefined || !startedAt || !endedAt) {
            res.status(400).json({ error: 'Missing required session parameters' });
            return;
        }

        // Save operational MongoDB record
        const session = new FocusSession({
            taskId,
            userId,
            duration,
            startedAt,
            endedAt,
            status: 'completed'
        });

        await session.save();

        // Look up task and user for analytics sync
        const task = await Task.findById(taskId);
        const user = await User.findById(userId);

        if (task && user) {
            try {
                // Execute multi-step persistence inside atomic Prisma transaction
                await persistAnalyticsSessionTx({
                    userId: user._id.toString(),
                    userName: user.name,
                    taskId: task._id.toString(),
                    taskTitle: task.title,
                    duration,
                    startedAt,
                    endedAt,
                });
            } catch (txErr) {
                console.error('PostgreSQL analytics transaction rolled back:', txErr);
                // Operational session in Mongo succeeded; report analytics sync warning
            }
        }

        res.status(201).json(session);
    } catch (error) {
        console.error('createFocusSession error:', error);
        res.status(500).json({ error: 'Failed to create focus session' });
    }
};