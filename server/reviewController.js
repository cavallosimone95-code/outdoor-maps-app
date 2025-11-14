import { runAsync, getAsync, allAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new review
export async function createReview(db, userId, reviewData) {
  const { trackId, rating, comment, trailCondition } = reviewData;

  if (!trackId || rating === undefined) {
    return { success: false, message: 'Missing required fields (trackId, rating)' };
  }

  if (rating < 1 || rating > 5) {
    return { success: false, message: 'Rating must be between 1 and 5' };
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      db,
      `INSERT INTO reviews (
        id, trackId, userId, rating, comment, trailCondition, 
        date, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, trackId, userId, rating, comment || '', trailCondition || 'good',
        now, now
      ]
    );

    return { 
      success: true, 
      message: 'Review created successfully',
      reviewId: id 
    };
  } catch (err) {
    console.error('Create review error:', err);
    return { success: false, message: 'Error creating review' };
  }
}

// Get review by ID
export async function getReview(db, reviewId) {
  try {
    const review = await getAsync(
      db,
      'SELECT * FROM reviews WHERE id = ?',
      [reviewId]
    );
    
    return review || null;
  } catch (err) {
    console.error('Get review error:', err);
    return null;
  }
}

// Get all reviews for a track
export async function getTrackReviews(db, trackId) {
  try {
    const reviews = await allAsync(
      db,
      `SELECT r.*, u.username, u.firstName, u.lastName, u.profilePhoto 
       FROM reviews r 
       JOIN users u ON r.userId = u.id 
       WHERE r.trackId = ? 
       ORDER BY r.createdAt DESC`,
      [trackId]
    );
    
    return reviews;
  } catch (err) {
    console.error('Get track reviews error:', err);
    return [];
  }
}

// Get user's reviews
export async function getUserReviews(db, userId) {
  try {
    const reviews = await allAsync(
      db,
      `SELECT r.*, t.name as trackName 
       FROM reviews r 
       JOIN tracks t ON r.trackId = t.id 
       WHERE r.userId = ? 
       ORDER BY r.createdAt DESC`,
      [userId]
    );
    
    return reviews;
  } catch (err) {
    console.error('Get user reviews error:', err);
    return [];
  }
}

// Update review
export async function updateReview(db, reviewId, userId, updateData) {
  try {
    // Check if user owns the review
    const review = await getAsync(
      db,
      'SELECT * FROM reviews WHERE id = ? AND userId = ?',
      [reviewId, userId]
    );
    
    if (!review) {
      return { success: false, message: 'Review not found or unauthorized' };
    }

    const now = new Date().toISOString();
    const { rating, comment, trailCondition } = updateData;

    let updateQuery = 'UPDATE reviews SET ';
    let params = [];
    const updates = [];

    if (rating !== undefined) { 
      if (rating < 1 || rating > 5) {
        return { success: false, message: 'Rating must be between 1 and 5' };
      }
      updates.push('rating = ?'); 
      params.push(rating); 
    }
    if (comment !== undefined) { updates.push('comment = ?'); params.push(comment); }
    if (trailCondition !== undefined) { updates.push('trailCondition = ?'); params.push(trailCondition); }

    if (updates.length === 0) {
      return { success: true, message: 'No updates provided' };
    }

    updates.push('date = ?');
    params.push(now);
    params.push(reviewId);
    params.push(userId);

    updateQuery += updates.join(', ') + ' WHERE id = ? AND userId = ?';

    await runAsync(db, updateQuery, params);

    return { success: true, message: 'Review updated' };
  } catch (err) {
    console.error('Update review error:', err);
    return { success: false, message: 'Error updating review' };
  }
}

// Delete review
export async function deleteReview(db, reviewId, userId) {
  try {
    // Check if user owns the review
    const review = await getAsync(
      db,
      'SELECT * FROM reviews WHERE id = ? AND userId = ?',
      [reviewId, userId]
    );
    
    if (!review) {
      return { success: false, message: 'Review not found or unauthorized' };
    }

    await runAsync(
      db,
      'DELETE FROM reviews WHERE id = ?',
      [reviewId]
    );

    return { success: true, message: 'Review deleted' };
  } catch (err) {
    console.error('Delete review error:', err);
    return { success: false, message: 'Error deleting review' };
  }
}
