import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import Chat from './Chat'; // Включаем Chat для ассоциаций

class User extends Model {
    public id!: number;
    public public_key!: string;
    public email!: string;
    public password!: string;
    public username!: string;
    public realname!: string;
    public aboutMe?: string;
    public lastLogin!: Date;
    public shareEmail!: boolean;
    public shareCountry!: boolean;
    public shareTimezone!: boolean;
    public avatar?: string;
    public avatarHash!: string;
    public rating?: number;
    public online!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

User.init(
    {
        public_key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        realname: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        aboutMe: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        shareEmail: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        shareCountry: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        shareTimezone: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        avatar: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        avatarHash: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        rating: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0,
            validate: {
                isFloat: true,
            },
        },
        online: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        sequelize,
        tableName: 'users',
        timestamps: true,
    }
);


export default User;
