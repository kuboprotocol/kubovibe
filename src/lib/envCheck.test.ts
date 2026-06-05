import { describe, it, expect } from "vitest";
import { checkFrontendEnv } from "./envCheck";

const GOOD = {
  VITE_SUPABASE_URL: "https://realref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJrealtoken.signed.payload",
  VITE_SUPABASE_PROJECT_ID: "realref",
};

describe("checkFrontendEnv", () => {
  it("ok when all required vars are filled with real values", () => {
    const r = checkFrontendEnv(GOOD);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.placeholders).toEqual([]);
  });

  it("reports missing required vars", () => {
    const r = checkFrontendEnv({ ...GOOD, VITE_SUPABASE_URL: "" });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("VITE_SUPABASE_URL");
  });

  it("flags placeholder URL (your-project-ref)", () => {
    const r = checkFrontendEnv({
      ...GOOD,
      VITE_SUPABASE_URL: "https://your-project-ref.supabase.co",
    });
    expect(r.ok).toBe(false);
    expect(r.placeholders).toContain("VITE_SUPABASE_URL");
  });

  it("flags placeholder key (eyJhbGciOiJIUzI1NiIs...)", () => {
    const r = checkFrontendEnv({
      ...GOOD,
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIs...",
    });
    expect(r.ok).toBe(false);
    expect(r.placeholders).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("flags placeholder project id (your-project-ref)", () => {
    const r = checkFrontendEnv({ ...GOOD, VITE_SUPABASE_PROJECT_ID: "your-project-ref" });
    expect(r.ok).toBe(false);
    expect(r.placeholders).toContain("VITE_SUPABASE_PROJECT_ID");
  });

  it("accumulates multiple failures", () => {
    const r = checkFrontendEnv({
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIs...",
      VITE_SUPABASE_PROJECT_ID: "your-project-ref",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["VITE_SUPABASE_URL"]);
    expect(r.placeholders.sort()).toEqual([
      "VITE_SUPABASE_PROJECT_ID",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]);
  });
});
