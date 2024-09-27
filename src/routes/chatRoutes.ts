import { Router } from 'express';
import {
    createPrivateChatController,
    createGroupChatController,
    getChatController,
    getChatsController,
    getChatWithMessagesController,
    deleteChatController,
    addUsersToChatController,
    kickUserController,
    assignRoleController
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/private', authenticateToken, createPrivateChatController);
router.post('/group', authenticateToken, createGroupChatController);

router.get('/:chatId', authenticateToken, getChatController);
router.post('/chats', authenticateToken, getChatsController);
router.get('/:chatId/messages', authenticateToken, getChatWithMessagesController);

router.post('/:chatId/add-users', authenticateToken, addUsersToChatController);

router.post('/:chatId/kick-user', authenticateToken, kickUserController);

router.post('/:chatId/assign-role', authenticateToken, assignRoleController);

router.delete('/:chatId', authenticateToken, deleteChatController);

export default router;
