import { Request, Response } from 'express';
import { createMessage, getMessages } from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import { decrypt } from "../utils/encryptionUtils";

export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;
    const file = req.file;

    try {
        const message = await createMessage(req.user!.id, Number(chatId), content, file);

        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                const decryptedMessageContent = decrypt(JSON.parse(message.content));
                client.send(JSON.stringify({
                    type: 'newMessage',
                    message: {
                        ...message.toJSON(),
                        content: decryptedMessageContent
                    }
                }));
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

        console.log("Encrypted messages from DB:", messages);

        const decryptedMessages = messages.map((message) => {
            const decryptedContent = decrypt(JSON.parse(message.content));
            console.log("Decrypted message content:", decryptedContent);
            return {
                ...message.toJSON(),
                content: decryptedContent
            };
        });

        res.status(200).json(decryptedMessages);
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ message: err.message });
    }
};
