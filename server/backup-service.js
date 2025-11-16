import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub backup configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'cavallosimone95-code/outdoor-maps-app';
const BACKUP_BRANCH = 'database-backup';

/**
 * Export database to JSON format
 */
export async function exportDatabaseToJSON() {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {}
  };

  // Export all tables
  const tables = ['users', 'tracks', 'pois', 'tours', 'reviews', 'sessions'];
  
  for (const table of tables) {
    try {
      const stmt = db.prepare(`SELECT * FROM ${table}`);
      backup.data[table] = stmt.all();
      console.log(`✅ Exported ${backup.data[table].length} records from ${table}`);
    } catch (err) {
      console.warn(`⚠️ Could not export table ${table}:`, err.message);
      backup.data[table] = [];
    }
  }

  return backup;
}

/**
 * Import database from JSON format
 */
export async function importDatabaseFromJSON(backup) {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not available');
  }

  console.log('🔄 Starting database import...');
  
  // Clear existing data
  const tables = ['sessions', 'reviews', 'tours', 'pois', 'tracks', 'users'];
  for (const table of tables) {
    try {
      const stmt = db.prepare(`DELETE FROM ${table}`);
      stmt.run();
    } catch (err) {
      console.warn(`⚠️ Could not clear table ${table}:`, err.message);
    }
  }

  // Import data
  let totalImported = 0;
  
  for (const [table, records] of Object.entries(backup.data || {})) {
    if (!Array.isArray(records) || records.length === 0) {
      console.log(`⏭️ Skipping empty table ${table}`);
      continue;
    }

    try {
      // Get column names from first record
      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(`
        INSERT INTO ${table} (${columns.join(', ')}) 
        VALUES (${placeholders})
      `);

      for (const record of records) {
        const values = columns.map(col => record[col]);
        stmt.run(...values);
        totalImported++;
      }

      console.log(`✅ Imported ${records.length} records into ${table}`);
    } catch (err) {
      console.error(`❌ Error importing table ${table}:`, err.message);
    }
  }

  console.log(`🎉 Import completed: ${totalImported} total records`);
  return totalImported;
}

/**
 * Save backup to local file
 */
export async function saveBackupToFile(backup, filename = null) {
  const backupDir = path.join(__dirname, 'backups');
  
  // Create backup directory if it doesn't exist
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create backup directory, using temp directory');
  }

  const fileName = filename || `backup-${Date.now()}.json`;
  const filePath = path.join(backupDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup saved to ${filePath}`);
  
  return filePath;
}

/**
 * Load backup from local file
 */
export async function loadBackupFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Automatic backup to GitHub (if configured)
 */
export async function autoBackupToGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⏭️ GitHub backup skipped: no token configured');
    return false;
  }

  try {
    const backup = await exportDatabaseToJSON();
    const backupContent = JSON.stringify(backup, null, 2);
    
    // Save to GitHub via API
    const fileName = `database-backup-${Date.now()}.json`;
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/backups/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Auto backup: ${new Date().toISOString()}`,
        content: Buffer.from(backupContent).toString('base64'),
        branch: BACKUP_BRANCH
      })
    });

    if (response.ok) {
      console.log(`☁️ Backup uploaded to GitHub: ${fileName}`);
      return true;
    } else {
      console.error('GitHub backup failed:', await response.text());
      return false;
    }
  } catch (err) {
    console.error('Auto backup error:', err.message);
    return false;
  }
}

/**
 * Restore from latest GitHub backup
 */
export async function restoreFromGitHub() {
  if (!GITHUB_TOKEN) {
    console.log('⏭️ GitHub restore skipped: no token configured');
    return false;
  }

  try {
    // Get latest backup file from GitHub
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/backups`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    });

    if (!response.ok) {
      console.log('📭 No backups found on GitHub');
      return false;
    }

    const files = await response.json();
    const backupFiles = files
      .filter(file => file.name.startsWith('database-backup-') && file.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Latest first

    if (backupFiles.length === 0) {
      console.log('📭 No database backups found on GitHub');
      return false;
    }

    const latestFile = backupFiles[0];
    console.log(`🔄 Restoring from: ${latestFile.name}`);

    // Download backup content
    const fileResponse = await fetch(latestFile.download_url);
    const backup = await fileResponse.json();

    // Import to database
    await importDatabaseFromJSON(backup);
    
    console.log(`✅ Database restored from GitHub backup: ${latestFile.name}`);
    return true;
  } catch (err) {
    console.error('GitHub restore error:', err.message);
    return false;
  }
}

/**
 * Start automatic backup schedule (every hour)
 */
export function startAutoBackup() {
  // Backup every hour
  const BACKUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  setInterval(async () => {
    try {
      await autoBackupToGitHub();
    } catch (err) {
      console.error('Scheduled backup failed:', err.message);
    }
  }, BACKUP_INTERVAL);

  console.log('🕒 Auto backup scheduled every hour');
}