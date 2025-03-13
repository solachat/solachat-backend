import axios from "axios";

const BLOCKCYPHER_API = "https://api.blockcypher.com/v1/eth/main"; // Ethereum Mainnet API
const BLOCKCYPHER_TOKEN = "ee5134e2c2ae4dd4a53ac7de8381a1a2"; // Твой API-токен

// Генерация временного ETH-адреса через BlockCypher API
async function generateTemporaryWallet() {
    try {
        const response = await axios.post(`${BLOCKCYPHER_API}/addrs?token=${BLOCKCYPHER_TOKEN}`);
        const { address, private: privateKey } = response.data;

        console.log("✅ Сгенерирован новый ETH-адрес:", address);
        return { address, privateKey };
    } catch (error: unknown) {
        const err = error as any;
        console.error("❌ Ошибка при создании ETH-адреса:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка генерации ETH-адреса");
    }
}

// Отправка ETH через BlockCypher API
async function sendThroughMixer(userAddress: string, amount: number) {
    try {
        const tempWallet = await generateTemporaryWallet();

        console.log(`🚀 Отправка ${amount} ETH на временный адрес ${tempWallet.address}`);

        // 1️⃣ Отправляем ETH на временный адрес
        const response1 = await axios.post(`${BLOCKCYPHER_API}/txs/new?token=${BLOCKCYPHER_TOKEN}`, {
            inputs: [{ addresses: ["YOUR_MAIN_WALLET_ADDRESS"] }], // Тут твой основной кошелёк
            outputs: [{ addresses: [tempWallet.address], value: amount * 10 ** 18 }]
        });

        console.log("✅ ETH отправлен на временный адрес:", response1.data);

        // 2️⃣ Ждём задержку и отправляем ETH на реальный адрес
        setTimeout(async () => {
            console.log(`🚀 Отправка ${amount * 0.99} ETH на ${userAddress}`);

            const response2 = await axios.post(`${BLOCKCYPHER_API}/txs/new?token=${BLOCKCYPHER_TOKEN}`, {
                inputs: [{ addresses: [tempWallet.address] }],
                outputs: [{ addresses: [userAddress], value: amount * 0.99 * 10 ** 18 }]
            });

            console.log("✅ ETH отправлен пользователю:", response2.data);
        }, Math.random() * 10000);
    } catch (error: unknown) {
        const err = error as any;
        console.error("❌ Ошибка при отправке ETH:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка отправки ETH");
    }
}

export { sendThroughMixer };
