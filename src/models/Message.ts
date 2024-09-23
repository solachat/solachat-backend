import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import Chat from './Chat';
import User from './User';
import File from './File';

class Message extends Model {
    public id!: number;
    public content!: string;
    public chatId!: number;
    public userId!: number;
    public timestamp!: string;
    public fileId?: number;
    public attachment?: File;
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
        fileId: {
            type: DataTypes.INTEGER,
            references: {
                model: File,
                key: 'id',
            },
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: () => new Date().toISOString(),
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
