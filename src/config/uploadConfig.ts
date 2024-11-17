import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { UserRequest } from '../types/types';

const storageClient = new Storage({
    projectId: 'avid-compound-432501-j1',
    keyFilename: path.join(__dirname, '../../your-keyfile.json')
});
const bucketName = 'avid-compound-432501-j1';
const bucket = storageClient.bucket(bucketName);

const getDestination = (fileExtension: string): string => {
    switch (fileExtension) {
        case 'jpeg':
        case 'jpg':
        case 'png':
        case 'gif':
            return 'uploads/images';
        case 'pdf':
        case 'doc':
        case 'docx':
        case 'txt':
            return 'uploads/documents';
        case 'mp4':
        case 'avi':
        case 'mov':
            return 'uploads/videos';
        case 'mp3':
        case 'wav':
            return 'uploads/audio';
        case 'zip':
        case 'rar':
            return 'uploads/archives';
        default:
            return 'uploads/others';
    }
};

const ensureDirectoryExists = (dir: string): void => {
    console.log(`Каталог ${dir} используется для Google Cloud Storage и не создается локально.`);
};

const uploadFileToGCS = async (fileBuffer: Buffer, destinationPath: string): Promise<string> => {
    const blob = bucket.file(destinationPath);
    const blobStream = blob.createWriteStream({
        resumable: false,
        gzip: true,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    });

    return new Promise<string>((resolve, reject) => {
        blobStream.on('error', (err) => reject(`Ошибка при загрузке файла: ${err}`));
        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
            resolve(publicUrl);
        });
        blobStream.end(fileBuffer);
    });
};


const storage = multer.memoryStorage();

const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: FileFilterCallback) => {
    const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'avi', 'mov', 'mp3', 'wav', 'zip', 'rar'];
    const extname = path.extname(file.originalname).toLowerCase().slice(1);

    if (validTypes.includes(extname)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый тип файла. Допустимы только изображения, документы, видео, аудиофайлы и архивы zip/rar.'));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 120 * 1024 * 1024 },
    fileFilter
});

export { getDestination, uploadFileToGCS, ensureDirectoryExists };
