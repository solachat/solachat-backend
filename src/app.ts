import express from 'express';
import cors from 'cors';
import walletRoutes from './routes/walletRoutes';
import userRoutes from "./routes/userRoutes";

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', walletRoutes);
app.use('/api/users', userRoutes)

export default app;
