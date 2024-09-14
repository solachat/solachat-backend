import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http'; // Подключаем http для работы с WebSocket
import walletRoutes from './routes/walletRoutes';
import userRoutes from './routes/userRoutes';
import tokenRoutes from './routes/tokenRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import { initWebSocketServer } from './websocket'; // Инициализация WebSocket сервера
import './models/associations'; // Импорт моделей для установления связей

const app = express();

// Путь для загрузки файлов
const uploadsPath = path.resolve(__dirname, '../uploads');
console.log(`Serving static files from: ${uploadsPath}`);

// Создание HTTP сервера на основе Express
const server = http.createServer(app);

// Инициализация WebSocket на основе созданного HTTP сервера
initWebSocketServer(server);

// Middleware для работы с загрузкой статических файлов
app.use('/uploads', express.static(uploadsPath));
app.use(cors());
app.use(express.json());

// Определяем маршруты
app.use('/api', walletRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Определяем порт для сервера и WebSocket
const PORT = process.env.PORTSOCKET || 5000;
const wsURL = `ws://localhost:${PORT}`;

// Запуск сервера на определенном порту
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket is available at ${wsURL}`);  // Выводим ссылку на WebSocket
});

export default app;
