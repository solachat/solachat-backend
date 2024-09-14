import User from './User';
import Chat from './Chat';
import Message from './Message';
import UserChats from './UserChats';

export const defineAssociations = () => {
    Chat.belongsToMany(User, {
        through: UserChats,
        foreignKey: 'chatId',
        as: 'users', // Псевдоним для связи с пользователями
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
    User.belongsToMany(Chat, {
        through: UserChats,
        foreignKey: 'userId',
        as: 'chats', // Псевдоним для связи с чатами
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Message.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user', // Псевдоним для связи с пользователем
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Message.belongsTo(Chat, {
        foreignKey: 'chatId',
        as: 'chat', // Псевдоним для связи с чатом
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Chat.hasMany(Message, {
        foreignKey: 'chatId',
        as: 'messages', // Псевдоним для связи с сообщениями
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};
