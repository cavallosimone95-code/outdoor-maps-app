import { apiFetch } from '../utils/apiConfig';

// Create a new review
export async function createReviewViaBackend(reviewData: any) {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error creating review' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Create review error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Get reviews for a track
export async function getTrackReviewsFromBackend(trackId: string) {
  try {
    const response = await fetch(`https://singletrack-backend.onrender.com/api/reviews/track/${trackId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch reviews');
    }

    const data = await response.json();
    return data.reviews || [];
  } catch (err) {
    console.error('Get track reviews error:', err);
    return [];
  }
}

// Get user's reviews
export async function getUserReviewsFromBackend() {
  try {
    const response = await apiFetch('https://singletrack-backend.onrender.com/api/reviews/user');

    if (!response.ok) {
      throw new Error('Failed to fetch user reviews');
    }

    const data = await response.json();
    return data.reviews || [];
  } catch (err) {
    console.error('Get user reviews error:', err);
    return [];
  }
}

// Get review by ID
export async function getReviewFromBackend(reviewId: string) {
  try {
    const response = await fetch(`https://singletrack-backend.onrender.com/api/reviews/${reviewId}`);

    if (!response.ok) {
      throw new Error('Review not found');
    }

    const data = await response.json();
    return data.review || null;
  } catch (err) {
    console.error('Get review error:', err);
    return null;
  }
}

// Update review
export async function updateReviewViaBackend(reviewId: string, updateData: any) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error updating review' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Update review error:', err);
    return { success: false, message: 'Network error' };
  }
}

// Delete review
export async function deleteReviewViaBackend(reviewId: string) {
  try {
    const response = await apiFetch(`https://singletrack-backend.onrender.com/api/reviews/${reviewId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error deleting review' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Delete review error:', err);
    return { success: false, message: 'Network error' };
  }
}
