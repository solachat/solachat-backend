import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import walletRoutes from './routes/walletRoutes';
import userRoutes from './routes/userRoutes';
import tokenRoutes from './routes/tokenRoutes';
import chatRoutes from './routes/chatRoutes';
import messageRoutes from './routes/messageRoutes';
import { initWebSocketServer } from './websocket';
import './models/associations';
import downloadRoutes from './routes/fileRoutes';
import fileRoutes from './routes/fileRoutes';
import callRoutes from './routes/callRoutes';

const app = express();

const uploadsPath = path.resolve(__dirname, '../uploads');

const server = http.createServer(app);

initWebSocketServer(server);

app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
            res.setHeader('Content-Type', 'mp4');
        } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        }
    }
}));

app.use(express.urlencoded({ extended: true }));
app.use('/download', downloadRoutes);
app.use(cors());
app.use(express.json());

app.use('/api/calls', callRoutes);
app.use('/api', walletRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/file', fileRoutes);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Произошла ошибка на сервере. Мы работаем над этим!' });
});

const PORT = process.env.PORTSOCKET || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const wsProtocol = isProduction ? 'wss' : 'ws';
const wsURL = `${wsProtocol}://localhost:${PORT}`;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket is available at ${wsURL}`);
});

export default app;
