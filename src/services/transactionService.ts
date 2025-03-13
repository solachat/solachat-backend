import { sendThroughMixer } from "./ethereumService";
import { sendThroughBTCMixer } from "./bitcoinService";

async function mixCrypto(userAddress: string, amount: number, currency: string) {
    console.log(`Запуск миксера для ${currency} на сумму ${amount}`);

    if (currency === "ETH") {
        await sendThroughMixer(userAddress, amount);
    } else if (currency === "BTC") {
        await sendThroughBTCMixer(userAddress, amount);
    } else {
        throw new Error("❌ Неподдерживаемая криптовалюта");
    }
}

export { mixCrypto };
