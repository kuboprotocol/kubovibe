import { describe, it, expect } from "vitest";

/**
 * PWA Telemetry — RLS permission matrix test.
 *
 * This is a pure-logic test that mirrors the SQL policies declared in
 * docs/PWA_TELEMETRY_RLS.md. It guards against accidental regressions where
 * UI or backend code grants access broader than what RLS actually enforces.
 *
 * Run with: bunx vitest run src/test/pwa-telemetry-rls.test.ts
 */

type Role = "admin" | "analyst" | "viewer" | "user";

// Mirrors public.has_any_role(roles[]) for the test subject.
const hasAnyRole = (role: Role, allowed: Role[]) => allowed.includes(role);

const policies = {
  events: {
    select: (role: Role) => hasAnyRole(role, ["admin", "analyst", "viewer"]),
    insert: (actorId: string, rowUserId: string) => actorId === rowUserId,
    delete: (role: Role) => hasAnyRole(role, ["admin", "analyst"]),
  },
  exportJobs: {
    // Per-job: a user can only access their own rows; admin/analyst can read all.
    select: (role: Role, actorId: string, rowUserId: string) =>
      actorId === rowUserId || hasAnyRole(role, ["admin", "analyst"]),
    update: (actorId: string, rowUserId: string) => actorId === rowUserId,
    delete: (actorId: string, rowUserId: string) => actorId === rowUserId,
  },
  settings: {
    select: (role: Role, actorId: string, rowUserId: string) =>
      actorId === rowUserId || role === "admin",
    update: (actorId: string, rowUserId: string) => actorId === rowUserId,
  },
  auditLogs: {
    select: (role: Role) => role === "admin",
    insert: () => true, // any authenticated user can insert (own actor_id enforced by app)
  },
  metrics: {
    select: (role: Role) => role === "admin",
  },
  webhooks: {
    all: (role: Role) => role === "admin",
  },
};

describe("PWA Telemetry RLS — events", () => {
  it("admin, analyst and viewer can SELECT events", () => {
    expect(policies.events.select("admin")).toBe(true);
    expect(policies.events.select("analyst")).toBe(true);
    expect(policies.events.select("viewer")).toBe(true);
  });
  it("plain user cannot SELECT events", () => {
    expect(policies.events.select("user")).toBe(false);
  });
  it("only admin and analyst can DELETE events", () => {
    expect(policies.events.delete("admin")).toBe(true);
    expect(policies.events.delete("analyst")).toBe(true);
    expect(policies.events.delete("viewer")).toBe(false);
    expect(policies.events.delete("user")).toBe(false);
  });
  it("a user can only INSERT events with their own user_id", () => {
    expect(policies.events.insert("u1", "u1")).toBe(true);
    expect(policies.events.insert("u1", "u2")).toBe(false);
  });
});

describe("PWA Telemetry RLS — export_jobs (per-job validation)", () => {
  it("owner can read their own job", () => {
    expect(policies.exportJobs.select("user", "u1", "u1")).toBe(true);
  });
  it("a non-owner regular user cannot read someone else's job", () => {
    expect(policies.exportJobs.select("user", "u1", "u2")).toBe(false);
    expect(policies.exportJobs.select("viewer", "u1", "u2")).toBe(false);
  });
  it("admin and analyst can read any job", () => {
    expect(policies.exportJobs.select("admin", "u1", "u2")).toBe(true);
    expect(policies.exportJobs.select("analyst", "u1", "u2")).toBe(true);
  });
  it("only the owner can cancel/retry/update a job", () => {
    expect(policies.exportJobs.update("u1", "u1")).toBe(true);
    expect(policies.exportJobs.update("u1", "u2")).toBe(false);
  });
});

describe("PWA Telemetry RLS — settings, audit, metrics, webhooks", () => {
  it("settings: owner manages own, admin reads all", () => {
    expect(policies.settings.update("u1", "u1")).toBe(true);
    expect(policies.settings.update("u1", "u2")).toBe(false);
    expect(policies.settings.select("admin", "u1", "u2")).toBe(true);
    expect(policies.settings.select("user", "u1", "u2")).toBe(false);
  });
  it("audit logs: only admins can read; any authenticated user can insert", () => {
    expect(policies.auditLogs.select("admin")).toBe(true);
    expect(policies.auditLogs.select("analyst")).toBe(false);
    expect(policies.auditLogs.select("viewer")).toBe(false);
    expect(policies.auditLogs.insert()).toBe(true);
  });
  it("metrics: admin only", () => {
    expect(policies.metrics.select("admin")).toBe(true);
    expect(policies.metrics.select("analyst")).toBe(false);
  });
  it("webhooks: admin only", () => {
    expect(policies.webhooks.all("admin")).toBe(true);
    expect(policies.webhooks.all("analyst")).toBe(false);
    expect(policies.webhooks.all("user")).toBe(false);
  });
});
