import { apiFetch, API_CONFIG } from '../utils/apiConfig';

export interface BackendUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'free' | 'plus' | 'contributor' | 'admin';
  approved: boolean;
  createdAt: string;
}

export interface UserManagementResponse {
  success: boolean;
  users?: BackendUser[];
  message?: string;
}

/**
 * Get users pending approval (admin only)
 */
export async function getPendingUsersFromBackend(): Promise<BackendUser[]> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/pending`);
    
    if (!response.ok) {
      console.error('Failed to fetch pending users:', response.status);
      return [];
    }
    
    const data: UserManagementResponse = await response.json();
    return data.success ? (data.users || []) : [];
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return [];
  }
}

/**
 * Get all approved users (admin only)
 */
export async function getApprovedUsersFromBackend(): Promise<BackendUser[]> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/approved`);
    
    if (!response.ok) {
      console.error('Failed to fetch approved users:', response.status);
      return [];
    }
    
    const data: UserManagementResponse = await response.json();
    return data.success ? (data.users || []) : [];
  } catch (error) {
    console.error('Error fetching approved users:', error);
    return [];
  }
}

/**
 * Approve a pending user (admin only)
 */
export async function approveUserViaBackend(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/${userId}/approve`, {
      method: 'PUT'
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error approving user:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Reject/delete a user (admin only)
 */
export async function rejectUserViaBackend(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error rejecting user:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Change user role (admin only)
 */
export async function changeUserRoleViaBackend(
  userId: string, 
  role: 'free' | 'plus' | 'contributor' | 'admin'
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error changing user role:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Test if user management endpoints are available
 */
export async function testUserManagementEndpoints(): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_CONFIG.BASE_URL}/api/admin/users/pending`);
    return response.status !== 404;
  } catch (error) {
    console.error('User management endpoints test failed:', error);
    return false;
  }
}