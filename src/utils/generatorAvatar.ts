import sharp from 'sharp';
import path from 'path';
import { ensureDirectoryExists, getDestination } from '../config/uploadConfig';

const getRandomColor = (): string => {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#FF9633', '#8D33FF'];
    return colors[Math.floor(Math.random() * colors.length)];
};

const getInitials = (username: string): string => {
    return username
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase();
};

const generateAvatar = async (username: string): Promise<string> => {
    const initials = getInitials(username);
    const width = 120;
    const height = 120;
    const backgroundColor = getRandomColor();

    const fileExtension = 'png';
    const destinationPath = getDestination(fileExtension);

    ensureDirectoryExists(destinationPath);

    const fileName = `avatar-${username}-${Date.now()}.png`;
    const filePath = path.join(destinationPath, fileName);

    const svgImage = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <text x="50%" y="50%" font-size="48" fill="#FFF" font-family="Arial, sans-serif" dy=".3em" text-anchor="middle">${initials}</text>
    </svg>`;

    await sharp(Buffer.from(svgImage))
        .png()
        .toFile(filePath);

    return `http://localhost:4000/uploads/images/${fileName}`;
};

export default generateAvatar;
