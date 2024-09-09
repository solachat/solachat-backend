import { Router } from 'express';
import { createWallet, getBalance } from '../controllers/walletController';

const router = Router();

router.post('/wallet/create', createWallet);
router.get('/wallet/:address/balance', getBalance);

export default router;
