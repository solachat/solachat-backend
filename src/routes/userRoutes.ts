import { Router } from 'express';
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    phantomLogin,
    updateAvatar, getUserAvatars
} from '../controllers/userController';
import {authenticateToken} from "../middleware/authMiddleware";
import {upload} from "../config/uploadConfig";

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/phantom-login', phantomLogin);
router.get('/profile', getProfile);
router.put('/profile/:username', authenticateToken, updateProfile);
router.put('/avatar', authenticateToken, upload.single('avatar'), updateAvatar);
router.get('/:username/avatars', getUserAvatars);

export default router;
