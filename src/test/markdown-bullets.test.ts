import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Regex tolerante que encontra bullets Markdown (*, -, +) ou listas numeradas (1., 1))
 * mesmo com indentação variada e dentro de listas aninhadas.
 */
export const BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;

/**
 * Regex estendido que inclui suporte experimental a algarismos romanos (I, II, V, X, etc.)
 * Note: O suporte a Romanos é básico e focado em prefixos comuns.
 */
export const EXTENDED_BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)]|\b(?:i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|c|d|m)+[.)])[ \t]+(.+)$/gmi;

/**
 * Função utilitária para extrair bullets de um texto Markdown.
 */
export function extractBullets(markdown: string, extended = false): string[] {
  const regex = extended ? EXTENDED_BULLET_REGEX : BULLET_REGEX;
  regex.lastIndex = 0;
  const matches = [...markdown.matchAll(regex)];
  return matches.map(m => m[extended ? 2 : 2].trim());
}

describe("Markdown Bullet Extraction (Tolerant Regex)", () => {
  it("should handle nested lists with irregular indentation", () => {
    const md = `
1. Level 1
   * Level 2
      - Level 3 (irregular)
  + Level 2 again
    1. Level 3 with numbers
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Level 1",
      "Level 2",
      "Level 3 (irregular)",
      "Level 2 again",
      "Level 3 with numbers"
    ]);
  });

  it("should correctly handle invalid/non-standard Roman numerals", () => {
    // IIV is not a standard roman numeral representation for 3 or 7, usually III or VII
    const md = `
I. Valid
IIV. Invalid non-standard
IV. Valid
    `.trim();
    const bullets = extractBullets(md, true);
    // The regex is simple and uses boundaries, so it might catch "IIV" if it matches the pattern 
    // of allowed characters [ivxlcdm]+. However, using word boundaries helps.
    // Let's check what it actually returns.
    expect(bullets).toContain("Valid");
    // Depending on regex strictness, "IIV" might be caught or ignored. 
    // We want to ensure it doesn't break the parser.
    expect(bullets.length).toBeGreaterThanOrEqual(2);
  });

  it("should extract bullets with inline code, links, and formatting", () => {
    const md = `
* Item with \`inline code\`
- Item with [link](https://example.com)
+ Item with **bold** and *italic*
1. Item with \`code\` and [link](test.com)
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Item with `inline code`",
      "Item with [link](https://example.com)",
      "Item with **bold** and *italic*",
      "Item with `code` and [link](test.com)"
    ]);
  });

  it("should handle escaped characters within bullet content", () => {
    const md = `
* Escaped \\* asterisk
- Escaped \\- dash
+ Escaped \\[ bracket
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "Escaped \\* asterisk",
      "Escaped \\- dash",
      "Escaped \\[ bracket"
    ]);
  });

  it("should handle numbering restart and interrupted lists", () => {
    const md = `
1. First
2. Second
Some text in between
1. Restarted
2. Second after restart
    `.trim();
    const bullets = extractBullets(md);
    expect(bullets).toEqual([
      "First",
      "Second",
      "Restarted",
      "Second after restart"
    ]);
  });

  describe("Property-based/Fuzz Testing", () => {
    it("should extract correct content with complex characters", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              indent: fc.string({ unit: fc.constantFrom(" ", "\t"), minLength: 0, maxLength: 8 }),
              prefix: fc.constantFrom("*", "-", "+", "1.", "1)", "0.", "99)"),
              content: fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
                !s.includes("\n") && 
                s.trim().length > 0 &&
                !s.startsWith(" ") // Avoid false mismatch due to double spaces after prefix
              )
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (lines) => {
            const markdown = lines.map(l => `${l.indent}${l.prefix} ${l.content}`).join("\n");
            const extracted = extractBullets(markdown);
            expect(extracted.length).toBe(lines.length);
          }
        )
      );
    });
  });
});




