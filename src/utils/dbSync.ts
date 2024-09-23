import sequelize from '../config/db';

import '../models/User';
import '../models/Transaction';
import '../models/Message';
import '../models/Chat';
import '../models/File';
import '../models/UserChats';

import { defineAssociations } from '../models/associations';

export const syncDatabase = async () => {
    try {
        defineAssociations();

        await sequelize.sync({ force: false, alter: true });
        console.log('\x1b[32m%s\x1b[0m', 'Database & tables synced successfully!');
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error syncing database:', error);
    }
};
