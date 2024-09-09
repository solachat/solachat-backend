import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';

class User extends Model {
    public id!: number;
    public public_key!: string;
    public secret_key!: string;
    public email!: string;
    public password!: string;
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
    },
    {
        sequelize,
        tableName: 'users',
        timestamps: true,
    }
);

export default User;
