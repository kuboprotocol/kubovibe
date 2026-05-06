#!/usr/bin/env bash
# verify-fc-summary.sh — assert that a fast-check summary/sticky-body file
# contains the expected inline fc-seeds.json / fc-failures.json links
# (or the documented fallback markers), CONDITIONAL on the staging outputs
# of the workflow's `stage` step.
#
# Required env:
#   SUMMARY_FILE         Path to the file to validate.
#   CONTEXT_LABEL        Human label for error messages (e.g. "summary-request-method.md"
#                        or "sticky PR comment body").
#   STAGED_FC_SEEDS      "1" if fc-seeds.json was produced by this job, else "0"/empty.
#   STAGED_FC_FAILURES   "1" if fc-failures.json was produced by this job, else "0"/empty.
#   FC_SEEDS_URL         Artifact URL for fc-seeds.json (only required when staged).
#   FC_FAILURES_URL      Artifact URL for fc-failures.json (only required when staged).
#
# Optional env:
#   FC_HEADER_LABEL      e.g. "Access-Control-Request-Method". When set,
#                        we additionally assert the section header for that
#                        label appears exactly once and the OPPOSITE label
#                        does NOT leak in (cross-category contamination).
#   REQUIRE_CONTEXT_PARAGRAPH   "1" (default) requires the
#                        "uploaded as standalone GitHub artifacts" paragraph.
#                        Set to "0" to skip (e.g. for sticky body only).
#   MAX_BYTES            Max allowed size in bytes (default 60000 — keeps
#                        margin under GitHub's 65536 sticky comment cap).
#   GITHUB_OUTPUT        Standard Actions env. When present, writes
#                        seeds_result / failures_result / size / header_count.
#
# Exit code: 0 on success, 1 on first contract violation.

set -euo pipefail

SUMMARY_FILE="${SUMMARY_FILE:?SUMMARY_FILE is required}"
CONTEXT_LABEL="${CONTEXT_LABEL:-summary file}"
STAGED_FC_SEEDS="${STAGED_FC_SEEDS:-0}"
STAGED_FC_FAILURES="${STAGED_FC_FAILURES:-0}"
FC_SEEDS_URL="${FC_SEEDS_URL:-}"
FC_FAILURES_URL="${FC_FAILURES_URL:-}"
FC_HEADER_LABEL="${FC_HEADER_LABEL:-}"
REQUIRE_CONTEXT_PARAGRAPH="${REQUIRE_CONTEXT_PARAGRAPH:-1}"
MAX_BYTES="${MAX_BYTES:-60000}"

# ─── helpers ─────────────────────────────────────────────────────────────────

# Print every line in $SUMMARY_FILE that mentions fc-seeds.json or
# fc-failures.json (with line numbers and 1 line of context on each side),
# so a CI log reader can immediately see what the validator saw.
dump_fc_lines() {
  echo "----- BEGIN fc-* line context (${SUMMARY_FILE}) -----"
  if [ -s "${SUMMARY_FILE}" ]; then
    # -n line numbers, -B/-A 1 context, -F fixed string OR.
    {
      grep -n -B 1 -A 1 -F "fc-seeds.json"    "${SUMMARY_FILE}" || true
      echo "---"
      grep -n -B 1 -A 1 -F "fc-failures.json" "${SUMMARY_FILE}" || true
    } | sed 's/^/  /'
  else
    echo "  (file is empty or missing)"
  fi
  echo "----- END fc-* line context -----"
}

dump_full_body() {
  echo "----- BEGIN ${CONTEXT_LABEL} (${SUMMARY_FILE}) -----"
  sed -n '1,400p' "${SUMMARY_FILE}" 2>/dev/null || echo "(could not read file)"
  echo "----- END ${CONTEXT_LABEL} -----"
}

fail() {
  echo "::error title=${CONTEXT_LABEL} contract violation::$1"
  echo ""
  echo "Reason: $1"
  echo ""
  dump_fc_lines
  echo ""
  dump_full_body
  exit 1
}

assert_contains() {
  local needle="$1" reason="$2"
  if ! grep -Fq "${needle}" "${SUMMARY_FILE}"; then
    fail "${reason} — expected substring not found: ${needle}"
  fi
}

assert_not_contains() {
  local needle="$1" reason="$2"
  if grep -Fq "${needle}" "${SUMMARY_FILE}"; then
    fail "${reason} — forbidden substring is present: ${needle}"
  fi
}

# ─── basic sanity ────────────────────────────────────────────────────────────

if [ ! -s "${SUMMARY_FILE}" ]; then
  fail "Summary file is missing or empty: ${SUMMARY_FILE}"
fi

# ─── header (optional, only when FC_HEADER_LABEL is provided) ────────────────

HEADER_COUNT=0
if [ -n "${FC_HEADER_LABEL}" ]; then
  HEADER_COUNT=$(grep -Fc "🎯 fast-check direct downloads (${FC_HEADER_LABEL})" "${SUMMARY_FILE}" || true)
  if [ "${HEADER_COUNT}" != "1" ]; then
    fail "Expected exactly 1 fast-check section header for ${FC_HEADER_LABEL}, found ${HEADER_COUNT}"
  fi

  OTHER_LABEL="Access-Control-Request-Headers"
  [ "${FC_HEADER_LABEL}" = "Access-Control-Request-Headers" ] && OTHER_LABEL="Access-Control-Request-Method"
  if grep -Fq "🎯 fast-check direct downloads (${OTHER_LABEL})" "${SUMMARY_FILE}"; then
    fail "Cross-category contamination: ${CONTEXT_LABEL} contains the ${OTHER_LABEL} section"
  fi
fi

# Expected canonical bullet formats (must match the `Append fast-check
# artifact links to summary` step in .github/workflows/preflight-fuzz.yml).
# Kept here so any drift between writer and validator fails CI loudly.
SEEDS_BULLET_PREFIX='- 🌱 **Seeds executed (last 50 runs):** '
FAILURES_BULLET_PREFIX='- 💥 **Minimized counterexamples (last 100):** '

# Assert that a given inline link appears as a properly-formatted bullet line
# (full line match, not just substring). $1=expected full line, $2=link token
# used to locate candidate lines for the debug dump.
assert_bullet_line() {
  local expected_line="$1" link_token="$2" reason="$3"
  # -F fixed-string, -x whole-line match. Anchors prevent partial/substring
  # matches like a stripped emoji or a missing bold prefix from passing.
  if ! grep -Fxq "${expected_line}" "${SUMMARY_FILE}"; then
    echo "::error title=${CONTEXT_LABEL} bullet format violation::${reason}"
    echo "Expected exact line:"
    echo "  ${expected_line}"
    echo "Candidate lines found in ${SUMMARY_FILE} (mentioning ${link_token}):"
    grep -n -F "${link_token}" "${SUMMARY_FILE}" | sed 's/^/  /' || echo "  (none)"
    fail "${reason}"
  fi
}

# ─── fc-seeds.json — conditional on STAGED_FC_SEEDS ──────────────────────────

SEEDS_RESULT="skipped"
if [ "${STAGED_FC_SEEDS}" = "1" ]; then
  if [ -z "${FC_SEEDS_URL}" ]; then
    fail "fc-seeds.json was staged but FC_SEEDS_URL is empty (broken inline link would render in ${CONTEXT_LABEL})"
  fi
  case "${FC_SEEDS_URL}" in
    https://*) : ;;
    *) fail "fc-seeds.json URL is not https:// (got: ${FC_SEEDS_URL})" ;;
  esac
  assert_contains "[\`fc-seeds.json\`](${FC_SEEDS_URL})" \
    "Missing inline fc-seeds.json link to ${FC_SEEDS_URL} in ${CONTEXT_LABEL}"
  # Strict bullet-format check: the writer emits a full canonical bullet,
  # so reject any drift (e.g. missing emoji, missing bold label, wrong dash).
  assert_bullet_line \
    "${SEEDS_BULLET_PREFIX}[\`fc-seeds.json\`](${FC_SEEDS_URL})" \
    "fc-seeds.json" \
    "fc-seeds.json inline link is not formatted as the canonical bullet '${SEEDS_BULLET_PREFIX}[\`fc-seeds.json\`](URL)' in ${CONTEXT_LABEL}"
  SEEDS_RESULT="link OK (${FC_SEEDS_URL})"
else
  assert_contains "\`fc-seeds.json\` — _(not produced in this run)_" \
    "fc-seeds.json was not staged → ${CONTEXT_LABEL} must include the documented fallback marker"
  # Defensive: when not staged, no stray inline link should exist.
  if grep -Eq "\[\`fc-seeds\.json\`\]\(https://" "${SUMMARY_FILE}"; then
    fail "fc-seeds.json was NOT staged but ${CONTEXT_LABEL} contains a stray inline https link"
  fi
  SEEDS_RESULT="fallback marker (not staged)"
fi

# ─── fc-failures.json — conditional on STAGED_FC_FAILURES ────────────────────

FAILURES_RESULT="skipped"
if [ "${STAGED_FC_FAILURES}" = "1" ]; then
  if [ -z "${FC_FAILURES_URL}" ]; then
    fail "fc-failures.json was staged but FC_FAILURES_URL is empty (broken inline link would render in ${CONTEXT_LABEL})"
  fi
  case "${FC_FAILURES_URL}" in
    https://*) : ;;
    *) fail "fc-failures.json URL is not https:// (got: ${FC_FAILURES_URL})" ;;
  esac
  assert_contains "[\`fc-failures.json\`](${FC_FAILURES_URL})" \
    "Missing inline fc-failures.json link to ${FC_FAILURES_URL} in ${CONTEXT_LABEL}"
  assert_bullet_line \
    "${FAILURES_BULLET_PREFIX}[\`fc-failures.json\`](${FC_FAILURES_URL})" \
    "fc-failures.json" \
    "fc-failures.json inline link is not formatted as the canonical bullet '${FAILURES_BULLET_PREFIX}[\`fc-failures.json\`](URL)' in ${CONTEXT_LABEL}"
  FAILURES_RESULT="link OK (${FC_FAILURES_URL})"
else
  assert_contains "\`fc-failures.json\` — _(no failures persisted in this run — invariants held)_" \
    "fc-failures.json was not staged → ${CONTEXT_LABEL} must include the documented fallback marker"
  if grep -Eq "\[\`fc-failures\.json\`\]\(https://" "${SUMMARY_FILE}"; then
    fail "fc-failures.json was NOT staged but ${CONTEXT_LABEL} contains a stray inline https link"
  fi
  FAILURES_RESULT="fallback marker (not staged)"
fi

# ─── contextual paragraph (opt-in) ───────────────────────────────────────────

if [ "${REQUIRE_CONTEXT_PARAGRAPH}" = "1" ]; then
  assert_contains "uploaded as standalone GitHub artifacts" \
    "Missing contextual explanation about standalone artifacts in ${CONTEXT_LABEL}"
fi

# ─── unresolved-placeholder defence ──────────────────────────────────────────

for bad in \
  '${FC_SEEDS_URL}' \
  '${FC_FAILURES_URL}' \
  '](null)' \
  '](undefined)' \
  '](  )'; do
  if grep -Fq "${bad}" "${SUMMARY_FILE}"; then
    fail "Unresolved placeholder/garbage in ${CONTEXT_LABEL}: ${bad}"
  fi
done

# ─── size guard (sticky PR comment hard cap is 65536 chars) ──────────────────

SIZE_BYTES=$(wc -c < "${SUMMARY_FILE}")
if [ "${SIZE_BYTES}" -gt "${MAX_BYTES}" ]; then
  fail "${CONTEXT_LABEL} too large for a sticky PR comment (${SIZE_BYTES} > ${MAX_BYTES} bytes; GitHub hard cap is 65536)"
fi

# ─── success — emit machine-readable + human-readable summary ────────────────

echo "✅ ${CONTEXT_LABEL} validated"
echo "   fc-seeds.json:    ${SEEDS_RESULT}"
echo "   fc-failures.json: ${FAILURES_RESULT}"
echo "   size:             ${SIZE_BYTES} bytes"
[ -n "${FC_HEADER_LABEL}" ] && echo "   header_count:     ${HEADER_COUNT} (${FC_HEADER_LABEL})"

if [ -n "${GITHUB_OUTPUT:-}" ] && [ -f "${GITHUB_OUTPUT}" ]; then
  {
    echo "seeds_result=${SEEDS_RESULT}"
    echo "failures_result=${FAILURES_RESULT}"
    echo "size_bytes=${SIZE_BYTES}"
    echo "header_count=${HEADER_COUNT}"
  } >> "${GITHUB_OUTPUT}"
fi
