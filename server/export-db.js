#!/usr/bin/env node

/**
 * Export Database to JSON
 * Esporta il database SQLite in formato JSON per il backup/restore
 */

import { initDatabase, allAsync } from './db.js';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    console.log('🔄 Export database to JSON...\n');

    const db = await initDatabase();

    // Export all tables
    const users = await allAsync(db, 'SELECT * FROM users');
    const tracks = await allAsync(db, 'SELECT * FROM tracks');
    const pois = await allAsync(db, 'SELECT * FROM pois');
    const tours = await allAsync(db, 'SELECT * FROM tours');
    const reviews = await allAsync(db, 'SELECT * FROM reviews');
    const sessions = await allAsync(db, 'SELECT * FROM sessions');

    const exportData = {
      exportDate: new Date().toISOString(),
      database: {
        users: users || [],
        tracks: tracks || [],
        pois: pois || [],
        tours: tours || [],
        reviews: reviews || [],
        sessions: sessions || []
      },
      summary: {
        usersCount: (users || []).length,
        tracksCount: (tracks || []).length,
        poisCount: (pois || []).length,
        toursCount: (tours || []).length,
        reviewsCount: (reviews || []).length,
        sessionsCount: (sessions || []).length
      }
    };

    // Save to file
    const fileName = `database-export-${new Date().toISOString().split('T')[0]}.json`;
    const filePath = path.join(process.cwd(), fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

    console.log('✅ Database exported successfully!');
    console.log(`📄 File: ${fileName}\n`);
    console.log('📊 Summary:');
    console.log(`  Users: ${exportData.summary.usersCount}`);
    console.log(`  Tracks: ${exportData.summary.tracksCount}`);
    console.log(`  POIs: ${exportData.summary.poisCount}`);
    console.log(`  Tours: ${exportData.summary.toursCount}`);
    console.log(`  Reviews: ${exportData.summary.reviewsCount}`);
    console.log(`  Sessions: ${exportData.summary.sessionsCount}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

main();
