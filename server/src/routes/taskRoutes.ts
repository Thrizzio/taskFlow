import { Router } from 'express';
import {
    getTasks,
    getTaskStats,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    uploadTaskAttachment,
    getTaskAttachments,
    downloadTaskAttachment,
    deleteTaskAttachment,
} from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import { validate, createTaskSchema } from '../middleware/validate';
import { handleUpload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.get('/stats', getTaskStats);
router.post('/', validate(createTaskSchema), createTask);
router.get('/:taskId', getTaskById);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

// Task file attachments
router.post('/:taskId/attachments', handleUpload('file'), uploadTaskAttachment);
router.get('/:taskId/attachments', getTaskAttachments);
router.get('/:taskId/attachments/:attachmentId/download', downloadTaskAttachment);
router.delete('/:taskId/attachments/:attachmentId', deleteTaskAttachment);

export default router;
