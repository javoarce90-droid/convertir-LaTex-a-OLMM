/**
 * nary.js
 * Operadores n-arios: integrales, sumatorias, productos.
 *
 * Cada entrada define:
 *   - char:   símbolo Unicode que Word usa como carácter del operador
 *   - limLoc: dónde van los límites:
 *       'undOvr'  → encima/debajo (∑, ∏)
 *       'subSup'  → como subíndice/superíndice lateral (∫, ∮)
 */

const nary = {
  // ── Sumatorias y productos ────────────────────────────────────
  sum:    { char: '∑', limLoc: 'undOvr' },
  prod:   { char: '∏', limLoc: 'undOvr' },
  coprod: { char: '∐', limLoc: 'undOvr' },
  bigcap: { char: '⋂', limLoc: 'undOvr' },
  bigcup: { char: '⋃', limLoc: 'undOvr' },
  bigoplus:  { char: '⊕', limLoc: 'undOvr' },
  bigotimes: { char: '⊗', limLoc: 'undOvr' },
  bigodot:   { char: '⊙', limLoc: 'undOvr' },
  biguplus:  { char: '⊎', limLoc: 'undOvr' },
  bigvee:    { char: '⋁', limLoc: 'undOvr' },
  bigwedge:  { char: '⋀', limLoc: 'undOvr' },
  bigsqcup:  { char: '⊔', limLoc: 'undOvr' },

  // ── Integrales simples ────────────────────────────────────────
  int:    { char: '∫', limLoc: 'subSup' },
  oint:   { char: '∮', limLoc: 'subSup' },
  oiint:  { char: '∯', limLoc: 'subSup' },

  // ── Integrales múltiples ──────────────────────────────────────
  iint:   { char: '∬', limLoc: 'subSup' },
  iiint:  { char: '∭', limLoc: 'subSup' },
  iiiint: { char: '⨌', limLoc: 'subSup' },

  // ── Integrales de contorno ────────────────────────────────────
  ointctrclockwise: { char: '∲', limLoc: 'subSup' },
  varointclockwise: { char: '∳', limLoc: 'subSup' },
};

module.exports = nary;