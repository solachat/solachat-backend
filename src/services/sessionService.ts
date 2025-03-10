import Session from "../models/Session";

export class SessionService {
    static async saveSessionKey(chatId: number, sessionKey: string): Promise<void> {
        await Session.upsert({ chatId, sessionKey });
    }

    static async getSessionKey(chatId: number): Promise<string | null> {
        const session = await Session.findOne({ where: { chatId } });
        return session ? session.sessionKey : null;
    }

    static async deleteSessionKey(chatId: number): Promise<void> {
        await Session.destroy({ where: { chatId } });
    }

    static async hasSessionKey(chatId: number): Promise<boolean> {
        const session = await Session.findOne({ where: { chatId } });
        return !!session;
    }
}

export default SessionService;
