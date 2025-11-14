import { apiFetch } from '../utils/apiConfig';

// Create a new tour
export async function createTourViaBackend(tourData: any) {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/tours', {
      method: 'POST',
      body: JSON.stringify(tourData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error creating tour' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Create tour error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Get all tours (public)
export async function getAllToursFromBackend() {
  try {
    const response = await fetch('https://singletrack-backend.onrender.com/api/tours');

    if (!response.ok) {
      throw new Error('Failed to fetch tours');
    }

    const data = await response.json();
    return data.tours || [];
  } catch (err) {
    console.error('Get all tours error:', err);
    return [];
  }
}

// Get user's tours
export async function getUserToursFromBackend() {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/tours/user');

    if (!response.ok) {
      throw new Error('Failed to fetch user tours');
    }

    const data = await response.json();
    return data.tours || [];
  } catch (err) {
    console.error('Get user tours error:', err);
    return [];
  }
}

// Get tour by ID
export async function getTourFromBackend(tourId: string) {
  try {
    const response = await fetch(`https://singletrack-backend.onrender.com/api/tours/${tourId}`);

    if (!response.ok) {
      throw new Error('Tour not found');
    }

    const data = await response.json();
    return data.tour || null;
  } catch (err) {
    console.error('Get tour error:', err);
    return null;
  }
}

// Update tour
export async function updateTourViaBackend(tourId: string, updateData: any) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/tours/${tourId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error updating tour' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Update tour error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Delete tour
export async function deleteTourViaBackend(tourId: string) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/tours/${tourId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error deleting tour' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Delete tour error:', err);
    return { success: false, message: 'Network error' };
  }
}
