import { Request, Response } from "express";
import { mixCrypto } from "../services/transactionService";
import { generateDepositAddress } from "../services/depositService";

export const createDeposit = async (req: Request, res: Response) => {
    try {
        const { currency } = req.body;

        if (!currency) {
            return res.status(400).json({ error: "⚠️ Укажите валюту!" });
        }

        const depositAddress = await generateDepositAddress();

        res.json({
            message: "✅ Адрес для депозита создан",
            currency,
            depositAddress,
        });
    } catch (error) {
        console.error("❌ Ошибка создания депозита:", error);
        res.status(500).json({ error: "❌ Ошибка сервера" });
    }
};

const startMixing = async (req: Request, res: Response) => {
    try {
        const { address, amount, currency } = req.body;

        if (!address || !amount || !currency) {
            return res.status(400).json({ error: "⚠️ Все поля обязательны!" });
        }

        console.log(`🔄 Запуск миксера для ${currency}: ${amount} → ${address}`);

        // Запускаем процесс микширования
        const mixId = await mixCrypto(address, amount, currency);

        res.json({
            message: "✅ Миксинг запущен!",
            mixId,
            status: "pending",
        });
    } catch (error) {
        console.error("❌ Ошибка миксинга:", error);
        res.status(500).json({ error: "❌ Ошибка миксинга" });
    }
};

export { startMixing };
