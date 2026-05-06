#!/usr/bin/env bash
# Offline test harness for the paginated GitHub artifacts merge logic used by
# .github/workflows/preflight-fuzz.yml (the summary_url cross-check step).
#
# This script mocks the `curl` calls to the GitHub artifacts REST API by
# pre-generating page JSON + header files in a temp dir, then runs the SAME
# pagination loop shape (Link rel="next" follow, merge with jq, total_count
# accounting) against those mocks and asserts the expected artifact id is
# found.
#
# Scenarios covered:
#   1. Multiple pages (3 pages, target on last page) — Link headers chain
#   2. Single page, no Link header at all — must terminate cleanly
#   3. Multiple pages, target on FIRST page — must still walk all pages
#      (so total_count check passes) and find target
#   4. Link header present but malformed (no rel="next") — must terminate
#   5. total_count mismatch (page silently dropped) — must FAIL accounting
#   6. Target not present anywhere — must FAIL match step
#   7. Runaway guard: more pages than MAX_PAGES — must FAIL guard
#
# Run:  bash .github/scripts/test-artifacts-pagination.sh
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to run these tests" >&2
  exit 2
fi

PASS=0
FAIL=0
FAILED_CASES=()

# ─── core logic under test ────────────────────────────────────────────────────
# Mirrors the loop in preflight-fuzz.yml. Inputs:
#   $1 = pages_dir containing page-N.json + page-N.headers files
#   $2 = expected artifact id
#   $3 = expected artifact name
#   $4 = MAX_PAGES override (default 50)
# Echoes diagnostics to stderr; sets $RESULT to one of:
#   OK | API_FAIL | ACCOUNTING_MISMATCH | NO_MATCH | RUNAWAY
run_pagination() {
  local pages_dir="$1"
  local expected_id="$2"
  local expected_name="$3"
  local max_pages="${4:-50}"

  local page=1
  local total_count=""
  local merged="${pages_dir}/_merged.json"
  local next_url="mock://page-1"

  while [ -n "${next_url}" ] && [ "${page}" -le "${max_pages}" ]; do
    local idx="${next_url#mock://page-}"
    local page_file="${pages_dir}/page-${idx}.json"
    local header_file="${pages_dir}/page-${idx}.headers"

    if [ ! -f "${page_file}" ]; then
      RESULT="API_FAIL"
      echo "  [run] missing mock page file: ${page_file}" >&2
      return
    fi

    if [ -z "${total_count}" ]; then
      total_count=$(jq -r '.total_count // 0' "${page_file}")
    fi

    # Parse Link header for rel="next". Tolerate completely missing header file.
    local link=""
    if [ -f "${header_file}" ]; then
      link=$(grep -i '^link:' "${header_file}" | tr -d '\r' || true)
    fi
    next_url=$(printf '%s\n' "${link}" \
      | sed -n 's/.*<\([^>]*\)>;[[:space:]]*rel="next".*/\1/p' \
      | head -n 1)

    page=$((page + 1))
  done

  if [ "${page}" -gt "${max_pages}" ] && [ -n "${next_url}" ]; then
    RESULT="RUNAWAY"
    return
  fi

  jq -s '{ total_count: (.[0].total_count // 0),
           artifacts:   ([.[].artifacts[]]) }' \
    "${pages_dir}"/page-*.json > "${merged}"

  local merged_count
  merged_count=$(jq -r '.artifacts | length' "${merged}")

  if [ -n "${total_count}" ] && [ "${total_count}" != "0" ] \
     && [ "${merged_count}" != "${total_count}" ]; then
    RESULT="ACCOUNTING_MISMATCH"
    echo "  [run] merged=${merged_count} total_count=${total_count}" >&2
    return
  fi

  local match
  match=$(jq -r --arg name "${expected_name}" --arg id "${expected_id}" '
    .artifacts[] | select(.name == $name and (.id|tostring) == $id) | .id
  ' "${merged}" | head -n 1)

  if [ -z "${match}" ]; then
    RESULT="NO_MATCH"
    return
  fi

  RESULT="OK"
}

# ─── helpers to fabricate mock pages ──────────────────────────────────────────
make_page() {
  # $1 dir  $2 page_index  $3 total_count  $4 next_page_index_or_empty  $5 artifacts_json
  local dir="$1" idx="$2" total="$3" next="$4" arts="$5"
  cat > "${dir}/page-${idx}.json" <<EOF
{ "total_count": ${total}, "artifacts": ${arts} }
EOF
  if [ -n "${next}" ]; then
    cat > "${dir}/page-${idx}.headers" <<EOF
HTTP/2 200
content-type: application/json; charset=utf-8
link: <mock://page-${next}>; rel="next", <mock://page-LAST>; rel="last"
EOF
  else
    # Deliberately produce a headers file WITHOUT a link header to exercise
    # the "no Link header" path (single-page response, or final page).
    cat > "${dir}/page-${idx}.headers" <<EOF
HTTP/2 200
content-type: application/json; charset=utf-8
EOF
  fi
}

art() {
  # $1 id  $2 name -> JSON object
  printf '{"id": %s, "name": "%s", "expired": false, "archive_download_url": "https://api.github.com/x/%s"}' "$1" "$2" "$1"
}

assert() {
  local case_name="$1" expected="$2" actual="$3"
  if [ "${actual}" = "${expected}" ]; then
    echo "  ✓ ${case_name}: ${actual}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${case_name}: expected=${expected} actual=${actual}"
    FAIL=$((FAIL + 1))
    FAILED_CASES+=("${case_name}")
  fi
}

# ─── scenarios ────────────────────────────────────────────────────────────────

echo "[1] 3 pages, target on last page (id=999, name=summary-id-1)"
D=$(mktemp -d)
A1="[$(art 1 other-a),$(art 2 other-b)]"
A2="[$(art 3 other-c),$(art 4 other-d)]"
A3="[$(art 999 summary-id-1),$(art 5 other-e)]"
make_page "$D" 1 6 2 "$A1"
make_page "$D" 2 6 3 "$A2"
make_page "$D" 3 6 ""  "$A3"
run_pagination "$D" 999 summary-id-1
assert "3-pages-target-last" "OK" "$RESULT"
rm -rf "$D"

echo "[2] single page, NO Link header (id=42, name=summary-id-2)"
D=$(mktemp -d)
make_page "$D" 1 2 "" "[$(art 42 summary-id-2),$(art 7 other)]"
run_pagination "$D" 42 summary-id-2
assert "single-page-no-link" "OK" "$RESULT"
rm -rf "$D"

echo "[3] 2 pages, target on page 1 — must still walk both"
D=$(mktemp -d)
make_page "$D" 1 3 2 "[$(art 100 summary-id-3),$(art 8 other)]"
make_page "$D" 2 3 ""  "[$(art 9 other-tail)]"
run_pagination "$D" 100 summary-id-3
assert "target-first-page-walks-all" "OK" "$RESULT"
rm -rf "$D"

echo "[4] malformed Link header (no rel=\"next\") — terminates cleanly"
D=$(mktemp -d)
cat > "$D/page-1.json" <<EOF
{"total_count": 1, "artifacts": [$(art 55 summary-id-4)]}
EOF
cat > "$D/page-1.headers" <<'EOF'
HTTP/2 200
link: <mock://page-LAST>; rel="last"
EOF
run_pagination "$D" 55 summary-id-4
assert "malformed-link-no-next" "OK" "$RESULT"
rm -rf "$D"

echo "[5] total_count mismatch (page silently dropped) — must FAIL accounting"
D=$(mktemp -d)
# Claim total_count=10 but only deliver 2 artifacts across 1 page.
make_page "$D" 1 10 "" "[$(art 200 summary-id-5),$(art 11 other)]"
run_pagination "$D" 200 summary-id-5
assert "accounting-mismatch-detected" "ACCOUNTING_MISMATCH" "$RESULT"
rm -rf "$D"

echo "[6] target not present anywhere — must FAIL match"
D=$(mktemp -d)
make_page "$D" 1 4 2 "[$(art 1 a),$(art 2 b)]"
make_page "$D" 2 4 ""  "[$(art 3 c),$(art 4 d)]"
run_pagination "$D" 999 summary-id-missing
assert "target-not-found" "NO_MATCH" "$RESULT"
rm -rf "$D"

echo "[7] runaway: more pages than MAX_PAGES (cap=2, chain length=4)"
D=$(mktemp -d)
make_page "$D" 1 4 2 "[$(art 1 a)]"
make_page "$D" 2 4 3 "[$(art 2 b)]"
make_page "$D" 3 4 4 "[$(art 3 c)]"
make_page "$D" 4 4 ""  "[$(art 999 summary-id-7)]"
run_pagination "$D" 999 summary-id-7 2
assert "runaway-guard-trips" "RUNAWAY" "$RESULT"
rm -rf "$D"

echo
echo "──────────────────────────────────────"
echo "passed=${PASS}  failed=${FAIL}"
if [ "${FAIL}" -ne 0 ]; then
  echo "failed cases: ${FAILED_CASES[*]}"
  exit 1
fi
echo "all pagination harness tests passed"
