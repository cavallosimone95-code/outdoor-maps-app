import jwt from 'jsonwebtoken';
import { getDatabase } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

export function generateAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

export function generateRefreshToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  req.userId = decoded.userId;
  next();
}

export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.userId = decoded.userId;
    }
  }
  
  next();
}

// Admin middleware that loads full user object
export function adminAuthMiddleware() {
  return async (req, res, next) => {
    console.log('[ADMIN_AUTH] Starting admin auth middleware');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[ADMIN_AUTH] No authorization header');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('[ADMIN_AUTH] Token extracted:', token.substring(0, 50) + '...');
    
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      console.log('[ADMIN_AUTH] Token verification failed');
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    console.log('[ADMIN_AUTH] Token decoded, userId:', decoded.userId);

    try {
      // Get database instance
      const db = getDatabase();
      
      // Check if database is available
      if (!db) {
        console.error('[ADMIN_AUTH] Database is not available');
        return res.status(500).json({ success: false, message: 'Database not available' });
      }

      console.log('[ADMIN_AUTH] Database available, querying user...');
      
      // Load full user object from database
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const user = stmt.get(decoded.userId);
      
      console.log('[ADMIN_AUTH] User query result:', user ? 'found' : 'not found');
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      console.log('[ADMIN_AUTH] User role:', user.role);
      
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
      
      req.userId = decoded.userId;
      req.user = user;
      console.log('[ADMIN_AUTH] Success, proceeding to endpoint');
      next();
    } catch (err) {
      console.error('[ADMIN_AUTH] Admin auth middleware error:', err);
      return res.status(500).json({ success: false, message: 'Authentication error', debug: err.message });
    }
  };
}
