import { Router } from 'express';
import { getTasks, getTaskById, createTask, updateTask, deleteTask } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/:taskId', getTaskById);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);

export default router;
