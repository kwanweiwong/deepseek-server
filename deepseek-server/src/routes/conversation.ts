import express, { Router } from 'express';
import ConversationController from '../controllers/conversation';
import authMiddleware from '../middleware/auth';

const router: Router = express.Router();

router.get('/', authMiddleware, ConversationController.getAll);
router.post('/', authMiddleware, ConversationController.create);
router.get('/:id', authMiddleware, ConversationController.getById);
router.put('/:id', authMiddleware, ConversationController.update);
router.delete('/:id', authMiddleware, ConversationController.delete);

export default router;
