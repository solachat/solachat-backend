import { Router } from 'express';
import { createSPLToken, getTokenBalance, sendToken } from '../controllers/tokenController';

const router = Router();

router.post('/token/create', createSPLToken);
router.get('/token/:walletAddress/:tokenMintAddress/balance', getTokenBalance);
router.post('/token/send', sendToken);

export default router;
