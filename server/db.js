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

  return db;
}

function initSchema() {
  db.exec('\
    CREATE TABLE IF NOT EXISTS documents (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      file_path TEXT UNIQUE NOT NULL,\
      file_name TEXT NOT NULL,\
      file_type TEXT NOT NULL,\
      file_size INTEGER NOT NULL,\
      page_count INTEGER DEFAULT 0,\
      parent_folder TEXT NOT NULL DEFAULT \'\',\
      file_hash TEXT,\
      thumbnail_generated INTEGER DEFAULT 0,\
      created_at TEXT DEFAULT (datetime(\'now\')),\
      updated_at TEXT DEFAULT (datetime(\'now\'))\
    );\
    \
    CREATE TABLE IF NOT EXISTS devices (\
      id TEXT PRIMARY KEY,\
      ip_address TEXT,\
      user_agent TEXT,\
      last_seen_at TEXT DEFAULT (datetime(\'now\'))\
    );\
    \
    CREATE TABLE IF NOT EXISTS reading_progress (\
      device_id TEXT NOT NULL,\
      document_id INTEGER NOT NULL,\
      current_page INTEGER NOT NULL DEFAULT 1,\
      last_read_at TEXT DEFAULT (datetime(\'now\')),\
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
      updated_at TEXT DEFAULT (datetime(\'now\')),\
      PRIMARY KEY (device_id, setting_key),\
      FOREIGN KEY (device_id) REFERENCES devices(id)\
    );\
  ');
}

module.exports = { getDb };
