const config = require("../config/env");
const sleep = require("../utils/sleep");

const buildHeaders = () => {
  const headers = {
    Accept: "application/json",
  };

  if (config.nvdApiKey) {
    headers.apiKey = config.nvdApiKey;
  }

  return headers;
};

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status <= 599);

const fetchWithRetry = async (url, attempts = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(),
      });

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < attempts) {
          const waitMs = 1000 * attempt;
          await sleep(waitMs);
          continue;
        }

        const responseText = await response.text();
        throw new Error(`NVD API error ${response.status}: ${responseText.slice(0, 250)}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const waitMs = 1000 * attempt;
        await sleep(waitMs);
        continue;
      }
    }
  }

  throw lastError;
};

const fetchCvePage = async ({
  startIndex,
  resultsPerPage = config.nvdResultsPerPage,
  lastModStartDate,
  lastModEndDate,
}) => {
  const query = new URLSearchParams({
    startIndex: String(startIndex),
    resultsPerPage: String(resultsPerPage),
  });

  if (lastModStartDate) {
    query.set("lastModStartDate", lastModStartDate);
  }

  if (lastModEndDate) {
    query.set("lastModEndDate", lastModEndDate);
  }

  const url = `${config.nvdApiBase}?${query.toString()}`;
  return fetchWithRetry(url);
};

module.exports = {
  fetchCvePage,
};
