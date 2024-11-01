import { ethers } from 'ethers';

export const getEthereumBalance = async (walletAddress: string): Promise<string> => {
    try {
        const rpcUrl = process.env.ETHEREUM_RPC_URL;

        if (!rpcUrl) {
            throw new Error("ETHEREUM_RPC_URL is not defined in .env");
        }

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        const balanceInWei = await provider.getBalance(walletAddress);

        return ethers.utils.formatEther(balanceInWei);
    } catch (error) {
        console.error(`Ошибка при получении баланса для адреса ${walletAddress}: ${error}`);
        return '0';
    }
};
