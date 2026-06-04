#!/usr/bin/env bash
# ============================================================
# setup-env.sh — Bootstrap local .env files from .env.example
# ============================================================
# Usage:
#   bash scripts/setup-env.sh               # copy templates (no overwrite)
#   bash scripts/setup-env.sh --force       # overwrite existing .env files
#   source scripts/setup-env.sh --load      # copy + export vars in current shell
#
# Tip: to load vars into your CURRENT shell, you MUST use `source`:
#   source scripts/setup-env.sh --load
# ============================================================

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORCE=0
LOAD=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --load)  LOAD=1 ;;
    -h|--help)
      sed -n '2,15p' "${BASH_SOURCE[0]}"
      return 0 2>/dev/null || exit 0
      ;;
  esac
done

copy_template() {
  local src="$1" dst="$2"
  if [[ ! -f "$src" ]]; then
    echo "⚠️  Template missing: $src (skip)"
    return 0
  fi
  if [[ -f "$dst" && $FORCE -eq 0 ]]; then
    echo "✓ Kept existing: $dst (use --force to overwrite)"
    return 0
  fi
  cp "$src" "$dst"
  echo "✅ Wrote: $dst"
}

echo "📦 Bootstrapping local env files..."
copy_template "$ROOT_DIR/.env.example"                       "$ROOT_DIR/.env"
copy_template "$ROOT_DIR/supabase/functions/.env.example"    "$ROOT_DIR/supabase/functions/.env"

if [[ $LOAD -eq 1 ]]; then
  if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo ""
    echo "⚠️  --load requires sourcing the script to export into your shell:"
    echo "    source scripts/setup-env.sh --load"
    exit 1
  fi
  echo "🔐 Loading variables into current shell..."
  set -a
  # shellcheck disable=SC1090
  [[ -f "$ROOT_DIR/.env" ]]                    && source "$ROOT_DIR/.env"
  # shellcheck disable=SC1090
  [[ -f "$ROOT_DIR/supabase/functions/.env" ]] && source "$ROOT_DIR/supabase/functions/.env"
  set +a
  echo "✅ Env vars exported (frontend + edge functions)."
fi

echo ""
echo "👉 Next: edit .env and supabase/functions/.env with real values."
echo "   Then run:   source scripts/setup-env.sh --load"
