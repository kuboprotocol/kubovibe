#!/usr/bin/env bash
# fixture-eol-fuzzer.sh — Gerador de fixtures fast-check summary com EOLs
# aleatórios (LF/CRLF/CR misturados por linha) + parser de bullets + testes
# unitários do parser. Garante que verify-fc-summary.sh tolera qualquer
# combinação aleatória de quebras de linha.
#
# Modos:
#   gen-fixture <out_path> [--seed N] [--mode staged|fallback|mixed]
#       Emite 1 fixture com EOL fuzzeado por linha.
#
#   parse-bullet <file>
#       Parser tolerante: extrai (kind|token|url) por bullet
#       canônico OU fallback. Emite TSV ordenado: kind\ttoken\turl.
#         kind ∈ { seeds_canonical, failures_canonical, seeds_fallback, failures_fallback }
#         url  = "" para fallback
#       Códigos: 0 ok, 2 sem bullets reconhecidos.
#
#   test-parser
#       Roda os testes unitários do parser (fixtures determinísticos).
#
#   fuzz [--iters N] [--seed BASE]
#       Gera N fixtures com EOL aleatório, roda parser + verify-fc-summary.sh,
#       confere que parser e verifier concordam (consistência cruzada).
#
# CI: chamado em .github/workflows/verify-fc-summary.yml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY="${SCRIPT_DIR}/verify-fc-summary.sh"

SEEDS_URL_DEFAULT="https://example.com/seeds"
FAILURES_URL_DEFAULT="https://example.com/failures"

# ─── PRNG determinístico (LCG) ───────────────────────────────────────────────
# Bash $RANDOM é process-global e não permite seed estável entre chamadas.
# Usamos um LCG glibc-style (a=1103515245, c=12345, m=2^31) para reprodutibilidade.
__RNG_STATE=0
rng_seed() { __RNG_STATE=$(( $1 & 0x7fffffff )); }
rng_next() {
  __RNG_STATE=$(( (__RNG_STATE * 1103515245 + 12345) & 0x7fffffff ))
  echo "${__RNG_STATE}"
}
rng_pick() {
  # rng_pick N -> 0..N-1
  local n="$1" r
  r=$(rng_next)
  echo $(( r % n ))
}

# ─── EOL fuzz ────────────────────────────────────────────────────────────────
# Cada linha recebe um terminador aleatório: LF, CRLF, CR, ou CRLF duplicado
# (representando trailing \r espúrio comum em PRs com mixed checkout configs).
# Conjunto realista para repos versionados em Git: LF, CRLF, CRLF com \r
# extra (drift de checkout config). Bare CR (Mac classic) é excluído porque
# a toolchain do verifier (grep -E) é orientada a \n e não cobre esse caso —
# o parser Python aqui tolera, mas o contrato do verifier não inclui CR-only.
random_eol() {
  case "$(rng_pick 3)" in
    0) printf '\n' ;;
    1) printf '\r\n' ;;
    2) printf '\r\r\n' ;;
  esac
}

emit_line() { printf '%s' "$1"; random_eol; }

# ─── geração de fixtures ─────────────────────────────────────────────────────
gen_staged_canonical() {
  local out="$1" seeds_url="$2" failures_url="$3"
  {
    emit_line "# Preflight CORS Fuzz — request-headers"
    emit_line ""
    emit_line "### 🎯 fast-check direct downloads (Access-Control-Request-Headers)"
    emit_line ""
    emit_line "- 🌱 **Seeds executed (last 50 runs):** [\`fc-seeds.json\`](${seeds_url})"
    emit_line "- 💥 **Minimized counterexamples (last 100):** [\`fc-failures.json\`](${failures_url})"
    emit_line ""
    emit_line "_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._"
  } > "${out}"
}

gen_fallback() {
  local out="$1"
  {
    emit_line "# Preflight CORS Fuzz — request-headers"
    emit_line ""
    emit_line "### 🎯 fast-check direct downloads (Access-Control-Request-Headers)"
    emit_line ""
    emit_line "- 🌱 \`fc-seeds.json\` — _(not produced in this run)_"
    emit_line "- 💥 \`fc-failures.json\` — _(no failures persisted in this run — invariants held)_"
    emit_line ""
    emit_line "_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._"
  } > "${out}"
}

gen_mixed() {
  # Um canônico + um fallback (cenário híbrido válido).
  local out="$1" seeds_url="$2"
  {
    emit_line "# Preflight CORS Fuzz — request-headers"
    emit_line ""
    emit_line "### 🎯 fast-check direct downloads (Access-Control-Request-Headers)"
    emit_line ""
    emit_line "- 🌱 **Seeds executed (last 50 runs):** [\`fc-seeds.json\`](${seeds_url})"
    emit_line "- 💥 \`fc-failures.json\` — _(no failures persisted in this run — invariants held)_"
    emit_line ""
    emit_line "_The two files above are uploaded as standalone GitHub artifacts so you can curl or download them without unpacking the full bundle._"
  } > "${out}"
}

cmd_gen_fixture() {
  local out="" seed=42 mode="staged"
  while [ $# -gt 0 ]; do
    case "$1" in
      --seed) seed="$2"; shift 2 ;;
      --mode) mode="$2"; shift 2 ;;
      *) [ -z "${out}" ] && out="$1" || { echo "unexpected arg: $1" >&2; return 1; }; shift ;;
    esac
  done
  [ -n "${out}" ] || { echo "usage: gen-fixture <out_path> [--seed N] [--mode staged|fallback|mixed]" >&2; return 1; }
  rng_seed "${seed}"
  case "${mode}" in
    staged)   gen_staged_canonical "${out}" "${SEEDS_URL_DEFAULT}" "${FAILURES_URL_DEFAULT}" ;;
    fallback) gen_fallback         "${out}" ;;
    mixed)    gen_mixed            "${out}" "${SEEDS_URL_DEFAULT}" ;;
    *) echo "unknown mode: ${mode}" >&2; return 1 ;;
  esac
}

# ─── parser ──────────────────────────────────────────────────────────────────
# Tolerante a qualquer mistura de \r e \n. Estratégia:
#   1. Normaliza EOLs para \n (tr -d '\r' não basta para CR-only; usamos sed).
#   2. Identifica bullet por regex e classifica canônico vs fallback.
#
# Saída: TSV ordenado por kind para diff estável.
parse_file() {
  local file="$1"
  # Normaliza qualquer combinação de \r\n, \r, \r\r\n para \n único.
  # awk processa byte-a-byte usando RS='' no record level depois.
  python3 - "$file" <<'PY'
import re, sys
raw = open(sys.argv[1], 'rb').read()
# Normaliza EOLs: \r\n -> \n, \r -> \n. Colapsa \n+ duplicados em \n para
# evitar linhas vazias adjacentes interferirem.
norm = raw.replace(b'\r\n', b'\n').replace(b'\r', b'\n').decode('utf-8', errors='replace')

# Bullets: leading whitespace? + '-' + ws+
BULLET = re.compile(r'^\s*-\s+(.*?)\s*$', re.MULTILINE)

# Canonical: emoji + '**label**' or '__label__' + '[`token`](url)'
CANON_SEEDS = re.compile(
    r'^🌱\s+(?:\*\*|__)Seeds\s+executed[^*_]*(?:\*\*|__)\s+\[\s*`(fc-seeds\.json)`\s*\]\(\s*(\S+?)\s*\)\s*$'
)
CANON_FAILURES = re.compile(
    r'^💥\s+(?:\*\*|__)Minimized\s+counterexamples[^*_]*(?:\*\*|__)\s+\[\s*`(fc-failures\.json)`\s*\]\(\s*(\S+?)\s*\)\s*$'
)
# Fallback: emoji + `token` + ' — _(...)_'
FB_SEEDS    = re.compile(r'^🌱\s+`(fc-seeds\.json)`\s+—\s+_\(.+\)_\s*$')
FB_FAILURES = re.compile(r'^💥\s+`(fc-failures\.json)`\s+—\s+_\(.+\)_\s*$')

found = []
for m in BULLET.finditer(norm):
    body = m.group(1)
    if (mm := CANON_SEEDS.match(body)):
        found.append(('seeds_canonical',    mm.group(1), mm.group(2)))
    elif (mm := CANON_FAILURES.match(body)):
        found.append(('failures_canonical', mm.group(1), mm.group(2)))
    elif (mm := FB_SEEDS.match(body)):
        found.append(('seeds_fallback',     mm.group(1), ''))
    elif (mm := FB_FAILURES.match(body)):
        found.append(('failures_fallback',  mm.group(1), ''))

if not found:
    sys.exit(2)
found.sort()
for kind, token, url in found:
    print(f'{kind}\t{token}\t{url}')
PY
}

cmd_parse_bullet() {
  local file="${1:?parse-bullet <file>}"
  parse_file "${file}"
}

# ─── testes unitários do parser ──────────────────────────────────────────────
PARSER_PASS=0
PARSER_FAIL=0
parser_assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "${expected}" = "${actual}" ]; then
    PARSER_PASS=$((PARSER_PASS + 1))
    printf "  ✅ %s\n" "${name}"
  else
    PARSER_FAIL=$((PARSER_FAIL + 1))
    printf "  ❌ %s\n" "${name}"
    echo "     expected:"; printf '%s\n' "${expected}" | sed 's/^/       /'
    echo "     actual:"  ; printf '%s\n' "${actual}"   | sed 's/^/       /'
  fi
}

cmd_test_parser() {
  local tmp; tmp="$(mktemp -d)"; trap "rm -rf '${tmp}'" RETURN
  echo "── parser unit tests ──"

  # 1) LF puro
  rng_seed 1; gen_staged_canonical "${tmp}/lf.md" "https://x/seeds" "https://x/failures"
  # Sobrescreve com EOLs puros LF para teste determinístico:
  printf '%s\n' \
    '# h' '' \
    '### 🎯 fast-check direct downloads (Access-Control-Request-Headers)' '' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/lf.md"
  parser_assert_eq "LF puro: dois canônicos" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/lf.md")"

  # 2) CRLF puro
  printf '%s\r\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/crlf.md"
  parser_assert_eq "CRLF puro" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/crlf.md")"

  # 3) CR puro (Mac classic)
  printf '%s\r' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/cr.md"
  parser_assert_eq "CR puro (Mac classic)" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/cr.md")"

  # 4) Mistura por linha + trailing \r\r\n
  {
    printf 'header\n'
    printf -- '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)\r\r\n'
    printf -- '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)\r'
  } > "${tmp}/mix.md"
  parser_assert_eq "EOL misturados por linha (LF + CRLF + duplo \\r)" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/mix.md")"

  # 5) Bold __ alternativo
  printf '%s\n' \
    '- 🌱 __Seeds executed (last 50 runs):__ [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 __Minimized counterexamples (last 100):__ [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/under.md"
  parser_assert_eq "Bold sintático __ ao invés de **" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/under.md")"

  # 6) Fallback markers
  printf '%s\n' \
    '- 🌱 `fc-seeds.json` — _(not produced in this run)_' \
    '- 💥 `fc-failures.json` — _(no failures persisted in this run — invariants held)_' \
    > "${tmp}/fb.md"
  parser_assert_eq "Fallback markers (LF puro)" \
    "$(printf 'failures_fallback\tfc-failures.json\t\nseeds_fallback\tfc-seeds.json\t')" \
    "$(parse_file "${tmp}/fb.md")"

  # 7) Misto canônico + fallback
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 `fc-failures.json` — _(no failures persisted in this run — invariants held)_' \
    > "${tmp}/hybrid.md"
  parser_assert_eq "Híbrido: seeds canônico + failures fallback" \
    "$(printf 'failures_fallback\tfc-failures.json\t\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/hybrid.md")"

  # 8) Indentação + spacing extra
  printf '%s\n' \
    '   -    🌱   **Seeds executed (last 50 runs):**    [ `fc-seeds.json` ](  https://x/seeds  )' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/loose.md"
  parser_assert_eq "Indent + spacing extra" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/loose.md")"

  # 9) Negativo: URL drift NÃO deve casar canônico (parser é tolerante de
  #    forma, mas captura URL fielmente — verifier compara semântica).
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://wrong/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/wrongurl.md"
  parser_assert_eq "Drift de URL é capturado (parser preserva URL real)" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://wrong/seeds')" \
    "$(parse_file "${tmp}/wrongurl.md")"

  # 10) Sem bullets relevantes -> exit 2
  printf 'random text without bullets\n' > "${tmp}/empty.md"
  set +e
  parse_file "${tmp}/empty.md" >/dev/null 2>&1
  local rc=$?
  set -e
  parser_assert_eq "Arquivo sem bullets reconhecidos -> exit 2" "2" "${rc}"

  # ─── Negativos: bullets corrompidos / labels quase corretos ─────────────
  # Cada caso contém SOMENTE bullets corrompidos. O parser deve reconhecer
  # zero bullets válidos e sair com código 2 de forma determinística — sem
  # casar parcialmente ou capturar tokens errados.
  __neg_assert() {
    local name="$1" file="$2"
    set +e
    local out; out=$(parse_file "${file}" 2>/dev/null)
    local rc=$?
    set -e
    parser_assert_eq "${name} (exit code)" "2" "${rc}"
    parser_assert_eq "${name} (stdout vazio)" "" "${out}"
  }

  # N1) Token typo: fc-seed.json (sem 's') / fc-failures.txt
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seed.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.txt`](https://x/failures)' \
    > "${tmp}/neg_token.md"
  __neg_assert "Negativo: tokens com extensões/typos errados" "${tmp}/neg_token.md"

  # N2) Emoji errado (🔥 / ⚠️ no lugar de 🌱 / 💥)
  printf '%s\n' \
    '- 🔥 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- ⚠️ **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_emoji.md"
  __neg_assert "Negativo: emojis trocados" "${tmp}/neg_emoji.md"

  # N3) Emoji ausente
  printf '%s\n' \
    '- **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_no_emoji.md"
  __neg_assert "Negativo: bullets sem emoji" "${tmp}/neg_no_emoji.md"

  # N4) Label quase certo: 'Seed executed' (singular) / 'Counterexample' (singular)
  printf '%s\n' \
    '- 🌱 **Seed executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexample (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_label.md"
  __neg_assert "Negativo: labels singulares (quase corretos)" "${tmp}/neg_label.md"

  # N5) Sem backticks no token: `[fc-seeds.json](url)` — não casa code fence
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [fc-seeds.json](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [fc-failures.json](https://x/failures)' \
    > "${tmp}/neg_no_code.md"
  __neg_assert "Negativo: token sem code fences" "${tmp}/neg_no_code.md"

  # N6) Markdown link malformado (parêntese não fechado)
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`(https://x/failures)' \
    > "${tmp}/neg_link.md"
  __neg_assert "Negativo: links markdown malformados" "${tmp}/neg_link.md"

  # N7) Negrito quebrado (asterisco solto / sem fechamento)
  printf '%s\n' \
    '- 🌱 *Seeds executed (last 50 runs):* [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 ***Minimized counterexamples (last 100):* [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_bold.md"
  __neg_assert "Negativo: negrito quebrado/itálico simples" "${tmp}/neg_bold.md"

  # N8) Fallback sem itálico (em-dash sem _( ... )_)
  printf '%s\n' \
    '- 🌱 `fc-seeds.json` — (not produced in this run)' \
    '- 💥 `fc-failures.json` — no failures persisted' \
    > "${tmp}/neg_fb_italic.md"
  __neg_assert "Negativo: fallback sem itálico _( )_" "${tmp}/neg_fb_italic.md"

  # N9) Fallback sem em-dash (usa hífen ASCII '-')
  printf '%s\n' \
    '- 🌱 `fc-seeds.json` - _(not produced in this run)_' \
    '- 💥 `fc-failures.json` - _(no failures persisted in this run — invariants held)_' \
    > "${tmp}/neg_fb_dash.md"
  __neg_assert "Negativo: fallback com hífen ASCII no lugar de em-dash" "${tmp}/neg_fb_dash.md"

  # N10) Linha sem o bullet '-' (apenas emoji)
  printf '%s\n' \
    '🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_no_dash.md"
  __neg_assert "Negativo: linhas sem dash de bullet" "${tmp}/neg_no_dash.md"

  # N11) Token correto, mas dentro de bloco de código (não é bullet markdown)
  printf '%s\n' \
    '```' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures)' \
    '```' \
    > "${tmp}/neg_codeblock.md"
  # NOTA: o parser atual NÃO sabe distinguir bloco de código — então neste
  # caso ele DEVE casar canônico (comportamento documentado). Verificamos
  # esse contrato explicitamente para que qualquer mudança futura no parser
  # quebre o teste de forma visível.
  parser_assert_eq "Contrato: bullets dentro de code-block ainda casam (parser não interpreta fences)" \
    "$(printf 'failures_canonical\tfc-failures.json\thttps://x/failures\nseeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/neg_codeblock.md")"

  # N12) Trailing chars depois da URL ')' invalidam o match
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds) extra-text' \
    '- 💥 **Minimized counterexamples (last 100):** [`fc-failures.json`](https://x/failures) trailing' \
    > "${tmp}/neg_trailing.md"
  __neg_assert "Negativo: conteúdo extra após URL invalida bullet canônico" "${tmp}/neg_trailing.md"

  # N13) Mistura: bullet válido + bullet corrompido — parser captura SÓ o válido
  printf '%s\n' \
    '- 🌱 **Seeds executed (last 50 runs):** [`fc-seeds.json`](https://x/seeds)' \
    '- 💥 **Minimized counterexample (last 100):** [`fc-failures.json`](https://x/failures)' \
    > "${tmp}/neg_partial.md"
  parser_assert_eq "Contrato: bullet corrompido é descartado, válido é preservado" \
    "$(printf 'seeds_canonical\tfc-seeds.json\thttps://x/seeds')" \
    "$(parse_file "${tmp}/neg_partial.md")"

  echo ""
  echo "parser unit tests: ${PARSER_PASS} passed, ${PARSER_FAIL} failed"
  [ "${PARSER_FAIL}" = "0" ]
}

# ─── fuzz harness ────────────────────────────────────────────────────────────
# Quando rodando no CI, qualquer falha precisa ser reproduzível localmente
# com UM comando. Para isso, persistimos:
#   - failures.jsonl (uma linha por falha: iter/seed/mode/stage/rc + repro_cmd)
#   - fixtures/<seed>_<mode>.md  (bytes exatos com EOLs preservados)
#   - verify_<i>.log (saída do verifier para falhas no stage 'verify')
# em um diretório passado via --failures-out (default: $tmp, descartado).
cmd_fuzz() {
  local iters=30 seed_base=1 failures_out=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --iters)         iters="$2"; shift 2 ;;
      --seed)          seed_base="$2"; shift 2 ;;
      --failures-out)  failures_out="$2"; shift 2 ;;
      *) echo "unknown arg: $1" >&2; return 1 ;;
    esac
  done

  [ -x "${VERIFY}" ] || chmod +x "${VERIFY}"
  local tmp; tmp="$(mktemp -d)"; trap "rm -rf '${tmp}'" RETURN

  local fail_dir="${failures_out:-${tmp}/failures}"
  local fail_log="${fail_dir}/failures.jsonl"
  local fail_fixtures="${fail_dir}/fixtures"
  local persisted=0
  __persist_failure() {
    local iter="$1" seed="$2" mode="$3" stage="$4" rc="$5" detail="$6" fixture_src="$7" verify_log="$8"
    if [ "${persisted}" = "0" ]; then
      mkdir -p "${fail_fixtures}"
      : > "${fail_log}"
      persisted=1
    fi
    cp "${fixture_src}" "${fail_fixtures}/seed${seed}_${mode}.md"
    local repro="bash .github/scripts/fixture-eol-fuzzer.sh repro --seed ${seed} --mode ${mode}"
    local detail_json
    detail_json=$(printf '%s' "${detail}" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
    printf '{"iter":%d,"seed":%d,"mode":"%s","stage":"%s","rc":%d,"fixture":"%s","repro_cmd":"%s","detail":%s}\n' \
      "${iter}" "${seed}" "${mode}" "${stage}" "${rc}" \
      "fixtures/seed${seed}_${mode}.md" "${repro}" "${detail_json}" >> "${fail_log}"
    if [ -n "${verify_log}" ] && [ -f "${verify_log}" ]; then
      cp "${verify_log}" "${fail_dir}/verify_seed${seed}_${mode}.log"
    fi
  }

  local pass=0 fail=0 modes=(staged fallback mixed)
  echo "── EOL fuzz: ${iters} iters (parser ↔ verify-fc-summary.sh consistency) ──"
  [ -n "${failures_out}" ] && echo "   persisting failures to: ${failures_out}"

  for ((i=0; i<iters; i++)); do
    local seed=$((seed_base + i))
    local mode="${modes[$((i % 3))]}"
    local fixture="${tmp}/fuzz_${i}_${mode}.md"
    cmd_gen_fixture "${fixture}" --seed "${seed}" --mode "${mode}"

    local parsed
    parsed=$(parse_file "${fixture}" || true)
    local toks
    toks=$(printf '%s\n' "${parsed}" | awk -F'\t' '{print $2}' | sort -u | tr '\n' ',' | sed 's/,$//')
    local expect_toks="fc-failures.json,fc-seeds.json"
    if [ "${toks}" != "${expect_toks}" ]; then
      fail=$((fail + 1))
      printf "  ❌ iter=%d seed=%d mode=%s — parser tokens=[%s], expected=[%s]\n" \
        "${i}" "${seed}" "${mode}" "${toks}" "${expect_toks}"
      printf "     repro: bash .github/scripts/fixture-eol-fuzzer.sh repro --seed %d --mode %s\n" "${seed}" "${mode}"
      echo "     fixture (od -c trecho):"
      od -c "${fixture}" | head -10 | sed 's/^/       /'
      __persist_failure "${i}" "${seed}" "${mode}" "parser" 2 \
        "parser tokens=[${toks}], expected=[${expect_toks}]" "${fixture}" ""
      continue
    fi

    local staged_seeds=1 staged_failures=1 seeds_url="${SEEDS_URL_DEFAULT}" failures_url="${FAILURES_URL_DEFAULT}"
    case "${mode}" in
      staged)   staged_seeds=1; staged_failures=1 ;;
      fallback) staged_seeds=0; staged_failures=0; seeds_url=""; failures_url="" ;;
      mixed)    staged_seeds=1; staged_failures=0; failures_url="" ;;
    esac

    set +e
    SUMMARY_FILE="${fixture}" \
    CONTEXT_LABEL="fuzz:iter${i}:${mode}" \
    STAGED_FC_SEEDS="${staged_seeds}" \
    STAGED_FC_FAILURES="${staged_failures}" \
    FC_SEEDS_URL="${seeds_url}" \
    FC_FAILURES_URL="${failures_url}" \
    FC_HEADER_LABEL="Access-Control-Request-Headers" \
    REQUIRE_CONTEXT_PARAGRAPH="1" \
    GITHUB_OUTPUT="" \
      "${VERIFY}" >"${tmp}/verify_${i}.log" 2>&1
    local rc=$?
    set -e

    if [ "${rc}" = "0" ]; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
      printf "  ❌ iter=%d seed=%d mode=%s — verify exited %d (parser ok)\n" "${i}" "${seed}" "${mode}" "${rc}"
      printf "     repro: bash .github/scripts/fixture-eol-fuzzer.sh repro --seed %d --mode %s\n" "${seed}" "${mode}"
      sed 's/^/       /' "${tmp}/verify_${i}.log" | head -25
      echo "     fixture od -c (8 linhas):"
      od -c "${fixture}" | head -8 | sed 's/^/       /'
      local detail
      detail=$(head -25 "${tmp}/verify_${i}.log")
      __persist_failure "${i}" "${seed}" "${mode}" "verify" "${rc}" \
        "${detail}" "${fixture}" "${tmp}/verify_${i}.log"
    fi
  done

  echo ""
  echo "EOL fuzz: ${pass} passed, ${fail} failed (${iters} total)"
  if [ "${fail}" != "0" ] && [ "${persisted}" = "1" ]; then
    echo ""
    echo "── failures persisted to ${fail_dir} ──"
    echo "   • failures.jsonl  (uma linha JSON por falha, com repro_cmd)"
    echo "   • fixtures/       (bytes exatos do fixture, EOLs preservados)"
    echo ""
    echo "   Reproduza QUALQUER falha localmente com o repro_cmd; primeira falha:"
    head -1 "${fail_log}" | python3 -c 'import sys,json; print("     " + json.loads(sys.stdin.read())["repro_cmd"])' 2>/dev/null || true
  fi
  [ "${fail}" = "0" ]
}

# ─── repro: regenera UM fixture e roda parser + verifier verbose ─────────────
# Comando único para reproduzir localmente uma falha do CI:
#   bash .github/scripts/fixture-eol-fuzzer.sh repro --seed N --mode M
cmd_repro() {
  local seed="" mode="staged"
  while [ $# -gt 0 ]; do
    case "$1" in
      --seed) seed="$2"; shift 2 ;;
      --mode) mode="$2"; shift 2 ;;
      *) echo "unknown arg: $1" >&2; return 1 ;;
    esac
  done
  [ -n "${seed}" ] || { echo "usage: repro --seed N [--mode staged|fallback|mixed]" >&2; return 1; }

  [ -x "${VERIFY}" ] || chmod +x "${VERIFY}"
  local tmp; tmp="$(mktemp -d)"; trap "rm -rf '${tmp}'" RETURN
  local fixture="${tmp}/repro_seed${seed}_${mode}.md"
  cmd_gen_fixture "${fixture}" --seed "${seed}" --mode "${mode}"

  echo "── repro: seed=${seed} mode=${mode} ──"
  echo ""
  echo "── fixture bytes (od -c, primeiras 30 linhas) ──"
  od -c "${fixture}" | head -30
  echo ""
  echo "── parser output ──"
  parse_file "${fixture}" || echo "(parser exit code: $?)"
  echo ""
  echo "── verify-fc-summary.sh ──"
  local staged_seeds=1 staged_failures=1 seeds_url="${SEEDS_URL_DEFAULT}" failures_url="${FAILURES_URL_DEFAULT}"
  case "${mode}" in
    staged)   ;;
    fallback) staged_seeds=0; staged_failures=0; seeds_url=""; failures_url="" ;;
    mixed)    staged_failures=0; failures_url="" ;;
    *) echo "unknown mode: ${mode}" >&2; return 1 ;;
  esac
  SUMMARY_FILE="${fixture}" \
  CONTEXT_LABEL="repro:seed${seed}:${mode}" \
  STAGED_FC_SEEDS="${staged_seeds}" \
  STAGED_FC_FAILURES="${staged_failures}" \
  FC_SEEDS_URL="${seeds_url}" \
  FC_FAILURES_URL="${failures_url}" \
  FC_HEADER_LABEL="Access-Control-Request-Headers" \
  REQUIRE_CONTEXT_PARAGRAPH="1" \
  GITHUB_OUTPUT="" \
    "${VERIFY}"
}

# ─── entry point ─────────────────────────────────────────────────────────────
sub="${1:-}"
shift || true
case "${sub}" in
  gen-fixture)  cmd_gen_fixture  "$@" ;;
  parse-bullet) cmd_parse_bullet "$@" ;;
  test-parser)  cmd_test_parser ;;
  fuzz)         cmd_fuzz "$@" ;;
  repro)        cmd_repro "$@" ;;
  *)
    cat >&2 <<USAGE
usage: $0 <subcommand> [args]
  gen-fixture <out> [--seed N] [--mode staged|fallback|mixed]
  parse-bullet <file>
  test-parser
  fuzz [--iters N] [--seed BASE] [--failures-out DIR]
  repro --seed N [--mode staged|fallback|mixed]
USAGE
    exit 1
    ;;
esac
