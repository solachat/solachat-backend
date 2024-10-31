import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

class UserChats extends Model {
    public userId!: number;
    public chatId!: number;
    public role!: 'owner' | 'admin' | 'member';
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
        role: {
            type: DataTypes.ENUM('owner', 'admin', 'member'),
            allowNull: false,
            defaultValue: 'member',
        },
    },
    {
        sequelize,
        tableName: 'user_chats',
        timestamps: false,
    }
);


export default UserChats;
