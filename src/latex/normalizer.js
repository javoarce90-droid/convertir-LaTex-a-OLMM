/**
 * normalizer.js
 * Preprocesa el texto LaTeX antes de que el parser lo consuma.
 *
 * Problema de origen:
 *   Cuando Bubble (u otro sistema) serializa JSON con LaTeX, los backslashes
 *   se escapan múltiples veces:
 *     \frac  →  \\frac  →  \\\\frac  (según cuántas serializaciones hubo)
 *
 *   Además, los delimitadores \(...\) y \[...\] son válidos LaTeX pero más
 *   difíciles de parsear que $...$ y $$...$$, así que los convertimos.
 *
 * Esta función es idempotente: aplicarla dos veces da el mismo resultado.
 */

function normalizeLatexDelimiters(input) {
  if (!input) return '';

  let text = input;

  // ── Paso 1: Reducir backslashes múltiples ─────────────────────
  // \\\\frac → \\frac → \frac
  // Se aplica en loop hasta que no haya cambios.
  let prev;
  do {
      prev = text;
      text = text.replace(/\\\\/g, '\\');
  } while (text !== prev);

  // ── Paso 2: \[...\] → $$...$$ (display math) ─────────────────
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, content) => `$$${content}$$`);

  // ── Paso 3: \(...\) → $...$ (inline math) ─────────────────────
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, content) => `$${content}$`);

  return text;
}

module.exports = { normalizeLatexDelimiters };