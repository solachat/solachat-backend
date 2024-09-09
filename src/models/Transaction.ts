import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

class Transaction extends Model {
    public id!: number;
    public from!: string;
    public to!: string;
    public amount!: number;
    public tokenMintAddress!: string;
    public signature!: string;
    public status!: string;
    public readonly createdAt!: Date;
}

Transaction.init(
    {
        from: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        to: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        tokenMintAddress: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        signature: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'pending',
        },
    },
    {
        sequelize,
        tableName: 'transactions',
        timestamps: true,
    }
);

export default Transaction;
