import axios from "axios";

const BLOCKCYPHER_API = "https://api.blockcypher.com/v1/eth/main"; // Ethereum Mainnet API
const BLOCKCYPHER_TOKEN = "ee5134e2c2ae4dd4a53ac7de8381a1a2"; // Твой API-токен
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MAIN_WALLET = process.env.MAIN_WALLET; // Адрес основного кошелька миксера

if (!PRIVATE_KEY || !MAIN_WALLET) {
    throw new Error("❌ Ошибка: PRIVATE_KEY или MAIN_WALLET не найдены в .env файле!");
}

// **Генерация нового ETH-адреса через BlockCypher API**
async function generateDepositAddress() {
    try {
        const response = await axios.post(`${BLOCKCYPHER_API}/addrs?token=${BLOCKCYPHER_TOKEN}`);
        const { address, private: privateKey } = response.data;

        console.log("✅ Сгенерирован новый ETH-адрес для депозита:", address);
        return { address, privateKey };
    } catch (error: unknown) {
        const err = error as any;
        console.error("❌ Ошибка при создании ETH-адреса:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка генерации ETH-адреса");
    }
}

// **Проверка поступлений на адрес миксера**
async function checkDeposits() {
    try {
        const response = await axios.get(`${BLOCKCYPHER_API}/addrs/${MAIN_WALLET}/balance?token=${BLOCKCYPHER_TOKEN}`);
        const balanceETH = response.data.balance / 10 ** 18;

        console.log(`🔍 Баланс основного кошелька: ${balanceETH} ETH`);

        if (balanceETH > 0.01) {
            console.log(`✅ Обнаружено поступление ${balanceETH} ETH. Запускаем миксер...`);
            return balanceETH;
        }
        return 0;
    } catch (error: unknown) {
        const err = error as any;
        console.error("❌ Ошибка при проверке баланса:", err.response?.data || err.message || err);
        throw new Error("❌ Ошибка проверки депозита");
    }
}

export { generateDepositAddress, checkDeposits };
