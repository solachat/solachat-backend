import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';

export const createPrivateChat = async (user1Id: number, user2Id: number) => {
    const chat = await Chat.create({ isGroup: false });
    const user1 = await User.findByPk(user1Id);
    const user2 = await User.findByPk(user2Id);

    if (user1 && user2) {
        await chat.addUsers([user1, user2]);
    }

    return chat;
};

export const createGroupChat = async (userIds: number[], chatName: string) => {
    const chat = await Chat.create({ name: chatName, isGroup: true });
    const users = await User.findAll({ where: { id: userIds } });

    if (users.length > 0) {
        await chat.addUsers(users);
    }

    return chat;
};

export const getChatById = async (chatId: number) => {
    const chat = await Chat.findByPk(chatId, {
        include: [
            {
                model: User,
                as: 'users',
                attributes: ['id', 'username', 'email'],
                through: { attributes: [] },
            },
            {
                model: Message,
                as: 'messages',
                attributes: ['id', 'content', 'createdAt'],
                include: [
                    {
                        model: User,
                        attributes: ['id', 'username', 'avatar'],
                    }
                ]
            }
        ]
    });

    if (!chat) {
        throw new Error('Chat not found');
    }

    return chat;
};
