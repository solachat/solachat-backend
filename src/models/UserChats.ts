import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

class UserChats extends Model {
    public userId!: number;
    public chatId!: number;
}

UserChats.init(
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        chatId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'user_chats',
        timestamps: false,
    }
);

export default UserChats;
