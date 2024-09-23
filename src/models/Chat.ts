import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';
import Message from './Message'; // Добавляем для связи с сообщениями

interface ChatAttributes {
    id: number;
    name?: string;
    isGroup: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ChatCreationAttributes extends Optional<ChatAttributes, 'id'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
    public id!: number;
    public name?: string;
    public isGroup!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    public users?: User[];
    public messages?: Message[];

    public addUsers!: (users: User[]) => Promise<void>;
    public addUser!: (user: User) => Promise<void>;
}

Chat.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
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
