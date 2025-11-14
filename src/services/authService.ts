import { hashPassword, verifyPassword } from '../utils/crypto';

const USERS_KEY = 'singletrack_users';
const CURRENT_USER_KEY = 'singletrack_current_user';

export type UserRole = 'free' | 'plus' | 'contributor' | 'admin' | 'developer' | 'standard';
// New roles:
// free: utente gratuito con limitazioni
// plus: abbonamento a pagamento, accesso completo
// contributor: sviluppatore/contributore, accesso completo gratuito
// admin: account DEV con accesso completo + funzioni amministrative
// Legacy (auto-migrated): developer → admin/contributor, standard → free

export interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    passwordHash: string;
    passwordSalt: string;
    role: UserRole;
    approved: boolean; // Requires approval for free/plus users, auto-approved for contributor/admin
    isBanned?: boolean; // User ban status
    bannedReason?: string; // Reason for banning
    bannedAt?: string; // Timestamp when user was banned
    createdAt: string;
    // Profile fields
    profilePhoto?: string;
    bio?: string;
    location?: string;
    phone?: string;
    website?: string;
    socialLinks?: {
        instagram?: string;
        facebook?: string;
        strava?: string;
    }
}

export interface CurrentUser {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    role: UserRole;
    approved: boolean;
    profilePhoto?: string;
    bio?: string;
    location?: string;
    phone?: string;
    website?: string;
    socialLinks?: {
        instagram?: string;
        facebook?: string;
        strava?: string;
    };
}

    // Get all users (with automatic role migration)
    export const getUsers = (): User[] => {
        const data = localStorage.getItem(USERS_KEY);
        if (!data) return [];
        try {
            let users = JSON.parse(data);
            let migrated = false;        // Migrate old roles to new system for all users
        users = users.map((user: any) => {
            if (user.role === 'developer') {
                migrated = true;
                return { ...user, role: user.id === 'dev_001' ? 'admin' : 'contributor', approved: true };
            } else if (user.role === 'standard') {
                migrated = true;
                return { ...user, role: 'free' };
            }
            return user;
        });
        
        // Save migrated users back
        if (migrated) {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            console.log('[Auth] Migrated user database to new role system');
        }
        
        return users;
    } catch {
        return [];
    }
};

// Save users
export const saveUsers = (users: User[]): void => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// Register new user
export const register = async (userData: Omit<User, 'id' | 'createdAt' | 'role' | 'approved' | 'passwordHash' | 'passwordSalt'> & { password: string }): Promise<{ success: boolean; message: string; user?: CurrentUser }> => {
    const users = getUsers();
    
    // Check if email already exists
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return { success: false, message: 'Email già registrata' };
    }
    
    // Check if username already exists
    if (users.find(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        return { success: false, message: 'Nome utente già in uso' };
    }
    
    // Hash password
    const { password, ...restUserData } = userData;
    const { hash, salt } = await hashPassword(password);
    
    const newUser: User = {
        ...restUserData,
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'free', // Default role for new users (free tier)
        approved: false, // Requires admin approval
        createdAt: new Date().toISOString(),
        passwordHash: hash,
        passwordSalt: salt
    };
    
    users.push(newUser);
    saveUsers(users);
    
    // Return success but user is not approved yet
    return { success: true, message: 'Registrazione completata! In attesa di approvazione da parte di un amministratore.' };
};

// Login
export const login = async (email: string, password: string): Promise<{ success: boolean; message: string; user?: CurrentUser }> => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user || !(await verifyPassword(password, user.passwordHash, user.passwordSalt))) {
        return { success: false, message: 'Email o password non corretti' };
    }
    
    // Check if user is banned
    if (user.isBanned) {
        const reason = user.bannedReason ? ` Motivo: ${user.bannedReason}` : '';
        return { success: false, message: `Il tuo account è stato bannato.${reason}` };
    }
    
    // Check if user is approved (skip check for contributor/admin)
    if ((user.role === 'free' || user.role === 'plus') && !user.approved) {
        return { success: false, message: 'Il tuo account è in attesa di approvazione da parte di un amministratore.' };
    }
    
    const currentUser: CurrentUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        role: user.role,
        approved: user.approved
    };
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    
    // Set session timestamp for expiration check
    localStorage.setItem('singletrack_session_timestamp', Date.now().toString());
    
    return { success: true, message: 'Accesso effettuato!', user: currentUser };
};

// Logout
export const logout = (): void => {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('singletrack_remember_me');
    localStorage.removeItem('singletrack_session_timestamp');
};

// Get current user (with automatic role migration from old system)
export const getCurrentUser = (): CurrentUser | null => {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    if (!data) return null;
    try {
        let user = JSON.parse(data);
        
        // Migrate old roles to new system
        if (user.role === 'developer' as any) {
            user.role = user.id === 'dev_001' ? 'admin' : 'contributor';
            user.approved = true;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else if (user.role === 'standard' as any) {
            user.role = 'free';
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        }
        
        // Check session expiration (only if "remember me" is not active)
        const rememberMe = localStorage.getItem('singletrack_remember_me') === 'true';
        const sessionTimestamp = localStorage.getItem('singletrack_session_timestamp');
        
        if (!rememberMe && sessionTimestamp) {
            const sessionAge = Date.now() - parseInt(sessionTimestamp);
            const sessionMaxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (sessionAge > sessionMaxAge) {
                // Session expired
                logout();
                return null;
            }
        }
        
        return user;
    } catch {
        return null;
    }
};

// Check if user is logged in
export const isAuthenticated = (): boolean => {
    return getCurrentUser() !== null;
};

// Initialize default admin account with secure password
export const initializeDefaultAccounts = async (): Promise<void> => {
    const users = getUsers();
    
    // Check if admin account already exists
    const adminExists = users.find(u => u.role === 'admin');
    
    if (!adminExists) {
        const defaultPassword = process.env.REACT_APP_DEFAULT_ADMIN_PASSWORD || 'admin123';
        const { hash, salt } = await hashPassword(defaultPassword);
        
        const adminUser: User = {
            id: 'dev_001',
            email: 'admin@singletrack.app',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'Developer',
            birthDate: '1990-01-01',
            passwordHash: hash,
            passwordSalt: salt,
            role: 'admin',
            approved: true, // Auto-approved
            createdAt: new Date().toISOString()
        };
        
        users.push(adminUser);
        saveUsers(users);
        console.log('[Auth] Account admin creato: admin@singletrack.app / admin123');
    }
};

// Get pending users (not approved, free/plus only)
export const getPendingUsers = (): User[] => {
    const users = getUsers();
    return users.filter(u => (u.role === 'free' || u.role === 'plus') && !u.approved);
};

// Get approved regular users (free/plus, not contributors/admins)
export const getApprovedUsers = (): User[] => {
    const users = getUsers();
    return users.filter(u => (u.role === 'free' || u.role === 'plus') && u.approved && !u.isBanned);
};

// Get contributors (user-developers with full access)
export const getContributors = (): User[] => {
    const users = getUsers();
    return users.filter(u => u.role === 'contributor');
};

// Get admins (DEV accounts)
export const getAdmins = (): User[] => {
    const users = getUsers();
    return users.filter(u => u.role === 'admin');
};

// Legacy: getDevelopers returns both contributors and admins
export const getDevelopers = (): User[] => {
    const users = getUsers();
    return users.filter(u => (u.role === 'contributor' || u.role === 'admin') && !u.isBanned);
};

// Get banned users
export const getBannedUsers = (): User[] => {
    const users = getUsers();
    return users.filter(u => u.isBanned === true);
};

// Delete user permanently from the app (but keep their approved content)
export const deleteUser = (userId: string): { success: boolean; message: string } => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    const deletedUser = users[userIndex];
    
    // Protect admin accounts
    if (deletedUser.role === 'admin') {
        return { success: false, message: '🔒 Non è possibile eliminare un account Admin. Solo gli Admin possono gestire altri Admin.' };
    }
    
    // Remove user account
    users.splice(userIndex, 1);
    saveUsers(users);
    
    // Note: We intentionally do NOT delete:
    // - Approved tracks created by the user (createdBy = userId)
    // - Approved POIs created by the user (createdBy = userId)
    // - Reviews made by the user (they retain their userName)
    // - Tours created by the user
    // This ensures no content loss when an account is deleted
    
    console.log('[Auth] Utente eliminato definitivamente:', deletedUser.username, '| Contenuti approvati mantenutti');
    return { 
        success: true, 
        message: `Utente "${deletedUser.username}" eliminato dall'app.\n\nI seguenti dati sono stati mantenutti:\n✓ Tracce approvate caricate\n✓ Punti di interesse approvati\n✓ Recensioni ai singletrack` 
    };
};

// Approve user
export const approveUser = (userId: string): void => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (user) {
        user.approved = true;
        saveUsers(users);
        console.log('[Auth] Utente approvato:', user.username);
    }
};

// Reject user (delete)
export const rejectUser = (userId: string): void => {
    const users = getUsers();
    const filtered = users.filter(u => u.id !== userId);
    saveUsers(filtered);
    console.log('[Auth] Utente rifiutato e rimosso');
};

// Promote user to contributor (developer access)
export const promoteToContributor = (userId: string): void => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (user && (user.role === 'free' || user.role === 'plus')) {
        user.role = 'contributor';
        user.approved = true; // Auto-approve contributors
        saveUsers(users);
        console.log('[Auth] Utente promosso a contributor:', user.username);
    }
};

// Demote user from developer/contributor to standard user
export const demoteFromDeveloper = (userId: string, targetRole: 'free' | 'plus' = 'free'): { success: boolean; message: string } => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    // Protect admin accounts
    if (user.role === 'admin') {
        return { success: false, message: '🔒 Non è possibile declassare un account Admin. Solo gli Admin possono gestire altri Admin.' };
    }
    
    if (user.role !== 'contributor' && user.role !== 'developer') {
        return { success: false, message: 'Questo utente non è uno sviluppatore' };
    }
    
    const previousRole = user.role;
    user.role = targetRole;
    // Keep approval status for plus users, set to false for free users
    if (targetRole === 'free') {
        user.approved = false; // Free users need re-approval
    } else {
        user.approved = true; // Plus users auto-approved
    }
    
    saveUsers(users);
    console.log('[Auth] Utente declassato:', user.username, '→', targetRole, '(da', previousRole, ')');
    
    return { success: true, message: `Utente "${user.username}" declassato con successo da ${previousRole} a ${targetRole}` };
};

// Change user role (admin function)
export const changeUserRole = (userId: string, newRole: UserRole): void => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (user) {
        user.role = newRole;
        // Auto-approve contributor/admin roles
        if (newRole === 'contributor' || newRole === 'admin') {
            user.approved = true;
        }
        saveUsers(users);
        console.log('[Auth] Ruolo utente cambiato:', user.username, '→', newRole);
    }
};

// Legacy alias
export const promoteToDeveloper = promoteToContributor;

// Update user profile
export const updateUserProfile = (userId: string, profileData: Partial<Pick<User, 'firstName' | 'lastName' | 'birthDate' | 'profilePhoto' | 'bio' | 'location' | 'phone' | 'website' | 'socialLinks'>>): { success: boolean; message: string; user?: CurrentUser } => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    const user = users[userIndex];
    
    // Protect admin accounts - can only modify their own profile
    if (user.role === 'admin') {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.id !== userId) {
            return { success: false, message: '🔒 Non è possibile modificare il profilo di un account Admin.' };
        }
        // Allow self-modification for admin
    }
    
    // Update user data
    users[userIndex] = {
        ...users[userIndex],
        ...profileData
    };
    
    saveUsers(users);
    
    // Update current user if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        const updatedUser: CurrentUser = {
            ...currentUser,
            ...profileData
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
        return { success: true, message: 'Profilo aggiornato con successo', user: updatedUser };
    }
    
    return { success: true, message: 'Profilo aggiornato con successo' };
};

// Change password with proper hashing
export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    // Protect admin accounts - can only change their own password
    if (user.role === 'admin') {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.id !== userId) {
            return { success: false, message: '🔒 Non è possibile modificare la password di un account Admin.' };
        }
        // Allow self-modification for admin
    }
    
    if (!(await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt))) {
        return { success: false, message: 'Password attuale non corretta' };
    }
    
    if (newPassword.length < 8) {
        return { success: false, message: 'La nuova password deve essere di almeno 8 caratteri' };
    }
    
    const { hash, salt } = await hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    saveUsers(users);
    
    return { success: true, message: 'Password modificata con successo' };
};

// Ban user (admin function)
export const banUser = (userId: string, reason: string = 'No reason provided'): { success: boolean; message: string } => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    if (user.role === 'admin') {
        return { success: false, message: '🔒 Non è possibile bannare un account Admin. Solo gli Admin possono gestire altri Admin.' };
    }
    
    if (user.role === 'developer') {
        return { success: false, message: '🔒 Non è possibile bannare uno sviluppatore. Usa la funzione "Declassa a Standard" prima.' };
    }
    
    user.isBanned = true;
    user.bannedReason = reason;
    user.bannedAt = new Date().toISOString();
    
    saveUsers(users);
    console.log('[Auth] Utente bannato:', user.username, '- Motivo:', reason);
    
    return { success: true, message: `Utente "${user.username}" bannato con successo` };
};

// Unban user (admin function)
export const unbanUser = (userId: string): { success: boolean; message: string } => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return { success: false, message: 'Utente non trovato' };
    }
    
    if (!user.isBanned) {
        return { success: false, message: 'Utente non è bannato' };
    }
    
    user.isBanned = false;
    user.bannedReason = undefined;
    user.bannedAt = undefined;
    
    saveUsers(users);
    console.log('[Auth] Utente sbannato:', user.username);
    
    return { success: true, message: `Utente "${user.username}" sbannato con successo` };
};

// Permission helpers (support legacy roles during transition)
export const isAdmin = (user?: CurrentUser | User | null): boolean => {
    return user?.role === 'admin' || user?.role === 'developer';
};

export const isContributor = (user?: CurrentUser | User | null): boolean => {
    return user?.role === 'contributor' || user?.role === 'developer';
};

export const isPlusUser = (user?: CurrentUser | User | null): boolean => {
    return user?.role === 'plus';
};

export const isFreeUser = (user?: CurrentUser | User | null): boolean => {
    return user?.role === 'free' || user?.role === 'standard';
};

export const hasFullAccess = (user?: CurrentUser | User | null): boolean => {
    // Plus, contributor, admin, and legacy developer have full access
    return user?.role === 'plus' || user?.role === 'contributor' || user?.role === 'admin' || user?.role === 'developer';
};

export const canManageUsers = (user?: CurrentUser | User | null): boolean => {
    // Admins and legacy developers can manage users
    return user?.role === 'admin' || user?.role === 'developer';
};

export const canDevelop = (user?: CurrentUser | User | null): boolean => {
    // Contributors, admins, and legacy developers have dev access
    return user?.role === 'contributor' || user?.role === 'admin' || user?.role === 'developer';
};
