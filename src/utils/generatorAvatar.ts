import * as Avatars from '@dicebear/avatars';
import * as sprites from '@dicebear/avatars-identicon-sprites';
import fs from 'fs';
import path from 'path';
import { ensureDirectoryExists, getDestination } from '../config/uploadConfig';
import sharp from "sharp";

const generateAvatar = async (publicKey: string): Promise<string> => {
    const width = 120;
    const height = 120;
    const fileExtension = 'png';
    const destinationPath = getDestination(fileExtension);

    ensureDirectoryExists(destinationPath);

    const fileName = `avatar-${publicKey}-${Date.now()}.png`;
    const filePath = path.join(destinationPath, fileName);

    const avatars = new Avatars.default(sprites.default, {
        width,
        height,
        background: '#FFF',
        margin: 5,
    });

    const svg = avatars.create(publicKey);

    await sharp(Buffer.from(svg))
        .png()
        .toFile(filePath);

    return `http://localhost:4000/uploads/images/${fileName}`;
};

export default generateAvatar;
