import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the local database export
const localBackupPath = path.join(__dirname, '..', 'database-export-2025-11-14.json');

if (!fs.existsSync(localBackupPath)) {
  console.error(`❌ Local backup file not found: ${localBackupPath}`);
  process.exit(1);
}

console.log('📖 Reading local backup...');
const localData = JSON.parse(fs.readFileSync(localBackupPath, 'utf8'));

// Transform to our backup format
const backup = {
  timestamp: new Date().toISOString(),
  version: '1.0',
  source: 'local-migration',
  data: {}
};

// Map local data structure to our format
if (localData.database?.users) {
  backup.data.users = localData.database.users;
  console.log(`✅ Found ${localData.database.users.length} users`);
}

if (localData.database?.tracks) {
  backup.data.tracks = localData.database.tracks;
  console.log(`✅ Found ${localData.database.tracks.length} tracks`);
}

if (localData.database?.pois) {
  backup.data.pois = localData.database.pois;
  console.log(`✅ Found ${localData.database.pois.length} POIs`);
}

if (localData.database?.tours) {
  backup.data.tours = localData.database.tours;
  console.log(`✅ Found ${localData.database.tours.length} tours`);
}

if (localData.database?.reviews) {
  backup.data.reviews = localData.database.reviews;
  console.log(`✅ Found ${localData.database.reviews.length} reviews`);
}

// Ensure we have empty arrays for missing tables
const tables = ['users', 'tracks', 'pois', 'tours', 'reviews', 'sessions'];
for (const table of tables) {
  if (!backup.data[table]) {
    backup.data[table] = [];
  }
}

// Save to upload-ready format
const uploadPath = path.join(__dirname, 'upload-backup.json');
fs.writeFileSync(uploadPath, JSON.stringify(backup, null, 2));

console.log(`💾 Upload-ready backup saved to: ${uploadPath}`);
console.log('📤 You can now upload this to the production server via /api/backup/import');
console.log('\n📋 Summary:');
Object.entries(backup.data).forEach(([table, records]) => {
  console.log(`  ${table}: ${records.length} records`);
});

// Also create a curl command for easy upload
const curlCommand = `curl -X POST https://singletrack-backend.onrender.com/api/backup/import \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -d @${uploadPath}`;

console.log('\n🚀 Upload command:');
console.log(curlCommand);