import { runAsync, getAsync, allAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new tour
export async function createTour(db, userId, tourData) {
  const { name, description, trackIds, totalLength, difficulty } = tourData;

  if (!name || !trackIds || trackIds.length === 0) {
    return { success: false, message: 'Missing required fields (name, trackIds)' };
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      db,
      `INSERT INTO tours (
        id, userId, name, description, trackIds, 
        totalLength, difficulty, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, name, description || '', JSON.stringify(trackIds),
        totalLength || 0, difficulty || '', now, now
      ]
    );

    return { 
      success: true, 
      message: 'Tour created successfully',
      tourId: id 
    };
  } catch (err) {
    console.error('Create tour error:', err);
    return { success: false, message: 'Error creating tour' };
  }
}

// Get tour by ID
export async function getTour(db, tourId) {
  try {
    const tour = await getAsync(
      db,
      'SELECT * FROM tours WHERE id = ?',
      [tourId]
    );
    
    if (tour) {
      tour.trackIds = JSON.parse(tour.trackIds);
    }
    
    return tour || null;
  } catch (err) {
    console.error('Get tour error:', err);
    return null;
  }
}

// Get all tours
export async function getAllTours(db) {
  try {
    const tours = await allAsync(
      db,
      'SELECT * FROM tours ORDER BY createdAt DESC'
    );
    
    return tours.map(tour => ({
      ...tour,
      trackIds: JSON.parse(tour.trackIds)
    }));
  } catch (err) {
    console.error('Get all tours error:', err);
    return [];
  }
}

// Get user's tours
export async function getUserTours(db, userId) {
  try {
    const tours = await allAsync(
      db,
      'SELECT * FROM tours WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
    
    return tours.map(tour => ({
      ...tour,
      trackIds: JSON.parse(tour.trackIds)
    }));
  } catch (err) {
    console.error('Get user tours error:', err);
    return [];
  }
}

// Update tour
export async function updateTour(db, tourId, userId, updateData) {
  try {
    // Check if user owns the tour
    const tour = await getAsync(
      db,
      'SELECT * FROM tours WHERE id = ? AND userId = ?',
      [tourId, userId]
    );
    
    if (!tour) {
      return { success: false, message: 'Tour not found or unauthorized' };
    }

    const now = new Date().toISOString();
    const { name, description, trackIds, totalLength, difficulty } = updateData;

    let updateQuery = 'UPDATE tours SET ';
    let params = [];
    const updates = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (trackIds !== undefined) { updates.push('trackIds = ?'); params.push(JSON.stringify(trackIds)); }
    if (totalLength !== undefined) { updates.push('totalLength = ?'); params.push(totalLength); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); params.push(difficulty); }

    updates.push('updatedAt = ?');
    params.push(now);
    params.push(tourId);
    params.push(userId);

    updateQuery += updates.join(', ') + ' WHERE id = ? AND userId = ?';

    await runAsync(db, updateQuery, params);

    return { success: true, message: 'Tour updated' };
  } catch (err) {
    console.error('Update tour error:', err);
    return { success: false, message: 'Error updating tour' };
  }
}

// Delete tour
export async function deleteTour(db, tourId, userId) {
  try {
    // Check if user owns the tour
    const tour = await getAsync(
      db,
      'SELECT * FROM tours WHERE id = ? AND userId = ?',
      [tourId, userId]
    );
    
    if (!tour) {
      return { success: false, message: 'Tour not found or unauthorized' };
    }

    await runAsync(
      db,
      'DELETE FROM tours WHERE id = ?',
      [tourId]
    );

    return { success: true, message: 'Tour deleted' };
  } catch (err) {
    console.error('Delete tour error:', err);
    return { success: false, message: 'Error deleting tour' };
  }
}
