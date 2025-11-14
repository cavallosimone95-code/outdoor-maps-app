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

    if (data.success && data.accessToken && data.refreshToken) {
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Network error' };
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
