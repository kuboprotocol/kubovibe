import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Regex tolerante que encontra bullets Markdown (*, -, +) ou listas numeradas (1., 1))
 * mesmo com indentação variada e dentro de listas aninhadas.
 */
export const BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string): string[] {
  const matches = [...markdown.matchAll(BULLET_REGEX)];
  return matches.map(m => m[2].trim());
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

  it("should ignore lines that are not bullets", () => {
    const md = `
# Heading
This is a paragraph.
Just some text.
- Valid bullet
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual(["Valid bullet"]);
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
            
            // Verifica se a quantidade extraída bate com a gerada
            expect(extracted.length).toBe(lines.length);
            
            // Verifica se o conteúdo (trimmed) bate
            lines.forEach((line, i) => {
              expect(extracted[i]).toBe(line.content.trim());
            });
          }
        )
      );
    });

    it("should not match lines that don't follow the bullet pattern", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string().filter(s => !/^([ \t]*([*+-]|\d+[.)])[ \t]+)/.test(s)),
            { minLength: 1, maxLength: 10 }
          ),
          (nonBullets) => {
            const markdown = nonBullets.join("\n");
            const extracted = extractBullets(markdown);
            expect(extracted.length).toBe(0);
          }
        )
      );
    });
  });
});


