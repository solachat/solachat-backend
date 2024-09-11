import { Keypair, Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import { config } from '../config/config';
import logger from '../utils/logger';

const tokenMintAddress = new PublicKey(config.token.mintAddress);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS = 5000;

export const createNewWallet = () => {
    const keypair = Keypair.generate();
    const wallet = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: Buffer.from(keypair.secretKey).toString('hex')
    };
    logger.info(`Wallet generated: ${wallet.publicKey}`);
    return wallet;
};

export const getSolanaBalance = async (address: string) => {
    const connection = new Connection(config.solana.rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: TIMEOUT_MS,
    });
    const publicKey = new PublicKey(address);

    let retries = 0;
    let balance: number | null = null;

    while (retries < MAX_RETRIES) {
        try {
            balance = await connection.getBalance(publicKey);
            logger.info(`Balance fetched for address ${address}: ${balance / LAMPORTS_PER_SOL} SOL`);
            return balance / LAMPORTS_PER_SOL;
        } catch (err) {
            const error = err as Error;
            retries += 1;
            logger.error(`Error fetching balance (attempt ${retries}) for ${address}: ${error.message}`);

            if (retries >= MAX_RETRIES) {
                throw new Error(`Failed to fetch balance after ${MAX_RETRIES} attempts: ${error.message}`);
            }

            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }

    return balance;
};

export const getTokenBalance = async (walletAddress: string, tokenMintAddress: string, payerSecretKey: string) => {
    const connection = new Connection(config.solana.rpcUrl);
    const walletPublicKey = new PublicKey(walletAddress);
    const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(payerSecretKey, 'hex')));

    const mintPublicKey = new PublicKey(tokenMintAddress);
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payerKeypair,
        mintPublicKey,
        walletPublicKey
    );

    logger.info(`SPL Token balance fetched for ${walletPublicKey.toBase58()}: ${tokenAccount.amount}`);
    return tokenAccount.amount;
};


export const sendTokenTransaction = async (from: string, to: string, amount: number, tokenMintAddress: string) => {
    const connection = new Connection(config.solana.rpcUrl);
    const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(from, 'hex')));
    const toPublicKey = new PublicKey(to);
    const mint = new PublicKey(tokenMintAddress);

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        mint,
        fromKeypair.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        mint,
        toPublicKey
    );

    const transaction = new Transaction().add(
        createTransferInstruction(
            fromTokenAccount.address,
            toTokenAccount.address,
            fromKeypair.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
        )
    );

    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature);

    logger.info(`Token transaction sent from ${fromKeypair.publicKey.toBase58()} to ${toPublicKey.toBase58()} amount: ${amount}`);
    return signature;
};

