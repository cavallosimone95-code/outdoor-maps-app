import { apiFetch } from '../utils/apiConfig';

// Create a new track
export async function createTrackViaBackend(trackData: any) {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/tracks', {
      method: 'POST',
      body: JSON.stringify(trackData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error creating track' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Create track error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Get all approved tracks (public)
export async function getApprovedTracksFromBackend() {
  try {
    const response = await fetch('https://singletrack-backend.onrender.com/api/tracks/approved');

    if (!response.ok) {
      throw new Error('Failed to fetch tracks');
    }

    const data = await response.json();
    return data.tracks || [];
  } catch (err) {
    console.error('Get approved tracks error:', err);
    return [];
  }
}

// Get user's tracks
export async function getUserTracksFromBackend() {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/tracks/user');

    if (!response.ok) {
      throw new Error('Failed to fetch user tracks');
    }

    const data = await response.json();
    return data.tracks || [];
  } catch (err) {
    console.error('Get user tracks error:', err);
    return [];
  }
}

// Get track by ID
export async function getTrackFromBackend(trackId: string) {
  try {
    const response = await fetch(`https://singletrack-backend.onrender.com/api/tracks/${trackId}`);

    if (!response.ok) {
      throw new Error('Track not found');
    }

    const data = await response.json();
    return data.track || null;
  } catch (err) {
    console.error('Get track error:', err);
    return null;
  }
}

// Update track
export async function updateTrackViaBackend(trackId: string, updateData: any) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/tracks/${trackId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error updating track' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Update track error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Delete track
export async function deleteTrackViaBackend(trackId: string) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/tracks/${trackId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error deleting track' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Delete track error:', err);
    return { success: false, message: 'Network error' };
  }
}
