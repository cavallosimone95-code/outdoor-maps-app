import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase, getDatabase } from './db.js';
import { authMiddleware, optionalAuthMiddleware } from './middleware.js';
import { register, login, refreshAccessToken, changePassword, getCurrentUser, updateUserProfile } from './authController.js';

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

// ============ HEALTH CHECK ============

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
