#!/usr/bin/env bash
# verify-security-local.sh
# Reproduz localmente as 3 camadas do workflow post-migration-security.yml
# e grava os relatórios em ./reports/security/ (mesmo formato dos artifacts do CI).
#
# Uso:
#   ./scripts/verify-security-local.sh                # camada 1 sempre, 2 e 3 se secrets exportados
#   SUPABASE_DB_URL=... ./scripts/verify-security-local.sh
#   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... ./scripts/verify-security-local.sh
#
# Saída:
#   reports/security/static-lint.log
#   reports/security/db-checks.log
#   reports/security/supabase-linter.log
#   reports/security/summary.md
# Exit code: 0 se todas as camadas executadas passaram, 1 se alguma falhou.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPORT_DIR="reports/security"
mkdir -p "$REPORT_DIR"

STATIC_LOG="$REPORT_DIR/static-lint.log"
DB_LOG="$REPORT_DIR/db-checks.log"
LINTER_LOG="$REPORT_DIR/supabase-linter.log"
SUMMARY="$REPORT_DIR/summary.md"

: > "$STATIC_LOG"
: > "$DB_LOG"
: > "$LINTER_LOG"

status_static="✅"
status_db="⏭️"
status_linter="⏭️"
exit_code=0

log()  { printf '%s\n' "$*"; }
fail() { status_static="❌"; exit_code=1; echo "$*" | tee -a "$STATIC_LOG"; }

# -------------------------------------------------------------------
# Camada 1 — Lint estático
# -------------------------------------------------------------------
log "🔍 [1/3] Lint estático em supabase/migrations + edge functions"
{
  echo "=== STATIC LINT ($(date -u +%FT%TZ)) ==="

  if [ -d supabase/migrations ]; then
    for f in supabase/migrations/*.sql; do
      [ -f "$f" ] || continue
      if grep -qiE 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?public\.' "$f"; then
        grep -qiE 'grant[[:space:]]+.*on[[:space:]]+(table[[:space:]]+)?public\.' "$f" \
          || { echo "❌ MISSING GRANT: $f"; exit_code=1; status_static="❌"; }
        grep -qiE 'enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' "$f" \
          || { echo "❌ MISSING RLS: $f"; exit_code=1; status_static="❌"; }
      fi
      if grep -qiE 'security[[:space:]]+definer' "$f" && ! grep -qiE 'set[[:space:]]+search_path' "$f"; then
        echo "❌ SECURITY DEFINER sem SET search_path: $f"
        exit_code=1; status_static="❌"
      fi
      if grep -qiE 'alter[[:space:]]+database[[:space:]]+postgres' "$f"; then
        echo "❌ ALTER DATABASE postgres proibido: $f"
        exit_code=1; status_static="❌"
      fi
      if grep -qiE '(create|alter|drop)[[:space:]]+[^;]*(auth|storage|realtime|vault|supabase_functions)\.' "$f"; then
        echo "❌ Toca schema reservado: $f"
        exit_code=1; status_static="❌"
      fi
    done
  fi

  if grep -RInE 'SUPABASE_SERVICE_ROLE_KEY' src/ 2>/dev/null; then
    echo "❌ SERVICE_ROLE_KEY referenciado no frontend (src/)"
    exit_code=1; status_static="❌"
  fi
  if grep -RInE "rpc\(['\"]execute_sql" supabase/functions/ 2>/dev/null; then
    echo "❌ Edge function executa SQL arbitrário via execute_sql"
    exit_code=1; status_static="❌"
  fi

  [ "$status_static" = "✅" ] && echo "OK — nenhum padrão inseguro detectado."
} | tee -a "$STATIC_LOG"

# -------------------------------------------------------------------
# Camada 2 — Checagens no banco
# -------------------------------------------------------------------
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  log "🔐 [2/3] Checagens no banco via psql"
  if ! command -v psql >/dev/null 2>&1; then
    echo "❌ psql não instalado — pule ou instale postgresql-client" | tee -a "$DB_LOG"
    status_db="❌"; exit_code=1
  else
    {
      echo "=== DB CHECKS ($(date -u +%FT%TZ)) ==="
      psql_db_ok=1

      run_check() {
        local label="$1" sql="$2"
        local out
        out=$(psql "$SUPABASE_DB_URL" -At -c "$sql" 2>&1) || {
          echo "❌ $label — psql error: $out"; psql_db_ok=0; return
        }
        if [ -n "$out" ]; then
          echo "❌ $label:"; echo "$out"
          psql_db_ok=0
        else
          echo "✅ $label"
        fi
      }

      run_check "Tabelas em public SEM RLS" "
        SELECT n.nspname||'.'||c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false;"

      run_check "Tabelas com RLS mas SEM policies" "
        SELECT n.nspname||'.'||c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        LEFT JOIN pg_policy p ON p.polrelid=c.oid
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true
        GROUP BY 1 HAVING COUNT(p.polname)=0;"

      run_check "Tabelas SEM GRANT" "
        SELECT n.nspname||'.'||c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r'
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.role_table_grants g
            WHERE g.table_schema='public' AND g.table_name=c.relname
              AND g.grantee IN ('authenticated','anon','service_role'));"

      run_check "Funções SECURITY DEFINER sem search_path" "
        SELECT n.nspname||'.'||p.proname FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.prosecdef=true
          AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%');"

      if [ $psql_db_ok -eq 1 ]; then status_db="✅"; else status_db="❌"; exit_code=1; fi
    } | tee -a "$DB_LOG"
  fi
else
  echo "⏭️  SUPABASE_DB_URL não definida — camada 2 ignorada" | tee -a "$DB_LOG"
fi

# -------------------------------------------------------------------
# Camada 3 — Supabase linter oficial
# -------------------------------------------------------------------
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  log "🧪 [3/3] Supabase DB linter"
  if ! command -v supabase >/dev/null 2>&1; then
    echo "❌ supabase CLI não instalado (https://supabase.com/docs/guides/cli)" | tee -a "$LINTER_LOG"
    status_linter="❌"; exit_code=1
  else
    {
      echo "=== SUPABASE LINTER ($(date -u +%FT%TZ)) ==="
      supabase link --project-ref "$SUPABASE_PROJECT_REF" 2>&1 || true
      if supabase db lint --linked --level error 2>&1; then
        status_linter="✅"
      else
        status_linter="❌"; exit_code=1
      fi
    } | tee -a "$LINTER_LOG"
  fi
else
  echo "⏭️  SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF ausentes — camada 3 ignorada" | tee -a "$LINTER_LOG"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
{
  echo "# Post-Migration Security — Relatório Local"
  echo
  echo "_Gerado em $(date -u +%FT%TZ)_"
  echo
  echo "| Camada | Status |"
  echo "|---|---|"
  echo "| 1. Lint estático        | $status_static |"
  echo "| 2. Checagens no banco   | $status_db |"
  echo "| 3. Supabase linter      | $status_linter |"
  echo
  echo "Logs: \`$STATIC_LOG\`, \`$DB_LOG\`, \`$LINTER_LOG\`"
} > "$SUMMARY"

log ""
log "📄 Summary: $SUMMARY"
log "Static=$status_static  DB=$status_db  Linter=$status_linter"
exit $exit_code
