import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Database file path - shared with Python scraper
const dbPath = path.join(process.cwd(), 'scraper', 'data', 'listings.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection with retry logic for concurrent access
let sqlite: Database.Database;

try {
  sqlite = new Database(dbPath);
  // Enable WAL mode for better concurrent access
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
} catch (error) {
  // If database is locked, wait and retry
  console.warn('Database locked, retrying...');
  setTimeout(() => {
    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('busy_timeout = 5000');
  }, 100);
  sqlite = new Database(dbPath);
}

// Export drizzle instance
export const db = drizzle(sqlite, { schema });

// Export schema for use in other files
export * from './schema';
