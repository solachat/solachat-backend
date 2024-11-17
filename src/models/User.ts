import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

class User extends Model {
    public id!: number;
    public public_key?: string;
    public username!: string;
    public aboutMe?: string;
    public lastLogin!: Date;
    public sharePublicKey!: boolean;
    public avatar?: string;
    public avatarHash!: string;
    public rating?: number;
    public online!: boolean;
    public verified!: boolean;
    public lastOnline!: Date | null;
    public totpSecret?: string;
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
        username: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
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
        lastOnline: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        sharePublicKey: {
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
        totpSecret: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        online: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        verified: {
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
