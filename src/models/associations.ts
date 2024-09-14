import User from './User';
import Chat from './Chat';
import Message from './Message';
import UserChats from './UserChats';

export const defineAssociations = () => {
    Chat.belongsToMany(User, { through: UserChats, foreignKey: 'chatId', as: 'users' });
    User.belongsToMany(Chat, { through: UserChats, foreignKey: 'userId', as: 'chats' });

    Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Message.belongsTo(Chat, { foreignKey: 'chatId', as: 'chat' });

    Chat.hasMany(Message, { foreignKey: 'chatId', as: 'messages' });
};
