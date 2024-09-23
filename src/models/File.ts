import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import User from './User';
import Chat from './Chat';

class File extends Model {
    public id!: number;
    public fileName!: string;
    public fileType!: string;
    public filePath!: string;
    public userId!: number;
    public chatId!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

File.init(
    {
        fileName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        fileType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        filePath: {
            type: DataTypes.STRING,
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
        chatId: {
            type: DataTypes.INTEGER,
            references: {
                model: Chat,
                key: 'id',
            },
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'files',
        timestamps: true,
    }
);

File.belongsTo(User, { foreignKey: 'userId' });
File.belongsTo(Chat, { foreignKey: 'chatId' });

export default File;
