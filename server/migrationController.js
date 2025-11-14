import bcryptjs from 'bcryptjs';
import { runAsync, getAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Migrate users from legacy format to SQLite database
 * This is a one-time migration for existing users who have localStorage data
 */
export async function migrateUsersFromLocalStorage(db, users) {
  if (!Array.isArray(users) || users.length === 0) {
    return { success: false, message: 'No users to migrate' };
  }

  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const user of users) {
    try {
      // Check if user already exists
      const existing = await getAsync(
        db,
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [user.email, user.username]
      );

      if (existing) {
        skipped++;
        console.log(`⏭️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Validate required fields
      if (!user.email || !user.username || !user.password) {
        errors.push(`Invalid user data: ${user.email}`);
        continue;
      }

      // Hash the password (if not already hashed)
      let passwordHash;
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        // Already hashed
        passwordHash = user.password;
      } else {
        // Hash it
        passwordHash = await bcryptjs.hash(user.password, 10);
      }

      // Generate UUID for user
      const userId = uuidv4();
      const now = new Date().toISOString();

      // Insert user into database
      await runAsync(
        db,
        `INSERT INTO users (
          id, email, username, passwordHash, firstName, lastName, 
          birthDate, role, approved, isBanned, profilePhoto, bio, 
          location, phone, website, instagram, facebook, strava,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, user.email, user.username, passwordHash,
          user.firstName || '', user.lastName || '', user.birthDate || '',
          user.role || 'free', user.approved ? 1 : 0, user.isBanned ? 1 : 0,
          user.profilePhoto || '', user.bio || '', user.location || '',
          user.phone || '', user.website || '', user.instagram || '',
          user.facebook || '', user.strava || '', now, now
        ]
      );

      migrated++;
      console.log(`✅ Migrated user: ${user.email}`);
    } catch (err) {
      errors.push(`Error migrating ${user.email}: ${err.message}`);
      console.error(`❌ Error migrating user ${user.email}:`, err);
    }
  }

  return {
    success: true,
    message: `Migration completed: ${migrated} users migrated, ${skipped} skipped`,
    migrated,
    skipped,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get all users from database (for export/backup)
 */
export async function getAllUsers(db) {
  try {
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY createdAt DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return users.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      approved: !!u.approved,
      isBanned: !!u.isBanned,
      createdAt: u.createdAt
    }));
  } catch (err) {
    console.error('Get all users error:', err);
    return [];
  }
}

/**
 * Check if user exists and return info (for duplicate prevention)
 */
export async function userExists(db, email, username) {
  try {
    const user = await getAsync(
      db,
      'SELECT id, email, username FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    return user || null;
  } catch (err) {
    console.error('User exists check error:', err);
    return null;
  }
}
