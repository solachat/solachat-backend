import { Router } from 'express';
import {registerUser, loginUser, getProfile, updateProfile, phantomLogin} from '../controllers/userController';
import {authenticateToken} from "../middleware/authMiddleware";

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/phantom-login', phantomLogin);
router.get('/profile', getProfile);
router.put('/profile/:username', authenticateToken, updateProfile);

export default router;
