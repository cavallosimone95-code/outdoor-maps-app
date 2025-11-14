#!/usr/bin/env node

/**
 * Sync Database to Render Backend
 * Sincronizza il database locale al backend su Render
 */

import fs from 'fs';
import path from 'path';

async function main() {
  try {
    console.log('🔄 Syncing database to Render backend...\n');

    // Read the export file
    const exportFile = 'database-export-2025-11-14.json';
    const filePath = path.join(process.cwd(), exportFile);

    if (!fs.existsSync(filePath)) {
      console.error('❌ Export file not found:', exportFile);
      console.log('📝 First run: node server/export-db.js');
      process.exit(1);
    }

    const exportData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const token = process.env.MIGRATION_TOKEN || '61fca8d79bfa9674a062b108d67f9b5fb6edc3e4be6c7a5bb84aa0e2fa3cd120';
    const backendUrl = 'https://singletrack-backend.onrender.com';

    console.log(`📤 Sending database to: ${backendUrl}`);
    console.log(`🔑 Token: ${token.substring(0, 20)}...`);
    console.log('');

    const response = await fetch(`${backendUrl}/api/migrate/restore-database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Migration-Token': token
      },
      body: JSON.stringify(exportData.database)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Sync successful!\n');
      console.log('📊 Restored:');
      console.log(`  Users: ${result.restored.users}`);
      console.log(`  Tracks: ${result.restored.tracks}`);
      console.log(`  POIs: ${result.restored.pois}`);
      console.log(`  Tours: ${result.restored.tours}`);
      console.log(`  Reviews: ${result.restored.reviews}`);
      console.log('\n🎉 Database synchronized to Render!');
      process.exit(0);
    } else {
      console.error('❌ Sync failed:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
