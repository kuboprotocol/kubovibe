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
 * O regex atual é 'guloso' para caracteres [ivxlcdm]. Ele aceitará sequências que não são
 * algarismos romanos válidos (ex: "IIV", "XXXX") desde que seguidas por "." ou ")".
 * Decisão técnica: Priorizar performance e simplicidade sobre validação gramatical completa de numeração romana.
 * Se uma validação estrita for necessária, um parser dedicado deve ser usado em vez de regex.
 */
export const EXTENDED_BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)]|\b[ivxlcdm]+[.)])[ \t]+(.+)$/gmi;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string, extended = false): string[] {
  const regex = extended ? EXTENDED_BULLET_REGEX : BULLET_REGEX;
  regex.lastIndex = 0;
  const matches = [...markdown.matchAll(regex)];
  return matches.map(m => m[extended ? 2 : 2].trim());
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

  it("should fail build or validation if strict roman rule is requested (Demonstration)", () => {
    const nonStrictMatches = ["IIV", "XXXX", "IX"];
    
    // Simulação de lógica que o CI usaria para falhar se encontrasse romanos inválidos
    const invalidOnes = nonStrictMatches.filter(s => !isValidRoman(s));
    
    // Se estivéssemos em um modo estrito, isso falharia o build
    // Aqui apenas validamos que conseguimos detectar para erro claro
    expect(invalidOnes).toContain("IIV");
    expect(invalidOnes).toContain("XXXX");
    expect(isValidRoman("IX")).toBe(true);
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





