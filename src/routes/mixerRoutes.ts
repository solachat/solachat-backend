import express from "express";
import { createDeposit, startMixing } from "../controllers/mixerController";

const router = express.Router();

// POST /mixer - Запуск миксера
router.post("/", startMixing);
router.post("/deposit", createDeposit);

export default router;
