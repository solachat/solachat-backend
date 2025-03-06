import { createClient } from 'redis';

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
    }
});

redisClient.on('error', (err) => console.error('❌ Redis Error:', err));
redisClient.on('connect', () => console.log('🚀 Redis подключен'));

(async () => {
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        } catch (error) {
            console.error('❌ Ошибка подключения к Redis:', error);
        }
    }
})();

export default redisClient;
