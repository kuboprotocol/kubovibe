#!/usr/bin/env bash
# ============================================================
# Unit tests for scripts/setup-env.sh
# ============================================================
# Runs the script in an isolated sandbox copy of the repo and
# asserts behavior + exit codes:
#   0 success | 1 IO/precheck | 2 invalid flag | 3 validation
#
# Usage:
#   bash scripts/setup-env.test.sh
# ============================================================
set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/setup-env.sh"

PASS=0; FAIL=0
RED=$'\033[31m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'

# make_sandbox → echo path to fresh temp project (with templates only)
make_sandbox() {
  local dir
  dir="$(mktemp -d -t kubo-envtest.XXXXXX)"
  mkdir -p "$dir/scripts" "$dir/supabase/functions"
  cp "$ROOT_DIR/.env.example" "$dir/.env.example"
  cp "$ROOT_DIR/supabase/functions/.env.example" "$dir/supabase/functions/.env.example"
  cp "$SCRIPT" "$dir/scripts/setup-env.sh"
  echo "$dir"
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "${GRN}✓${RST} $label ${DIM}(=$actual)${RST}"
    PASS=$((PASS+1))
  else
    echo "${RED}✗${RST} $label — expected $expected, got $actual"
    FAIL=$((FAIL+1))
  fi
}

run() {
  # run <sandbox> <args...> → echoes exit code
  local dir="$1"; shift
  ( cd "$dir" && bash scripts/setup-env.sh "$@" >/dev/null 2>&1 )
  echo $?
}

echo "▸ test 1: --help returns 0"
SBX="$(make_sandbox)"
assert_eq "exit code" 0 "$(run "$SBX" --help)"
rm -rf "$SBX"

echo "▸ test 2: unknown flag returns 2"
SBX="$(make_sandbox)"
assert_eq "exit code" 2 "$(run "$SBX" --does-not-exist)"
rm -rf "$SBX"

echo "▸ test 3: --dry-run writes nothing"
SBX="$(make_sandbox)"
code="$(run "$SBX" --dry-run)"
assert_eq "exit code" 0 "$code"
[[ ! -f "$SBX/.env" && ! -f "$SBX/supabase/functions/.env" ]] \
  && { echo "${GRN}✓${RST} no files written"; PASS=$((PASS+1)); } \
  || { echo "${RED}✗${RST} dry-run created files"; FAIL=$((FAIL+1)); }
rm -rf "$SBX"

echo "▸ test 4: default copy creates both .env files"
SBX="$(make_sandbox)"
code="$(run "$SBX")"
assert_eq "exit code" 0 "$code"
[[ -f "$SBX/.env" && -f "$SBX/supabase/functions/.env" ]] \
  && { echo "${GRN}✓${RST} files created"; PASS=$((PASS+1)); } \
  || { echo "${RED}✗${RST} files missing"; FAIL=$((FAIL+1)); }
rm -rf "$SBX"

echo "▸ test 5: default copy is idempotent (does not overwrite)"
SBX="$(make_sandbox)"
run "$SBX" >/dev/null
echo "MARKER=keepme" > "$SBX/.env"
run "$SBX" >/dev/null
grep -q "MARKER=keepme" "$SBX/.env" \
  && { echo "${GRN}✓${RST} existing .env preserved"; PASS=$((PASS+1)); } \
  || { echo "${RED}✗${RST} existing .env overwritten"; FAIL=$((FAIL+1)); }
rm -rf "$SBX"

echo "▸ test 6: --force overwrites existing .env"
SBX="$(make_sandbox)"
echo "MARKER=keepme" > "$SBX/.env"
code="$(run "$SBX" --force)"
assert_eq "exit code" 0 "$code"
grep -q "MARKER=keepme" "$SBX/.env" \
  && { echo "${RED}✗${RST} --force did not overwrite"; FAIL=$((FAIL+1)); } \
  || { echo "${GRN}✓${RST} --force overwrote"; PASS=$((PASS+1)); }
rm -rf "$SBX"

echo "▸ test 7: missing frontend template returns 1"
SBX="$(make_sandbox)"
rm "$SBX/.env.example"
assert_eq "exit code" 1 "$(run "$SBX")"
rm -rf "$SBX"

echo "▸ test 8: missing functions template returns 1"
SBX="$(make_sandbox)"
rm "$SBX/supabase/functions/.env.example"
assert_eq "exit code" 1 "$(run "$SBX")"
rm -rf "$SBX"

echo "▸ test 9: --validate on placeholder templates returns 3"
SBX="$(make_sandbox)"
run "$SBX" >/dev/null
assert_eq "exit code" 3 "$(run "$SBX" --validate)"
rm -rf "$SBX"

echo "▸ test 10: --validate with real-looking values returns 0"
SBX="$(make_sandbox)"
cat > "$SBX/.env" <<'EOF'
VITE_SUPABASE_URL="https://realref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJrealtokenvalue.signedpayload.signature"
VITE_SUPABASE_PROJECT_ID="realref"
EOF
cat > "$SBX/supabase/functions/.env" <<'EOF'
SUPABASE_URL="https://realref.supabase.co"
SUPABASE_ANON_KEY="eyJrealanontoken.signedpayload.signature"
SUPABASE_SERVICE_ROLE_KEY="eyJrealsrtoken.signedpayload.signature"
EOF
assert_eq "exit code" 0 "$(run "$SBX" --validate)"
rm -rf "$SBX"

echo "▸ test 11: --validate with missing required var returns 3"
SBX="$(make_sandbox)"
cat > "$SBX/.env" <<'EOF'
VITE_SUPABASE_URL="https://realref.supabase.co"
VITE_SUPABASE_PROJECT_ID="realref"
EOF
cat > "$SBX/supabase/functions/.env" <<'EOF'
SUPABASE_URL="https://realref.supabase.co"
SUPABASE_ANON_KEY="eyJrealanontoken.signedpayload.signature"
SUPABASE_SERVICE_ROLE_KEY="eyJrealsrtoken.signedpayload.signature"
EOF
assert_eq "exit code" 3 "$(run "$SBX" --validate)"
rm -rf "$SBX"

echo ""
echo "─────────────────────────────────────────"
echo "Results: ${GRN}$PASS passed${RST}, ${RED}$FAIL failed${RST}"
echo "─────────────────────────────────────────"
[[ $FAIL -eq 0 ]] || exit 1
