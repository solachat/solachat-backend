import { Router } from 'express';
import {
    getTokenBalanceController,
    getTokenTransactionsController,
    sendTokenController
} from '../controllers/tokenController';

const router = Router();

router.post('/token/send', sendTokenController);
router.get('/:walletAddress/balance', getTokenBalanceController);
router.get('/transactions', getTokenTransactionsController);

export default router;
