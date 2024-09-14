import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http'; // Подключаем http для работы с WebSocket
import walletRoutes from './routes/walletRoutes';
import userRoutes from './routes/userRoutes';
import tokenRoutes from './routes/tokenRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import { initWebSocketServer } from './websocket';
import './models/associations';

const app = express();

const uploadsPath = path.resolve(__dirname, '../uploads');
console.log(`Serving static files from: ${uploadsPath}`);

const server = http.createServer(app);

initWebSocketServer(server);

app.use('/uploads', express.static(uploadsPath));
app.use(cors());
app.use(express.json());

app.use('/api', walletRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

const PORT = process.env.PORTSOCKET || 5000;
const wsURL = `ws://localhost:${PORT}`;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket is available at ${wsURL}`);
});

export default app;
