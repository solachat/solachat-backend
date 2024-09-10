import { Router } from 'express';
import { getTokenBalanceController, sendTokenController } from '../controllers/tokenController';

const router = Router();

router.get('/token/:walletAddress/:tokenMintAddress/balance', getTokenBalanceController);
router.post('/token/send', sendTokenController);

export default router;
