import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Task } from '../models/Task';
import { sanitizeString } from '../utils/sanitize';
import { isSafeFilePath } from '../middleware/upload';
import config from '../utils/config';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../socket';

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tasks = await Task.find({ userId: req.user?.userId }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('getTasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

/**
 * MongoDB Aggregation Pipeline
 * Computes multi-dimensional task metrics scoped strictly to the authenticated user.
 * Stages:
 *   1. $match: isolates tenant documents using indexed userId
 *   2. $facet: parallel execution of:
 *      - byStatus: grouped counts sorted descending
 *      - byPriority: grouped counts sorted by priority
 *      - overview: projects attachment sizes, groups sums with conditional expressions ($cond),
 *                  and computes rounded completion rate via arithmetic operators ($round, $multiply, $divide)
 */
export const getTaskStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Use valid ObjectId or string match depending on ID format
        let matchUserId: any = req.user.userId;
        if (mongoose.Types.ObjectId.isValid(req.user.userId)) {
            matchUserId = new mongoose.Types.ObjectId(req.user.userId);
        }

        const result = await Task.aggregate([
            // Stage 1: Match tasks belonging exclusively to authenticated user
            { $match: { userId: matchUserId } },
            // Stage 2: Faceted parallel multi-stage sub-pipelines
            {
                $facet: {
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } }
                    ],
                    byPriority: [
                        {
                            $group: {
                                _id: '$priority',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    overview: [
                        {
                            $project: {
                                status: 1,
                                attachmentCount: { $size: { $ifNull: ['$attachments', []] } },
                                attachmentBytes: { $sum: '$attachments.size' }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalTasks: { $sum: 1 },
                                completedTasks: {
                                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                                },
                                pendingTasks: {
                                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                                },
                                totalAttachments: { $sum: '$attachmentCount' },
                                totalAttachmentBytes: { $sum: '$attachmentBytes' }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                totalTasks: 1,
                                completedTasks: 1,
                                pendingTasks: 1,
                                totalAttachments: 1,
                                totalAttachmentBytes: 1,
                                completionRate: {
                                    $cond: [
                                        { $gt: ['$totalTasks', 0] },
                                        {
                                            $round: [
                                                { $multiply: [{ $divide: ['$completedTasks', '$totalTasks'] }, 100] },
                                                1
                                            ]
                                        },
                                        0
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const facetResult = result[0] || {};
        const overview = facetResult.overview && facetResult.overview[0] ? facetResult.overview[0] : {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            totalAttachments: 0,
            totalAttachmentBytes: 0,
            completionRate: 0
        };

        res.json({
            overview,
            byStatus: facetResult.byStatus || [],
            byPriority: facetResult.byPriority || []
        });
    } catch (error) {
        console.error('getTaskStats aggregation error:', error);
        res.status(500).json({ error: 'Failed to compute task statistics' });
    }
};

/**
 * MongoDB Relationship Handling:
 * Demonstrates the architectural difference between:
 * - Embedded Subdocuments: task.attachments are stored inline inside the task document,
 *   retrieved with zero additional queries or joins.
 * - Referenced Entities: task.userId references the User collection. When requested
 *   via query param (?populate=user), Mongoose populates the referenced User document
 *   selecting safe public fields ('name email role').
 */
export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let taskQuery = Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });

        if (req.query.populate === 'user') {
            taskQuery = taskQuery.populate('userId', 'name email role') as any;
        }

        const task = await taskQuery;
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json(task);
    } catch (error) {
        console.error('getTaskById error:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
};

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { title, description, priority, subject } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Title is required' });
            return;
        }

        const task = new Task({
            title: sanitizeString(title),
            description: description ? sanitizeString(description) : '',
            priority: priority || 'medium',
            subject: subject ? sanitizeString(subject) : 'general',
            userId: req.user?.userId
        });

        const savedTask = await task.save();
        if (req.user?.userId) {
            emitTaskCreated(req.user.userId, savedTask);
        }
        res.status(201).json(savedTask);
    } catch (error) {
        console.error('createTask error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Whitelist allowed fields to prevent MongoDB operator injection
        const allowedUpdates: Record<string, any> = {};
        const { title, description, status, priority, subject } = req.body;

        if (typeof title === 'string') allowedUpdates.title = sanitizeString(title);
        if (typeof description === 'string') allowedUpdates.description = sanitizeString(description);
        if (typeof status === 'string' && ['pending', 'completed'].includes(status)) allowedUpdates.status = status;
        if (typeof priority === 'string' && ['low', 'medium', 'high'].includes(priority)) allowedUpdates.priority = priority;
        if (typeof subject === 'string') allowedUpdates.subject = sanitizeString(subject);

        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, userId: req.user?.userId },
            { $set: allowedUpdates },
            { new: true }
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (req.user?.userId) {
            emitTaskUpdated(req.user.userId, task);
        }
        res.json(task);
    } catch (error) {
        console.error('updateTask error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const deleted = await Task.findOneAndDelete({ _id: req.params.taskId, userId: req.user?.userId });
        if (!deleted) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (req.user?.userId) {
            emitTaskDeleted(req.user.userId, String(req.params.taskId));
        }
        res.status(204).send();
    } catch (error) {
        console.error('deleteTask error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
};

export const uploadTaskAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const attachment = {
            id: crypto.randomUUID(),
            originalName: sanitizeString(req.file.originalname),
            filename: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date(),
        };

        (task as any).attachments = (task as any).attachments || [];
        (task as any).attachments.push(attachment);
        await task.save();

        if (req.user?.userId) {
            emitTaskUpdated(req.user.userId, task);
        }

        res.status(201).json(attachment);
    } catch (error) {
        console.error('uploadTaskAttachment error:', error);
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
};

export const getTaskAttachments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.status(200).json((task as any).attachments || []);
    } catch (error) {
        console.error('getTaskAttachments error:', error);
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
};

export const downloadTaskAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const attachments = (task as any).attachments || [];
        const attachment = attachments.find((a: any) => a.id === req.params.attachmentId);
        if (!attachment) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        const filePath = path.join(config.UPLOAD_DIR, attachment.filename);

        // Enforce strict path traversal prevention
        if (!isSafeFilePath(config.UPLOAD_DIR, filePath)) {
            res.status(400).json({ error: 'Invalid file path traversal detected' });
            return;
        }

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found on storage' });
            return;
        }

        res.download(filePath, attachment.originalName);
    } catch (error) {
        console.error('downloadTaskAttachment error:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
};

export const deleteTaskAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const attachments = (task as any).attachments || [];
        const attachmentIndex = attachments.findIndex((a: any) => a.id === req.params.attachmentId);
        if (attachmentIndex === -1) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        const [removed] = attachments.splice(attachmentIndex, 1);
        const filePath = path.join(config.UPLOAD_DIR, removed.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await task.save();
        if (req.user?.userId) {
            emitTaskUpdated(req.user.userId, task);
        }
        res.status(200).json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        console.error('deleteTaskAttachment error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
};
