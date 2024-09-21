import { Request, Response } from 'express';
import { createMessage, getMessages } from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';

export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const file = req.file;

    try {
        const message = await createMessage(req.user!.id, Number(chatId), content, file);

        // Отправляем сообщение через WebSocket всем подключенным клиентам
        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({ type: 'newMessage', message }));
            }
        });

        res.status(201).json(message);
    } catch (error) {
        const err = error as Error;
        console.error('Error creating message:', err.message);
        res.status(500).json({ message: err.message });
    }
};

export const getMessagesController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    try {
        const messages = await getMessages(Number(chatId));
        res.status(200).json(messages);
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ message: err.message });
    }
};
