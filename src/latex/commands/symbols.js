/**
 * symbols.js
 * Símbolos LaTeX → Unicode.
 *
 * Cada sección agrupa símbolos por categoría semántica.
 * Valor vacío '' = el símbolo se ignora (espaciado, etc.).
 */

const symbols = {

  // ── Operadores binarios ───────────────────────────────────────
  cdot:      '·',
  times:     '×',
  div:       '÷',
  pm:        '±',
  mp:        '∓',
  ast:       '∗',
  star:      '⋆',
  circ:      '∘',
  bullet:    '•',
  oplus:     '⊕',
  ominus:    '⊖',
  otimes:    '⊗',
  oslash:    '⊘',
  odot:      '⊙',
  wedge:     '∧',
  vee:       '∨',
  cap:       '∩',
  cup:       '∪',
  setminus:  '∖',
  sqcap:     '⊓',
  sqcup:     '⊔',
  uplus:     '⊎',
  amalg:     '⨿',
  dagger:    '†',
  ddagger:   '‡',

  // ── Relaciones ────────────────────────────────────────────────
  leq:       '≤',
  geq:       '≥',
  le:        '≤',
  ge:        '≥',
  neq:       '≠',
  ne:        '≠',
  approx:    '≈',
  equiv:     '≡',
  sim:       '∼',
  simeq:     '≃',
  cong:      '≅',
  propto:    '∝',
  prec:      '≺',
  succ:      '≻',
  preceq:    '≼',
  succeq:    '≽',
  ll:        '≪',
  gg:        '≫',
  perp:      '⊥',
  mid:       '∣',
  nmid:      '∤',
  parallel:  '∥',

  // ── Conjuntos ─────────────────────────────────────────────────
  in:        '∈',
  notin:     '∉',
  ni:        '∋',
  subset:    '⊂',
  supset:    '⊃',
  subseteq:  '⊆',
  supseteq:  '⊇',
  subsetneq: '⊊',
  supsetneq: '⊋',
  emptyset:  '∅',
  varnothing:'∅',

  // ── Lógica / Cuantificadores ──────────────────────────────────
  forall:    '∀',
  exists:    '∃',
  nexists:   '∄',
  neg:       '¬',
  lnot:      '¬',
  land:      '∧',
  lor:       '∨',

  // ── Cálculo / Análisis ────────────────────────────────────────
  infty:     '∞',
  partial:   '∂',
  nabla:     '∇',
  prime:     '′',
  hbar:      'ℏ',
  ell:       'ℓ',
  Re:        'ℜ',
  Im:        'ℑ',
  wp:        '℘',

  // ── Flechas ───────────────────────────────────────────────────
  to:              '→',
  rightarrow:      '→',
  leftarrow:       '←',
  Rightarrow:      '⇒',
  Leftarrow:       '⇐',
  leftrightarrow:  '↔',
  Leftrightarrow:  '⟺',
  iff:             '⟺',
  implies:         '⟹',
  uparrow:         '↑',
  downarrow:       '↓',
  updownarrow:     '↕',
  Uparrow:         '⇑',
  Downarrow:       '⇓',
  nearrow:         '↗',
  searrow:         '↘',
  mapsto:          '↦',
  longmapsto:      '⟼',
  hookleftarrow:   '↩',
  hookrightarrow:  '↪',

  // ── Puntos suspensivos ────────────────────────────────────────
  ldots:  '…',
  cdots:  '⋯',
  vdots:  '⋮',
  ddots:  '⋱',
  dotsc:  '…',   // para comas
  dotsb:  '⋯',   // para operadores binarios

  // ── Delimitadores sueltos ─────────────────────────────────────
  '|':    '|',
  lvert:  '|',
  rvert:  '|',
  lVert:  '‖',
  rVert:  '‖',
  langle: '⟨',
  rangle: '⟩',
  lceil:  '⌈',
  rceil:  '⌉',
  lfloor: '⌊',
  rfloor: '⌋',

  // ── Espaciado (se ignoran en Word, solo sirven en LaTeX PDF) ──
  ',':    '',    // \,  espacio fino
  ':':    '',    // \:  espacio medio
  ';':    '',    // \;  espacio grueso
  '!':    '',    // \!  espacio negativo
  ' ':    '',    // \   espacio explícito
  quad:   '',
  qquad:  '',
  enspace:'',
  thinspace: '',

  // ── Varios ────────────────────────────────────────────────────
  '\\':   '',    // salto de línea en align → ignorar
  '#':    '#',
  '%':    '%',
  '&':    '',    // separador de columnas en align → ignorar
  '_':    '_',
  '^':    '^',
  dag:    '†',
  ddag:   '‡',
  S:      '§',
  P:      '¶',
  copyright: '©',
  circ:   '°',
  degree: '°',
  angle:  '∠',
  triangle: '△',
  square: '□',
  diamond: '◇',
  clubsuit:    '♣',
  diamondsuit: '♦',
  heartsuit:   '♥',
  spadesuit:   '♠',
  checkmark:   '✓',
  maltese:     '✠',
};

module.exports = symbols;