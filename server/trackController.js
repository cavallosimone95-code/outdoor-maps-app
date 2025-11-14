import { runAsync, getAsync, allAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new track
export async function createTrack(db, userId, trackData) {
  const {
    name,
    description,
    difficulty,
    distance,
    elevationGain,
    elevationLoss,
    minElevation,
    maxElevation,
    points
  } = trackData;

  if (!name || !points) {
    return { success: false, message: 'Missing required fields (name, points)' };
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      db,
      `INSERT INTO tracks (
        id, userId, name, description, difficulty, distance, 
        elevationGain, elevationLoss, minElevation, maxElevation, 
        points, approved, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, name, description || '', difficulty || '', 
        distance || 0, elevationGain || 0, elevationLoss || 0, 
        minElevation || 0, maxElevation || 0,
        JSON.stringify(points), 0, now, now
      ]
    );

    return { 
      success: true, 
      message: 'Track created and awaiting approval',
      trackId: id 
    };
  } catch (err) {
    console.error('Create track error:', err);
    return { success: false, message: 'Error creating track' };
  }
}

// Get track by ID
export async function getTrack(db, trackId) {
  try {
    const track = await getAsync(
      db,
      'SELECT * FROM tracks WHERE id = ?',
      [trackId]
    );
    
    if (track) {
      track.points = JSON.parse(track.points);
    }
    
    return track;
  } catch (err) {
    console.error('Get track error:', err);
    return null;
  }
}

// Get all approved tracks (public)
export async function getApprovedTracks(db) {
  try {
    const tracks = await allAsync(
      db,
      'SELECT * FROM tracks WHERE approved = 1 ORDER BY createdAt DESC'
    );
    
    return tracks.map(track => ({
      ...track,
      points: JSON.parse(track.points)
    }));
  } catch (err) {
    console.error('Get approved tracks error:', err);
    return [];
  }
}

// Get user's tracks (all, including unapproved)
export async function getUserTracks(db, userId) {
  try {
    const tracks = await allAsync(
      db,
      'SELECT * FROM tracks WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
    
    return tracks.map(track => ({
      ...track,
      points: JSON.parse(track.points)
    }));
  } catch (err) {
    console.error('Get user tracks error:', err);
    return [];
  }
}

// Update track
export async function updateTrack(db, trackId, userId, updateData) {
  try {
    // Check if user owns the track
    const track = await getAsync(
      db,
      'SELECT * FROM tracks WHERE id = ? AND userId = ?',
      [trackId, userId]
    );
    
    if (!track) {
      return { success: false, message: 'Track not found or unauthorized' };
    }

    // If track is already approved, user cannot modify critical fields
    if (track.approved) {
      return { success: false, message: 'Cannot modify approved tracks. Contact admin.' };
    }

    const now = new Date().toISOString();
    const { name, description, difficulty, distance, elevationGain, elevationLoss, minElevation, maxElevation, points } = updateData;

    let updateQuery = 'UPDATE tracks SET ';
    let params = [];
    const updates = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (difficulty !== undefined) { updates.push('difficulty = ?'); params.push(difficulty); }
    if (distance !== undefined) { updates.push('distance = ?'); params.push(distance); }
    if (elevationGain !== undefined) { updates.push('elevationGain = ?'); params.push(elevationGain); }
    if (elevationLoss !== undefined) { updates.push('elevationLoss = ?'); params.push(elevationLoss); }
    if (minElevation !== undefined) { updates.push('minElevation = ?'); params.push(minElevation); }
    if (maxElevation !== undefined) { updates.push('maxElevation = ?'); params.push(maxElevation); }
    if (points !== undefined) { updates.push('points = ?'); params.push(JSON.stringify(points)); }

    updates.push('updatedAt = ?');
    params.push(now);
    params.push(trackId);
    params.push(userId);

    updateQuery += updates.join(', ') + ' WHERE id = ? AND userId = ?';

    await runAsync(db, updateQuery, params);

    return { success: true, message: 'Track updated' };
  } catch (err) {
    console.error('Update track error:', err);
    return { success: false, message: 'Error updating track' };
  }
}

// Delete track
export async function deleteTrack(db, trackId, userId) {
  try {
    // Check if user owns the track
    const track = await getAsync(
      db,
      'SELECT * FROM tracks WHERE id = ? AND userId = ?',
      [trackId, userId]
    );
    
    if (!track) {
      return { success: false, message: 'Track not found or unauthorized' };
    }

    // If track is approved, user cannot delete
    if (track.approved) {
      return { success: false, message: 'Cannot delete approved tracks. Contact admin.' };
    }

    await runAsync(
      db,
      'DELETE FROM tracks WHERE id = ?',
      [trackId]
    );

    return { success: true, message: 'Track deleted' };
  } catch (err) {
    console.error('Delete track error:', err);
    return { success: false, message: 'Error deleting track' };
  }
}

// Get pending tracks for admin approval
export async function getPendingTracks(db) {
  try {
    const tracks = await allAsync(
      db,
      'SELECT t.*, u.username, u.firstName, u.lastName FROM tracks t JOIN users u ON t.userId = u.id WHERE t.approved = 0 ORDER BY t.createdAt ASC'
    );
    
    return tracks.map(track => ({
      ...track,
      points: JSON.parse(track.points)
    }));
  } catch (err) {
    console.error('Get pending tracks error:', err);
    return [];
  }
}

// Approve track (admin only)
export async function approveTrack(db, trackId, adminId) {
  try {
    const now = new Date().toISOString();

    await runAsync(
      db,
      'UPDATE tracks SET approved = 1, approvedAt = ?, approvedBy = ?, updatedAt = ? WHERE id = ?',
      [now, adminId, now, trackId]
    );

    return { success: true, message: 'Track approved' };
  } catch (err) {
    console.error('Approve track error:', err);
    return { success: false, message: 'Error approving track' };
  }
}

// Reject track (admin only)
export async function rejectTrack(db, trackId) {
  try {
    await runAsync(
      db,
      'DELETE FROM tracks WHERE id = ? AND approved = 0',
      [trackId]
    );

    return { success: true, message: 'Track rejected and deleted' };
  } catch (err) {
    console.error('Reject track error:', err);
    return { success: false, message: 'Error rejecting track' };
  }
}
