import User from './User';
import Chat from './Chat';
import Message from './Message';
import File from './File';
import UserChats from './UserChats';

export const defineAssociations = () => {
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

    Message.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Message.belongsTo(Chat, {
        foreignKey: 'chatId',
        as: 'chat',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Chat.hasMany(Message, {
        foreignKey: 'chatId',
        as: 'messages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Message.belongsTo(File, {
        foreignKey: 'fileId',
        as: 'attachment',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    File.hasOne(Message, {
        foreignKey: 'fileId',
        as: 'message',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};
