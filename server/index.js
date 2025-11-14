import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './db.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware.js';
import { register, login, refreshAccessToken, changePassword, getCurrentUser, updateUserProfile } from './authController.js';
import { createTrack, getTrack, getApprovedTracks, getUserTracks, updateTrack, deleteTrack, getPendingTracks, approveTrack, rejectTrack } from './trackController.js';
import { createPOI, getPOI, getApprovedPOIs, getUserPOIs, updatePOI, deletePOI, getPendingPOIs, approvePOI, rejectPOI } from './poiController.js';
import { createTour, getTour, getAllTours, getUserTours, updateTour, deleteTour } from './tourController.js';
import { createReview, getReview, getTrackReviews, getUserReviews, updateReview, deleteReview } from './reviewController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: CORS_ORIGIN,
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ SERVER STARTUP ============

async function startServer() {
  try {
    console.log('🚀 Initializing database...');
    db = await initDatabase();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
