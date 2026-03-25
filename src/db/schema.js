const db = require("./client");

const initializeSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cve_records (
      cve_id TEXT PRIMARY KEY,
      source_identifier TEXT NOT NULL,
      published_at TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      vuln_status TEXT,
      cvss_v2_score REAL,
      cvss_v3_score REAL,
      base_score REAL,
      description TEXT,
      metrics_json TEXT,
      weaknesses_json TEXT,
      configurations_json TEXT,
      references_json TEXT,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (now_iso()),
      updated_at TEXT NOT NULL DEFAULT (now_iso())
    );

    CREATE INDEX IF NOT EXISTS idx_cve_published_at ON cve_records (published_at);
    CREATE INDEX IF NOT EXISTS idx_cve_last_modified_at ON cve_records (last_modified_at);
    CREATE INDEX IF NOT EXISTS idx_cve_base_score ON cve_records (base_score);

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_successful_sync TEXT,
      last_incremental_start TEXT,
      last_incremental_end TEXT,
      last_run_status TEXT,
      last_error TEXT,
      last_full_refresh_at TEXT,
      total_upserted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (now_iso())
    );

    INSERT OR IGNORE INTO sync_state (id, total_upserted, last_run_status)
    VALUES (1, 0, 'never-ran');
  `);
};

module.exports = {
  initializeSchema,
};
