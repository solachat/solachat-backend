import express from "express";
import SessionController from "../controllers/SessionController";

const router = express.Router();

router.post("/session", SessionController.saveSessionKey); // Сохранение ключа
router.get("/session/:chatId", SessionController.getSessionKey); // Получение ключа
router.delete("/session/:chatId", SessionController.deleteSessionKey); // Удаление ключа

export default router;
