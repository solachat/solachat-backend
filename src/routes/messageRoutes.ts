import { Router } from 'express';
import { sendMessageController, getMessagesController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/authMiddleware';
import { upload } from '../config/uploadConfig';

const router = Router();

router.post('/:chatId', authenticateToken, sendMessageController);
router.get('/:chatId', authenticateToken, getMessagesController);
router.post('/:chatId/upload', authenticateToken, upload.single('file'), sendMessageController);

export default router;
