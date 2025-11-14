import { getUsers, saveUsers } from './authService';
import { hashPassword } from '../utils/crypto';

export const migrateUsersToHash = async () => {
    const users = getUsers();
    let migrated = false;
    
    for (const user of users) {
        if ((user as any).password && !user.passwordHash) {
            const { hash, salt } = await hashPassword((user as any).password);
            delete (user as any).password;
            user.passwordHash = hash;
            user.passwordSalt = salt;
            migrated = true;
        }
    }

    if (migrated) {
        saveUsers(users);
    }
    
    return migrated;
};

export const resetAdmin = async () => {
    const users = getUsers();
    const adminUser = users.find(u => u.role === 'admin');
    
    if (adminUser) {
        const defaultPassword = process.env.REACT_APP_DEFAULT_ADMIN_PASSWORD || 'admin123';
        const { hash, salt } = await hashPassword(defaultPassword);
        adminUser.passwordHash = hash;
        adminUser.passwordSalt = salt;
        saveUsers(users);
        return true;
    }
    return false;
};