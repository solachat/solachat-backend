import { Request, Response } from "express";
import { createPrivateChatController } from "../controllers/chatController";

export const callCreatePrivateChatController = async (user1Id: number, user2Id: number) => {
    return new Promise((resolve, reject) => {
        const req = { body: { user1Id, user2Id } } as Request;
        const res = {
            status: (statusCode: number) => ({
                json: (data: any) => {
                    if (statusCode >= 200 && statusCode < 300) {
                        resolve(data); // Успешный ответ → возвращаем данные
                    } else {
                        reject(new Error(`Ошибка ${statusCode}: ${JSON.stringify(data)}`));
                    }
                }
            })
        } as Response;

        createPrivateChatController(req, res).catch(reject);
    });
};
