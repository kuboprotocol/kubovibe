import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Regex tolerante que encontra bullets Markdown (*, -, +) ou listas numeradas (1., 1))
 * mesmo com indentação variada e dentro de listas aninhadas.
 */
export const BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;

/**
 * Regex estendido que inclui suporte experimental a algarismos romanos (I, II, V, X, etc.)
 * 
 * REGRA DE FALHA PARA ROMANOS:
 * O sistema utiliza o padrão \b[ivxlcdm]+[.)] para capturar numeração romana.
 * Decisão técnica: Priorizar performance sobre validação gramatical completa.
 * 
 * - COMPORTAMENTO PREVISTO: Sequências que utilizam apenas caracteres romanos válidos
 *   (i, v, x, l, c, d, m) serão aceitas mesmo se semanticamente inválidas (ex: IIV, XXXX).
 * - COMPORTAMENTO DE FALHA: Qualquer caractere fora do conjunto [ivxlcdm] (ex: IA., V1.)
 *   dentro do marcador fará com que a linha NÃO seja capturada como bullet romano,
 *   garantindo previsibilidade.
 */
export const EXTENDED_BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)]|\b[ivxlcdm]+[.)])[ \t]+(.+)$/gmi;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string, extended = false): string[] {
  const regex = extended ? EXTENDED_BULLET_REGEX : BULLET_REGEX;
  regex.lastIndex = 0;
  const matches = Array.from(markdown.matchAll(regex));
  return matches.map(m => m[2].trim());
}

/**
 * Validador estrito para algarismos romanos (opcional, para testes de falha clara).
 */
export function isValidRoman(s: string): boolean {
  return /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(s);
}


describe("Markdown Bullet Extraction (Advanced & Edge Cases)", () => {
  it("should document and verify behavior for invalid Roman-like strings", () => {
    const md = `
IIV. Non-standard but matched as roman-like
XXXX. Match as roman-like
    `.trim();
    const bullets = extractBullets(md, true);
    
    // Verificamos que o regex captura o que prometemos (caracteres romanos válidos, mesmo sem ordem)
    expect(bullets).toEqual([
      "Non-standard but matched as roman-like",
      "Match as roman-like"
    ]);

    // Teste de falha explícita: Caractere não-romano invalida o bullet romano
    const invalidMd = "IA. Not a bullet\nV1. Not a bullet";
    expect(extractBullets(invalidMd, true)).toEqual([]);
  });

  it("should fail build with explicit message for invalid Roman numerals in strict mode", () => {
    const md = `
I. Valid
IIV. Invalid
    `.trim();
    
    // Exttração (permissiva por padrão para captura de conteúdo)
    const matches = Array.from(md.matchAll(EXTENDED_BULLET_REGEX));
    
    matches.forEach(m => {
      const marker = m[1].replace(/[.)]/g, "");
      // Se parece romano (contém apenas ivxlcdm), validamos estritamente
      if (/^[ivxlcdm]+$/i.test(marker)) {
        if (!isValidRoman(marker)) {
          // Mensagem de erro explícita e consistente conforme solicitado
          throw new Error(`[ROMAN_VALIDATION_ERROR]: O marcador '${marker}' não é um algarismo romano válido. Exemplos válidos: IV, IX, XII. Entrada inválida: ${marker}`);
        }
      }
    });
  });



  it("should handle mixed markers and numbering types across levels", () => {
    const md = `
1. Level 1 (Numeric)
   * Level 2 (Bullet)
      I. Level 3 (Roman)
   - Level 2 (Bullet)
    `.trim();
    const bullets = extractBullets(md, true);
    expect(bullets).toEqual([
      "Level 1 (Numeric)",
      "Level 2 (Bullet)",
      "Level 3 (Roman)",
      "Level 2 (Bullet)"
    ]);
  });

  it("should handle extreme indentation jumps without losing content", () => {
    const md = `
* Level 1
                                  - Extreme jump level
    1. Another jump
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Level 1",
      "Extreme jump level",
      "Another jump"
    ]);
  });

  it("should extract bullets with nested formatting and special chars", () => {
    const md = `
* [Link](url) and \`code\`
- **Bold** and *Italic*
+ Special chars: $#!@%^&*()
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "[Link](url) and `code`",
      "**Bold** and *Italic*",
      "Special chars: $#!@%^&*()"
    ]);
  });

  describe("Fuzzing & Property Testing", () => {
    it("should handle random mixtures of markers and content", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              indent: fc.string({ unit: fc.constantFrom(" ", "\t"), minLength: 0, maxLength: 20 }),
              prefix: fc.constantFrom("*", "-", "+", "1.", "1)", "i.", "v)"),
              content: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes("\n") && s.trim().length > 0)
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (lines) => {
            const markdown = lines.map(l => `${l.indent}${l.prefix} ${l.content}`).join("\n");
            const extracted = extractBullets(markdown, true);
            expect(extracted.length).toBe(lines.length);
          }
        )
      );
    });
  });
});





