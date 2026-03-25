const db = require("./client");

const upsertStmt = db.prepare(`
  INSERT INTO cve_records (
    cve_id,
    source_identifier,
    published_at,
    last_modified_at,
    vuln_status,
    cvss_v2_score,
    cvss_v3_score,
    base_score,
    description,
    metrics_json,
    weaknesses_json,
    configurations_json,
    references_json,
    raw_json,
    updated_at
  )
  VALUES (
    @cveId,
    @sourceIdentifier,
    @publishedAt,
    @lastModifiedAt,
    @vulnStatus,
    @cvssV2Score,
    @cvssV3Score,
    @baseScore,
    @description,
    @metricsJson,
    @weaknessesJson,
    @configurationsJson,
    @referencesJson,
    @rawJson,
    now_iso()
  )
  ON CONFLICT(cve_id)
  DO UPDATE SET
    source_identifier = excluded.source_identifier,
    published_at = excluded.published_at,
    last_modified_at = excluded.last_modified_at,
    vuln_status = excluded.vuln_status,
    cvss_v2_score = excluded.cvss_v2_score,
    cvss_v3_score = excluded.cvss_v3_score,
    base_score = excluded.base_score,
    description = excluded.description,
    metrics_json = excluded.metrics_json,
    weaknesses_json = excluded.weaknesses_json,
    configurations_json = excluded.configurations_json,
    references_json = excluded.references_json,
    raw_json = excluded.raw_json,
    updated_at = now_iso();
`);

const upsertCveBatchTx = db.transaction((records) => {
  let upserted = 0;

  for (const record of records) {
    upsertStmt.run(record);
    upserted += 1;
  }

  return upserted;
});

const parseJsonSafe = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const mapRow = (row) => ({
  cveId: row.cve_id,
  sourceIdentifier: row.source_identifier,
  publishedAt: row.published_at,
  lastModifiedAt: row.last_modified_at,
  vulnStatus: row.vuln_status,
  cvssV2Score: row.cvss_v2_score,
  cvssV3Score: row.cvss_v3_score,
  baseScore: row.base_score,
  description: row.description,
  metrics: parseJsonSafe(row.metrics_json),
  weaknesses: parseJsonSafe(row.weaknesses_json),
  configurations: parseJsonSafe(row.configurations_json),
  references: parseJsonSafe(row.references_json),
  raw: parseJsonSafe(row.raw_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildWhereClause = (filters) => {
  const clauses = [];
  const params = [];

  if (filters.cveId) {
    clauses.push("cve_id LIKE ?");
    params.push(`%${filters.cveId.trim()}%`);
  }

  if (filters.year) {
    clauses.push("cve_id LIKE ?");
    params.push(`CVE-${filters.year}-%`);
  }

  if (typeof filters.score === "number") {
    clauses.push("base_score = ?");
    params.push(filters.score);
  }

  if (typeof filters.scoreMin === "number") {
    clauses.push("base_score >= ?");
    params.push(filters.scoreMin);
  }

  if (typeof filters.scoreMax === "number") {
    clauses.push("base_score <= ?");
    params.push(filters.scoreMax);
  }

  if (typeof filters.modifiedWithinDays === "number") {
    clauses.push("datetime(last_modified_at) >= datetime('now', ?)");
    params.push(`-${filters.modifiedWithinDays} days`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
};

const listCves = ({
  page = 1,
  limit = 10,
  cveId,
  year,
  score,
  scoreMin,
  scoreMax,
  modifiedWithinDays,
  sortBy = "lastModified",
  sortOrder = "desc",
}) => {
  const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  const offset = (safePage - 1) * safeLimit;

  const sortColumnMap = {
    published: "published_at",
    lastModified: "last_modified_at",
  };
  const sortColumn = sortColumnMap[sortBy] || sortColumnMap.lastModified;
  const safeSortOrder = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";

  const { whereClause, params } = buildWhereClause({
    cveId,
    year,
    score,
    scoreMin,
    scoreMax,
    modifiedWithinDays,
  });

  const countStmt = db.prepare(`SELECT COUNT(1) AS total FROM cve_records ${whereClause}`);
  const totalRecords = countStmt.get(...params).total;

  const listStmt = db.prepare(`
    SELECT
      cve_id,
      source_identifier,
      published_at,
      last_modified_at,
      vuln_status,
      cvss_v2_score,
      cvss_v3_score,
      base_score,
      description,
      created_at,
      updated_at
    FROM cve_records
    ${whereClause}
    ORDER BY ${sortColumn} ${safeSortOrder}, cve_id ASC
    LIMIT ? OFFSET ?
  `);

  const rows = listStmt.all(...params, safeLimit, offset).map((row) => ({
    cveId: row.cve_id,
    sourceIdentifier: row.source_identifier,
    publishedAt: row.published_at,
    lastModifiedAt: row.last_modified_at,
    vulnStatus: row.vuln_status,
    cvssV2Score: row.cvss_v2_score,
    cvssV3Score: row.cvss_v3_score,
    baseScore: row.base_score,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    page: safePage,
    limit: safeLimit,
    totalRecords,
    totalPages: Math.max(Math.ceil(totalRecords / safeLimit), 1),
    records: rows,
  };
};

const findCveById = (cveId) => {
  const stmt = db.prepare(`
    SELECT
      cve_id,
      source_identifier,
      published_at,
      last_modified_at,
      vuln_status,
      cvss_v2_score,
      cvss_v3_score,
      base_score,
      description,
      metrics_json,
      weaknesses_json,
      configurations_json,
      references_json,
      raw_json,
      created_at,
      updated_at
    FROM cve_records
    WHERE cve_id = ?
    LIMIT 1
  `);

  const row = stmt.get(cveId);
  return row ? mapRow(row) : null;
};

const upsertCveBatch = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    return 0;
  }

  return upsertCveBatchTx(records);
};

const clearAllCves = () => {
  db.prepare("DELETE FROM cve_records").run();
};

const getSyncState = () => {
  return db.prepare("SELECT * FROM sync_state WHERE id = 1").get();
};

const updateSyncState = (partial) => {
  const allowedFields = [
    "last_successful_sync",
    "last_incremental_start",
    "last_incremental_end",
    "last_run_status",
    "last_error",
    "last_full_refresh_at",
    "total_upserted",
  ];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(partial, field)) {
      updates.push(`${field} = ?`);
      values.push(partial[field]);
    }
  }

  if (updates.length === 0) {
    return;
  }

  updates.push("updated_at = now_iso()");

  db.prepare(`UPDATE sync_state SET ${updates.join(", ")} WHERE id = 1`).run(...values);
};

const incrementTotalUpserted = (delta) => {
  db.prepare(
    "UPDATE sync_state SET total_upserted = total_upserted + ?, updated_at = now_iso() WHERE id = 1"
  ).run(delta);
};

module.exports = {
  upsertCveBatch,
  listCves,
  findCveById,
  clearAllCves,
  getSyncState,
  updateSyncState,
  incrementTotalUpserted,
};
