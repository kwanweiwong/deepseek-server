const express = require('express');
const ConversationController = require('../controllers/conversation');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, ConversationController.getAll);
router.post('/', authMiddleware, ConversationController.create);
router.get('/:id', authMiddleware, ConversationController.getById);
router.put('/:id', authMiddleware, ConversationController.update);
router.delete('/:id', authMiddleware, ConversationController.delete);

module.exports = router;
