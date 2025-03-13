import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import Chat from "./Chat";

export class Session extends Model {
    public id!: number;
    public chatId!: number;
    public sessionKey!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Session.init(
    {
        chatId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: Chat,
                key: "id",
            },
        },
        sessionKey: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: "sessions",
        timestamps: true,
    }
);

// ✅ Связываем с Chat
Session.belongsTo(Chat, { foreignKey: "chatId", onDelete: "CASCADE" });

export default Session;
