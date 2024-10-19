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
import WebSocket from 'ws';
import { Socket } from 'net';
import './models/associations';
import downloadRoutes from "./routes/fileRoutes";
import fileRoutes from "./routes/fileRoutes";
import callRoutes from './routes/callRoutes';

const app = express();

const uploadsPath = path.resolve(__dirname, '../uploads');
console.log(`Serving static files from: ${uploadsPath}`);

const server = http.createServer(app);

export const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket: Socket, head) => {
    console.log('Upgrade request received');
    wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('WebSocket connection established');
        wss.emit('connection', ws, request);
    });
});

initWebSocketServer(wss);

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

app.use('/api/calls', callRoutes)
app.use('/api', walletRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/file', fileRoutes)



const PORT = process.env.PORTSOCKET || 5000;
const wsURL = `ws://localhost:${PORT}`;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket is available at ${wsURL}`);
});

export default app;
