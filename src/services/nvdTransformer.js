const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const readV2Score = (metrics) => {
  const candidates = metrics?.cvssMetricV2;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const score = Number.parseFloat(candidates[0]?.cvssData?.baseScore);
  return Number.isFinite(score) ? score : null;
};

const readV3Score = (metrics) => {
  const v31 = Array.isArray(metrics?.cvssMetricV31) ? metrics.cvssMetricV31 : [];
  const v30 = Array.isArray(metrics?.cvssMetricV30) ? metrics.cvssMetricV30 : [];
  const all = [...v31, ...v30];

  const scores = all
    .map((entry) => Number.parseFloat(entry?.cvssData?.baseScore))
    .filter((score) => Number.isFinite(score));

  if (scores.length === 0) {
    return null;
  }

  return Math.max(...scores);
};

const readDescription = (descriptions) => {
  if (!Array.isArray(descriptions) || descriptions.length === 0) {
    return "No description available.";
  }

  const english = descriptions.find((entry) => entry?.lang === "en");
  return english?.value || descriptions[0]?.value || "No description available.";
};

const transformNvdVulnerability = (vulnerability) => {
  const cve = vulnerability?.cve;
  if (!cve || !cve.id) {
    return null;
  }

  const publishedAt = toIsoString(cve.published);
  const lastModifiedAt = toIsoString(cve.lastModified);

  if (!publishedAt || !lastModifiedAt) {
    return null;
  }

  const cvssV2Score = readV2Score(cve.metrics);
  const cvssV3Score = readV3Score(cve.metrics);
  const scored = [cvssV2Score, cvssV3Score].filter((score) => Number.isFinite(score));
  const baseScore = scored.length > 0 ? Math.max(...scored) : null;

  return {
    cveId: cve.id,
    sourceIdentifier: cve.sourceIdentifier || "unknown",
    publishedAt,
    lastModifiedAt,
    vulnStatus: cve.vulnStatus || "unknown",
    cvssV2Score,
    cvssV3Score,
    baseScore,
    description: readDescription(cve.descriptions),
    metricsJson: JSON.stringify(cve.metrics || null),
    weaknessesJson: JSON.stringify(cve.weaknesses || []),
    configurationsJson: JSON.stringify(cve.configurations || []),
    referencesJson: JSON.stringify(cve.references || []),
    rawJson: JSON.stringify(cve),
  };
};

module.exports = {
  transformNvdVulnerability,
};
