import crypto from 'crypto';
import fs from 'fs';

export const generateKeys = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });

    fs.writeFileSync('private.key', privateKey.export({ type: 'pkcs1', format: 'pem' }));
    fs.writeFileSync('public.key', publicKey.export({ type: 'pkcs1', format: 'pem' }));

    console.log('Keys generated and saved to files');
};

generateKeys();
