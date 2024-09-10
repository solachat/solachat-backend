import app from './app';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { syncDatabase } from './utils/dbSync';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = createServer(app);

syncDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
