import Message from '../models/Message';
import Chat from '../models/Chat';
import User from '../models/User';
import File from '../models/File';
import { encryptMessage } from "../encryption/messageEncryption";

export const createMessage = async (
    userId: number,
    chatId: number,
    content: string,
    fileId: number | null,
    user: User
) => {
    const encryptedContent = encryptMessage(content);

    console.time('DB Write: Message');
    const message = await Message.create({
        chatId,
        userId,
        content: JSON.stringify(encryptedContent),
        fileId: fileId || undefined,
        timestamp: new Date().toISOString(),
    });
    console.timeEnd('DB Write: Message');


    return message;
};


export const getMessages = async (chatId: number) => {
    return await Message.findAll({
        where: { chatId },
        include: [
            { model: User, attributes: ['id', 'username', 'avatar'] },
            { model: File, as: 'attachment', attributes: ['fileName', 'filePath', 'fileType'] },
        ],
        order: [['createdAt', 'ASC']]
    });
};

export const getMessageById = async (messageId: number) => {
    return await Message.findByPk(messageId);
};

export const updateMessageContent = async (messageId: number, updates: { content: string; isEdited: boolean }) => {
    await Message.update(updates, { where: { id: messageId } });
};
