const express = require("express");
const { z } = require("zod");

const { listCves, findCveById, getSyncState } = require("../db/cveRepository");
const {
  runIncrementalSync,
  runFullSync,
  isSyncRunning,
} = require("../services/cveSyncService");

const router = express.Router();

const optionalNumber = ({ min, max, integer = false } = {}) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    (() => {
      let schema = z.number();
      if (integer) {
        schema = schema.int();
      }
      if (typeof min === "number") {
        schema = schema.min(min);
      }
      if (typeof max === "number") {
        schema = schema.max(max);
      }
      return schema.optional();
    })()
  );

const listQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === "" ? 1 : Number(value)),
      z.number().int().min(1)
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === "" ? 10 : Number(value)),
      z.number().int().min(1).max(100)
    ),
    cveId: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null) {
            return undefined;
          }
          const trimmed = String(value).trim();
          return trimmed.length > 0 ? trimmed : undefined;
        },
        z.string().min(3).optional()
      )
      .optional(),
    year: optionalNumber({ min: 1999, max: 2100, integer: true }),
    score: optionalNumber({ min: 0, max: 10 }),
    scoreMin: optionalNumber({ min: 0, max: 10 }),
    scoreMax: optionalNumber({ min: 0, max: 10 }),
    modifiedWithinDays: optionalNumber({ min: 1, max: 3650, integer: true }),
    sortBy: z.enum(["published", "lastModified"]).default("lastModified"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (value) => {
      if (typeof value.scoreMin === "number" && typeof value.scoreMax === "number") {
        return value.scoreMin <= value.scoreMax;
      }
      return true;
    },
    {
      message: "scoreMin must be less than or equal to scoreMax",
      path: ["scoreMin"],
    }
  );

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cve-api",
    timestamp: new Date().toISOString(),
  });
});

router.get("/sync/state", (_req, res) => {
  const state = getSyncState();
  res.json({
    ...state,
    inProgress: isSyncRunning(),
  });
});

router.post("/sync", async (req, res, next) => {
  try {
    const mode = req.body?.mode === "full" ? "full" : "incremental";
    const maxPagesRaw = req.body?.maxPages;
    const maxPages =
      maxPagesRaw === undefined || maxPagesRaw === null || maxPagesRaw === ""
        ? undefined
        : Number.parseInt(maxPagesRaw, 10);

    const summary =
      mode === "full"
        ? await runFullSync({ maxPages })
        : await runIncrementalSync({ maxPages });

    res.json({
      mode,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/cves", (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid query parameters",
      errors: parsed.error.issues,
    });
  }

  const result = listCves(parsed.data);

  return res.json({
    totalRecords: result.totalRecords,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    records: result.records,
    filters: {
      cveId: parsed.data.cveId || null,
      year: parsed.data.year || null,
      score: parsed.data.score || null,
      scoreMin: parsed.data.scoreMin || null,
      scoreMax: parsed.data.scoreMax || null,
      modifiedWithinDays: parsed.data.modifiedWithinDays || null,
      sortBy: parsed.data.sortBy,
      sortOrder: parsed.data.sortOrder,
    },
  });
});

router.get("/cves/:cveId", (req, res) => {
  const cveId = String(req.params.cveId || "").trim().toUpperCase();
  const record = findCveById(cveId);

  if (!record) {
    return res.status(404).json({
      message: `CVE ${cveId} not found`,
    });
  }

  return res.json(record);
});

module.exports = router;
