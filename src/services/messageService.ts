import Message from '../models/Message';
import Chat from '../models/Chat';
import User from '../models/User';
import File from '../models/File';
import { encrypt } from "../utils/encryptionUtils";

export const createMessage = async (userId: number, chatId: number, content: string, file?: Express.Multer.File) => {
    const chat = await Chat.findByPk(chatId);
    const user = await User.findByPk(userId);

    if (!chat || !user) throw new Error('Chat or user not found');

    let filePath = '';
    if (file) {
        const uploadedFile = await File.create({
            filename: file.filename,
            fileType: file.mimetype,
            filePath: file.path,
            userId,
            chatId
        });
        filePath = uploadedFile.filePath;
    }

    const encryptedContent = encrypt(content);

    const message = await Message.create({
        chatId,
        userId,
        content: JSON.stringify(encryptedContent),
        filePath,
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
            }
        ],
        order: [['createdAt', 'ASC']]
    });

    return messages;
};
