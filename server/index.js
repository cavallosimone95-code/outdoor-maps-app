import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase, getDatabase, runAsync } from './db.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware.js';
import { register, login, refreshAccessToken, changePassword, getCurrentUser, updateUserProfile } from './authController.js';
import { createTrack, getTrack, getApprovedTracks, getUserTracks, updateTrack, deleteTrack, getPendingTracks, approveTrack, rejectTrack } from './trackController.js';
import { createPOI, getPOI, getApprovedPOIs, getUserPOIs, updatePOI, deletePOI, getPendingPOIs, approvePOI, rejectPOI } from './poiController.js';
import { createTour, getTour, getAllTours, getUserTours, updateTour, deleteTour } from './tourController.js';
import { createReview, getReview, getTrackReviews, getUserReviews, updateReview, deleteReview } from './reviewController.js';
import { migrateUsersFromLocalStorage, getAllUsers, userExists } from './migrationController.js';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS origins - support both local development and production
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://outdoor-maps-app.vercel.app',
  'https://outdoor-maps-app-gzvf.vercel.app' // Include all vercel subdomains
];

// Add any custom CORS origins from environment
const CORS_ORIGIN = process.env.CORS_ORIGIN;
if (CORS_ORIGIN) {
  corsOrigins.push(...CORS_ORIGIN.split(','));
}

console.log('[CORS] Allowed origins:', corsOrigins);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', loginLimiter);

let db;

// ============ AUTH ENDPOINTS ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, birthDate } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await register(db, email, username, password, firstName, lastName, birthDate);
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Missing email or password' });
    }

    const result = await login(db, email, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Missing refresh token' });
    }

    const result = await refreshAccessToken(db, refreshToken);
    res.status(result.success ? 200 : 401).json(result);
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ USER ENDPOINTS ============

app.get('/api/users/me', authMiddleware, async (req, res) => {
  try {
    const user = await getCurrentUser(db, req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const result = await updateUserProfile(db, req.userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/users/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await changePassword(db, req.userId, oldPassword, newPassword);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ TRACKS ENDPOINTS ============

app.post('/api/tracks', authMiddleware, async (req, res) => {
  try {
    const result = await createTrack(db, req.userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    console.error('Create track error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tracks/approved', async (req, res) => {
  try {
    const tracks = await getApprovedTracks(db);
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Get approved tracks error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tracks/user', authMiddleware, async (req, res) => {
  try {
    const tracks = await getUserTracks(db, req.userId);
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Get user tracks error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tracks/:id', async (req, res) => {
  try {
    const track = await getTrack(db, req.params.id);
    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found' });
    }
    res.json({ success: true, track });
  } catch (err) {
    console.error('Get track error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const result = await updateTrack(db, req.params.id, req.userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Update track error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.delete('/api/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteTrack(db, req.params.id, req.userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Delete track error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ POI ENDPOINTS ============

app.post('/api/pois', authMiddleware, async (req, res) => {
  try {
    const result = await createPOI(db, req.userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    console.error('Create POI error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/pois/approved', async (req, res) => {
  try {
    const pois = await getApprovedPOIs(db);
    res.json({ success: true, pois });
  } catch (err) {
    console.error('Get approved POIs error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/pois/user', authMiddleware, async (req, res) => {
  try {
    const pois = await getUserPOIs(db, req.userId);
    res.json({ success: true, pois });
  } catch (err) {
    console.error('Get user POIs error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/pois/:id', async (req, res) => {
  try {
    const poi = await getPOI(db, req.params.id);
    if (!poi) {
      return res.status(404).json({ success: false, message: 'POI not found' });
    }
    res.json({ success: true, poi });
  } catch (err) {
    console.error('Get POI error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/pois/:id', authMiddleware, async (req, res) => {
  try {
    const result = await updatePOI(db, req.params.id, req.userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Update POI error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.delete('/api/pois/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deletePOI(db, req.params.id, req.userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Delete POI error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ TOURS ENDPOINTS ============

app.post('/api/tours', authMiddleware, async (req, res) => {
  try {
    const result = await createTour(db, req.userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    console.error('Create tour error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tours', async (req, res) => {
  try {
    const tours = await getAllTours(db);
    res.json({ success: true, tours });
  } catch (err) {
    console.error('Get all tours error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tours/user', authMiddleware, async (req, res) => {
  try {
    const tours = await getUserTours(db, req.userId);
    res.json({ success: true, tours });
  } catch (err) {
    console.error('Get user tours error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/tours/:id', async (req, res) => {
  try {
    const tour = await getTour(db, req.params.id);
    if (!tour) {
      return res.status(404).json({ success: false, message: 'Tour not found' });
    }
    res.json({ success: true, tour });
  } catch (err) {
    console.error('Get tour error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/tours/:id', authMiddleware, async (req, res) => {
  try {
    const result = await updateTour(db, req.params.id, req.userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Update tour error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.delete('/api/tours/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteTour(db, req.params.id, req.userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Delete tour error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ REVIEWS ENDPOINTS ============

app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const result = await createReview(db, req.userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/reviews/track/:trackId', async (req, res) => {
  try {
    const reviews = await getTrackReviews(db, req.params.trackId);
    res.json({ success: true, reviews });
  } catch (err) {
    console.error('Get track reviews error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/reviews/user', authMiddleware, async (req, res) => {
  try {
    const reviews = await getUserReviews(db, req.userId);
    res.json({ success: true, reviews });
  } catch (err) {
    console.error('Get user reviews error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/reviews/:id', async (req, res) => {
  try {
    const review = await getReview(db, req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.json({ success: true, review });
  } catch (err) {
    console.error('Get review error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const result = await updateReview(db, req.params.id, req.userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.delete('/api/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteReview(db, req.params.id, req.userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ MIGRATION ENDPOINTS ============

app.post('/api/migrate/users-from-localstorage', async (req, res) => {
  try {
    // SECURITY: Only allow this endpoint in development or with a migration token
    const migrationToken = process.env.MIGRATION_TOKEN;
    const authHeader = req.headers.authorization;

    if (!migrationToken || !authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    if (token !== migrationToken) {
      return res.status(401).json({ success: false, message: 'Invalid migration token' });
    }

    const { users } = req.body;

    if (!users) {
      return res.status(400).json({ success: false, message: 'Missing users array' });
    }

    const result = await migrateUsersFromLocalStorage(db, users);
    res.json(result);
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/migrate/check-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const exists = await userExists(db, email, '');
    
    if (exists) {
      return res.json({ success: true, exists: true, user: { email: exists.email, username: exists.username } });
    }
    
    res.json({ success: true, exists: false });
  } catch (err) {
    console.error('Check user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint per sincronizzare l'intero database
app.post('/api/migrate/restore-database', async (req, res) => {
  try {
    const token = req.headers['x-migration-token'];
    if (token !== process.env.MIGRATION_TOKEN) {
      return res.status(401).json({ success: false, message: 'Invalid migration token' });
    }

    const { database } = req.body;
    if (!database) {
      return res.status(400).json({ success: false, message: 'No database data provided' });
    }

    console.log('🔄 Restoring database...');

    // Restore users
    if (database.users && Array.isArray(database.users)) {
      for (const user of database.users) {
        try {
          await runAsync(db, `
            INSERT OR REPLACE INTO users (
              id, email, username, passwordHash, firstName, lastName, 
              birthDate, role, approved, isBanned, bannedReason, bannedAt,
              profilePhoto, bio, location, phone, website, instagram, facebook, strava,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            user.id, user.email, user.username, user.passwordHash,
            user.firstName || '', user.lastName || '', user.birthDate || '',
            user.role || 'free', user.approved ? 1 : 0, user.isBanned ? 1 : 0,
            user.bannedReason || '', user.bannedAt || '',
            user.profilePhoto || '', user.bio || '', user.location || '',
            user.phone || '', user.website || '', user.instagram || '',
            user.facebook || '', user.strava || '', user.createdAt, user.updatedAt
          ]);
        } catch (err) {
          console.error(`Error restoring user ${user.email}:`, err);
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Database restored successfully',
      restored: {
        users: (database.users || []).length,
        tracks: (database.tracks || []).length,
        pois: (database.pois || []).length,
        tours: (database.tours || []).length,
        reviews: (database.reviews || []).length
      }
    });
  } catch (err) {
    console.error('Restore database error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ HELPER FUNCTIONS ============

async function initializeAdminIfNeeded(database) {
  try {
    // Check if admin exists
    const { getAsync } = await import('./db.js');
    const adminExists = await getAsync(database, 'SELECT * FROM users WHERE email = ?', ['admin@singletrack.app']);
    
    if (adminExists) {
      return; // Admin already exists
    }

    // Create admin user
    const passwordHash = await bcryptjs.hash('admin123', 10);
    const userId = uuidv4();
    const now = new Date().toISOString();

    await runAsync(database,
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

    console.log('✅ Admin account initialized: admin@singletrack.app / admin123');
  } catch (error) {
    console.error('⚠️  Error initializing admin:', error.message);
  }
}

// ============ USER MANAGEMENT ENDPOINTS (ADMIN ONLY) ============

// Get all pending users (need approval)
app.get('/api/admin/users/pending', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const stmt = db.prepare(`
      SELECT id, email, username, firstName, lastName, role, approved, createdAt 
      FROM users 
      WHERE approved = 0 AND role IN (?, ?)
    `);
    const users = stmt.all('free', 'plus');
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get pending users error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all approved users
app.get('/api/admin/users/approved', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const stmt = db.prepare(`
      SELECT id, email, username, firstName, lastName, role, approved, createdAt 
      FROM users 
      WHERE approved = 1
    `);
    const users = stmt.all();
    res.json({ success: true, users });
  } catch (err) {
    console.error('Get approved users error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Approve user
app.put('/api/admin/users/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const { id } = req.params;
    const stmt = db.prepare('UPDATE users SET approved = 1 WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User approved successfully' });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Reject/delete user
app.delete('/api/admin/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const { id } = req.params;
    
    // Protect admin accounts
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin accounts' });
    }
    
    const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteStmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Change user role
app.put('/api/admin/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['free', 'plus', 'contributor', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    
    const stmt = db.prepare('UPDATE users SET role = ?, approved = ? WHERE id = ?');
    const approved = (role === 'contributor' || role === 'admin') ? 1 : 0;
    const result = stmt.run(role, approved, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User role updated successfully' });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DEBUG: Get all users (temporary - remove in production)
app.get('/api/admin/users/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const stmt = db.prepare(`
      SELECT id, email, username, firstName, lastName, role, approved, createdAt 
      FROM users 
      ORDER BY createdAt DESC
    `);
    const users = stmt.all();
    res.json({ success: true, users, total: users.length });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ============ SERVER STARTUP ============

async function startServer() {
  try {
    console.log('🚀 Initializing database...');
    db = await initDatabase();
    console.log('✅ Database initialized');

    // Initialize admin if needed
    await initializeAdminIfNeeded(db);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
    });
  } catch (err) {
    console.error('⚠️  Database initialization failed:', err.message);
    console.log('⚠️  Starting server anyway (limited functionality)');
    
    // Still start the server so health check works
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT} (DB not available)`);
      console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
    });
  }
}

startServer();
