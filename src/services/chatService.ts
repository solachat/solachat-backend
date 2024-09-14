import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';

export const createPrivateChat = async (user1Id: number, user2Id: number) => {
    try {
        let chat = await Chat.findOne({
            where: { isGroup: false },
            include: [
                {
                    model: User,
                    as: 'users',
                    where: { id: [user1Id, user2Id] },
                    through: { attributes: [] }
                }
            ]
        });

        if (!chat) {
            chat = await Chat.create({ isGroup: false });

            const user1 = await User.findByPk(user1Id);
            const user2 = await User.findByPk(user2Id);

            if (user1 && user2) {
                await chat.addUsers([user1, user2]);
            }
        }

        return chat;
    } catch (error) {
        console.error('Error creating private chat:', error);
        throw new Error('Failed to create private chat');
    }
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
                        as: 'user',
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


export const getChatsForUser = async (userId: number) => {
    try {
        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    where: { id: userId },
                    attributes: [],
                },
            ],
        });

        return chats;
    } catch (error) {
        console.error('Error fetching chats for user:', error);
        throw new Error('Failed to fetch chats');
    }
};

export const getChatWithMessages = async (chatId: number) => {
    const chat = await Chat.findByPk(chatId, {
        include: [
            {
                model: User,
                as: 'users',
                attributes: ['id', 'username', 'email', 'avatar'],
                through: { attributes: [] },
            },
            {
                model: Message,
                as: 'messages',
                attributes: ['id', 'content', 'createdAt'],
                include: [
                    {
                        model: User,
                        as: 'user',
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


