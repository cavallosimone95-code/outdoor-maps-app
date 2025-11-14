import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'singletrack.db');

export function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create tables
      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            firstName TEXT,
            lastName TEXT,
            birthDate TEXT,
            role TEXT DEFAULT 'free',
            approved BOOLEAN DEFAULT 0,
            isBanned BOOLEAN DEFAULT 0,
            bannedReason TEXT,
            bannedAt TEXT,
            profilePhoto TEXT,
            bio TEXT,
            location TEXT,
            phone TEXT,
            website TEXT,
            instagram TEXT,
            facebook TEXT,
            strava TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Tracks table
        db.run(`
          CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            difficulty TEXT,
            distance REAL,
            elevationGain REAL,
            elevationLoss REAL,
            minElevation REAL,
            maxElevation REAL,
            points TEXT NOT NULL,
            approved BOOLEAN DEFAULT 0,
            approvedAt TEXT,
            approvedBy TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
          )
        `);

        // POIs table
        db.run(`
          CREATE TABLE IF NOT EXISTS pois (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            description TEXT,
            approved BOOLEAN DEFAULT 0,
            approvedAt TEXT,
            approvedBy TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
          )
        `);

        // Tours table
        db.run(`
          CREATE TABLE IF NOT EXISTS tours (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            trackIds TEXT,
            totalLength REAL,
            difficulty TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
          )
        `);

        // Reviews table
        db.run(`
          CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            trackId TEXT NOT NULL,
            userId TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            trailCondition TEXT,
            date TEXT DEFAULT CURRENT_TIMESTAMP,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(trackId) REFERENCES tracks(id),
            FOREIGN KEY(userId) REFERENCES users(id)
          )
        `);

        // Sessions table (per refresh tokens)
        db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            refreshToken TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });
    });
  });
}

export function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

export function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
