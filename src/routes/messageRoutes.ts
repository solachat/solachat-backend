import { Router } from 'express';
import {sendMessageController, getMessagesController, editMessageController} from '../controllers/messageController';
import { authenticateToken } from '../middleware/authMiddleware';
import { upload } from '../config/uploadConfig';
import {uploadFileController} from "../controllers/fileController";

const router = Router();

router.post('/:chatId/upload', authenticateToken, upload.single('file'), uploadFileController);
router.post('/:chatId', authenticateToken, sendMessageController);
router.get('/:chatId', authenticateToken, getMessagesController);
router.put('/:messageId', authenticateToken, editMessageController);

export default router;
