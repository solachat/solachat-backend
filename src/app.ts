import express from 'express';
import cors from 'cors';
import walletRoutes from './routes/walletRoutes';
import userRoutes from "./routes/userRoutes";
import tokenRoutes from "./routes/tokenRoutes";

const app = express();

app.use(cors());
app.use(express.json());


app.use('/api', walletRoutes);
app.use('/api/users', userRoutes)
app.use('/api/tokens', tokenRoutes)

export default app;
