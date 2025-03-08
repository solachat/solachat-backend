import Queue from 'bull';
import { createFile } from './fileService';

export const fileQueue = new Queue('file-processing', {
    redis: {
        host: '127.0.0.1',
        port: 6379,
    },
});

fileQueue.process(async (job) => {
    try {
        const { file, userId, chatId } = job.data;
        console.log(`Обрабатываю файл: ${file.originalname}`);

        const result = await createFile(file, userId, chatId, true);

        return result;
    } catch (error) {
        console.error('Ошибка обработки файла:', error);
        throw error;
    }
});
