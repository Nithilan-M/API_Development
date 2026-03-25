const { transformNvdVulnerability } = require("../src/services/nvdTransformer");

describe("nvdTransformer", () => {
  it("transforms valid NVD vulnerability payload", () => {
    const payload = {
      cve: {
        id: "CVE-2024-9999",
        sourceIdentifier: "security@example.org",
        published: "2024-10-01T12:00:00.000",
        lastModified: "2024-10-02T12:00:00.000",
        vulnStatus: "Analyzed",
        descriptions: [{ lang: "en", value: "Test description" }],
        metrics: {
          cvssMetricV2: [{ cvssData: { baseScore: 5.0 } }],
          cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }],
        },
      },
    };

    const transformed = transformNvdVulnerability(payload);

    expect(transformed.cveId).toBe("CVE-2024-9999");
    expect(transformed.cvssV2Score).toBe(5.0);
    expect(transformed.cvssV3Score).toBe(9.8);
    expect(transformed.baseScore).toBe(9.8);
    expect(transformed.description).toBe("Test description");
  });

  it("returns null for invalid date values", () => {
    const payload = {
      cve: {
        id: "CVE-2024-1234",
        published: "invalid-date",
        lastModified: "invalid-date",
        descriptions: [],
      },
    };

    const transformed = transformNvdVulnerability(payload);
    expect(transformed).toBeNull();
  });
});
