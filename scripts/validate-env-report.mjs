#!/usr/bin/env node
/**
 * Validates reports/env-check.json against reports/env-check.schema.json.
 *
 * Zero-dependency: implements just the subset of JSON Schema used by our
 * report (type, required, enum, minimum/minItems/minLength, format=date-time,
 * additionalProperties).
 *
 * Exit codes:
 *   0  valid
 *   1  IO / parse error
 *   2  schema validation failed
 *
 * Emits GitHub Actions annotations when GITHUB_ACTIONS=true.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const reportPath = args[0] ?? "reports/env-check.json";
const schemaPath = args[1] ?? "reports/env-check.schema.json";

const ci = process.env.GITHUB_ACTIONS === "true";
const annotate = (level, file, msg) => {
  if (!ci) return;
  const m = msg.replace(/\n/g, "%0A");
  process.stdout.write(`::${level} file=${file}::${m}\n`);
};

function die(code, msg, file = reportPath) {
  console.error(`✗ ${msg}`);
  annotate("error", file, msg);
  process.exit(code);
}

for (const f of [reportPath, schemaPath]) {
  if (!existsSync(f)) die(1, `file not found: ${f}`, f);
}

let report, schema;
try { report = JSON.parse(readFileSync(resolve(reportPath), "utf8")); }
catch (e) { die(1, `parse error in ${reportPath}: ${e.message}`); }
try { schema = JSON.parse(readFileSync(resolve(schemaPath), "utf8")); }
catch (e) { die(1, `parse error in ${schemaPath}: ${e.message}`, schemaPath); }

const errors = [];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function check(value, sch, path) {
  if (sch.type) {
    const allowed = Array.isArray(sch.type) ? sch.type : [sch.type];
    const t = typeOf(value);
    const ok = allowed.includes(t) || (allowed.includes("number") && t === "integer");
    if (!ok) errors.push(`${path}: expected type ${allowed.join("|")}, got ${t}`);
  }
  if (sch.enum && !sch.enum.includes(value))
    errors.push(`${path}: value ${JSON.stringify(value)} not in enum [${sch.enum.join(", ")}]`);
  if (sch.format === "date-time" && typeof value === "string" && !ISO.test(value))
    errors.push(`${path}: not an ISO date-time: ${value}`);
  if (typeof value === "string" && sch.minLength != null && value.length < sch.minLength)
    errors.push(`${path}: string shorter than minLength ${sch.minLength}`);
  if (typeof value === "number" && sch.minimum != null && value < sch.minimum)
    errors.push(`${path}: value ${value} < minimum ${sch.minimum}`);
  if (Array.isArray(value)) {
    if (sch.minItems != null && value.length < sch.minItems)
      errors.push(`${path}: array shorter than minItems ${sch.minItems}`);
    if (sch.items) value.forEach((v, i) => check(v, sch.items, `${path}[${i}]`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of sch.required ?? [])
      if (!(k in value)) errors.push(`${path}: missing required field "${k}"`);
    if (sch.properties) {
      for (const [k, sub] of Object.entries(sch.properties))
        if (k in value) check(value[k], sub, `${path}/${k}`);
    }
    if (sch.additionalProperties === false && sch.properties) {
      for (const k of Object.keys(value))
        if (!(k in sch.properties)) errors.push(`${path}: unexpected field "${k}"`);
    }
  }
}

check(report, schema, "#");

if (errors.length) {
  for (const e of errors) {
    console.error(`✗ ${e}`);
    annotate("error", reportPath, `JSON schema: ${e}`);
  }
  die(2, `${errors.length} schema violation(s) in ${reportPath}`);
}

console.log(`✓ ${reportPath} matches schema (${report.entries.length} entries, status=${report.status})`);
