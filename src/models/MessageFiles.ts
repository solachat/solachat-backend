import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";

export class MessageFiles extends Model {
    public messageId!: number;
    public fileId!: number;
}

MessageFiles.init(
    {
        messageId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fileId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: "message_files",
        timestamps: false,
    }
);

// 🛠 Отложенная ассоциация, чтобы избежать ошибки циклического импорта
(async () => {
    const { default: Message } = await import("./Message");
    const { default: File } = await import("./File");

    MessageFiles.belongsTo(Message, { foreignKey: "messageId", as: "message" });
    MessageFiles.belongsTo(File, { foreignKey: "fileId", as: "file" });
})();
export default MessageFiles;
