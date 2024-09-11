import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

class User extends Model {
    public id!: number;
    public public_key!: string;
    public secret_key!: string;
    public email!: string;
    public password!: string;
    public username!: string;
    public realname!: string;
    public lastLogin!: Date;
    public shareEmail!: boolean;
    public shareCountry!: boolean;
    public shareTimezone!: boolean;
    public avatar?: string;
    public rating?: number;
    public readonly createdAt!: Date;
}

User.init(
    {
        public_key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        secret_key: {
            type: DataTypes.STRING,
            allowNull: false,
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
        rating: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'users',
        timestamps: true,
    }
);

export default User;
