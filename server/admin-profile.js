import { initDatabase, runAsync } from './db.js';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initialize or update admin account with persistent profile data
 * This runs on server startup to ensure admin exists with saved profile
 */
export async function initializeAdminWithProfile(db) {
  try {
    // Check if admin exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@singletrack.app');
    
    if (!existingAdmin) {
      // Create new admin account
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const saltRounds = 10;
      const passwordHash = await bcryptjs.hash(defaultPassword, saltRounds);
      
      const adminId = uuidv4();
      
      await runAsync(db,
        `INSERT INTO users (
          id, email, username, firstName, lastName, role, approved, passwordHash, createdAt,
          bio, location, phone, website, profilePhoto, instagram, facebook, strava
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId,
          'admin@singletrack.app',
          'admin',
          process.env.ADMIN_FIRST_NAME || 'Admin',
          process.env.ADMIN_LAST_NAME || 'User',
          'admin',
          1,
          passwordHash,
          process.env.ADMIN_BIO || '',
          process.env.ADMIN_LOCATION || '',
          process.env.ADMIN_PHONE || '',
          process.env.ADMIN_WEBSITE || '',
          process.env.ADMIN_PHOTO || '',
          process.env.ADMIN_INSTAGRAM || '',
          process.env.ADMIN_FACEBOOK || '',
          process.env.ADMIN_STRAVA || ''
        ]
      );
      
      console.log('[Init] ✅ Admin account created with profile data');
    } else {
      // Update existing admin profile from environment variables if they exist
      const updates = {};
      let hasUpdates = false;
      
      if (process.env.ADMIN_FIRST_NAME && process.env.ADMIN_FIRST_NAME !== existingAdmin.firstName) {
        updates.firstName = process.env.ADMIN_FIRST_NAME;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_LAST_NAME && process.env.ADMIN_LAST_NAME !== existingAdmin.lastName) {
        updates.lastName = process.env.ADMIN_LAST_NAME;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_BIO && process.env.ADMIN_BIO !== existingAdmin.bio) {
        updates.bio = process.env.ADMIN_BIO;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_LOCATION && process.env.ADMIN_LOCATION !== existingAdmin.location) {
        updates.location = process.env.ADMIN_LOCATION;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_PHONE && process.env.ADMIN_PHONE !== existingAdmin.phone) {
        updates.phone = process.env.ADMIN_PHONE;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_WEBSITE && process.env.ADMIN_WEBSITE !== existingAdmin.website) {
        updates.website = process.env.ADMIN_WEBSITE;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_PHOTO && process.env.ADMIN_PHOTO !== existingAdmin.profilePhoto) {
        updates.profilePhoto = process.env.ADMIN_PHOTO;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_INSTAGRAM && process.env.ADMIN_INSTAGRAM !== existingAdmin.instagram) {
        updates.instagram = process.env.ADMIN_INSTAGRAM;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_FACEBOOK && process.env.ADMIN_FACEBOOK !== existingAdmin.facebook) {
        updates.facebook = process.env.ADMIN_FACEBOOK;
        hasUpdates = true;
      }
      
      if (process.env.ADMIN_STRAVA && process.env.ADMIN_STRAVA !== existingAdmin.strava) {
        updates.strava = process.env.ADMIN_STRAVA;
        hasUpdates = true;
      }
      
      if (hasUpdates) {
        await runAsync(db,
          `UPDATE users 
           SET firstName = ?, lastName = ?, bio = ?, location = ?, phone = ?, website = ?,
               profilePhoto = ?, instagram = ?, facebook = ?, strava = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE email = ?`,
          [
            updates.firstName || existingAdmin.firstName,
            updates.lastName || existingAdmin.lastName,
            updates.bio || existingAdmin.bio,
            updates.location || existingAdmin.location,
            updates.phone || existingAdmin.phone,
            updates.website || existingAdmin.website,
            updates.profilePhoto || existingAdmin.profilePhoto,
            updates.instagram || existingAdmin.instagram,
            updates.facebook || existingAdmin.facebook,
            updates.strava || existingAdmin.strava,
            'admin@singletrack.app'
          ]
        );
        
        console.log('[Init] ✅ Admin profile updated from environment variables');
      } else {
        console.log('[Init] ✅ Admin account exists, no profile updates needed');
      }
    }
    
    return true;
  } catch (err) {
    console.error('[Init] ❌ Admin initialization error:', err);
    return false;
  }
}