import { Router } from 'express';
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    updateUserStatusController,
    updateAvatar, getUserAvatars, searchUser, attachPublicKey, setupTotp, verifyTotp
} from '../controllers/userController';
import {authenticateToken} from "../middleware/authMiddleware";
import {upload} from "../config/uploadConfig";
import {getUserById} from "../services/userService";

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/update-status', updateUserStatusController);
router.post('/setup-totp', authenticateToken, setupTotp);
router.post('/verify-totp', authenticateToken, verifyTotp);

router.get('/profile', getProfile);
router.get('/:username/avatars', getUserAvatars);
router.get('/users/:userId', getUserById);
router.get('/search', searchUser);

router.put('/profile/:public_key', authenticateToken, updateProfile);
router.put('/avatar', authenticateToken, upload.single('avatar'), updateAvatar);
router.put('/attach-public-key', authenticateToken, attachPublicKey);

export default router;
