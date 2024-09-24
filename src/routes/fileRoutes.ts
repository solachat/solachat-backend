import express from 'express';
import { downloadFileController } from '../controllers/fileController';

const router = express.Router();

router.get('/:filename', downloadFileController);

export default router;
