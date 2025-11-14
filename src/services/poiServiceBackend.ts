import { apiFetch } from '../utils/apiConfig';

// Create a new POI
export async function createPOIViaBackend(poiData: any) {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/pois', {
      method: 'POST',
      body: JSON.stringify(poiData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error creating POI' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Create POI error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Get all approved POIs (public)
export async function getApprovedPOIsFromBackend() {
  try {
    const response = await fetch('https://singletrack-backend.onrender.com/api/pois/approved');

    if (!response.ok) {
      throw new Error('Failed to fetch POIs');
    }

    const data = await response.json();
    return data.pois || [];
  } catch (err) {
    console.error('Get approved POIs error:', err);
    return [];
  }
}

// Get user's POIs
export async function getUserPOIsFromBackend() {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/pois/user');

    if (!response.ok) {
      throw new Error('Failed to fetch user POIs');
    }

    const data = await response.json();
    return data.pois || [];
  } catch (err) {
    console.error('Get user POIs error:', err);
    return [];
  }
}

// Get POI by ID
export async function getPOIFromBackend(poiId: string) {
  try {
    const response = await fetch(`https://singletrack-backend.onrender.com/api/pois/${poiId}`);

    if (!response.ok) {
      throw new Error('POI not found');
    }

    const data = await response.json();
    return data.poi || null;
  } catch (err) {
    console.error('Get POI error:', err);
    return null;
  }
}

// Update POI
export async function updatePOIViaBackend(poiId: string, updateData: any) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/pois/${poiId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error updating POI' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Update POI error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Delete POI
export async function deletePOIViaBackend(poiId: string) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/pois/${poiId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error deleting POI' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Delete POI error:', err);
    return { success: false, message: 'Network error' };
  }
}
