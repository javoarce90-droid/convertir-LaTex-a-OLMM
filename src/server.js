require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const rateLimit = require('express-rate-limit');

// ─────────────────────────────────────────────
// VARIABLES DE ENTORNO
// ─────────────────────────────────────────────

const API_KEY = process.env.API_KEY;
const TEMPLATE_PATH = process.env.TEMPLATE_PATH
    ? path.resolve(process.env.TEMPLATE_PATH)
    : path.join(__dirname, 'template.docx');

if (!API_KEY) {
    console.warn('⚠️  ADVERTENCIA: API_KEY no definida. El endpoint no está protegido.');
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const {
    ALLOWED_TEMPLATE_KEYS,
    MARKDOWN_PLACEHOLDER_KEYS_SET: MARKDOWN_PLACEHOLDER_KEYS,
} = require('./constant');

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MIN) || 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
});
app.use('/convert', limiter);

function requireApiKey(req, res, next) {
    console.log("DEBUG API_KEY:", API_KEY, "tipo:", typeof API_KEY);
    if (!API_KEY) return next();
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'API Key inválida o ausente.' });
    }
    next();
}

// ─────────────────────────────────────────────
// HELPERS XML
// ─────────────────────────────────────────────

function xmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function textToRun(text, bold = false) {
    if (!text) return '';
    const rpr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
    return `<w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

// ─────────────────────────────────────────────
// ★ NUEVO: NORMALIZAR DELIMITADORES LATEX
// ─────────────────────────────────────────────

/**
 * Normaliza los delimitadores LaTeX que vienen de Bubble/JSON.
 * 
 * Problema: Cuando Bubble envía \( o \[, el JSON los escapa como \\ 
 * y pueden llegar como \\( o \\\\( dependiendo de cuántas veces se serializó.
 * 
 * Esta función convierte TODO a formato $...$ y $$...$$ que es más fácil de parsear.
 * 
 * @param {string} input - Texto con fórmulas LaTeX
 * @returns {string} - Texto normalizado con delimitadores $ y $$
 */
function normalizeLatexDelimiters(input) {
    if (!input) return '';
    
    let text = input;
    
    // DEBUG: descomentar para ver qué llega realmente
    // console.log('INPUT RAW:', JSON.stringify(text));
    
    // Paso 1: Normalizar TODOS los backslashes múltiples en comandos LaTeX
    // Esto maneja casos donde el JSON se escapó múltiples veces
    // \\\\vec → \\vec, \\\\frac → \\frac, etc.
    // Aplicar repetidamente hasta que no haya cambios
    let prev;
    do {
        prev = text;
        // Reducir \\\\ a \\ (doble escape a simple)
        text = text.replace(/\\\\/g, '\\');
    } while (text !== prev);
    
    // Paso 2: Convertir \[...\] a $$...$$ (display)
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
        return `$$${content}$$`;
    });
    
    // Paso 3: Convertir \(...\) a $...$ (inline)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, content) => {
        return `$${content}$`;
    });
    
    // DEBUG: descomentar para ver el resultado
    // console.log('OUTPUT NORMALIZED:', JSON.stringify(text));
    
    return text;
}

// ─────────────────────────────────────────────
// PARSER LaTeX → OMML
// ─────────────────────────────────────────────

function latexToOmml(latex, display = false) {
    const ns = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
    const parser = new LatexOmmlParser(latex.trim());
    const inner = parser.parse();

    if (display) {
        return `<m:oMathPara ${ns}><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>${inner}</m:oMath></m:oMathPara>`;
    }
    return `<m:oMath ${ns}>${inner}</m:oMath>`;
}

class LatexOmmlParser {
    constructor(src) {
        this.src = src;
        this.pos = 0;
    }

    parse() {
        const parts = [];
        while (this.pos < this.src.length) {
            parts.push(this.next());
        }
        return parts.join('');
    }

    next() {
        this.skip();
        if (this.pos >= this.src.length) return '';
        const ch = this.src[this.pos];

        if (ch === '\\') return this.command();
        if (ch === '{') return this.group();
        if (ch === '^') { this.pos++; return this.sup(this.arg()); }
        if (ch === '_') { this.pos++; return this.sub(this.arg()); }

        this.pos++;
        return `<m:r><m:t>${xmlEscape(ch)}</m:t></m:r>`;
    }

    sup(content) {
        return `<m:sSup><m:e><m:r><m:t/></m:r></m:e><m:sup>${content}</m:sup></m:sSup>`;
    }

    sub(content) {
        return `<m:sSub><m:e><m:r><m:t/></m:r></m:e><m:sub>${content}</m:sub></m:sSub>`;
    }

    command() {
        this.pos++;
        let cmd = '';
        if (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
            while (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
                cmd += this.src[this.pos++];
            }
        } else {
            cmd = this.src[this.pos++] || '';
        }
        this.skip();
        return this.cmd(cmd);
    }

    cmd(c) {
        if (c === 'frac') {
            const n = this.arg(), d = this.arg();
            return `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
        }

        if (c === 'sqrt') {
            let deg = '';
            if (this.src[this.pos] === '[') {
                this.pos++;
                while (this.pos < this.src.length && this.src[this.pos] !== ']') deg += this.src[this.pos++];
                this.pos++;
            }
            const base = this.arg();
            if (deg) return `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr><m:deg><m:r><m:t>${xmlEscape(deg)}</m:t></m:r></m:deg><m:e>${base}</m:e></m:rad>`;
            return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${base}</m:e></m:rad>`;
        }

        const nary = { int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏' };
        if (nary[c]) {
            const loc = (c === 'sum' || c === 'prod') ? 'undOvr' : 'subSup';
            const { sub, sup } = this.limits();
            return `<m:nary><m:naryPr><m:chr m:val="${nary[c]}"/><m:limLoc m:val="${loc}"/></m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e><m:r><m:t/></m:r></m:e></m:nary>`;
        }

        if (c === 'lim') {
            const { sub } = this.limits();
            const subEl = sub ? `<m:sSub><m:e/><m:sub>${sub}</m:sub></m:sSub>` : '';
            return `<m:func><m:funcPr/><m:fName><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>lim</m:t></m:r>${subEl}</m:fName><m:e><m:r><m:t/></m:r></m:e></m:func>`;
        }

        const accents = { vec: '⃗', hat: '^', bar: '‾', tilde: '~', dot: '˙', ddot: '¨', widehat: '^', overrightarrow: '⃗' };
        if (accents[c]) {
            const e = this.arg();
            return `<m:acc><m:accPr><m:chr m:val="${accents[c]}"/></m:accPr><m:e>${e}</m:e></m:acc>`;
        }

        if (c === 'text') {
            const inner = this.arg();
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${inner}</m:t></m:r>`;
        }

        if (c === 'left' || c === 'right') {
            const d = this.src[this.pos] === '.' ? '' : (this.src[this.pos] || '');
            if (this.src[this.pos]) this.pos++;
            return d ? `<m:r><m:t>${xmlEscape(d)}</m:t></m:r>` : '';
        }

        const funcs = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'max', 'min', 'sup', 'inf', 'det', 'arg', 'deg', 'gcd', 'lcm'];
        if (funcs.includes(c)) {
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${c}</m:t></m:r>`;
        }

        const greek = {
            alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
            theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
            rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
            Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
            Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
        };
        if (greek[c]) return `<m:r><m:t>${greek[c]}</m:t></m:r>`;

        const syms = {
            cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
            leq: '≤', geq: '≥', neq: '≠', approx: '≈', equiv: '≡', sim: '∼',
            infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃',
            in: '∈', notin: '∉', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
            cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
            rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐',
            leftrightarrow: '↔', Leftrightarrow: '⟺', to: '→',
            ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
            '|': '|', '\\': '',
        };
        if (syms[c] !== undefined) return syms[c] ? `<m:r><m:t>${syms[c]}</m:t></m:r>` : '';

        if (['Big', 'Bigg', 'big', 'bigg', 'bigl', 'bigr', 'Bigl', 'Bigr'].includes(c)) {
            return this.next();
        }

        return `<m:r><m:t>${xmlEscape('\\' + c)}</m:t></m:r>`;
    }

    arg() {
        this.skip();
        if (this.pos >= this.src.length) return '';
        if (this.src[this.pos] === '{') return this.group();
        if (this.src[this.pos] === '\\') return this.command();
        const ch = this.src[this.pos++];
        return `<m:r><m:t>${xmlEscape(ch)}</m:t></m:r>`;
    }

    group() {
        this.pos++;
        let depth = 1, start = this.pos;
        while (this.pos < this.src.length && depth > 0) {
            if (this.src[this.pos] === '{') depth++;
            else if (this.src[this.pos] === '}') depth--;
            this.pos++;
        }
        const inner = this.src.slice(start, this.pos - 1);
        return new LatexOmmlParser(inner).parse();
    }

    limits() {
        let sub = '', sup = '';
        this.skip();
        for (let i = 0; i < 2; i++) {
            if (this.src[this.pos] === '_') { this.pos++; sub = this.arg(); }
            else if (this.src[this.pos] === '^') { this.pos++; sup = this.arg(); }
            else break;
            this.skip();
        }
        return { sub, sup };
    }

    skip() {
        while (this.pos < this.src.length && this.src[this.pos] === ' ') this.pos++;
    }
}

// ─────────────────────────────────────────────
// MARKDOWN + LATEX → WORD XML
// ─────────────────────────────────────────────

/**
 * Convierte markdown + LaTeX a XML Word.
 * ★ CAMBIO: Ahora normaliza delimitadores ANTES de procesar.
 */
function markdownLatexToWordXml(input) {
    if (!input || !input.trim()) return '';

    // ★ NORMALIZAR DELIMITADORES PRIMERO
    const normalized = normalizeLatexDelimiters(input);

    const paras = [];
    for (const line of normalized.split('\n')) {
        const t = line.trim();

        if (!t) { paras.push('<w:p/>'); continue; }

        // $$...$$ como línea completa → display
        const dm = t.match(/^\$\$([\s\S]+?)\$\$$/);
        if (dm) {
            paras.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${latexToOmml(dm[1].trim(), true)}</w:p>`);
            continue;
        }

        // Lista numerada
        const nm = t.match(/^(\d+)\.\s+(.+)/);
        if (nm) {
            paras.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${inlineToRuns(nm[2])}</w:p>`);
            continue;
        }

        // Lista viñeta
        const bm = t.match(/^[-*]\s+(.+)/);
        if (bm) {
            paras.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>${inlineToRuns(bm[1])}</w:p>`);
            continue;
        }

        // Párrafo normal
        paras.push(`<w:p>${inlineToRuns(t)}</w:p>`);
    }

    return paras.join('');
}

/**
 * Convierte una línea con $...$ y **bold** a runs Word.
 * ★ SIMPLIFICADO: Ya no necesita manejar \(...\) porque están normalizados.
 */
function inlineToRuns(line) {
    const parts = [];
    // Solo buscamos $...$ (inline), $$...$$ (display inline), y **bold**
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*(.+?)\*\*/g;
    let last = 0, m;

    while ((m = re.exec(line)) !== null) {
        if (m.index > last) parts.push(textToRun(line.slice(last, m.index)));
        
        if (m[1] !== undefined) {
            // $$...$$ display (pero en línea con texto)
            parts.push(latexToOmml(m[1].trim(), false));
        } else if (m[2] !== undefined) {
            // $...$ inline
            parts.push(latexToOmml(m[2].trim(), false));
        } else if (m[3] !== undefined) {
            // **bold**
            parts.push(textToRun(m[3], true));
        }
        
        last = re.lastIndex;
    }
    
    if (last < line.length) parts.push(textToRun(line.slice(last)));
    return parts.join('');
}

// ─────────────────────────────────────────────
// REEMPLAZAR PLACEHOLDER EN XML DEL TEMPLATE
// ─────────────────────────────────────────────

function replacePlaceholderWithXml(xml, placeholder, replacement) {
    const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pRegex = new RegExp(`<w:p[ >](?:(?!</w:p>).)*${esc}(?:(?!</w:p>).)*</w:p>`, 's');

    if (pRegex.test(xml)) {
        return xml.replace(pRegex, replacement || '<w:p/>');
    }

    if (xml.includes(placeholder)) {
        return xml.split(placeholder).join(replacement || '');
    }

    const consolidated = consolidateRunsInParagraphs(xml, placeholder);
    if (consolidated !== xml) {
        return replacePlaceholderWithXml(consolidated, placeholder, replacement);
    }

    return xml;
}

function consolidateRunsInParagraphs(xml, placeholder) {
    const key = placeholder.replace('{', '').replace('}', '');
    const chars = key.split('').map(c => xmlEscape(c));
    const fragPattern = chars.join('(?:</w:t></w:r><w:r(?:[^>]*)><w:t(?:[^>]*)>|</w:t><w:t(?:[^>]*)>)?');
    const fullPattern = `\\{${fragPattern}\\}`;

    try {
        const fragRe = new RegExp(fullPattern, 'g');
        return xml.replace(fragRe, placeholder);
    } catch (_) {
        return xml;
    }
}

// ─────────────────────────────────────────────
// BUILD DOCX DESDE TEMPLATE
// ─────────────────────────────────────────────

function buildDocxFromTemplate(templateBuffer, templateVars) {
    return JSZip.loadAsync(templateBuffer).then((zip) => {
        const xmlFiles = Object.keys(zip.files).filter(
            (name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name)
        );

        const processFile = (relPath) => {
            const file = zip.file(relPath);
            if (!file) return Promise.resolve();

            return file.async('string').then((xml) => {
                let out = xml;

                for (const key of Object.keys(templateVars)) {
                    const placeholder = `{${key}}`;
                    if (!out.includes(placeholder)) continue;

                    if (MARKDOWN_PLACEHOLDER_KEYS.has(key) && templateVars[key]) {
                        const wordXml = markdownLatexToWordXml(templateVars[key]);
                        out = replacePlaceholderWithXml(out, placeholder, wordXml);
                    } else {
                        out = out.split(placeholder).join(xmlEscape(templateVars[key] ?? ''));
                    }
                }

                zip.file(relPath, out);
            });
        };

        return Promise.all(xmlFiles.map(processFile)).then(() =>
            zip.generateAsync({ type: 'nodebuffer' })
        );
    });
}

// ─────────────────────────────────────────────
// ★ NUEVO: ENDPOINT DE DEBUG
// ─────────────────────────────────────────────

/**
 * POST /debug
 * Útil para ver exactamente qué llega y cómo se transforma.
 */
app.post('/debug', (req, res) => {
    const input = req.body.text || '';
    
    console.log('=== DEBUG ===');
    console.log('Raw input:', JSON.stringify(input));
    
    const normalized = normalizeLatexDelimiters(input);
    console.log('Normalized:', JSON.stringify(normalized));
    
    const wordXml = markdownLatexToWordXml(input);
    console.log('Word XML preview:', wordXml.substring(0, 500));
    
    res.json({
        raw: input,
        normalized: normalized,
        wordXmlPreview: wordXml.substring(0, 1000),
        hasOmml: wordXml.includes('<m:oMath')
    });
});

// ─────────────────────────────────────────────
// ENDPOINT POST /convert
// ─────────────────────────────────────────────

app.post('/convert', requireApiKey, (req, res) => {
    const raw = req.body.templateVars && typeof req.body.templateVars === 'object'
        ? req.body.templateVars : {};

    const templateVars = {};
    for (const key of Object.keys(raw)) {
        if (ALLOWED_TEMPLATE_KEYS.has(key)) {
            const v = raw[key];
            templateVars[key] = v == null ? '' : String(v);
        }
    }

    if (Object.keys(templateVars).length === 0) {
        return res.status(400).send('Falta templateVars');
    }

    if (!fs.existsSync(TEMPLATE_PATH)) {
        return res.status(500).send('template.docx no encontrado en el servidor');
    }

    buildDocxFromTemplate(fs.readFileSync(TEMPLATE_PATH), templateVars)
        .then((buf) => {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', 'attachment; filename="clase_matematicas.docx"');
            res.send(buf);
        })
        .catch((err) => {
            console.error('Error generando documento:', err);
            res.status(500).send('Error al generar el documento');
        });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
    console.log(`Endpoint de debug disponible en POST /debug`);
});