const cron = require("node-cron");

const config = require("../config/env");
const {
  upsertCveBatch,
  clearAllCves,
  getSyncState,
  updateSyncState,
  incrementTotalUpserted,
} = require("../db/cveRepository");
const { fetchCvePage } = require("./nvdClient");
const { transformNvdVulnerability } = require("./nvdTransformer");
const sleep = require("../utils/sleep");
const logger = require("../utils/logger");

let syncInProgress = false;

const syncFromNvd = async ({ fullRefresh, lastModStartDate, lastModEndDate, maxPages }) => {
  const effectiveMaxPages = Number.isFinite(maxPages)
    ? maxPages
    : Number.isFinite(config.nvdSyncMaxPages)
      ? config.nvdSyncMaxPages
      : 0;

  let startIndex = 0;
  let pageCount = 0;
  let totalResults = 0;
  let totalUpserted = 0;

  if (fullRefresh) {
    clearAllCves();
  }

  while (true) {
    if (effectiveMaxPages > 0 && pageCount >= effectiveMaxPages) {
      logger.log(`Sync reached page cap: ${effectiveMaxPages}`);
      break;
    }

    const payload = await fetchCvePage({
      startIndex,
      resultsPerPage: config.nvdResultsPerPage,
      lastModStartDate,
      lastModEndDate,
    });

    const vulnerabilities = Array.isArray(payload?.vulnerabilities) ? payload.vulnerabilities : [];
    const transformed = vulnerabilities.map(transformNvdVulnerability).filter(Boolean);

    totalUpserted += upsertCveBatch(transformed);
    pageCount += 1;

    totalResults = Number.parseInt(payload?.totalResults, 10) || totalResults;
    const pageResultsPerPage = Number.parseInt(payload?.resultsPerPage, 10) || config.nvdResultsPerPage;
    startIndex += pageResultsPerPage;

    logger.log(
      `Synced page ${pageCount}: fetched ${vulnerabilities.length}, upserted ${transformed.length}`
    );

    const reachedEnd = vulnerabilities.length === 0 || startIndex >= totalResults;
    if (reachedEnd) {
      break;
    }

    await sleep(config.nvdRequestDelayMs);
  }

  return {
    pages: pageCount,
    totalResults,
    upserted: totalUpserted,
  };
};

const guardedSync = async (syncOptions) => {
  if (syncInProgress) {
    return {
      started: false,
      message: "sync already in progress",
    };
  }

  syncInProgress = true;

  const startedAt = new Date().toISOString();
  updateSyncState({
    last_run_status: "running",
    last_error: null,
  });

  try {
    const summary = await syncFromNvd(syncOptions);
    const finishedAt = new Date().toISOString();

    const statusPatch = {
      last_successful_sync: finishedAt,
      last_run_status: "success",
      last_error: null,
    };

    if (syncOptions.fullRefresh) {
      statusPatch.last_full_refresh_at = finishedAt;
    }

    if (syncOptions.lastModStartDate) {
      statusPatch.last_incremental_start = syncOptions.lastModStartDate;
    }

    if (syncOptions.lastModEndDate) {
      statusPatch.last_incremental_end = syncOptions.lastModEndDate;
    }

    updateSyncState(statusPatch);
    incrementTotalUpserted(summary.upserted);

    logger.log(
      `Sync completed. fullRefresh=${syncOptions.fullRefresh} pages=${summary.pages} upserted=${summary.upserted}`
    );

    return {
      started: true,
      startedAt,
      finishedAt,
      ...summary,
    };
  } catch (error) {
    updateSyncState({
      last_run_status: "failed",
      last_error: error.message,
    });
    logger.error("Sync failed", error.message);
    throw error;
  } finally {
    syncInProgress = false;
  }
};

const runFullSync = async ({ maxPages = config.nvdSyncMaxPages } = {}) => {
  return guardedSync({
    fullRefresh: true,
    maxPages,
  });
};

const runIncrementalSync = async ({
  lookbackDays = config.incrementalLookbackDays,
  maxPages = config.nvdSyncMaxPages,
} = {}) => {
  const state = getSyncState();
  const now = new Date();

  const lastSync = state?.last_successful_sync ? new Date(state.last_successful_sync) : null;
  const fallbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const hasValidLastSync = lastSync instanceof Date && !Number.isNaN(lastSync.getTime());
  const startDate = hasValidLastSync ? lastSync : fallbackStart;

  return guardedSync({
    fullRefresh: false,
    lastModStartDate: startDate.toISOString(),
    lastModEndDate: now.toISOString(),
    maxPages,
  });
};

const triggerIncrementalSync = async () => runIncrementalSync();

const startSyncScheduler = () => {
  const task = cron.schedule(config.syncCron, async () => {
    logger.log("Scheduled sync started");
    try {
      await runIncrementalSync();
    } catch (error) {
      logger.error("Scheduled sync failed", error.message);
    }
  });

  logger.log(`Scheduler configured with cron: ${config.syncCron}`);
  return task;
};

const isSyncRunning = () => syncInProgress;

module.exports = {
  runFullSync,
  runIncrementalSync,
  triggerIncrementalSync,
  startSyncScheduler,
  isSyncRunning,
};
