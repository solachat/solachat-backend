import { Router } from 'express';
import {
    createPrivateChatController,
    createGroupChatController,
    getChatController,
    getChatsController
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/private', authenticateToken, createPrivateChatController);
router.post('/group', authenticateToken, createGroupChatController);
router.get('/:chatId', authenticateToken, getChatController);
router.get('/chats', authenticateToken, getChatsController);

export default router;
