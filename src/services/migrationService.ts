import { API_CONFIG } from '../utils/apiConfig';

/**
 * Check if a user already exists on the backend
 */
export async function checkUserExistsOnBackend(email: string) {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/migrate/check-user/${encodeURIComponent(email)}`
    );

    if (!response.ok) {
      throw new Error('Failed to check user');
    }

    const data = await response.json();
    return data.exists || false;
  } catch (err) {
    console.error('Check user error:', err);
    return false;
  }
}

/**
 * Migrate users from localStorage to backend
 * Requires migration token for security
 */
export async function migrateUsersToBackend(users: any[], migrationToken: string) {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/migrate/users-from-localstorage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${migrationToken}`
        },
        body: JSON.stringify({ users })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        message: error.message || 'Migration failed' 
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Migration error:', err);
    return { success: false, message: 'Network error during migration' };
  }
}

/**
 * Export users from localStorage for backup
 */
export function exportUsersFromLocalStorage() {
  try {
    const allKeys = Object.keys(localStorage);
    const users = [];

    // Look for singletrack_user_* keys
    for (const key of allKeys) {
      if (key.startsWith('singletrack_user_')) {
        const userData = localStorage.getItem(key);
        if (userData) {
          try {
            const user = JSON.parse(userData);
            users.push(user);
          } catch (e) {
            console.warn(`Failed to parse user data from ${key}`);
          }
        }
      }
    }

    // Also check for singletrack_users array (if stored as array)
    const usersArray = localStorage.getItem('singletrack_users');
    if (usersArray) {
      try {
        const parsedUsers = JSON.parse(usersArray);
        if (Array.isArray(parsedUsers)) {
          users.push(...parsedUsers);
        }
      } catch (e) {
        console.warn('Failed to parse users array from localStorage');
      }
    }

    return users;
  } catch (err) {
    console.error('Export error:', err);
    return [];
  }
}

/**
 * Get migration instructions for user
 */
export function getMigrationInstructions() {
  return `
    Per sincronizzare i tuoi dati locali con il backend:
    
    1. Accedi con le tue credenziali locali
    2. I dati verranno sincronizzati automaticamente
    3. Se hai problemi, contatta il supporto
    
    Nota: La migrazione è un'operazione una tantum.
  `;
}
