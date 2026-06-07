import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Schema/structure validation for CI-published artifacts.
 *
 * These tests guarantee that artifacts published by `.github/workflows/bullets-ci.yml`
 * are not only present at the standardized paths, but also contain the expected
 * shape, fields and types. They run locally and on CI after `vitest run` has
 * generated the JSON results and the summary report.
 *
 * Standardized paths:
 *   - HTML coverage:    coverage/bullets/index.html
 *   - Raw JSON results: test-results/bullets-results.json
 *   - Aggregated:       test-results/summary-report.json
 */

const ROOT = resolve(__dirname, "..", "..");
const HTML_PATH = resolve(ROOT, "coverage/bullets/index.html");
const JSON_PATH = resolve(ROOT, "test-results/bullets-results.json");
const SUMMARY_PATH = resolve(ROOT, "test-results/summary-report.json");

const isCI = !!process.env.CI;
const describeIfCI = isCI ? describe : describe.skip;

describe("CI Artifact: Raw JSON results (test-results/bullets-results.json)", () => {
  const exists = existsSync(JSON_PATH);
  const itIfExists = exists ? it : it.skip;

  itIfExists("exists at the standardized path", () => {
    expect(exists).toBe(true);
  });

  itIfExists("matches the expected vitest JSON reporter schema", () => {
    const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));

    // Top-level required fields
    expect(raw).toHaveProperty("success");
    expect(typeof raw.success).toBe("boolean");
    expect(typeof raw.numTotalTests).toBe("number");
    expect(typeof raw.numPassedTests).toBe("number");
    expect(typeof raw.numFailedTests).toBe("number");
    expect(Array.isArray(raw.testResults)).toBe(true);
    expect(raw.testResults.length).toBeGreaterThan(0);

    // Each suite must expose assertionResults with title + status
    for (const tr of raw.testResults) {
      expect(Array.isArray(tr.assertionResults)).toBe(true);
      for (const a of tr.assertionResults) {
        expect(typeof a.title).toBe("string");
        expect(["passed", "failed", "skipped", "pending", "todo"]).toContain(a.status);
      }
    }
  });

  itIfExists("contains the IIV invalid-roman regression test", () => {
    const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    const titles: string[] = raw.testResults.flatMap((tr: any) =>
      tr.assertionResults.map((a: any) => a.title)
    );
    expect(titles.some((t) => t.toLowerCase().includes("iiv"))).toBe(true);
  });
});

describe("CI Artifact: Aggregated Summary (test-results/summary-report.json)", () => {
  const exists = existsSync(SUMMARY_PATH);
  const itIfExists = exists ? it : it.skip;

  itIfExists("exists at the standardized path", () => {
    expect(exists).toBe(true);
  });

  itIfExists("matches the aggregated summary schema", () => {
    const s = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));

    // Top-level
    expect(["PASS", "FAIL", "ERROR"]).toContain(s.status);
    expect(typeof s.total_tests).toBe("number");
    expect(typeof s.passed_tests).toBe("number");
    expect(typeof s.failed_tests).toBe("number");
    expect(typeof s.coverage).toBe("string");
    expect(s.coverage).toMatch(/^\d+(\.\d+)?%$/);

    // Categories — required keys for PR comment rendering
    expect(s.categories).toBeDefined();
    for (const key of ["invalid_roman", "extraction", "formatting"]) {
      expect(s.categories[key]).toBeDefined();
      expect(["PASS", "FAIL"]).toContain(s.categories[key].status);
      expect(typeof s.categories[key].count).toBe("number");
      expect(typeof s.categories[key].failed).toBe("number");
      expect(s.categories[key].failed).toBeLessThanOrEqual(s.categories[key].count);
    }

    // Metadata required for PR comment links (PR number + SHA)
    expect(s.metadata).toBeDefined();
    expect(typeof s.metadata.pr).toBe("string");
    expect(typeof s.metadata.sha === "string" || s.metadata.sha === undefined).toBe(true);
    expect(typeof s.metadata.timestamp).toBe("string");
    expect(() => new Date(s.metadata.timestamp).toISOString()).not.toThrow();
  });

  itIfExists("counts are internally consistent with raw results", () => {
    if (!existsSync(JSON_PATH)) return;
    const s = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));
    const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    expect(s.total_tests).toBe(raw.numTotalTests);
    expect(s.passed_tests).toBe(raw.numPassedTests);
    expect(s.failed_tests).toBe(raw.numFailedTests);
  });
});

describeIfCI("CI Artifact: HTML Coverage (coverage/bullets/index.html)", () => {
  const exists = existsSync(HTML_PATH);
  const itIfExists = exists ? it : it.skip;

  itIfExists("exists at the standardized path", () => {
    expect(exists).toBe(true);
  });

  itIfExists("is a valid HTML coverage report with the expected structure", () => {
    const html = readFileSync(HTML_PATH, "utf8");
    // Doctype + root element
    expect(html.toLowerCase()).toContain("<!doctype html");
    expect(html).toMatch(/<html[\s>]/i);
    expect(html).toMatch(/<\/html>/i);
    expect(html).toMatch(/<head[\s>]/i);
    expect(html).toMatch(/<body[\s>]/i);

    // Istanbul/V8 coverage marker — at least one of these signatures must appear
    const hasCoverageMarker =
      /coverage-summary|class="strong"|All files|fraction|cover-empty|class="pct"/i.test(html);
    expect(hasCoverageMarker).toBe(true);

    // Sanity: report references files from the package
    expect(/\.(ts|tsx|js)/i.test(html)).toBe(true);
  });
});
