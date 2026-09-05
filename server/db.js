"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

// Everything mutable lives OUTSIDE the web root, so a deploy that
// mirrors the repo into /var/www can never wipe the database or
// the uploaded images.
const DATA_DIR = process.env.AK_DATA_DIR || "/var/lib/aurakingdom";
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "aurakingdom.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'UPDATE',
    excerpt     TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    image       TEXT,
    published   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_published
    ON posts (published, created_at DESC);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

/** Read a settings row, or null. */
function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

/**
 * The cookie-signing secret. Generated once and kept in the database,
 * so restarting the service does not log the admin out.
 */
function getSessionSecret() {
  let secret = getSetting("session_secret");
  if (!secret) {
    secret = crypto.randomBytes(48).toString("hex");
    setSetting("session_secret", secret);
  }
  return secret;
}

module.exports = { db, getSetting, setSetting, getSessionSecret, DATA_DIR, UPLOAD_DIR };
