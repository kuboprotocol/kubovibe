/**
 * Regex para bullets Markdown (*, -, +) ou listas numeradas (1., 1))
 */
export const BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)])[ \t]+(.+)$/gm;

/**
 * Regex estendido com suporte a algarismos romanos.
 */
export const EXTENDED_BULLET_REGEX = /^[ \t]*([*+-]|\d+[.)]|\b[ivxlcdm]+[.)])[ \t]+(.+)$/gmi;

/**
 * Validador estrito para algarismos romanos.
 */
export function isValidRoman(s: string): boolean {
  return /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(s);
}

/**
 * Valida se um texto Markdown contém numeração romana inválida.
 * Lança um erro explícito se encontrar algo como "IIV".
 */
export function validateMarkdownBullets(markdown: string): void {
  const matches = Array.from(markdown.matchAll(EXTENDED_BULLET_REGEX));
  
  for (const m of matches) {
    const marker = m[1].replace(/[.)]/g, "");
    // Se o marcador é composto apenas por caracteres que parecem romanos
    if (/^[ivxlcdm]+$/i.test(marker)) {
      if (!isValidRoman(marker)) {
        throw new Error(`[ROMAN_VALIDATION_ERROR]: O marcador '${marker}' não é um algarismo romano válido. Exemplos válidos: IV, IX, XII. Entrada inválida: ${marker}`);
      }
    }
  }
}

/**
 * Extrai bullets de um texto Markdown.
 */
export function extractBullets(markdown: string, extended = false): string[] {
  const regex = extended ? EXTENDED_BULLET_REGEX : BULLET_REGEX;
  regex.lastIndex = 0;
  const matches = Array.from(markdown.matchAll(regex));
  return matches.map(m => m[2].trim());
}
