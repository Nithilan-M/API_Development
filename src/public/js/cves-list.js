const state = {
  page: 1,
  limit: 10,
  totalPages: 1,
  totalRecords: 0,
  sortBy: "lastModified",
  sortOrder: "desc",
  filters: {},
};

const elements = {
  tableBody: document.getElementById("cveTableBody"),
  totalRecords: document.getElementById("totalRecords"),
  pageInfo: document.getElementById("pageInfo"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  limitSelect: document.getElementById("limitSelect"),
  sortBySelect: document.getElementById("sortBySelect"),
  sortOrderSelect: document.getElementById("sortOrderSelect"),
  filterForm: document.getElementById("filterForm"),
  resetBtn: document.getElementById("resetBtn"),
  runSyncBtn: document.getElementById("runSyncBtn"),
  syncStatePill: document.getElementById("syncStatePill"),
  cveIdInput: document.getElementById("cveIdInput"),
  yearInput: document.getElementById("yearInput"),
  scoreInput: document.getElementById("scoreInput"),
  scoreMinInput: document.getElementById("scoreMinInput"),
  scoreMaxInput: document.getElementById("scoreMaxInput"),
  modifiedDaysInput: document.getElementById("modifiedDaysInput"),
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatDate = (isoDate) => {
  if (!isoDate) {
    return "NA";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "NA";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatScore = (score) => (Number.isFinite(score) ? score.toFixed(1) : "NA");

const setLoadingState = () => {
  elements.tableBody.innerHTML = `<tr class="loading"><td colspan="6">Loading CVE records...</td></tr>`;
};

const setErrorState = (message) => {
  elements.tableBody.innerHTML = `<tr class="empty"><td colspan="6">${escapeHtml(message)}</td></tr>`;
};

const renderRows = (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    elements.tableBody.innerHTML = `<tr class="empty"><td colspan="6">No CVE records match this filter.</td></tr>`;
    return;
  }

  const html = records
    .map(
      (record) => `
        <tr class="is-clickable" data-id="${escapeHtml(record.cveId)}">
          <td>${escapeHtml(record.cveId)}</td>
          <td>${escapeHtml(record.sourceIdentifier || "unknown")}</td>
          <td>${escapeHtml(formatDate(record.publishedAt))}</td>
          <td>${escapeHtml(formatDate(record.lastModifiedAt))}</td>
          <td>${escapeHtml(formatScore(record.baseScore))}</td>
          <td>${escapeHtml(record.vulnStatus || "unknown")}</td>
        </tr>
      `
    )
    .join("");

  elements.tableBody.innerHTML = html;
};

const updatePaginationUI = () => {
  elements.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
  elements.prevPageBtn.disabled = state.page <= 1;
  elements.nextPageBtn.disabled = state.page >= state.totalPages;
};

const buildQuery = () => {
  const query = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });

  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  }

  return query;
};

const loadRecords = async () => {
  setLoadingState();

  const query = buildQuery();
  const response = await fetch(`/api/cves?${query.toString()}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(payload.message || "Unable to load CVE records");
  }

  const payload = await response.json();

  state.totalPages = payload.totalPages || 1;
  state.totalRecords = payload.totalRecords || 0;

  elements.totalRecords.textContent = String(state.totalRecords);

  if (state.page > state.totalPages) {
    state.page = state.totalPages;
    return loadRecords();
  }

  renderRows(payload.records);
  updatePaginationUI();
};

const updateSyncPill = (label, type = "") => {
  elements.syncStatePill.textContent = label;
  elements.syncStatePill.className = `pill ${type}`.trim();
};

const loadSyncState = async () => {
  try {
    const response = await fetch("/api/sync/state");
    if (!response.ok) {
      throw new Error("Sync state unavailable");
    }

    const statePayload = await response.json();

    if (statePayload.inProgress) {
      updateSyncPill("Sync status: running", "warn");
      return;
    }

    if (statePayload.last_run_status === "failed") {
      updateSyncPill("Sync status: failed", "error");
      return;
    }

    const lastSync = statePayload.last_successful_sync
      ? new Date(statePayload.last_successful_sync).toLocaleString()
      : "never";
    updateSyncPill(`Sync status: idle (last successful: ${lastSync})`, "ok");
  } catch (_error) {
    updateSyncPill("Sync status: unavailable", "error");
  }
};

const triggerIncrementalSync = async () => {
  elements.runSyncBtn.disabled = true;
  updateSyncPill("Sync status: running", "warn");

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "incremental" }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: "Sync failed" }));
      throw new Error(payload.message || "Sync failed");
    }

    await loadSyncState();
    await loadRecords();
  } catch (error) {
    updateSyncPill(`Sync status: ${error.message}`, "error");
  } finally {
    elements.runSyncBtn.disabled = false;
  }
};

const bindEvents = () => {
  elements.tableBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) {
      return;
    }

    const cveId = row.getAttribute("data-id");
    if (!cveId) {
      return;
    }

    window.location.href = `/cves/${encodeURIComponent(cveId)}`;
  });

  elements.prevPageBtn.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadRecords().catch((error) => setErrorState(error.message));
    }
  });

  elements.nextPageBtn.addEventListener("click", () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadRecords().catch((error) => setErrorState(error.message));
    }
  });

  elements.limitSelect.addEventListener("change", () => {
    state.limit = Number.parseInt(elements.limitSelect.value, 10);
    state.page = 1;
    loadRecords().catch((error) => setErrorState(error.message));
  });

  elements.sortBySelect.addEventListener("change", () => {
    state.sortBy = elements.sortBySelect.value;
    state.page = 1;
    loadRecords().catch((error) => setErrorState(error.message));
  });

  elements.sortOrderSelect.addEventListener("change", () => {
    state.sortOrder = elements.sortOrderSelect.value;
    state.page = 1;
    loadRecords().catch((error) => setErrorState(error.message));
  });

  elements.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextFilters = {
      cveId: elements.cveIdInput.value.trim() || undefined,
      year: toNumberOrUndefined(elements.yearInput.value),
      score: toNumberOrUndefined(elements.scoreInput.value),
      scoreMin: toNumberOrUndefined(elements.scoreMinInput.value),
      scoreMax: toNumberOrUndefined(elements.scoreMaxInput.value),
      modifiedWithinDays: toNumberOrUndefined(elements.modifiedDaysInput.value),
    };

    state.filters = nextFilters;
    state.page = 1;
    loadRecords().catch((error) => setErrorState(error.message));
  });

  elements.resetBtn.addEventListener("click", () => {
    elements.filterForm.reset();
    state.filters = {};
    state.page = 1;
    loadRecords().catch((error) => setErrorState(error.message));
  });

  elements.runSyncBtn.addEventListener("click", () => {
    triggerIncrementalSync();
  });
};

const init = async () => {
  bindEvents();
  await loadSyncState();

  try {
    await loadRecords();
  } catch (error) {
    setErrorState(error.message);
  }

  setInterval(() => {
    loadSyncState();
  }, 30000);
};

init();
