import fs from 'fs';
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const rsaPublicKey = fs.readFileSync('public.key', 'utf8');
const rsaPrivateKey = fs.readFileSync('private.key', 'utf8');

export const encryptFile = (filePath: string, outputFilePath: string) => {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(cipher).pipe(output);

    cipher.on('end', () => {
        const authTag = cipher.getAuthTag()

        const encryptedAesKey = crypto.publicEncrypt(rsaPublicKey, aesKey);

        const metadata = {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encryptedAesKey: encryptedAesKey.toString('hex'),
        };

        fs.writeFileSync(`${outputFilePath}.meta`, JSON.stringify(metadata));

    });

    cipher.on('error', (err) => {
        console.error('Ошибка при шифровании файла:', err);
        throw err;
    });
};

