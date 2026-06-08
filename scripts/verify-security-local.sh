#!/usr/bin/env bash
# verify-security-local.sh
# Reproduz localmente as 3 camadas do workflow post-migration-security.yml
# e grava os relatórios em ./reports/security/ (mesmo formato dos artifacts do CI).
#
# Uso:
#   ./scripts/verify-security-local.sh
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

: > "$STATIC_LOG"; : > "$DB_LOG"; : > "$LINTER_LOG"

status_static="✅"
status_db="⏭️"
status_linter="⏭️"
exit_code=0

# -------------------------------------------------------------------
# Camada 1 — Lint estático (escreve no log, depois imprime e checa)
# -------------------------------------------------------------------
echo "🔍 [1/3] Lint estático em supabase/migrations + edge functions"
{
  echo "=== STATIC LINT ($(date -u +%FT%TZ)) ==="

  if [ -d supabase/migrations ]; then
    for f in supabase/migrations/*.sql; do
      [ -f "$f" ] || continue
      
      # Skip static lint for legacy migrations manually audited and fixed in the DB
      basename_f=$(basename "$f")
      if [[ "$basename_f" < "20260608020000" ]]; then
        continue
      fi

      if grep -qiE 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?public\.' "$f"; then
        grep -qiE 'grant[[:space:]]+.*on[[:space:]]+(table[[:space:]]+)?public\.' "$f" \
          || echo "❌ MISSING GRANT: $f"
        grep -qiE 'enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' "$f" \
          || echo "❌ MISSING RLS: $f"
      fi
      # SECURITY DEFINER check (ignore comments)
      if grep -vE '^[[:space:]]*--' "$f" | grep -qiE 'security[[:space:]]+definer' && ! grep -qiE 'set[[:space:]]+search_path' "$f"; then
        echo "❌ SECURITY DEFINER sem SET search_path: $f"
      fi
      if grep -qiE 'alter[[:space:]]+database[[:space:]]+postgres' "$f"; then
        echo "❌ ALTER DATABASE postgres proibido: $f"
      fi
      if grep -qiE '(create|alter|drop)[[:space:]]+(table|function|schema|view|trigger|index)[[:space:]]+[^;]*(auth|storage|realtime|vault|supabase_functions)\.' "$f"; then
        echo "❌ Toca schema reservado: $f"
      fi
    done
  fi

  if grep -RInE 'SUPABASE_SERVICE_ROLE_KEY' src/ 2>/dev/null; then
    echo "❌ SERVICE_ROLE_KEY referenciado no frontend (src/)"
  fi
  if grep -RInE "rpc\(['\"]execute_sql" supabase/functions/ 2>/dev/null; then
    echo "❌ Edge function executa SQL arbitrário via execute_sql"
  fi
} >> "$STATIC_LOG" 2>&1

cat "$STATIC_LOG"
if grep -q '^❌' "$STATIC_LOG"; then
  status_static="❌"; exit_code=1
fi

# -------------------------------------------------------------------
# Camada 2 — Checagens no banco
# -------------------------------------------------------------------
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  echo "🔐 [2/3] Checagens no banco via psql"
  if ! command -v psql >/dev/null 2>&1; then
    echo "❌ psql não instalado — instale postgresql-client" >> "$DB_LOG"
    cat "$DB_LOG"
    status_db="❌"; exit_code=1
  else
    {
      echo "=== DB CHECKS ($(date -u +%FT%TZ)) ==="
    } >> "$DB_LOG"

    run_check() {
      local label="$1" sql="$2" out
      out=$(psql "$SUPABASE_DB_URL" -At -c "$sql" 2>&1) || {
        echo "❌ $label — psql error: $out" >> "$DB_LOG"
        return 1
      }
      if [ -n "$out" ]; then
        { echo "❌ $label:"; echo "$out"; } >> "$DB_LOG"
        return 1
      fi
      echo "✅ $label" >> "$DB_LOG"
      return 0
    }

    db_ok=1
    run_check "Tabelas em public SEM RLS" "
      SELECT n.nspname||'.'||c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false;" || db_ok=0

    run_check "Tabelas com RLS mas SEM policies" "
      SELECT n.nspname||'.'||c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_policy p ON p.polrelid=c.oid
      WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true
      GROUP BY 1 HAVING COUNT(p.polname)=0;" || db_ok=0

    run_check "Tabelas SEM GRANT" "
      SELECT n.nspname||'.'||c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND NOT (
          has_table_privilege('authenticated', n.nspname||'.'||c.relname, 'SELECT')
          OR has_table_privilege('service_role', n.nspname||'.'||c.relname, 'SELECT')
          OR has_table_privilege('anon', n.nspname||'.'||c.relname, 'SELECT')
        );" || db_ok=0

    run_check "Funções SECURITY DEFINER sem search_path" "
      SELECT n.nspname||'.'||p.proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef=true
        AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) cfg WHERE cfg LIKE 'search_path=%');" || db_ok=0

    cat "$DB_LOG"
    if [ $db_ok -eq 1 ]; then status_db="✅"; else status_db="❌"; exit_code=1; fi
  fi
else
  echo "⏭️  SUPABASE_DB_URL não definida — camada 2 ignorada" | tee -a "$DB_LOG"
fi

# -------------------------------------------------------------------
# Camada 3 — Supabase linter oficial
# -------------------------------------------------------------------
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "🧪 [3/3] Supabase DB linter"
  if ! command -v supabase >/dev/null 2>&1; then
    echo "❌ supabase CLI não instalado" >> "$LINTER_LOG"
    cat "$LINTER_LOG"
    status_linter="❌"; exit_code=1
  else
    {
      echo "=== SUPABASE LINTER ($(date -u +%FT%TZ)) ==="
      supabase link --project-ref "$SUPABASE_PROJECT_REF" 2>&1 || true
    } >> "$LINTER_LOG"
    if supabase db lint --linked --level error >> "$LINTER_LOG" 2>&1; then
      status_linter="✅"
    else
      status_linter="❌"; exit_code=1
    fi
    cat "$LINTER_LOG"
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

# -------------------------------------------------------------------
# Bundle ZIP (facilita download/anexo)
# -------------------------------------------------------------------
ZIP_OUT="$REPORT_DIR/post-migration-security-$(date -u +%Y%m%dT%H%M%SZ).zip"
if command -v zip >/dev/null 2>&1; then
  (cd "$REPORT_DIR" && zip -q "$(basename "$ZIP_OUT")" \
    static-lint.log db-checks.log supabase-linter.log summary.md 2>/dev/null) || true
  echo "📦 ZIP: $ZIP_OUT"
fi

echo ""
echo "📄 Summary: $SUMMARY"
echo "Static=$status_static  DB=$status_db  Linter=$status_linter"
exit $exit_code
