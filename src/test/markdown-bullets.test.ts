import { describe, it, expect } from "vitest";

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

  it("should match bullets inside nested lists with deeper indentation and tabs", () => {
    const md = `
1. Item 1
   * Nested Bullet 1.1
   * Nested Bullet 1.2
     - Deeper Bullet 1.2.1
2. Item 2
\t+ Nested Bullet 2.1
\t3) Nested Numbered 2.2
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Item 1",
      "Nested Bullet 1.1",
      "Nested Bullet 1.2",
      "Deeper Bullet 1.2.1",
      "Item 2",
      "Nested Bullet 2.1",
      "Nested Numbered 2.2"
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
});

