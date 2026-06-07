import { describe, it, expect } from "vitest";

/**
 * Regex tolerante que encontra bullets Markdown (*, -, +) mesmo com indentação variada
 * e dentro de listas aninhadas.
 */
export const BULLET_REGEX = /^[ \t]*[*+-][ \t]+(.+)$/gm;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string): string[] {
  const matches = [...markdown.matchAll(BULLET_REGEX)];
  return matches.map(m => m[1].trim());
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

  it("should match bullets with indentation", () => {
    const md = `
  * Indented Bullet 1
    - Indented Bullet 2
\t+ Tab Indented Bullet 3
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Indented Bullet 1",
      "Indented Bullet 2",
      "Tab Indented Bullet 3"
    ]);
  });

  it("should match bullets inside nested lists with deeper indentation", () => {
    const md = `
1. Item 1
   * Nested Bullet 1.1
   * Nested Bullet 1.2
     - Deeper Bullet 1.2.1
2. Item 2
\t+ Nested Bullet 2.1
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Nested Bullet 1.1",
      "Nested Bullet 1.2",
      "Deeper Bullet 1.2.1",
      "Nested Bullet 2.1"
    ]);
  });

  it("should ignore lines that are not bullets", () => {
    const md = `
# Heading
This is a paragraph.
1. Numbered list
   Not a bullet.
- Bullet after noise
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual(["Bullet after noise"]);
  });
});
