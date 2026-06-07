import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { 
  extractBullets, 
  validateMarkdownBullets, 
  isValidRoman,
  EXTENDED_BULLET_REGEX,
  BULLET_REGEX 
} from "../lib/markdown-validator";

describe("Markdown Bullet Extraction (Advanced & Edge Cases)", () => {
  it("should document and verify behavior for invalid Roman-like strings", () => {
    const md = `
IIV. Non-standard but matched as roman-like
XXXX. Match as roman-like
    `.trim();
    const bullets = extractBullets(md, true);
    
    expect(bullets).toEqual([
      "Non-standard but matched as roman-like",
      "Match as roman-like"
    ]);

    const invalidMd = "IA. Not a bullet\nV1. Not a bullet";
    expect(extractBullets(invalidMd, true)).toEqual([]);
  });

  it("should throw explicit and consistent error for invalid Roman numerals (e.g., IIV)", () => {
    const md = "IIV. Invalid";
    const expectedError = "[ROMAN_VALIDATION_ERROR]: Invalid Roman numeral syntax. Rule violated: Standard additive/subtractive Roman notation (e.g., no 'IIV'). Received: 'IIV'. Valid examples: IV, IX, XII.";
    
    expect(() => validateMarkdownBullets(md)).toThrow(expectedError);
    
    // Exact message comparison for consistency
    try {
      validateMarkdownBullets(md);
    } catch (e: any) {
      expect(e.message).toBe(expectedError);
    }

    // Categorized failure validation with exact message checks (Test Matrix)
    const invalidScenarios = [
      { marker: "IIV.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "XXXX.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "VV.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "IL.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "IC.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "XM.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "IIII.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "VX.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "VL.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" },
      { marker: "LC.", rule: "Standard additive/subtractive Roman notation (e.g., no 'IIV')" }
    ];
    
    invalidScenarios.forEach(({ marker, rule }) => {
      const md = `${marker} Item`;
      const cleanMarker = marker.replace(".", "");
      const expectedFull = `[ROMAN_VALIDATION_ERROR]: Invalid Roman numeral syntax. Rule violated: ${rule}. Received: '${cleanMarker}'. Valid examples: IV, IX, XII.`;
      
      try {
        validateMarkdownBullets(md);
        throw new Error(`Should have failed for ${marker}`);
      } catch (e: any) {
        expect(e.message).toBe(expectedFull);
      }
    });
  });

  it("should pass validation for valid Roman numerals", () => {
    const md = "IV. Valid\nIX. Valid\nXII. Valid";
    expect(() => validateMarkdownBullets(md)).not.toThrow();
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
