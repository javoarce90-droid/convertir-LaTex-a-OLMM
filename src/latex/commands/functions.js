/**
 * functions.js
 * Funciones matemáticas LaTeX que se renderizan en estilo "texto" (upright).
 *
 * \sin, \cos, \log, etc. → <m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>sin</m:t></m:r>
 *
 * "p" = plain (no itálica), que es la convención tipográfica para nombres de funciones.
 */

const mathFunctions = [
  // ── Trigonométricas ───────────────────────────────────────────
  'sin',  'cos',  'tan',
  'cot',  'sec',  'csc',

  // ── Trigonométricas inversas ──────────────────────────────────
  'arcsin', 'arccos', 'arctan',
  'arccot', 'arcsec', 'arccsc',

  // ── Hiperbólicas ──────────────────────────────────────────────
  'sinh', 'cosh', 'tanh',
  'coth', 'sech', 'csch',

  // ── Hiperbólicas inversas ─────────────────────────────────────
  'arcsinh', 'arccosh', 'arctanh',

  // ── Logaritmos y exponencial ──────────────────────────────────
  'log',  'ln',   'lg',   'exp',

  // ── Extremos y comparación ────────────────────────────────────
  'max',  'min',  'sup',  'inf',
  'lim',  'limsup', 'liminf',

  // ── Álgebra lineal ────────────────────────────────────────────
  'det',  'dim',  'rank', 'ker',
  'trace','tr',   'diag',

  // ── Teoría de números / combinatoria ──────────────────────────
  'gcd',  'lcm',  'deg',  'div',

  // ── Análisis complejo ─────────────────────────────────────────
  'arg',  'Arg',  'Re',   'Im',

  // ── Probabilidad / estadística ────────────────────────────────
  'Pr',   'E',    'Var',  'Cov',

  // ── Otros ─────────────────────────────────────────────────────
  'hom',  'End',  'Aut',  'Hom',
  'sign', 'sgn',  'erf',
];

module.exports = mathFunctions;