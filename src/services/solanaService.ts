import {
    Keypair,
    Connection,
    PublicKey,
    Transaction,
    LAMPORTS_PER_SOL,
    SolanaJSONRPCError,
    ParsedConfirmedTransaction
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction,
    getAssociatedTokenAddress,
} from '@solana/spl-token';
import { config } from '../config/config';
import logger from '../utils/logger';

const tokenMintAddress = new PublicKey(config.token.mintAddress);
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS = 5000;

export const createNewWallet = (): { publicKey: string; secretKey: string } => {
    const keypair = Keypair.generate();
    const wallet = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: Buffer.from(keypair.secretKey).toString('hex'),
    };
    logger.info(`Wallet generated: ${wallet.publicKey}`);
    return wallet;
};

export const getSolanaBalance = async (address: string): Promise<number> => {
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
            return (balance ?? 0) / LAMPORTS_PER_SOL;
        } catch (err) {
            const error = err as Error;
            retries += 1;
            logger.error(`Error fetching balance (attempt ${retries}) for ${address}: ${error.message}`);

            if (error.message.includes('fetch failed') || error.message.includes('network timeout')) {
                logger.warn(`Network error, retrying after ${RETRY_DELAY_MS * retries}ms`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * retries));
            } else {
                if (retries >= MAX_RETRIES) {
                    throw new Error(`Failed to fetch balance after ${MAX_RETRIES} attempts: ${error.message}`);
                }
            }
        }
    }

    return balance ?? 0;
};

export const getTokenBalance = async (walletAddress: string) => {
    try {
        const connection = new Connection(config.solana.rpcUrl, 'confirmed');
        const walletPublicKey = new PublicKey(walletAddress);

        const tokenMintAddress = new PublicKey(config.token.mintAddress);
        const tokenAccountAddress = await getAssociatedTokenAddress(tokenMintAddress, walletPublicKey);

        const [tokenAccountInfo, balance] = await Promise.all([
            connection.getTokenAccountBalance(tokenAccountAddress),
            connection.getBalance(walletPublicKey),
        ]);

        const tokenBalance = tokenAccountInfo.value.uiAmount || 0;
        logger.info(`Token balance for ${walletAddress}: ${tokenBalance}`);
        return tokenBalance;
    } catch (error) {
        if (error instanceof SolanaJSONRPCError && error.code === -32602) {
            logger.warn(`Token account not found for ${walletAddress}. Returning 0 balance.`);
            return 0;
        }
        logger.error("Error fetching SPL Token balance:", error);
        throw new Error("Failed to fetch token balance");
    }
};



export const sendTokenTransaction = async (from: string, to: string, amount: number): Promise<string> => {
    const connection = new Connection(config.solana.rpcUrl);
    const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(from, 'hex')));
    const toPublicKey = new PublicKey(to);

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        tokenMintAddress,
        fromKeypair.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        fromKeypair,
        tokenMintAddress,
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

    try {
        const signature = await connection.sendTransaction(transaction, [fromKeypair]);
        await connection.confirmTransaction(signature);

        logger.info(`Transaction confirmed: ${signature}`);
        return signature;
    } catch (error) {
        logger.error('Transaction failed', error);
        throw error;
    }
};

const INITIAL_DELAY_MS = 500;

export const getTokenTransactions = async (mintAddress: string) => {
    const connection = new Connection(config.solana.rpcUrl);
    const mintPublicKey = new PublicKey(mintAddress);
    let retries = 0;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (retries < MAX_RETRIES) {
        try {
            const signatures = await connection.getSignaturesForAddress(mintPublicKey, { limit: 100 });
            logger.info(`Fetched ${signatures.length} transactions for mint address: ${mintAddress}`);

            const transactions = await Promise.all(
                signatures.map(async (signatureInfo) => {
                    const transaction = await connection.getParsedTransaction(signatureInfo.signature);
                    return {
                        signature: signatureInfo.signature,
                        blockTime: signatureInfo.blockTime,
                        slot: signatureInfo.slot,
                        amount: extractAmountFromTransaction(transaction),
                        transaction,
                    };
                })
            );

            return transactions;
        } catch (error) {
            if (error instanceof SolanaJSONRPCError && error.code === 429) {
                retries += 1;
                const delayTime = INITIAL_DELAY_MS * Math.pow(3, retries); // Увеличиваем задержку
                logger.warn(`Server responded with 429 Too Many Requests. Retrying after ${delayTime}ms delay...`);
                await delay(delayTime);
            } else if (error instanceof Error && error.message.includes('fetch failed')) {
                retries += 1;
                const delayTime = INITIAL_DELAY_MS * Math.pow(3, retries); // Обработка 'fetch failed'
                logger.warn(`Fetch failed. Retrying after ${delayTime}ms delay...`);
                await delay(delayTime);
            } else if (error instanceof Error) {
                logger.error(`Error fetching transactions for mint address ${mintAddress}: ${error.message}`);
                throw new Error(`Failed to fetch transactions: ${error.message}`);
            } else {
                logger.error(`Unexpected error: ${String(error)}`);
                throw new Error('Unexpected error occurred.');
            }
        }
    }

    throw new Error(`Failed to fetch transactions after ${MAX_RETRIES} retries due to fetch errors or 429 Too Many Requests`);
};

const extractAmountFromTransaction = (transaction: ParsedConfirmedTransaction | null): number => {
    let amount = 0;
    if (transaction && transaction.meta && transaction.meta.postTokenBalances) {
        transaction.meta.postTokenBalances.forEach((balance) => {
            amount += balance.uiTokenAmount.uiAmount || 0;
        });
    }
    return amount;
};

