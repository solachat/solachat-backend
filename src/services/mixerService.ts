import { sendThroughMixer } from "./ethereumService";
import { sendThroughBTCMixer } from "./bitcoinService";

async function startMixing(depositAddress: string, amount: number, currency: string) {
    console.log(`🔄 Запуск миксера для ${currency}: ${amount} из ${depositAddress}`);

    if (currency === "ETH") {
        await sendThroughMixer(depositAddress, amount);
    } else if (currency === "BTC") {
        await sendThroughBTCMixer(depositAddress, amount);
    } else {
        throw new Error("❌ Неподдерживаемая криптовалюта!");
    }

    console.log(`✅ Миксинг для ${currency} завершен!`);
}

export { startMixing };
