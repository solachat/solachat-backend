import { Request, Response } from "express";
import SessionService from "../services/sessionService";

export class SessionController {
    static async saveSessionKey(req: Request, res: Response) {
        try {
            const { chatId, sessionKey } = req.body;
            if (!chatId || !sessionKey) {
                return res.status(400).json({ error: "chatId и sessionKey обязательны" });
            }

            const exists = await SessionService.hasSessionKey(chatId);
            if (!exists) {
                await SessionService.saveSessionKey(chatId, sessionKey);
                return res.status(200).json({ message: "Сессионный ключ сохранён" });
            }

            return res.status(200).json({ message: "Ключ уже существует, не перезаписываем." });
        } catch (error) {
            console.error("❌ Ошибка при сохранении ключа:", error);
            return res.status(500).json({ error: "Ошибка сервера" });
        }
    }

    static async getSessionKey(req: Request, res: Response) {
        try {
            const { chatId } = req.params;
            if (!chatId) {
                return res.status(400).json({ error: "chatId обязателен" });
            }

            const sessionKey = await SessionService.getSessionKey(Number(chatId));
            if (!sessionKey) {
                return res.status(404).json({ error: "Ключ не найден" });
            }

            return res.status(200).json({ sessionKey });
        } catch (error) {
            console.error("❌ Ошибка при получении ключа:", error);
            return res.status(500).json({ error: "Ошибка сервера" });
        }
    }

    static async deleteSessionKey(req: Request, res: Response) {
        try {
            const { chatId } = req.params;
            if (!chatId) {
                return res.status(400).json({ error: "chatId обязателен" });
            }

            await SessionService.deleteSessionKey(Number(chatId));
            return res.status(200).json({ message: "Сессионный ключ удалён" });
        } catch (error) {
            console.error("❌ Ошибка при удалении ключа:", error);
            return res.status(500).json({ error: "Ошибка сервера" });
        }
    }
}

export default SessionController;
