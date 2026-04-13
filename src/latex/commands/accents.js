/**
 * accents.js
 * Acentos y decoraciones sobre caracteres LaTeX → Unicode.
 *
 * Generan un <m:acc> con el carácter de acento especificado.
 */

const accents = {
  // ── Flechas (vectores) ────────────────────────────────────────
  vec:            '⃗',
  overrightarrow: '⃗',
  overleftarrow:  '⃖',

  // ── Sombreros ─────────────────────────────────────────────────
  hat:     '^',
  widehat: '^',
  check:   'ˇ',

  // ── Barras ────────────────────────────────────────────────────
  bar:       '‾',
  overline:  '‾',
  underline: '_',    // Word lo maneja diferente; aproximación
  tilde:     '~',
  widetilde: '~',

  // ── Puntos (derivadas) ────────────────────────────────────────
  dot:   '˙',
  ddot:  '¨',
  dddot: '⃛',

  // ── Llaves ────────────────────────────────────────────────────
  overbrace:  '⏞',
  underbrace: '⏟',

  // ── Otros ─────────────────────────────────────────────────────
  acute:  '´',
  grave:  '`',
  breve:  '˘',
  mathring: '˚',
};

module.exports = accents;