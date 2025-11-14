// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  AUTH: {
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  },
  USERS: {
    ME: `${API_BASE_URL}/api/users/me`,
    PROFILE: `${API_BASE_URL}/api/users/profile`,
    CHANGE_PASSWORD: `${API_BASE_URL}/api/users/change-password`,
  },
  HEALTH: `${API_BASE_URL}/api/health`,
};

// Token management
export const getAccessToken = () => localStorage.getItem('accessToken');
export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const setAccessToken = (token: string) => localStorage.setItem('accessToken', token);
export const setRefreshToken = (token: string) => localStorage.setItem('refreshToken', token);

export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Headers helper
export const getAuthHeaders = () => {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// API fetch wrapper with auto-refresh
export async function apiFetch(url: string, options: RequestInit = {}) {
  let response = await fetch(url, {
    ...options,
    headers: getAuthHeaders(),
  });

  // Se 401 (token scaduto), prova a refresh
  if (response.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshResponse = await fetch(API_CONFIG.AUTH.REFRESH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setAccessToken(data.accessToken);

        // Retry the original request
        response = await fetch(url, {
          ...options,
          headers: getAuthHeaders(),
        });
      } else {
        clearTokens();
        window.location.href = '/login';
      }
    }
  }

  return response;
}
