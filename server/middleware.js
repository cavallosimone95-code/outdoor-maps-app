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

// Admin middleware that checks JWT and verifies admin role from database
export function adminAuthMiddleware() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    try {
      // Get database instance
      const db = getDatabase();
      
      if (!db) {
        return res.status(500).json({ success: false, message: 'Database not available' });
      }

      // Load full user object from database
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const user = stmt.get(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
      
      req.userId = decoded.userId;
      req.user = user;
      next();
    } catch (err) {
      console.error('Admin auth middleware error:', err);
      return res.status(500).json({ success: false, message: 'Authentication error', debug: err.message });
    }
  };
}
