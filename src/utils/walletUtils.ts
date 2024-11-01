export const isSolanaWallet = (publicKey: string) => /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(publicKey);
export const isEthereumWallet = (publicKey: string) => /^0x[a-fA-F0-9]{40}$/.test(publicKey);
