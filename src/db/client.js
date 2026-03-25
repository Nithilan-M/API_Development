const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const config = require("../config/env");

if (config.dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
}

const db = new Database(config.dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.function("now_iso", () => new Date().toISOString());

module.exports = db;
