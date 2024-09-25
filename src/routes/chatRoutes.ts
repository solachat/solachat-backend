import { Router } from 'express';
import {
    createPrivateChatController,
    createGroupChatController,
    getChatController,
    getChatsController, getChatWithMessagesController, deleteChatController
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/private', authenticateToken, createPrivateChatController);
router.post('/group', authenticateToken, createGroupChatController);
router.get('/:chatId', authenticateToken, getChatController);
router.post('/chats', authenticateToken, getChatsController);
router.get('/:chatId/messages', authenticateToken, getChatWithMessagesController);
router.delete('/:chatId', authenticateToken, deleteChatController);

export default router;
