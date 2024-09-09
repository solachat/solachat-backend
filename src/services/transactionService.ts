import { Keypair, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import { config } from '../config/config';
import logger from '../utils/logger';
import TransactionModel from '../models/Transaction';

const tokenMintAddress = new PublicKey(config.token.mintAddress);

export const sendTokenTransaction = async (from: string, to: string, amount: number) => {
    const connection = new Connection(config.solana.rpcUrl);
    const fromKeypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(from, 'hex')));
    const toPublicKey = new PublicKey(to);

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, fromKeypair, tokenMintAddress, fromKeypair.publicKey);
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, fromKeypair, tokenMintAddress, toPublicKey);

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

    const dbTransaction = await TransactionModel.create({
        from: fromKeypair.publicKey.toBase58(),
        to: toPublicKey.toBase58(),
        amount,
        tokenMintAddress: tokenMintAddress.toBase58(),
        status: 'pending',
    });

    try {
        const signature = await connection.sendTransaction(transaction, [fromKeypair]);
        await connection.confirmTransaction(signature);

        await dbTransaction.update({ status: 'confirmed', signature });

        logger.info(`Token transaction confirmed with signature: ${signature}`);
        return signature;
    } catch (error) {
        await dbTransaction.update({ status: 'failed' });
        logger.error('Transaction failed', error);
        throw error;
    }
};
