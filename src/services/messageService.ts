import Message from '../models/Message';
import Chat from '../models/Chat';
import User from '../models/User';
import File from '../models/File';
import { encryptMessage } from "../encryption/messageEncryption";

export const createMessage = async (
    userId: number,
    chatId: number,
    content: string,
    protocol: string,
    host: string,
    fileId?: number | null
) => {
    const chat = await Chat.findByPk(chatId);
    const user = await User.findByPk(userId);

    if (!chat) {
        throw new Error('Chat not found');
    }

    if (!user) {
        throw new Error('User not found');
    }

    // Шифруем сообщение
    const encryptedContent = encryptMessage(content);

    // Сохраняем сообщение
    const message = await Message.create({
        chatId,
        userId,
        content: JSON.stringify(encryptedContent),
        fileId: fileId || undefined,
        timestamp: new Date().toISOString(),
    });

    return message;
};


export const getMessages = async (chatId: number) => {
    const messages = await Message.findAll({
        where: { chatId },
        include: [
            {
                model: User,
                attributes: ['id', 'username', 'avatar'],
            },
            {
                model: File,
                as: 'attachment',
                attributes: ['fileName', 'filePath', 'fileType'],
            }
        ],
        order: [['createdAt', 'ASC']]
    });

    return messages;
};

export const getMessageById = async (messageId: number) => {
    try {
        const message = await Message.findByPk(messageId);
        return message;
    } catch (error) {
        console.error('Error fetching message by ID:', error);
        throw new Error('Failed to fetch message');
    }
};

export const updateMessageContent = async (messageId: number, updates: { content: string; isEdited: boolean }) => {
    try {
        await Message.update(updates, { where: { id: messageId } });
    } catch (error) {
        console.error('Error updating message:', error);
        throw new Error('Failed to update message');
    }
};


