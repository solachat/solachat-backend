import User from './User';
import Chat from './Chat';
import Message from './Message';
import File from './File'; // Добавляем модель File
import UserChats from './UserChats';

export const defineAssociations = () => {
    // Связь между Chat и User через таблицу UserChats
    Chat.belongsToMany(User, {
        through: UserChats,
        foreignKey: 'chatId',
        as: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
    User.belongsToMany(Chat, {
        through: UserChats,
        foreignKey: 'userId',
        as: 'chats',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Связь Message с User
    Message.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Связь Message с Chat
    Message.belongsTo(Chat, {
        foreignKey: 'chatId',
        as: 'chat',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Связь Chat с Message
    Chat.hasMany(Message, {
        foreignKey: 'chatId',
        as: 'messages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Новая связь Message с File
    Message.belongsTo(File, {
        foreignKey: 'fileId',  // Добавляем связь с файлом
        as: 'attachment',      // Название связи как "attachment"
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    // Добавляем связь File с Message
    File.hasOne(Message, {
        foreignKey: 'fileId',
        as: 'message',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};
