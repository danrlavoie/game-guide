var Database = require('better-sqlite3');
var path = require('path');
var fs = require('fs');
var config = require('./config');

var db = null;

function getDb() {
  if (db) return db;

  // Ensure data directory exists
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

  db = new Database(config.dbPath);

  // Performance settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema();
  migrateSchema();

  return db;
}

function initSchema() {
  db.exec(
    "\
    CREATE TABLE IF NOT EXISTS documents (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      file_path TEXT UNIQUE NOT NULL,\
      file_name TEXT NOT NULL,\
      file_type TEXT NOT NULL,\
      file_size INTEGER NOT NULL,\
      page_count INTEGER DEFAULT NULL,\
      parent_folder TEXT NOT NULL DEFAULT '',\
      file_hash TEXT,\
      file_mtime REAL,\
      thumbnail_generated INTEGER DEFAULT 0,\
      created_at TEXT DEFAULT (datetime('now')),\
      updated_at TEXT DEFAULT (datetime('now'))\
    );\
    \
    CREATE TABLE IF NOT EXISTS devices (\
      id TEXT PRIMARY KEY,\
      ip_address TEXT,\
      user_agent TEXT,\
      last_seen_at TEXT DEFAULT (datetime('now'))\
    );\
    \
    CREATE TABLE IF NOT EXISTS reading_progress (\
      device_id TEXT NOT NULL,\
      document_id INTEGER NOT NULL,\
      current_page INTEGER NOT NULL DEFAULT 1,\
      last_read_at TEXT DEFAULT (datetime('now')),\
      PRIMARY KEY (device_id, document_id),\
      FOREIGN KEY (device_id) REFERENCES devices(id),\
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE\
    );\
    \
    CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_folder);\
    CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(file_name);\
    CREATE INDEX IF NOT EXISTS idx_progress_device ON reading_progress(device_id);\
    CREATE INDEX IF NOT EXISTS idx_progress_last_read ON reading_progress(last_read_at);\
    \
    CREATE TABLE IF NOT EXISTS device_settings (\
      device_id TEXT NOT NULL,\
      setting_key TEXT NOT NULL,\
      setting_value TEXT NOT NULL,\
      updated_at TEXT DEFAULT (datetime('now')),\
      PRIMARY KEY (device_id, setting_key),\
      FOREIGN KEY (device_id) REFERENCES devices(id)\
    );\
    \
    CREATE TABLE IF NOT EXISTS document_settings (\
      device_id TEXT NOT NULL,\
      document_id INTEGER NOT NULL,\
      setting_key TEXT NOT NULL,\
      setting_value TEXT NOT NULL,\
      updated_at TEXT DEFAULT (datetime('now')),\
      PRIMARY KEY (device_id, document_id, setting_key),\
      FOREIGN KEY (device_id) REFERENCES devices(id),\
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE\
    );\
    \
    CREATE TABLE IF NOT EXISTS bookmarks (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      device_id TEXT NOT NULL,\
      document_id INTEGER NOT NULL,\
      page_number INTEGER NOT NULL,\
      label TEXT DEFAULT '',\
      created_at TEXT DEFAULT (datetime('now')),\
      UNIQUE (device_id, document_id, page_number),\
      FOREIGN KEY (device_id) REFERENCES devices(id),\
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE\
    );\
    \
    CREATE TABLE IF NOT EXISTS favorites (\
      device_id TEXT NOT NULL,\
      document_id INTEGER NOT NULL,\
      created_at TEXT DEFAULT (datetime('now')),\
      PRIMARY KEY (device_id, document_id),\
      FOREIGN KEY (device_id) REFERENCES devices(id),\
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE\
    );\
  "
  );
}

function migrateSchema() {
  // Add file_mtime column if missing (migration for existing databases)
  try {
    db.exec('ALTER TABLE documents ADD COLUMN file_mtime REAL');
  } catch (_err) {
    // Column already exists — ignore
  }

  // Convert interrupted documents (page_count=0 with no thumbnail) to NULL
  // so the scanner picks them up for background processing on next startup
  db.exec(
    'UPDATE documents SET page_count = NULL WHERE page_count = 0 AND thumbnail_generated = 0'
  );
}

module.exports = { getDb };
