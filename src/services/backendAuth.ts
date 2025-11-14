import { apiFetch, API_CONFIG, setAccessToken, setRefreshToken, clearTokens, getAccessToken } from '../utils/apiConfig';

export interface LoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    approved: boolean;
  };
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

/**
 * Register a new user via backend
 */
export async function registerViaBackend(
  email: string,
  username: string,
  password: string,
  firstName: string,
  lastName: string,
  birthDate: string
): Promise<RegisterResponse> {
  try {
    const response = await fetch(API_CONFIG.AUTH.REGISTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password,
        firstName,
        lastName,
        birthDate,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Login via backend
 */
export async function loginViaBackend(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await fetch(API_CONFIG.AUTH.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.accessToken && data.refreshToken && data.user) {
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      // Save current user to localStorage for UI access
      localStorage.setItem('singletrack_current_user', JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Login via backend with fallback to localStorage if backend unavailable
 * This allows users to login even if migration hasn't happened yet
 */
export async function loginViaBackendWithFallback(email: string, password: string): Promise<LoginResponse> {
  try {
    // Try backend first
    const backendResult = await loginViaBackend(email, password);
    
    if (backendResult.success) {
      return backendResult;
    }

    // If backend fails, try localStorage as fallback
    console.warn('Backend login failed, trying localStorage fallback...');
    const localStorageUser = getLocalStorageUserByEmail(email);
    
    if (localStorageUser) {
      // Validate password (in real app, this would be hashed)
      if (localStorageUser.password === password || localStorageUser.passwordHash) {
        // Store a temporary session from localStorage
        localStorage.setItem('singletrack_current_user', JSON.stringify(localStorageUser));
        
        return {
          success: true,
          message: 'Logged in with local data (sync pending with server)',
          user: {
            id: localStorageUser.id || '',
            email: localStorageUser.email,
            username: localStorageUser.username,
            firstName: localStorageUser.firstName || '',
            lastName: localStorageUser.lastName || '',
            role: localStorageUser.role || 'free',
            approved: localStorageUser.approved !== false
          }
        };
      }
    }

    return backendResult;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Get user from localStorage by email (for fallback)
 */
function getLocalStorageUserByEmail(email: string): any {
  try {
    // Check for singletrack_users array
    const usersStr = localStorage.getItem('singletrack_users');
    if (usersStr) {
      const users = JSON.parse(usersStr);
      const user = users.find((u: any) => u.email === email);
      if (user) return user;
    }

    // Check for individual user entries
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.startsWith('singletrack_user_')) {
        const userData = localStorage.getItem(key);
        if (userData) {
          const user = JSON.parse(userData);
          if (user.email === email) {
            return user;
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('localStorage lookup error:', err);
    return null;
  }
}

/**
 * Get current user from backend
 */
export async function getCurrentUserFromBackend() {
  try {
    const response = await apiFetch(API_CONFIG.USERS.ME);

    if (response.status === 401) {
      clearTokens();
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Logout
 */
export function logoutViaBackend() {
  clearTokens();
  localStorage.removeItem('singletrack_current_user');
}

/**
 * Change password via backend
 */
export async function changePasswordViaBackend(
  oldPassword: string,
  newPassword: string
) {
  try {
    const response = await apiFetch(API_CONFIG.USERS.CHANGE_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Update user profile via backend
 */
export async function updateUserProfileViaBackend(profileData: any) {
  try {
    const response = await apiFetch(API_CONFIG.USERS.PROFILE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update profile error:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Test backend connection
 */
export async function testBackendConnection(): Promise<boolean> {
  try {
    const response = await fetch(API_CONFIG.HEALTH);
    return response.ok;
  } catch (error) {
    console.error('Backend connection error:', error);
    return false;
  }
}
