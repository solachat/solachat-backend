import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import Chat from './Chat';
import User from './User';

class Message extends Model {
    public id!: number;
    public content!: string;
    public chatId!: number;
    public userId!: number;
    public timestamp!: string;
    public filePath?: string;
    public unread!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Message.init(
    {
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        chatId: {
            type: DataTypes.INTEGER,
            references: {
                model: Chat,
                key: 'id',
            },
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: User,
                key: 'id',
            },
            allowNull: false,
        },
        timestamp: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: () => new Date().toISOString(),
        },
        filePath: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        unread: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        tableName: 'messages',
        timestamps: true,
    }
);

export default Message;
