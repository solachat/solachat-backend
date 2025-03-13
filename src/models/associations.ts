import User from './User';
import Chat from './Chat';
import Message from './Message';
import File from './File';
import UserChats from './UserChats';
import Session from "./Session";

export const defineAssociations = () => {
    // 🔹 Связь "многие ко многим" (Чат ↔ Пользователи)
    Chat.belongsToMany(User, {
        through: UserChats,
        foreignKey: 'chatId',
        as: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    User.belongsToMany(Chat, {
        through: UserChats,
        foreignKey: 'userId',
        as: 'chats',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    // ✅ Добавляем связи для UserChats
    UserChats.belongsTo(Chat, {
        foreignKey: 'chatId',
        as: 'chat', // 👈 Теперь `UserChats` понимает, что он связан с `Chat`
    });

    UserChats.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user', // 👈 Теперь `UserChats` понимает, что он связан с `User`
    });

    Chat.hasMany(UserChats, {
        foreignKey: 'chatId',
        as: 'userChats', // ✅ Должно совпадать с include в findOne
    });

    User.hasMany(UserChats, {
        foreignKey: 'userId',
        as: 'userChats', // ✅ alias для связи пользователя с чатами
    });

    // 🔹 Связь "сообщение принадлежит пользователю"
    Message.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    // 🔹 Связь "сообщение принадлежит чату"
    Message.belongsTo(Chat, {
        foreignKey: 'chatId',
        as: 'chat',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    // 🔹 Связь "чат имеет много сообщений"
    Chat.hasMany(Message, {
        foreignKey: 'chatId',
        as: 'messages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    // 🔹 Связь "сообщение может содержать файл"
    Message.belongsTo(File, {
        foreignKey: 'fileId',
        as: 'attachment',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });

    // 🔹 Связь "файл может принадлежать одному сообщению"
    File.hasOne(Message, {
        foreignKey: 'fileId',
        as: 'message',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    Chat.hasOne(Session, { foreignKey: "chatId", as: "session" });
    Session.belongsTo(Chat, { foreignKey: "chatId", as: "chat" });

};
