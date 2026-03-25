process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.BOOTSTRAP_SYNC_ON_START = "false";

const request = require("supertest");

const app = require("../src/app");
const { clearAllCves, upsertCveBatch } = require("../src/db/cveRepository");

const seedRecords = [
  {
    cveId: "CVE-2024-1111",
    sourceIdentifier: "cve@mitre.org",
    publishedAt: "2024-01-01T00:00:00.000Z",
    lastModifiedAt: "2024-01-10T00:00:00.000Z",
    vulnStatus: "Analyzed",
    cvssV2Score: 4.3,
    cvssV3Score: 8.8,
    baseScore: 8.8,
    description: "Seed record one",
    metricsJson: JSON.stringify({ foo: "bar" }),
    weaknessesJson: JSON.stringify([]),
    configurationsJson: JSON.stringify([]),
    referencesJson: JSON.stringify([]),
    rawJson: JSON.stringify({ id: "CVE-2024-1111" }),
  },
  {
    cveId: "CVE-2023-2222",
    sourceIdentifier: "cve@mitre.org",
    publishedAt: "2023-04-01T00:00:00.000Z",
    lastModifiedAt: "2023-04-02T00:00:00.000Z",
    vulnStatus: "Modified",
    cvssV2Score: 3.1,
    cvssV3Score: 5.5,
    baseScore: 5.5,
    description: "Seed record two",
    metricsJson: JSON.stringify({ foo: "bar" }),
    weaknessesJson: JSON.stringify([]),
    configurationsJson: JSON.stringify([]),
    referencesJson: JSON.stringify([]),
    rawJson: JSON.stringify({ id: "CVE-2023-2222" }),
  },
];

describe("CVE API", () => {
  beforeEach(() => {
    clearAllCves();
    upsertCveBatch(seedRecords);
  });

  it("returns paginated CVEs", async () => {
    const response = await request(app).get("/api/cves").query({ page: 1, limit: 10 });

    expect(response.statusCode).toBe(200);
    expect(response.body.totalRecords).toBe(2);
    expect(response.body.records).toHaveLength(2);
  });

  it("filters CVEs by year", async () => {
    const response = await request(app).get("/api/cves").query({ year: 2024 });

    expect(response.statusCode).toBe(200);
    expect(response.body.records).toHaveLength(1);
    expect(response.body.records[0].cveId).toBe("CVE-2024-1111");
  });

  it("returns CVE detail by ID", async () => {
    const response = await request(app).get("/api/cves/CVE-2024-1111");

    expect(response.statusCode).toBe(200);
    expect(response.body.cveId).toBe("CVE-2024-1111");
  });

  it("returns validation error for invalid score range", async () => {
    const response = await request(app)
      .get("/api/cves")
      .query({ scoreMin: 9.0, scoreMax: 2.0 });

    expect(response.statusCode).toBe(400);
  });
});
