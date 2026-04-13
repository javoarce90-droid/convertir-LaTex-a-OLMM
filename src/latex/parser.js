/**
 * parser.js
 * Convierte una expresión LaTeX a OMML (Office Math Markup Language).
 *
 * OMML es el formato XML que usa Word internamente para representar fórmulas.
 * Este parser es de tipo "descenso recursivo": consume el string carácter
 * a carácter, reconociendo tokens (comandos, grupos, operadores) y emitiendo
 * el XML correspondiente.
 *
 * Diagrama de flujo simplificado:
 *
 *   parse()
 *     └─► next()  ← dispatcher principal
 *           ├─ '\' → command() → cmd()   ← maneja \frac, \sqrt, \sum, etc.
 *           ├─ '{' → group()             ← parsea {contenido} recursivamente
 *           ├─ '^' → sup(arg())          ← superíndice
 *           ├─ '_' → sub(arg())          ← subíndice
 *           └─ chr → run de texto
 */

const { xmlEscape } = require('./xml-helpers');
const greek        = require('./commands/greek');
const symbols      = require('./commands/symbols');
const mathFunctions = require('./commands/functions');
const accents      = require('./commands/accents');
const nary         = require('./commands/nary');

class LatexOmmlParser {
    constructor(src) {
        this.src = src;
        this.pos = 0;
    }

    // ── API pública ───────────────────────────────────────────────

    parse() {
        const parts = [];
        while (this.pos < this.src.length) {
            parts.push(this.next());
        }
        return parts.join('');
    }

    // ── Dispatcher principal ──────────────────────────────────────

    next() {
        this.skip();
        if (this.pos >= this.src.length) return '';
        const ch = this.src[this.pos];

        if (ch === '\\') return this.command();
        if (ch === '{')  return this.group();
        if (ch === '^')  { this.pos++; return this.sup(this.arg()); }
        if (ch === '_')  { this.pos++; return this.sub(this.arg()); }

        this.pos++;
        return `<m:r><m:t>${xmlEscape(ch)}</m:t></m:r>`;
    }

    // ── Superíndice / subíndice ───────────────────────────────────

    sup(content) {
        return `<m:sSup><m:e><m:r><m:t/></m:r></m:e><m:sup>${content}</m:sup></m:sSup>`;
    }

    sub(content) {
        return `<m:sSub><m:e><m:r><m:t/></m:r></m:e><m:sub>${content}</m:sub></m:sSub>`;
    }

    // ── Lectura de comandos ───────────────────────────────────────

    command() {
        this.pos++; // consumir '\'
        let cmd = '';

        if (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
            while (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
                cmd += this.src[this.pos++];
            }
        } else {
            // Comandos de un solo carácter: \, \! \[ etc.
            cmd = this.src[this.pos++] || '';
        }

        this.skip();
        return this.cmd(cmd);
    }

    // ── Manejador de comandos ─────────────────────────────────────

    cmd(c) {

        // ── \frac{num}{den} ───────────────────────────────────────
        if (c === 'frac' || c === 'dfrac' || c === 'tfrac') {
            const n = this.arg(), d = this.arg();
            return `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
        }

        // ── \cfrac (fracción continua) — alias de \frac ───────────
        if (c === 'cfrac') {
            const n = this.arg(), d = this.arg();
            return `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
        }

        // ── \sqrt[n]{x} ───────────────────────────────────────────
        if (c === 'sqrt') {
            let deg = '';
            if (this.src[this.pos] === '[') {
                this.pos++;
                while (this.pos < this.src.length && this.src[this.pos] !== ']') {
                    deg += this.src[this.pos++];
                }
                this.pos++; // consumir ']'
            }
            const base = this.arg();
            if (deg) {
                return `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr><m:deg><m:r><m:t>${xmlEscape(deg)}</m:t></m:r></m:deg><m:e>${base}</m:e></m:rad>`;
            }
            return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${base}</m:e></m:rad>`;
        }

        // ── \binom{n}{k} ──────────────────────────────────────────
        if (c === 'binom' || c === 'dbinom' || c === 'tbinom') {
            const top = this.arg(), bot = this.arg();
            return `<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e><m:f><m:fPr><m:type m:val="noBar"/></m:fPr><m:num>${top}</m:num><m:den>${bot}</m:den></m:f></m:e></m:d>`;
        }

        // ── Operadores n-arios (∑, ∏, ∫, etc.) ───────────────────
        if (nary[c]) {
            const { char, limLoc } = nary[c];
            const { sub, sup } = this.limits();
            return `<m:nary><m:naryPr><m:chr m:val="${char}"/><m:limLoc m:val="${limLoc}"/></m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e><m:r><m:t/></m:r></m:e></m:nary>`;
        }

        // ── \lim con límite inferior ──────────────────────────────
        if (c === 'lim') {
            const { sub } = this.limits();
            const subEl = sub
                ? `<m:sSub><m:e/><m:sub>${sub}</m:sub></m:sSub>`
                : '';
            return `<m:func><m:funcPr/><m:fName><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>lim</m:t></m:r>${subEl}</m:fName><m:e><m:r><m:t/></m:r></m:e></m:func>`;
        }

        // ── Funciones matemáticas (sin, cos, log…) ────────────────
        if (mathFunctions.includes(c)) {
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${c}</m:t></m:r>`;
        }

        // ── Acentos y decoraciones ────────────────────────────────
        if (accents[c]) {
            const e = this.arg();
            return `<m:acc><m:accPr><m:chr m:val="${accents[c]}"/></m:accPr><m:e>${e}</m:e></m:acc>`;
        }

        // ── Fuentes matemáticas ───────────────────────────────────
        // \mathbf{F} → negrita, \mathrm{d} → texto normal, etc.
        if (c === 'mathbf' || c === 'boldsymbol' || c === 'bm') {
            const inner = this._extractGroupText();
            return `<m:r><m:rPr><m:sty m:val="b"/></m:rPr><m:t>${xmlEscape(inner)}</m:t></m:r>`;
        }
        if (c === 'mathrm' || c === 'text' || c === 'textrm') {
            const inner = this._extractGroupText();
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${xmlEscape(inner)}</m:t></m:r>`;
        }
        if (c === 'mathit') {
            const inner = this._extractGroupText();
            return `<m:r><m:rPr><m:sty m:val="i"/></m:rPr><m:t>${xmlEscape(inner)}</m:t></m:r>`;
        }
        if (c === 'mathcal' || c === 'mathscr') {
            const inner = this._extractGroupText();
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${xmlEscape(inner)}</m:t></m:r>`;
        }
        if (c === 'mathbb') {
            // Letras de pizarrón → Unicode de doble raya
            const inner = this._extractGroupText();
            const blackboard = { R:'ℝ', N:'ℕ', Z:'ℤ', Q:'ℚ', C:'ℂ', F:'𝔽', K:'𝕂', P:'ℙ' };
            const mapped = inner.split('').map(ch => blackboard[ch] || ch).join('');
            return `<m:r><m:t>${xmlEscape(mapped)}</m:t></m:r>`;
        }

        // ── \left...\right (delimitadores auto-escalables) ────────
        if (c === 'left') {
            return this._parseDelimited();
        }
        if (c === 'right') {
            // Consumir el carácter de cierre — ya fue manejado por \left
            if (this.src[this.pos]) this.pos++;
            return '';
        }

        // ── Modificadores de tamaño (se ignoran, solo consumen el siguiente token) ─
        if (['Big', 'Bigg', 'big', 'bigg', 'bigl', 'bigr', 'Bigl', 'Bigr'].includes(c)) {
            return this.next();
        }

        // ── \overline, \underline como estructura OMML ────────────
        if (c === 'overline') {
            const e = this.arg();
            return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${e}</m:e></m:bar>`;
        }
        if (c === 'underline') {
            const e = this.arg();
            return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${e}</m:e></m:bar>`;
        }

        // ── \underbrace{x}_{texto} ────────────────────────────────
        if (c === 'underbrace') {
            const e = this.arg();
            const { sub } = this.limits();
            return `<m:limLow><m:e>${e}</m:e><m:lim>${sub}</m:lim></m:limLow>`;
        }
        if (c === 'overbrace') {
            const e = this.arg();
            const { sup } = this.limits();
            return `<m:limUpp><m:e>${e}</m:e><m:lim>${sup}</m:lim></m:limUpp>`;
        }

        // ── Letras griegas ────────────────────────────────────────
        if (greek[c]) {
            return `<m:r><m:t>${greek[c]}</m:t></m:r>`;
        }

        // ── Símbolos ──────────────────────────────────────────────
        if (symbols[c] !== undefined) {
            return symbols[c]
                ? `<m:r><m:t>${symbols[c]}</m:t></m:r>`
                : ''; // símbolo vacío = espaciado, se ignora
        }

        // ── Fallback: mostrar el comando literalmente ─────────────
        // Nunca debería romper el documento; aparecerá como \nombreComando
        return `<m:r><m:t>${xmlEscape('\\' + c)}</m:t></m:r>`;
    }

    // ── \left...\right: parsear delimitadores con contenido ───────

    _parseDelimited() {
        // Leer el delimitador de apertura (puede ser \angle, \{, ( , [ , etc.)
        const openChar = this._readDelimChar();
    
        const contentParts = [];
    
        while (this.pos < this.src.length) {
            // Detectar \right
            if (
                this.src[this.pos] === '\\' &&
                this.src.slice(this.pos + 1, this.pos + 6) === 'right'
            ) {
                this.pos += 6; // saltar '\right'
                this.skip();   // ← agregá esto por si hay espacio entre \right y \rangle
                const closeChar = this._readDelimChar(); // ← ya lo tenías, pero verificá que esté así
                return `<m:d><m:dPr><m:begChr m:val="${xmlEscape(openChar)}"/><m:endChr m:val="${xmlEscape(closeChar)}"/></m:dPr><m:e>${contentParts.join('')}</m:e></m:d>`;
            }
            contentParts.push(this.next());
        }
    
        return contentParts.join('');
    }
    
    // Leer un carácter delimitador, que puede ser un carácter simple
    // o un comando como \langle, \{, \lbrace, etc.
    _readDelimChar() {
        const delimMap = {
            langle:   '⟨',
            rangle:   '⟩',
            lbrace:   '{',
            rbrace:   '}',
            lfloor:   '⌊',
            rfloor:   '⌋',
            lceil:    '⌈',
            rceil:    '⌉',
            lvert:    '|',
            rvert:    '|',
            lVert:    '‖',
            rVert:    '‖',
            '{':      '{',
            '}':      '}',
            '|':      '|',
        };
    
        if (this.src[this.pos] === '\\') {
            this.pos++; // saltar '\'
            let cmd = '';
            while (this.pos < this.src.length && /[a-zA-Z{}\|]/.test(this.src[this.pos])) {
                cmd += this.src[this.pos++];
            }
            return delimMap[cmd] || cmd;
        }
    
        // Carácter simple: (, ), [, ], ., etc.
        if (this.src[this.pos] === '.') {
            this.pos++;
            return ''; // \left. o \right. = sin delimitador visible
        }
    
        return this.src[this.pos] ? this.src[this.pos++] : '';
    }

    // ── Extraer texto plano de un grupo {…} ───────────────────────
    // Usado por \mathbf, \mathrm, etc.

    _extractGroupText() {
        this.skip();
        if (this.src[this.pos] !== '{') {
            // Argumento de un solo carácter
            return this.src[this.pos] ? this.src[this.pos++] : '';
        }
        this.pos++; // consumir '{'
        let depth = 1, text = '';
        while (this.pos < this.src.length && depth > 0) {
            const ch = this.src[this.pos];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth > 0) text += ch;
            this.pos++;
        }
        return text;
    }

    // ── Leer el próximo argumento {…} o carácter ─────────────────

    arg() {
        this.skip();
        if (this.pos >= this.src.length) return '';
        if (this.src[this.pos] === '{') return this.group();
        if (this.src[this.pos] === '\\') return this.command();
        const ch = this.src[this.pos++];
        return `<m:r><m:t>${xmlEscape(ch)}</m:t></m:r>`;
    }

    // ── Parsear un grupo {contenido} recursivamente ───────────────

    group() {
        this.pos++; // consumir '{'
        let depth = 1, start = this.pos;
        while (this.pos < this.src.length && depth > 0) {
            if (this.src[this.pos] === '{') depth++;
            else if (this.src[this.pos] === '}') depth--;
            this.pos++;
        }
        const inner = this.src.slice(start, this.pos - 1);
        return new LatexOmmlParser(inner).parse();
    }

    // ── Leer límites opcionales _ y ^ ────────────────────────────

    limits() {
        let sub = '', sup = '';
        this.skip();
        for (let i = 0; i < 2; i++) {
            if (this.src[this.pos] === '_') {
                this.pos++;
                sub = this.arg();
            } else if (this.src[this.pos] === '^') {
                this.pos++;
                sup = this.arg();
            } else {
                break;
            }
            this.skip();
        }
        return { sub, sup };
    }

    // ── Consumir espacios ─────────────────────────────────────────

    skip() {
        while (this.pos < this.src.length && this.src[this.pos] === ' ') {
            this.pos++;
        }
    }
}

module.exports = { LatexOmmlParser };