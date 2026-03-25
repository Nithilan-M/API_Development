const config = require("../config/env");
const { initializeSchema } = require("../db/schema");
const { runFullSync } = require("../services/cveSyncService");

(async () => {
  try {
    initializeSchema();
    const summary = await runFullSync({
      maxPages: config.nvdSyncMaxPages,
    });
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
