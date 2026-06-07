import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Regex tolerante que encontra bullets Markdown (*, -, +) ou listas numeradas (1., 1))
 * mesmo com indentação variada e dentro de listas aninhadas.
 * Nota: Atualmente não suporta algarismos romanos por padrão no CommonMark puro,
 * mas o regex pode ser estendido se necessário.
 */
export const BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;

/**
 * Regex estendido que inclui suporte experimental a algarismos romanos (I, II, V, X, etc.)
 */
export const EXTENDED_BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)]|[ivxlcdm]+[.)])[ \t]+(.+)$/gmi;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string, extended = false): string[] {
  const regex = extended ? EXTENDED_BULLET_REGEX : BULLET_REGEX;
  // Reset regex state for global flag
  regex.lastIndex = 0;
  const matches = [...markdown.matchAll(regex)];
  return matches.map(m => m[extended ? 2 : 2].trim());
}

describe("Markdown Bullet Extraction (Tolerant Regex)", () => {
  it("should match canonical bullets at the start of lines", () => {
    const md = `
* Bullet 1
- Bullet 2
+ Bullet 3
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual(["Bullet 1", "Bullet 2", "Bullet 3"]);
  });

  it("should match numbered lists (1. and 1))", () => {
    const md = `
1. Numbered One
2) Numbered Two with parenthesis
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual(["Numbered One", "Numbered Two with parenthesis"]);
  });

  it("should handle Roman Numerals (I, II, III) with extended regex", () => {
    const md = `
I. Roman One
II. Roman Two
iii) Roman Three (lowercase)
IV) Roman Four
    `.trim();
    
    // Test with standard regex (should fail to match Roman)
    const standardBullets = extractBullets(md, false);
    expect(standardBullets).toEqual([]);

    // Test with extended regex
    const extendedBullets = extractBullets(md, true);
    expect(extendedBullets).toEqual([
      "Roman One",
      "Roman Two",
      "Roman Three (lowercase)",
      "Roman Four"
    ]);
  });

  it("should match mixed bullets and numbered lists with indentation", () => {
    const md = `
1. Main Item
   * Sub Bullet
   + Another Sub
   2. Sub Numbered
     - Deepest Bullet
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Main Item",
      "Sub Bullet",
      "Another Sub",
      "Sub Numbered",
      "Deepest Bullet"
    ]);
  });

  describe("Property-based/Fuzz Testing", () => {
    it("should extract correct content regardless of indentation and numbering style", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              indent: fc.string({ unit: fc.constantFrom(" ", "\t"), minLength: 0, maxLength: 10 }),
              prefix: fc.constantFrom("*", "-", "+", "1.", "1)", "99.", "0)"),
              content: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes("\n") && s.trim().length > 0)
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (lines) => {
            const markdown = lines.map(l => `${l.indent}${l.prefix} ${l.content}`).join("\n");
            const extracted = extractBullets(markdown);
            expect(extracted.length).toBe(lines.length);
            lines.forEach((line, i) => {
              expect(extracted[i]).toBe(line.content.trim());
            });
          }
        )
      );
    });

    it("should extract Roman numerals when using extended regex in fuzzing", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              indent: fc.string({ unit: fc.constantFrom(" ", "\t"), minLength: 0, maxLength: 5 }),
              roman: fc.constantFrom("I.", "II)", "iv.", "X)", "viii."),
              content: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes("\n") && s.trim().length > 0)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (lines) => {
            const markdown = lines.map(l => `${l.indent}${l.roman} ${l.content}`).join("\n");
            const extracted = extractBullets(markdown, true);
            expect(extracted.length).toBe(lines.length);
          }
        )
      );
    });
  });
});



