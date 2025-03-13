import axios from "axios";

const BLOCKCYPHER_API = "https://api.blockcypher.com/v1/btc/test3"; // Тестовая сеть BTC
const BLOCKCYPHER_TOKEN = "ee5134e2c2ae4dd4a53ac7de8381a1a2"; // Твой API-токен

// Генерация нового BTC-адреса через BlockCypher API
async function generateNewAddress() {
    try {
        const response = await axios.post(`${BLOCKCYPHER_API}/addrs?token=${BLOCKCYPHER_TOKEN}`);
        const { address, private: privateKey } = response.data;

        console.log("✅ Сгенерирован новый BTC-адрес:", address);
        return { address, privateKey };
    } catch (error: unknown) {
        const err = error as any; // 📌 Явно приводим `error` к `any`
        console.error("❌ Ошибка при создании BTC-адреса:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка генерации BTC-адреса");
    }
}

// Отправка BTC через BlockCypher API
async function sendBTC(fromPrivateKey: string, toAddress: string, amount: number) {
    try {
        console.log(`🚀 Отправка ${amount} BTC на ${toAddress}`);

        const response = await axios.post(`${BLOCKCYPHER_API}/txs/micro?token=${BLOCKCYPHER_TOKEN}`, {
            from_private: fromPrivateKey,
            to: toAddress,
            value: amount * 100000000, // BTC → Satoshis
        });

        console.log("✅ BTC транзакция отправлена:", response.data);
        return response.data;
    } catch (error: unknown) {
        const err = error as any; // 📌 Явно приводим `error` к `any`
        console.error("❌ Ошибка при отправке BTC:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка отправки BTC");
    }
}

export { generateNewAddress, sendBTC };
