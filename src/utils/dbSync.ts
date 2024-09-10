import sequelize from '../config/db';
import '../models/User';
import '../models/Transaction';

export const syncDatabase = async () => {
    try {
        await sequelize.sync({ force: false });
        console.log('\x1b[32m%s\x1b[0m', 'Database & tables synced successfully!');
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error syncing database:', error);
    }
};
