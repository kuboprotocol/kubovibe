#!/usr/bin/env bash
# ============================================================
# setup-env.sh — Bootstrap & validate local .env files
# ============================================================
# Usage:
#   bash scripts/setup-env.sh                # copy templates (no overwrite)
#   bash scripts/setup-env.sh --force        # overwrite existing .env files
#   bash scripts/setup-env.sh --dry-run      # show what would happen, write nothing
#   bash scripts/setup-env.sh --validate     # only validate existing .env files
#   source scripts/setup-env.sh --load       # copy + export vars in current shell
#   bash scripts/setup-env.sh --help
#
# Flags can be combined, e.g.:
#   bash scripts/setup-env.sh --force --validate
#   source scripts/setup-env.sh --force --load
#
# Exit codes:
#   0  success
#   1  missing template / IO error
#   2  invalid flag
#   3  validation failed (placeholders still present or required vars missing)
# ============================================================

set -u
set -o pipefail

# ── Colors (auto-disabled when not a TTY) ──────────────────
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'
  C_BLU=$'\033[34m'; C_DIM=$'\033[2m';  C_RST=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; C_DIM=""; C_RST=""
fi

log()   { echo "${C_BLU}▸${C_RST} $*"; }
ok()    { echo "${C_GRN}✓${C_RST} $*"; }
warn()  { echo "${C_YLW}⚠${C_RST}  $*" >&2; }
err()   { echo "${C_RED}✗ ERROR:${C_RST} $*" >&2; }
hint()  { echo "  ${C_DIM}↳ $*${C_RST}" >&2; }

# ── Pre-check: bash version (need 4+ for assoc arrays) ─────
if [[ -z "${BASH_VERSION:-}" ]]; then
  err "This script requires bash (got: $(ps -p $$ -o comm= 2>/dev/null || echo unknown))."
  hint "Run: bash scripts/setup-env.sh"
  exit 1
fi
if (( BASH_VERSINFO[0] < 4 )); then
  err "Bash 4+ required (current: $BASH_VERSION)."
  hint "macOS users: brew install bash"
  exit 1
fi

# ── Parse args ─────────────────────────────────────────────
FORCE=0; LOAD=0; DRY=0; VALIDATE_ONLY=0; REPORT=0
REPORT_PATH=""

for arg in "$@"; do
  case "$arg" in
    --force)    FORCE=1 ;;
    --load)     LOAD=1 ;;
    --dry-run)  DRY=1 ;;
    --validate) VALIDATE_ONLY=1 ;;
    --report)   REPORT=1 ;;
    --report=*) REPORT=1; REPORT_PATH="${arg#--report=}" ;;
    -h|--help)
      sed -n '2,22p' "${BASH_SOURCE[0]}"
      return 0 2>/dev/null || exit 0
      ;;
    *)
      err "Unknown flag: $arg"
      hint "Run with --help for usage."
      return 2 2>/dev/null || exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_TEMPLATE="$ROOT_DIR/.env.example"
FUNCTIONS_TEMPLATE="$ROOT_DIR/supabase/functions/.env.example"
FRONTEND_ENV="$ROOT_DIR/.env"
FUNCTIONS_ENV="$ROOT_DIR/supabase/functions/.env"

# ── Pre-check: template existence ──────────────────────────
missing_templates=0
if [[ ! -f "$FRONTEND_TEMPLATE" ]]; then
  err "Frontend template not found: $FRONTEND_TEMPLATE"
  hint "Run this script from the repo root, or restore the file from git."
  missing_templates=1
fi
if [[ ! -f "$FUNCTIONS_TEMPLATE" ]]; then
  err "Edge-functions template not found: $FUNCTIONS_TEMPLATE"
  hint "Restore supabase/functions/.env.example or check your checkout."
  missing_templates=1
fi
(( missing_templates )) && { return 1 2>/dev/null || exit 1; }

# ── Pre-check: parent dirs writable ────────────────────────
for d in "$ROOT_DIR" "$ROOT_DIR/supabase/functions"; do
  if [[ ! -d "$d" ]]; then
    err "Required directory missing: $d"
    return 1 2>/dev/null || exit 1
  fi
  if [[ ! -w "$d" && $VALIDATE_ONLY -eq 0 ]]; then
    err "Directory not writable: $d"
    hint "Check permissions (ls -ld \"$d\")."
    return 1 2>/dev/null || exit 1
  fi
done

# ── Required variable lists ────────────────────────────────
REQUIRED_FRONTEND=(
  VITE_SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY
  VITE_SUPABASE_PROJECT_ID
)
REQUIRED_FUNCTIONS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
)

# Patterns that indicate an unfilled placeholder value.
PLACEHOLDER_REGEX='^(your-|sk_live_\.\.\.|sk-\.\.\.|sk-or-v1-\.\.\.|gsk_\.\.\.|fc-\.\.\.|whsec_\.\.\.|polar_\.\.\.|ghs_\.\.\.|GOCSPX-\.\.\.|xoxb-\.\.\.|lvb_\.\.\.|0x\.\.\.|eyJhbGciOiJIUzI1NiIs\.\.\.|base64-32-bytes\.\.\.|random-long-string|xxx\.apps\.googleusercontent\.com|Iv1\.xxxxxxxxxxxxxxxx|https://your-project-ref|postgres://postgres:\[password\])'

# read_env <file> → echoes "KEY=VALUE" lines (stripped, no comments)
read_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  # shellcheck disable=SC2002
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$f" | sed 's/[[:space:]]*$//'
}

# get_value <file> <KEY>
get_value() {
  local f="$1" key="$2"
  read_env "$f" | awk -F= -v k="$key" '$1==k { sub(/^[^=]+=/,""); print; exit }' \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# validate_file <label> <file> <required_var...>
# Populates REPORT_LINES (global) with per-key status when REPORT=1.
REPORT_LINES=()
validate_file() {
  local label="$1" file="$2"; shift 2
  local required=( "$@" )
  local fails=0

  if [[ ! -f "$file" ]]; then
    err "[$label] missing: $file"
    hint "Run: bash scripts/setup-env.sh   (without --validate)"
    REPORT_LINES+=( "| $label | _file_ | ❌ missing | $file |" )
    return 1
  fi

  log "Validating $label → $file"

  for key in "${required[@]}"; do
    local val status note
    val="$(get_value "$file" "$key" || true)"
    if [[ -z "$val" ]]; then
      err "[$label] $key is missing or empty"
      status="❌ missing"; note="empty / unset"
      fails=$((fails+1))
    elif [[ "$val" =~ $PLACEHOLDER_REGEX ]]; then
      err "[$label] $key still has placeholder value: $val"
      hint "Edit $file and replace with a real value."
      status="⚠️ placeholder"; note="value: \`$val\`"
      fails=$((fails+1))
    else
      ok "[$label] $key set (${#val} chars)"
      status="✅ ok"; note="${#val} chars"
    fi
    REPORT_LINES+=( "| $label | \`$key\` | $status | $note |" )
  done

  return $fails
}

write_report() {
  local total="$1" path="${REPORT_PATH:-reports/env-check.md}"
  local abs="$ROOT_DIR/$path"
  [[ "$path" = /* ]] && abs="$path"
  mkdir -p "$(dirname "$abs")"
  {
    echo "# env-check report"
    echo ""
    echo "- **Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- **Status:** $([[ $total -eq 0 ]] && echo '✅ pass' || echo "❌ fail ($total issue(s))")"
    echo "- **Frontend env:** \`${FRONTEND_ENV#$ROOT_DIR/}\`"
    echo "- **Functions env:** \`${FUNCTIONS_ENV#$ROOT_DIR/}\`"
    echo ""
    echo "| Scope | Variable | Status | Detail |"
    echo "|-------|----------|--------|--------|"
    for line in "${REPORT_LINES[@]}"; do echo "$line"; done
    echo ""
    echo "_Generated by \`scripts/setup-env.sh --validate --report\`. Exit codes: 0 ok · 3 validation failed._"
  } > "$abs"
  ok "Report written: ${abs#$ROOT_DIR/}"
}

# ── Validate-only mode ─────────────────────────────────────
if (( VALIDATE_ONLY )); then
  total_fails=0
  validate_file "frontend"  "$FRONTEND_ENV"  "${REQUIRED_FRONTEND[@]}"  || total_fails=$((total_fails + $?))
  validate_file "functions" "$FUNCTIONS_ENV" "${REQUIRED_FUNCTIONS[@]}" || total_fails=$((total_fails + $?))
  echo ""
  (( REPORT )) && write_report "$total_fails"
  if (( total_fails == 0 )); then
    ok "All required variables present and filled."
    return 0 2>/dev/null || exit 0
  else
    err "$total_fails validation failure(s)."
    return 3 2>/dev/null || exit 3
  fi
fi

# ── Copy step ──────────────────────────────────────────────
copy_template() {
  local src="$1" dst="$2" label="$3"
  if [[ ! -f "$src" ]]; then
    err "[$label] template missing: $src"
    return 1
  fi
  if [[ -f "$dst" && $FORCE -eq 0 ]]; then
    warn "[$label] kept existing: $dst (use --force to overwrite)"
    return 0
  fi
  if (( DRY )); then
    log "[dry-run] would copy: $src → $dst"
    return 0
  fi
  cp "$src" "$dst"
  ok "[$label] wrote: $dst"
}

if (( DRY )); then
  log "Dry-run mode: no files will be written."
fi

log "Bootstrapping local env files..."
copy_template "$FRONTEND_TEMPLATE"  "$FRONTEND_ENV"  "frontend"
copy_template "$FUNCTIONS_TEMPLATE" "$FUNCTIONS_ENV" "functions"

# ── Optional: load into current shell ──────────────────────
if (( LOAD )); then
  if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    warn "--load requires sourcing the script:"
    hint "source scripts/setup-env.sh --load"
    exit 1
  fi
  if (( DRY )); then
    warn "--load ignored in --dry-run mode."
  else
    log "Exporting variables into current shell..."
    set -a
    # shellcheck disable=SC1090
    [[ -f "$FRONTEND_ENV" ]]  && source "$FRONTEND_ENV"
    # shellcheck disable=SC1090
    [[ -f "$FUNCTIONS_ENV" ]] && source "$FUNCTIONS_ENV"
    set +a
    ok "Env vars exported (frontend + edge functions)."
  fi
fi

echo ""
if (( DRY )); then
  log "Dry-run complete. Re-run without --dry-run to apply."
else
  log "Next steps:"
  echo "  1. Edit ${FRONTEND_ENV#$ROOT_DIR/} and ${FUNCTIONS_ENV#$ROOT_DIR/} with real values"
  echo "  2. Validate:  bash scripts/setup-env.sh --validate"
  echo "  3. Load:      source scripts/setup-env.sh --load"
fi
