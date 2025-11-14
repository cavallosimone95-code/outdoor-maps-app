#!/usr/bin/env node

/**
 * Initialize admin user on backend startup
 * Runs once at startup to ensure admin account exists
 */

import bcryptjs from 'bcryptjs';
import { initDatabase, getAsync, runAsync } from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function initializeAdmin() {
  try {
    console.log('🔧 Checking admin account...');
    
    const db = await initDatabase();
    
    // Check if admin already exists
    const adminExists = await getAsync(db, 'SELECT * FROM users WHERE email = ?', ['admin@singletrack.app']);
    
    if (adminExists) {
      console.log('✅ Admin account already exists');
      return;
    }

    // Hash password
    const password = 'admin123';
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create admin user
    const userId = uuidv4();
    const now = new Date().toISOString();

    await runAsync(db,
      `INSERT INTO users (
        id, email, username, passwordHash, firstName, lastName, 
        birthDate, role, approved, isBanned, profilePhoto, bio, 
        location, phone, website, instagram, facebook, strava,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 'admin@singletrack.app', 'admin', passwordHash,
        'Admin', 'User', '',
        'admin', 1, 0,
        '', '', '',
        '', '', '',
        '', '', now, now
      ]
    );

    console.log('✅ Admin account created:');
    console.log('   Email: admin@singletrack.app');
    console.log('   Password: admin123');
    console.log('   Role: admin');

  } catch (error) {
    console.error('❌ Error initializing admin:', error.message);
  }
}

initializeAdmin();
