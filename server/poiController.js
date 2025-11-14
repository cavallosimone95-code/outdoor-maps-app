import { runAsync, getAsync, allAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new POI
export async function createPOI(db, userId, poiData) {
  const { name, category, latitude, longitude, description } = poiData;

  if (!name || latitude === undefined || longitude === undefined) {
    return { success: false, message: 'Missing required fields (name, latitude, longitude)' };
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      db,
      `INSERT INTO pois (
        id, userId, name, category, latitude, longitude, 
        description, approved, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, name, category || '', latitude, longitude,
        description || '', 0, now, now
      ]
    );

    return { 
      success: true, 
      message: 'POI created and awaiting approval',
      poiId: id 
    };
  } catch (err) {
    console.error('Create POI error:', err);
    return { success: false, message: 'Error creating POI' };
  }
}

// Get POI by ID
export async function getPOI(db, poiId) {
  try {
    const poi = await getAsync(
      db,
      'SELECT * FROM pois WHERE id = ?',
      [poiId]
    );
    
    return poi || null;
  } catch (err) {
    console.error('Get POI error:', err);
    return null;
  }
}

// Get all approved POIs (public)
export async function getApprovedPOIs(db) {
  try {
    const pois = await allAsync(
      db,
      'SELECT * FROM pois WHERE approved = 1 ORDER BY createdAt DESC'
    );
    
    return pois;
  } catch (err) {
    console.error('Get approved POIs error:', err);
    return [];
  }
}

// Get user's POIs (all, including unapproved)
export async function getUserPOIs(db, userId) {
  try {
    const pois = await allAsync(
      db,
      'SELECT * FROM pois WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
    
    return pois;
  } catch (err) {
    console.error('Get user POIs error:', err);
    return [];
  }
}

// Update POI
export async function updatePOI(db, poiId, userId, updateData) {
  try {
    // Check if user owns the POI
    const poi = await getAsync(
      db,
      'SELECT * FROM pois WHERE id = ? AND userId = ?',
      [poiId, userId]
    );
    
    if (!poi) {
      return { success: false, message: 'POI not found or unauthorized' };
    }

    // If POI is already approved, user cannot modify
    if (poi.approved) {
      return { success: false, message: 'Cannot modify approved POIs. Contact admin.' };
    }

    const now = new Date().toISOString();
    const { name, category, latitude, longitude, description } = updateData;

    let updateQuery = 'UPDATE pois SET ';
    let params = [];
    const updates = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    updates.push('updatedAt = ?');
    params.push(now);
    params.push(poiId);
    params.push(userId);

    updateQuery += updates.join(', ') + ' WHERE id = ? AND userId = ?';

    await runAsync(db, updateQuery, params);

    return { success: true, message: 'POI updated' };
  } catch (err) {
    console.error('Update POI error:', err);
    return { success: false, message: 'Error updating POI' };
  }
}

// Delete POI
export async function deletePOI(db, poiId, userId) {
  try {
    // Check if user owns the POI
    const poi = await getAsync(
      db,
      'SELECT * FROM pois WHERE id = ? AND userId = ?',
      [poiId, userId]
    );
    
    if (!poi) {
      return { success: false, message: 'POI not found or unauthorized' };
    }

    // If POI is approved, user cannot delete
    if (poi.approved) {
      return { success: false, message: 'Cannot delete approved POIs. Contact admin.' };
    }

    await runAsync(
      db,
      'DELETE FROM pois WHERE id = ?',
      [poiId]
    );

    return { success: true, message: 'POI deleted' };
  } catch (err) {
    console.error('Delete POI error:', err);
    return { success: false, message: 'Error deleting POI' };
  }
}

// Get pending POIs for admin approval
export async function getPendingPOIs(db) {
  try {
    const pois = await allAsync(
      db,
      'SELECT p.*, u.username, u.firstName, u.lastName FROM pois p JOIN users u ON p.userId = u.id WHERE p.approved = 0 ORDER BY p.createdAt ASC'
    );
    
    return pois;
  } catch (err) {
    console.error('Get pending POIs error:', err);
    return [];
  }
}

// Approve POI (admin only)
export async function approvePOI(db, poiId, adminId) {
  try {
    const now = new Date().toISOString();

    await runAsync(
      db,
      'UPDATE pois SET approved = 1, approvedAt = ?, approvedBy = ?, updatedAt = ? WHERE id = ?',
      [now, adminId, now, poiId]
    );

    return { success: true, message: 'POI approved' };
  } catch (err) {
    console.error('Approve POI error:', err);
    return { success: false, message: 'Error approving POI' };
  }
}

// Reject POI (admin only)
export async function rejectPOI(db, poiId) {
  try {
    await runAsync(
      db,
      'DELETE FROM pois WHERE id = ? AND approved = 0',
      [poiId]
    );

    return { success: true, message: 'POI rejected and deleted' };
  } catch (err) {
    console.error('Reject POI error:', err);
    return { success: false, message: 'Error rejecting POI' };
  }
}
