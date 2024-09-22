import { Router } from 'express';
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    phantomLogin,
    updateUserStatusController,
    updateAvatar, getUserAvatars, searchUser
} from '../controllers/userController';
import {authenticateToken} from "../middleware/authMiddleware";
import {upload} from "../config/uploadConfig";
import {getUserById} from "../services/userService";

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/phantom-login', phantomLogin);
router.post('/update-status', updateUserStatusController);

router.get('/profile', getProfile);
router.get('/:username/avatars', getUserAvatars);
router.get('/users/:userId', getUserById);
router.get('/search', searchUser);

router.put('/profile/:username', authenticateToken, updateProfile);
router.put('/avatar', authenticateToken, upload.single('avatar'), updateAvatar);

export default router;
