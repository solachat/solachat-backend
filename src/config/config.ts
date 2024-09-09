import dotenv from 'dotenv';

dotenv.config();

export const config = {
    solana: {
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    },
    token: {
        mintAddress: process.env.TOKEN_MINT_ADDRESS || 'YourTokenMintAddress',
    },
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
};
