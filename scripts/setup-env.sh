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
FORCE=0; LOAD=0; DRY=0; VALIDATE_ONLY=0; REPORT=0; REPORT_JSON=0
PRINT_EFFECTIVE=0
REPORT_PATH=""
REPORT_JSON_PATH=""

# CI annotation mode: emit ::error:: lines when running on GitHub Actions.
CI_ANNOTATE=0
[[ "${GITHUB_ACTIONS:-}" == "true" ]] && CI_ANNOTATE=1

# annotate <level> <file> <message>   (level=error|warning|notice)
annotate() {
  (( CI_ANNOTATE )) || return 0
  local level="$1" file="$2" msg="$3"
  msg="${msg//$'\n'/%0A}"
  printf '::%s file=%s::%s\n' "$level" "$file" "$msg"
}

for arg in "$@"; do
  case "$arg" in
    --force)    FORCE=1 ;;
    --load)     LOAD=1 ;;
    --dry-run)  DRY=1 ;;
    --validate) VALIDATE_ONLY=1 ;;
    --report)   REPORT=1 ;;
    --report=*) REPORT=1; REPORT_PATH="${arg#--report=}" ;;
    --report-json)   REPORT_JSON=1 ;;
    --report-json=*) REPORT_JSON=1; REPORT_JSON_PATH="${arg#--report-json=}" ;;
    --print-effective) PRINT_EFFECTIVE=1 ;;
    --no-annotate)     CI_ANNOTATE=0 ;;
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
# Populates REPORT_LINES (markdown) and REPORT_JSON_ENTRIES (json fragments).
REPORT_LINES=()
REPORT_JSON_ENTRIES=()

# json_escape <string>
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

validate_file() {
  local label="$1" file="$2"; shift 2
  local required=( "$@" )
  local fails=0

  if [[ ! -f "$file" ]]; then
    err "[$label] missing: $file"
    hint "Run: bash scripts/setup-env.sh   (without --validate)"
    annotate error "${file#$ROOT_DIR/}" "[$label] env file is missing — run: bash scripts/setup-env.sh"
    REPORT_LINES+=( "| $label | _file_ | ❌ missing | $file |" )
    REPORT_JSON_ENTRIES+=( "{\"scope\":\"$(json_escape "$label")\",\"variable\":null,\"status\":\"missing_file\",\"detail\":\"$(json_escape "$file")\"}" )
    return 1
  fi

  log "Validating $label → $file"

  local relfile="${file#$ROOT_DIR/}"
  for key in "${required[@]}"; do
    local val status note jstatus
    val="$(get_value "$file" "$key" || true)"
    if [[ -z "$val" ]]; then
      err "[$label] $key is missing or empty"
      annotate error "$relfile" "[$label] env var '$key' is missing or empty"
      status="❌ missing"; note="empty / unset"; jstatus="missing"
      fails=$((fails+1))
    elif [[ "$val" =~ $PLACEHOLDER_REGEX ]]; then
      err "[$label] $key still has placeholder value: $val"
      hint "Edit $file and replace with a real value."
      annotate error "$relfile" "[$label] env var '$key' still has placeholder value ($val)"
      status="⚠️ placeholder"; note="value: \`$val\`"; jstatus="placeholder"
      fails=$((fails+1))
    else
      ok "[$label] $key set (${#val} chars)"
      status="✅ ok"; note="${#val} chars"; jstatus="ok"
    fi
    REPORT_LINES+=( "| $label | \`$key\` | $status | $note |" )
    REPORT_JSON_ENTRIES+=( "{\"scope\":\"$(json_escape "$label")\",\"variable\":\"$(json_escape "$key")\",\"status\":\"$jstatus\",\"detail\":\"$(json_escape "$note")\"}" )
  done

  return $fails
}

# mask_value <value> — show first 4 + last 4 chars, mask the middle.
mask_value() {
  local v="$1" n=${#1}
  if (( n <= 8 )); then
    printf '%s' "$(printf '%*s' "$n" '' | tr ' ' '*')"
  else
    printf '%s…%s (%d chars)' "${v:0:4}" "${v: -4}" "$n"
  fi
}

# print_effective: dump resolved env values (masked) for both scopes.
print_effective() {
  echo ""
  log "Effective env (values masked — first 4 + last 4 chars):"
  local scope file keys key val
  for scope in frontend functions; do
    if [[ "$scope" == frontend ]]; then file="$FRONTEND_ENV"; keys=( "${REQUIRED_FRONTEND[@]}" )
    else                                 file="$FUNCTIONS_ENV"; keys=( "${REQUIRED_FUNCTIONS[@]}" )
    fi
    echo ""
    echo "  ${C_BLU}# $scope${C_RST} (${file#$ROOT_DIR/})"
    if [[ ! -f "$file" ]]; then
      echo "    (file not found)"
      continue
    fi
    for key in "${keys[@]}"; do
      val="$(get_value "$file" "$key" || true)"
      if [[ -z "$val" ]]; then
        printf '    %-32s = %s\n' "$key" "${C_RED}<unset>${C_RST}"
      else
        printf '    %-32s = %s\n' "$key" "$(mask_value "$val")"
      fi
    done
  done
  echo ""
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

write_report_json() {
  local total="$1" path="${REPORT_JSON_PATH:-reports/env-check.json}"
  local abs="$ROOT_DIR/$path"
  [[ "$path" = /* ]] && abs="$path"
  mkdir -p "$(dirname "$abs")"
  local status="pass"
  (( total > 0 )) && status="fail"
  {
    printf '{\n'
    printf '  "$schema": "./env-check.schema.json",\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "status": "%s",\n' "$status"
    printf '  "failures": %s,\n' "$total"
    printf '  "frontend_env": "%s",\n' "$(json_escape "${FRONTEND_ENV#$ROOT_DIR/}")"
    printf '  "functions_env": "%s",\n' "$(json_escape "${FUNCTIONS_ENV#$ROOT_DIR/}")"
    printf '  "entries": [\n'
    local i=0 n=${#REPORT_JSON_ENTRIES[@]}
    for entry in "${REPORT_JSON_ENTRIES[@]}"; do
      i=$((i+1))
      if (( i < n )); then printf '    %s,\n' "$entry"
      else                  printf '    %s\n'  "$entry"
      fi
    done
    printf '  ]\n}\n'
  } > "$abs"
  ok "JSON report written: ${abs#$ROOT_DIR/}"
}

# ── Validate-only mode ─────────────────────────────────────
if (( VALIDATE_ONLY )); then
  total_fails=0
  validate_file "frontend"  "$FRONTEND_ENV"  "${REQUIRED_FRONTEND[@]}"  || total_fails=$((total_fails + $?))
  validate_file "functions" "$FUNCTIONS_ENV" "${REQUIRED_FUNCTIONS[@]}" || total_fails=$((total_fails + $?))
  echo ""
  (( REPORT )) && write_report "$total_fails"
  (( REPORT_JSON )) && write_report_json "$total_fails"
  (( PRINT_EFFECTIVE )) && print_effective
  if (( total_fails == 0 )); then
    ok "All required variables present and filled."
    return 0 2>/dev/null || exit 0
  else
    err "$total_fails validation failure(s)."
    return 3 2>/dev/null || exit 3
  fi
fi

# Standalone --print-effective (no --validate)
if (( PRINT_EFFECTIVE )); then
  print_effective
  return 0 2>/dev/null || exit 0
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
