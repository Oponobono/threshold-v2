/**
 * Formats a title in Spanish title case:
 * Capitalizes each word except connectors (prepositions, conjunctions, articles),
 * keeping the first word always capitalized and handling Roman numerals (I, II, III, etc.).
 */
const CONNECTORS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'u', 'a', 'al', 'con', 'para', 'por', 'sin', 'sobre', 'un', 'una', 'unos', 'unas'
]);

export function formatSubjectTitle(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  return words
    .map((word, index) => {
      if (!word) return '';
      const lower = word.toLowerCase();

      // Preserve or format Roman numerals (e.g., I, II, III, IV, V, VI, VII, VIII, IX, X)
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(lower)) {
        return lower.toUpperCase();
      }

      // If connector and not the first word, keep lowercase
      if (index > 0 && CONNECTORS.has(lower)) {
        return lower;
      }

      // Capitalize first character
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
