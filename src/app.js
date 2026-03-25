const path = require("path");
const express = require("express");

const { initializeSchema } = require("./db/schema");

initializeSchema();

const apiRouter = require("./routes/api");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.redirect("/cves/list");
});

app.get("/cves/list", (_req, res) => {
  res.sendFile(path.join(__dirname, "views", "cves-list.html"));
});

app.get("/cves/:cveId", (_req, res) => {
  res.sendFile(path.join(__dirname, "views", "cve-detail.html"));
});

app.use("/api", apiRouter);

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      message: "API route not found",
    });
  }

  return res.status(404).send("Not found");
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  const message = error.message || "Internal server error";

  res.status(status).json({
    message,
  });
});

module.exports = app;
