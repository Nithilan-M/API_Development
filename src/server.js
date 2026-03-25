const app = require("./app");
const config = require("./config/env");
const logger = require("./utils/logger");
const { startSyncScheduler, runIncrementalSync } = require("./services/cveSyncService");

const server = app.listen(config.port, () => {
  logger.log(`Server listening on port ${config.port}`);
});

let scheduler;

if (config.nodeEnv !== "test") {
  scheduler = startSyncScheduler();

  if (config.bootstrapSyncOnStart) {
    runIncrementalSync().catch((error) => {
      logger.error("Bootstrap sync failed", error.message);
    });
  }
}

const shutdown = () => {
  if (scheduler) {
    scheduler.stop();
  }

  server.close(() => {
    logger.log("Server shut down");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
