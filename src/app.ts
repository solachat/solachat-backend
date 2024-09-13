import express from 'express';
import cors from 'cors';
import path from 'path';
import walletRoutes from './routes/walletRoutes';
import userRoutes from "./routes/userRoutes";
import tokenRoutes from "./routes/tokenRoutes";

const app = express();

const uploadsPath = path.resolve(__dirname, '../uploads');
console.log(`Serving static files from: ${uploadsPath}`);

app.use('/uploads', express.static(uploadsPath));
app.use(cors());
app.use(express.json());

app.use('/api', walletRoutes);
app.use('/api/users', userRoutes)
app.use('/api/tokens', tokenRoutes)

export default app;
