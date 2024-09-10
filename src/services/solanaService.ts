import { Keypair, Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import { config } from '../config/config';
import logger from '../utils/logger';

const tokenMintAddress = new PublicKey(config.token.mintAddress);

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
    const connection = new Connection(config.solana.rpcUrl);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    logger.info(`Balance fetched for address ${address}: ${balance / LAMPORTS_PER_SOL} SOL`);
    return balance / LAMPORTS_PER_SOL;
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

