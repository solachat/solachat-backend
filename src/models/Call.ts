import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

export class Call extends Model {
    public id!: number;
    public fromUserId!: number;
    public toUserId!: number;
    public isGroupCall!: boolean;
    public status!: 'initiated' | 'accepted' | 'rejected' | 'missed';
    public createdAt!: Date;
    public updatedAt!: Date;
}

Call.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        fromUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        toUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        isGroupCall: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        status: {
            type: DataTypes.ENUM('initiated', 'accepted', 'rejected', 'missed'),
            defaultValue: 'initiated',
        },
    },
    {
        sequelize,
        modelName: 'call',
        timestamps: true,
    }
);

export default Call;
