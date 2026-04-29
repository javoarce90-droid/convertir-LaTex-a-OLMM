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

  // ── Paso 4: $$...$$ multilinea → una sola línea ───────────────
  // \[...\] multilinea produce $$\ncontent_multilinea\n$$ después del Paso 2.
  // El content.trim() solo quitaba bordes pero dejaba \n internos.
  // Ahora aplanamos todos los saltos internos con un espacio.
  text = text.replace(/\$\$\s*\n([\s\S]*?)\n\s*\$\$/g,
      (_, content) => `$$${content.replace(/\s*\n\s*/g, ' ').trim()}$$`);

  // ── Paso 5: $...$ multilinea → una sola línea ─────────────────
  // Maneja tanto "$\ncontent\n$" como "$content\ncontent\ncontent$".
  // El grupo `before` captura lo que haya entre $ y el primer \n,
  // y `after` captura el resto hasta el $ de cierre (puede tener más \n).
  // El replace(/\s+/g,' ') aplana todos los saltos internos de una vez.
  text = text.replace(
      /(?<!\$)\$(?!\$)([^$]*?)\n([^$]*?)(?<!\$)\$(?!\$)/g,
      (_, before, after) => `$${(before + ' ' + after).replace(/\s+/g, ' ').trim()}$`
  );

  return text;
}

module.exports = { normalizeLatexDelimiters };