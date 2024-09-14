import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import User from './User';
import Message from './Message';
import UserChats from './UserChats';

class Chat extends Model {
    public id!: number;
    public name?: string;
    public isGroup!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    public users?: User[];
    public addUsers!: (users: User[]) => Promise<void>;
    public addUser!: (user: User) => Promise<void>;
}

Chat.init(
    {
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        isGroup: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        sequelize,
        tableName: 'chats',
        timestamps: true,
    }
);

export default Chat;
