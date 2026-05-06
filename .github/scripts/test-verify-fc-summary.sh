#!/usr/bin/env bash
# test-verify-fc-summary.sh — smoke tests for .github/scripts/verify-fc-summary.sh
#
# Runs the verify script against a fixture matrix covering:
#   - GOOD bullets (canonical writer output) → must exit 0
#   - BAD bullets for fc-seeds.json (missing bold prefix, wrong emoji,
#     wrong label text, wrong URL, http:// instead of https://) → must exit 1
#   - BAD bullets for fc-failures.json (same drift categories) → must exit 1
#   - Fallback markers when STAGED_FC_* == 0 → must exit 0
#   - Stray inline link when not staged → must exit 1
#
# Usage:  bash .github/scripts/test-verify-fc-summary.sh
# Exit:   0 if every assertion holds, 1 on first failure.
#
# This script is INTENTIONALLY decoupled from preflight-fuzz.yml so it can
# be wired into a fast lint-style job that runs on every push without needing
# the full fuzz matrix to execute.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY="${SCRIPT_DIR}/verify-fc-summary.sh"

if [ ! -x "${VERIFY}" ]; then
  chmod +x "${VERIFY}"
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

PASS=0
FAIL=0
FAILED_CASES=()

# Run the verify script with a given fixture + env, expecting a specific exit
# code. Captures combined stdout+stderr for failure diagnostics.
#
# Args:
#   $1  case name (human label)
#   $2  fixture file path
#   $3  expected exit code (0 or 1)
#   $4  STAGED_FC_SEEDS
#   $5  STAGED_FC_FAILURES
#   $6  FC_SEEDS_URL
#   $7  FC_FAILURES_URL
run_case() {
  local name="$1" fixture="$2" expected="$3"
  local staged_seeds="$4" staged_failures="$5"
  local seeds_url="$6" failures_url="$7"

  local logfile="${WORKDIR}/$(echo "${name}" | tr ' /:' '___').log"
  local actual=0

  set +e
  SUMMARY_FILE="${fixture}" \
  CONTEXT_LABEL="test:${name}" \
  STAGED_FC_SEEDS="${staged_seeds}" \
  STAGED_FC_FAILURES="${staged_failures}" \
  FC_SEEDS_URL="${seeds_url}" \
  FC_FAILURES_URL="${failures_url}" \
  FC_HEADER_LABEL="Access-Control-Request-Headers" \
  REQUIRE_CONTEXT_PARAGRAPH="1" \
  GITHUB_OUTPUT="" \
    "${VERIFY}" >"${logfile}" 2>&1
  actual=$?
  set -e

  if [ "${actual}" = "${expected}" ]; then
    PASS=$((PASS + 1))
    printf "  ✅ %-70s exit=%d\n" "${name}" "${actual}"
  else
    FAIL=$((FAIL + 1))
    FAILED_CASES+=("${name}")
    printf "  ❌ %-70s exit=%d (expected %d)\n" "${name}" "${actual}" "${expected}"
    echo "     ----- verify output (${logfile}) -----"
    sed 's/^/       /' "${logfile}" | head -40
    echo "     ----- end verify output -----"
  fi
}

# ─── fixture builders ────────────────────────────────────────────────────────

write_fixture() {
  # $1=path  $2=seeds_bullet_line  $3=failures_bullet_line
  local path="$1" seeds_line="$2" failures_line="$3"
  cat > "${path}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${seeds_line}
${failures_line}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF
}

write_fallback_fixture() {
  # Both fallback markers (no inline links).
  local path="$1"
  cat > "${path}" <<'EOF'
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 `fc-seeds.json` — _(not produced in this run)_
- 💥 `fc-failures.json` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF
}

# Canonical bullets (must match writer in preflight-fuzz.yml exactly).
SEEDS_OK='- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://example.com/seeds)'
FAILURES_OK='- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)'

# Bad seeds variants (each preserves the failures bullet so only seeds is broken).
SEEDS_NO_BOLD='- 🌱 [`fc-seeds.json`](https://example.com/seeds)'
SEEDS_WRONG_EMOJI='- 🌰 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://example.com/seeds)'
SEEDS_WRONG_LABEL='- 🌱 **Seeds (50 runs):** [`fc-seeds.json`](https://example.com/seeds)'
SEEDS_WRONG_URL='- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://wrong.example.com/seeds)'
SEEDS_HTTP='- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](http://example.com/seeds)'

# Bad failures variants.
FAILURES_NO_BOLD='- 💥 [`fc-failures.json`](https://example.com/failures)'
FAILURES_WRONG_EMOJI='- 🔥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)'
FAILURES_WRONG_LABEL='- 💥 **Counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)'
FAILURES_WRONG_URL='- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://wrong.example.com/failures)'
FAILURES_HTTP='- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](http://example.com/failures)'

# ─── build fixtures ──────────────────────────────────────────────────────────

GOOD="${WORKDIR}/good.md"
write_fixture "${GOOD}" "${SEEDS_OK}" "${FAILURES_OK}"

# Seeds-bad fixtures (failures bullet stays canonical).
SEEDS_BAD_NO_BOLD_F="${WORKDIR}/seeds_no_bold.md"
write_fixture "${SEEDS_BAD_NO_BOLD_F}"     "${SEEDS_NO_BOLD}"     "${FAILURES_OK}"
SEEDS_BAD_EMOJI_F="${WORKDIR}/seeds_emoji.md"
write_fixture "${SEEDS_BAD_EMOJI_F}"        "${SEEDS_WRONG_EMOJI}" "${FAILURES_OK}"
SEEDS_BAD_LABEL_F="${WORKDIR}/seeds_label.md"
write_fixture "${SEEDS_BAD_LABEL_F}"        "${SEEDS_WRONG_LABEL}" "${FAILURES_OK}"
SEEDS_BAD_URL_F="${WORKDIR}/seeds_url.md"
write_fixture "${SEEDS_BAD_URL_F}"          "${SEEDS_WRONG_URL}"   "${FAILURES_OK}"
SEEDS_BAD_HTTP_F="${WORKDIR}/seeds_http.md"
write_fixture "${SEEDS_BAD_HTTP_F}"         "${SEEDS_HTTP}"        "${FAILURES_OK}"

# Failures-bad fixtures (seeds bullet stays canonical).
FAILURES_BAD_NO_BOLD_F="${WORKDIR}/failures_no_bold.md"
write_fixture "${FAILURES_BAD_NO_BOLD_F}"   "${SEEDS_OK}"          "${FAILURES_NO_BOLD}"
FAILURES_BAD_EMOJI_F="${WORKDIR}/failures_emoji.md"
write_fixture "${FAILURES_BAD_EMOJI_F}"     "${SEEDS_OK}"          "${FAILURES_WRONG_EMOJI}"
FAILURES_BAD_LABEL_F="${WORKDIR}/failures_label.md"
write_fixture "${FAILURES_BAD_LABEL_F}"     "${SEEDS_OK}"          "${FAILURES_WRONG_LABEL}"
FAILURES_BAD_URL_F="${WORKDIR}/failures_url.md"
write_fixture "${FAILURES_BAD_URL_F}"       "${SEEDS_OK}"          "${FAILURES_WRONG_URL}"
FAILURES_BAD_HTTP_F="${WORKDIR}/failures_http.md"
write_fixture "${FAILURES_BAD_HTTP_F}"      "${SEEDS_OK}"          "${FAILURES_HTTP}"

# Fallback fixtures.
FALLBACK_OK="${WORKDIR}/fallback_ok.md"
write_fallback_fixture "${FALLBACK_OK}"

# Stray inline link when nothing staged → must fail.
STRAY_SEEDS="${WORKDIR}/stray_seeds.md"
cat > "${STRAY_SEEDS}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
- 💥 \`fc-failures.json\` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

STRAY_FAILURES="${WORKDIR}/stray_failures.md"
cat > "${STRAY_FAILURES}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 \`fc-seeds.json\` — _(not produced in this run)_
${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# ─── presence + uniqueness fixtures ──────────────────────────────────────────

# Missing fc-seeds bullet entirely (only failures bullet present).
MISSING_SEEDS="${WORKDIR}/missing_seeds.md"
cat > "${MISSING_SEEDS}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Missing fc-failures bullet entirely.
MISSING_FAILURES="${WORKDIR}/missing_failures.md"
cat > "${MISSING_FAILURES}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Missing BOTH bullets — section header only.
MISSING_BOTH="${WORKDIR}/missing_both.md"
cat > "${MISSING_BOTH}" <<'EOF'
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Duplicate canonical seeds bullet (writer/append ran twice).
DUP_SEEDS_CANONICAL="${WORKDIR}/dup_seeds_canonical.md"
cat > "${DUP_SEEDS_CANONICAL}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
${SEEDS_OK}
${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Duplicate canonical failures bullet.
DUP_FAILURES_CANONICAL="${WORKDIR}/dup_failures_canonical.md"
cat > "${DUP_FAILURES_CANONICAL}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
${FAILURES_OK}
${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Mixed: canonical inline AND fallback marker for the same file (drift
# between staged state and rendered output).
MIX_SEEDS="${WORKDIR}/mix_seeds.md"
cat > "${MIX_SEEDS}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
- 🌱 \`fc-seeds.json\` — _(not produced in this run)_
${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

MIX_FAILURES="${WORKDIR}/mix_failures.md"
cat > "${MIX_FAILURES}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
${FAILURES_OK}
- 💥 \`fc-failures.json\` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Duplicate FALLBACK markers (appended twice while not staged).
DUP_SEEDS_FALLBACK="${WORKDIR}/dup_seeds_fallback.md"
cat > "${DUP_SEEDS_FALLBACK}" <<'EOF'
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 `fc-seeds.json` — _(not produced in this run)_
- 🌱 `fc-seeds.json` — _(not produced in this run)_
- 💥 `fc-failures.json` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# ─── cross-contamination fixtures ────────────────────────────────────────────
# Each token has EXACTLY ONE bullet (so assert_single_bullet_for would pass)
# but the labels/tokens are swapped — the seeds canonical prefix points to
# fc-failures.json or vice-versa. This is the false-positive class we want
# to close: the validator must reject it instead of trusting count==1.

# Swapped CANONICAL bullets: seeds prefix wraps fc-failures.json link, and
# failures prefix wraps fc-seeds.json link. Each token still has 1 bullet.
SWAP_CANONICAL="${WORKDIR}/swap_canonical.md"
cat > "${SWAP_CANONICAL}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 **Seeds executed (last 50 runs):** [\`fc-failures.json\`](https://example.com/failures)
- 💥 **Minimized counterexamples (last 100):** [\`fc-seeds.json\`](https://example.com/seeds)

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Only the SEEDS canonical line is contaminated (failures bullet is correct).
# Each token still appears in exactly 1 bullet line (count==1).
SEEDS_PREFIX_WITH_FAILURES_TOKEN="${WORKDIR}/seeds_prefix_failures_token.md"
cat > "${SEEDS_PREFIX_WITH_FAILURES_TOKEN}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 **Seeds executed (last 50 runs):** [\`fc-failures.json\`](https://example.com/seeds)
${FAILURES_OK}

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Only the FAILURES canonical line is contaminated.
FAILURES_PREFIX_WITH_SEEDS_TOKEN="${WORKDIR}/failures_prefix_seeds_token.md"
cat > "${FAILURES_PREFIX_WITH_SEEDS_TOKEN}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

${SEEDS_OK}
- 💥 **Minimized counterexamples (last 100):** [\`fc-seeds.json\`](https://example.com/failures)

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# Swapped FALLBACK markers: seeds emoji + backtick wraps fc-failures.json,
# failures emoji + backtick wraps fc-seeds.json. Each token has 1 bullet.
SWAP_FALLBACK="${WORKDIR}/swap_fallback.md"
cat > "${SWAP_FALLBACK}" <<'EOF'
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 `fc-failures.json` — _(not produced in this run)_
- 💥 `fc-seeds.json` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

# ─── run cases ───────────────────────────────────────────────────────────────

echo "▶ verify-fc-summary.sh smoke tests"
echo ""
echo "── canonical bullets ──"
run_case "GOOD: both bullets canonical (staged)" \
  "${GOOD}" 0 1 1 "https://example.com/seeds" "https://example.com/failures"

echo ""
echo "── bad fc-seeds bullets (must fail) ──"
run_case "BAD seeds: missing bold prefix" \
  "${SEEDS_BAD_NO_BOLD_F}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD seeds: wrong emoji" \
  "${SEEDS_BAD_EMOJI_F}"   1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD seeds: wrong label text" \
  "${SEEDS_BAD_LABEL_F}"   1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD seeds: link points to wrong URL" \
  "${SEEDS_BAD_URL_F}"     1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD seeds: http:// instead of https://" \
  "${SEEDS_BAD_HTTP_F}"    1 1 1 "http://example.com/seeds"  "https://example.com/failures"

echo ""
echo "── bad fc-failures bullets (must fail) ──"
run_case "BAD failures: missing bold prefix" \
  "${FAILURES_BAD_NO_BOLD_F}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD failures: wrong emoji" \
  "${FAILURES_BAD_EMOJI_F}"   1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD failures: wrong label text" \
  "${FAILURES_BAD_LABEL_F}"   1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD failures: link points to wrong URL" \
  "${FAILURES_BAD_URL_F}"     1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD failures: http:// instead of https://" \
  "${FAILURES_BAD_HTTP_F}"    1 1 1 "https://example.com/seeds" "http://example.com/failures"

echo ""
echo "── fallback markers (not staged) ──"
run_case "GOOD fallback: both markers, nothing staged" \
  "${FALLBACK_OK}" 0 0 0 "" ""
run_case "BAD: stray seeds inline link while not staged" \
  "${STRAY_SEEDS}" 1 0 0 "" ""
run_case "BAD: stray failures inline link while not staged" \
  "${STRAY_FAILURES}" 1 0 0 "" ""

echo ""
echo "── presence: missing bullets (must fail) ──"
run_case "BAD: fc-seeds bullet missing entirely (staged)" \
  "${MISSING_SEEDS}"    1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: fc-failures bullet missing entirely (staged)" \
  "${MISSING_FAILURES}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: BOTH bullets missing (section header only, staged)" \
  "${MISSING_BOTH}"     1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: BOTH bullets missing (not staged either)" \
  "${MISSING_BOTH}"     1 0 0 "" ""

echo ""
echo "── uniqueness: duplicate bullets (must fail) ──"
run_case "BAD: duplicate canonical fc-seeds bullet" \
  "${DUP_SEEDS_CANONICAL}"    1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: duplicate canonical fc-failures bullet" \
  "${DUP_FAILURES_CANONICAL}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: duplicate fallback fc-seeds marker (not staged)" \
  "${DUP_SEEDS_FALLBACK}"     1 0 0 "" ""
run_case "BAD: mix canonical+fallback for fc-seeds.json" \
  "${MIX_SEEDS}"     1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: mix canonical+fallback for fc-failures.json" \
  "${MIX_FAILURES}"  1 1 1 "https://example.com/seeds" "https://example.com/failures"

echo ""
echo "── cross-contamination: swapped tokens (must fail) ──"
# Each of these fixtures has exactly ONE bullet per token (so the count-only
# check would falsely accept them) — the validator must catch the label↔token
# mismatch instead.
run_case "BAD: SEEDS prefix wraps fc-failures.json (canonical)" \
  "${SEEDS_PREFIX_WITH_FAILURES_TOKEN}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: FAILURES prefix wraps fc-seeds.json (canonical)" \
  "${FAILURES_PREFIX_WITH_SEEDS_TOKEN}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: both canonical bullets swapped (seeds↔failures)" \
  "${SWAP_CANONICAL}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "BAD: both fallback markers swapped (seeds↔failures)" \
  "${SWAP_FALLBACK}"  1 0 0 "" ""

# ─── tolerant-regex variations (link/whitespace/markdown) ────────────────────
# These exercise the refactored regex matcher: shapes that are SEMANTICALLY
# equivalent to the canonical writer output must be ACCEPTED. Shapes that
# change meaning (wrong URL, wrong token, wrong emoji) must still FAIL.

# 1) Prettier-style spaces inside the inline link: `[ \`tok\` ]( url )`.
TOL_LINK_SPACES="${WORKDIR}/tol_link_spaces.md"
write_fixture "${TOL_LINK_SPACES}" \
  '- 🌱 **Seeds executed (last 50 runs):** [ `fc-seeds.json` ]( https://example.com/seeds )' \
  '- 💥 **Minimized counterexamples (last 100):** [ `fc-failures.json` ]( https://example.com/failures )'

# 2) Multiple spaces between bullet dash, emoji, label, and link.
TOL_EXTRA_WS="${WORKDIR}/tol_extra_ws.md"
write_fixture "${TOL_EXTRA_WS}" \
  '-   🌱   **Seeds executed (last 50 runs):**   [`fc-seeds.json`](https://example.com/seeds)' \
  '-   💥   **Minimized counterexamples (last 100):**   [`fc-failures.json`](https://example.com/failures)'

# 3) Tabs instead of spaces (markdown-tolerant).
TOL_TABS="${WORKDIR}/tol_tabs.md"
write_fixture "${TOL_TABS}" \
  "$(printf -- '-\t🌱\t**Seeds executed (last 50 runs):**\t[`fc-seeds.json`](https://example.com/seeds)')" \
  "$(printf -- '-\t💥\t**Minimized counterexamples (last 100):**\t[`fc-failures.json`](https://example.com/failures)')"

# 4) Leading indent (e.g. nested list context) — must still match.
TOL_INDENT="${WORKDIR}/tol_indent.md"
write_fixture "${TOL_INDENT}" \
  '  - 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://example.com/seeds)' \
  '  - 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)'

# 5) `__bold__` instead of `**bold**` (CommonMark synonym).
TOL_UNDERSCORE_BOLD="${WORKDIR}/tol_underscore_bold.md"
write_fixture "${TOL_UNDERSCORE_BOLD}" \
  '- 🌱 __Seeds executed (last 50 runs):__ [`fc-seeds.json`](https://example.com/seeds)' \
  '- 💥 __Minimized counterexamples (last 100):__ [`fc-failures.json`](https://example.com/failures)'

# 6) Trailing whitespace on the line.
TOL_TRAILING_WS="${WORKDIR}/tol_trailing_ws.md"
write_fixture "${TOL_TRAILING_WS}" \
  '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://example.com/seeds)   ' \
  '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)   '

# 7) NEGATIVE: link uses wrong URL but inside Prettier-style spacing — must fail.
TOL_LINK_SPACES_WRONG_URL="${WORKDIR}/tol_link_spaces_wrong_url.md"
write_fixture "${TOL_LINK_SPACES_WRONG_URL}" \
  '- 🌱 **Seeds executed (last 50 runs):** [ `fc-seeds.json` ]( https://wrong.example.com/seeds )' \
  '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://example.com/failures)'

# 8) NEGATIVE: tabs everywhere but emoji is wrong.
TOL_TABS_WRONG_EMOJI="${WORKDIR}/tol_tabs_wrong_emoji.md"
write_fixture "${TOL_TABS_WRONG_EMOJI}" \
  "$(printf -- '-\t🌰\t**Seeds executed (last 50 runs):**\t[`fc-seeds.json`](https://example.com/seeds)')" \
  "$(printf -- '-\t💥\t**Minimized counterexamples (last 100):**\t[`fc-failures.json`](https://example.com/failures)')"

# 9) NEGATIVE: stray inline link with spaces inside (`[ … ]( … )`) when not staged.
TOL_STRAY_SPACED="${WORKDIR}/tol_stray_spaced.md"
cat > "${TOL_STRAY_SPACED}" <<EOF
# Preflight CORS Fuzz — request-headers

### 🎯 fast-check direct downloads (Access-Control-Request-Headers)

- 🌱 [ \`fc-seeds.json\` ]( https://example.com/seeds )
- 💥 \`fc-failures.json\` — _(no failures persisted in this run — invariants held)_

_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._
EOF

echo ""
echo "── tolerant-regex: link/whitespace variations (must PASS) ──"
run_case "TOL: Prettier spaces inside inline link" \
  "${TOL_LINK_SPACES}"      0 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL: extra spaces between bullet tokens" \
  "${TOL_EXTRA_WS}"         0 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL: tabs as separators" \
  "${TOL_TABS}"             0 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL: leading indent on bullet" \
  "${TOL_INDENT}"           0 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL: __underscore bold__ instead of **bold**" \
  "${TOL_UNDERSCORE_BOLD}"  0 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL: trailing whitespace on line" \
  "${TOL_TRAILING_WS}"      0 1 1 "https://example.com/seeds" "https://example.com/failures"

echo ""
echo "── tolerant-regex: variations that still alter meaning (must FAIL) ──"
run_case "TOL-NEG: spaced link but wrong URL" \
  "${TOL_LINK_SPACES_WRONG_URL}" 1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL-NEG: tabs everywhere but wrong emoji" \
  "${TOL_TABS_WRONG_EMOJI}"      1 1 1 "https://example.com/seeds" "https://example.com/failures"
run_case "TOL-NEG: stray spaced inline link while not staged" \
  "${TOL_STRAY_SPACED}"          1 0 0 "" ""

# ─── summary ─────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────────────"
echo "verify-fc-summary.sh smoke tests: ${PASS} passed, ${FAIL} failed"

if [ "${FAIL}" != "0" ]; then
  echo ""
  echo "Failed cases:"
  for c in "${FAILED_CASES[@]}"; do
    echo "  - ${c}"
  done
  exit 1
fi

echo "✅ All assertions held."
