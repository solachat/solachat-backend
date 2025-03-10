import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import Chat from "./Chat";
import User from "./User";
import File from "./File";
import MessageFiles from "./MessageFiles"; // ✅ Импортируем связь

export class Message extends Model {
    public id!: number;
    public content!: string;
    public chatId!: number;
    public userId!: number;
    public timestamp!: string;
    public fileIds?: number[] | null;
    public attachments?: File[];
    public isEdited!: boolean;
    public unread!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
    public isRead!: boolean;
    public messageFiles?: MessageFiles[]; // ✅ Добавил `messageFiles`
}

Message.init(
    {
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        chatId: {
            type: DataTypes.INTEGER,
            references: {
                model: Chat,
                key: "id",
            },
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: User,
                key: "id",
            },
            allowNull: false,
        },
        fileIds: {
            type: DataTypes.JSON, // ✅ Теперь это массив файлов
            allowNull: true,
        },
        isEdited: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        timestamp: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: () => new Date().toISOString(),
        },
        unread: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        tableName: "messages",
        timestamps: true,
    }
);

// 🔹 Добавляем связи
Message.hasMany(MessageFiles, { foreignKey: "messageId", as: "messageFiles" });

// ⬇️ Указываем связь MessageFiles с File
MessageFiles.belongsTo(File, { foreignKey: "fileId", as: "file" });

export default Message;
