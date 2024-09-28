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
    assignRoleController, updateChatSettingsController
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/authMiddleware';
import {upload} from "../config/uploadConfig";

const router = Router();

router.post('/private', authenticateToken, createPrivateChatController);
router.post('/group', authenticateToken, upload.single('avatar'), createGroupChatController);

router.post('/chats', authenticateToken, getChatsController);

router.post('/:chatId/add-users', authenticateToken, addUsersToChatController);

router.post('/:chatId/kick-user', authenticateToken, kickUserController);

router.post('/:chatId/assign-role', authenticateToken, assignRoleController);

router.put('/:chatId/settings', authenticateToken, upload.single('avatar'), updateChatSettingsController);

router.get('/:chatId', authenticateToken, getChatController);
router.get('/:chatId/messages', authenticateToken, getChatWithMessagesController);

router.delete('/:chatId', authenticateToken, deleteChatController);

export default router;
