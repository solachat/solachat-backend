import { Router } from 'express';
import { getBalance } from '../controllers/walletController';

const router = Router();

router.get('/wallet/:address/balance', getBalance);

export default router;
