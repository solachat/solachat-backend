import { generateNewAddress, sendBTC } from "../utils/btcUtils";

// Проверяем, есть ли `MIXER_WALLET` в `.env`
const mixerWallet = process.env.MIXER_WALLET as string;
if (!mixerWallet) {
    throw new Error("❌ Ошибка: MIXER_WALLET не найден в .env файле!");
}

// Генерируем временный BTC-адрес
async function generateTemporaryBTCWallet() {
    const tempWallet = await generateNewAddress();
    console.log("✅ Создан временный BTC-адрес:", tempWallet.address);
    return tempWallet; // Теперь возвращаем { address, privateKey }
}

// Микширование BTC (аналог CoinJoin)
async function sendThroughBTCMixer(userAddress: string, amount: number) {
    const tempWallet = await generateTemporaryBTCWallet();

    // 📌 Теперь передаём `tempWallet.privateKey`, а не `tempWallet.address`
    await sendBTC(mixerWallet, tempWallet.address, amount);
    console.log(`✅ Отправлено ${amount} BTC на временный адрес ${tempWallet.address}`);

    // Добавляем случайную задержку
    setTimeout(async () => {
        await sendBTC(tempWallet.privateKey, userAddress, amount * 0.99);
        console.log(`✅ Отправлено ${amount * 0.99} BTC на ${userAddress}`);
    }, Math.random() * 20000);
}

export { sendThroughBTCMixer };
