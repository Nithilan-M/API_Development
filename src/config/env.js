const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),
  dbPath: process.env.DB_PATH || path.join(process.cwd(), "data", "cve.db"),
  nvdApiBase:
    process.env.NVD_API_BASE || "https://services.nvd.nist.gov/rest/json/cves/2.0",
  nvdApiKey: process.env.NVD_API_KEY || "",
  nvdResultsPerPage: toInt(process.env.NVD_RESULTS_PER_PAGE, 2000),
  nvdRequestDelayMs: toInt(process.env.NVD_REQUEST_DELAY_MS, 6500),
  nvdSyncMaxPages: toInt(process.env.NVD_SYNC_MAX_PAGES, 0),
  incrementalLookbackDays: toInt(process.env.INCREMENTAL_LOOKBACK_DAYS, 7),
  syncCron: process.env.SYNC_CRON || "0 */6 * * *",
  bootstrapSyncOnStart: (process.env.BOOTSTRAP_SYNC_ON_START || "true") === "true",
};

module.exports = config;
