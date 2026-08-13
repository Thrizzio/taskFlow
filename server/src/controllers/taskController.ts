import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Task } from '../models/Task';

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tasks = await Task.find({ userId: req.user?.userId }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('getTasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, userId: req.user?.userId });
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
            title,
            description,
            priority,
            subject,
            userId: req.user?.userId
        });

        const savedTask = await task.save();
        res.status(201).json(savedTask);
    } catch (error) {
        console.error('createTask error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const updates = req.body;
        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, userId: req.user?.userId },
            { $set: updates },
            { new: true }
        );

        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
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
        res.status(204).send();
    } catch (error) {
        console.error('deleteTask error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
};
