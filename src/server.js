const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const TEMPLATE_PLACEHOLDER_KEYS = [
    'tituloSesion', 'docente', 'institucionEducativa', 'nivel', 'grado', 'area',
    'seccion', 'fecha', 'competencias', 'capacidades', 'desempeños',
    'criteriosDeEvaluacion', 'instrumentosDeEvaluacion', 'estandarDeAprendizaje',
    'proposito', 'evidencia', 'competenciasTransversales', 'enfoquesTransversales',
    'valores', 'actitudes', 'inicio', 'inicioTiempo', 'desarrollo', 'desarrolloTiempo',
    'cierre', 'cierreTiempo', 'ejerciciosRespuestas'
];

const ALLOWED_TEMPLATE_KEYS = new Set(TEMPLATE_PLACEHOLDER_KEYS);

/**
 * Estos campos pueden contener markdown + fórmulas LaTeX ($...$ y $$...$$).
 * Se procesan con el parser interno LaTeX → OMML sin Pandoc ni archivos temporales.
 * El template NO se toca: solo se reemplazan sus placeholders in-place.
 */
const MARKDOWN_PLACEHOLDER_KEYS = new Set([
    'inicio', 'desarrollo', 'cierre', 'ejerciciosRespuestas'
]);

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

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
// PARSER LaTeX → OMML
// ─────────────────────────────────────────────

/**
 * Convierte una expresión LaTeX a OMML (Office Math Markup Language).
 * OMML es el formato nativo de ecuaciones en Word/LibreOffice.
 * No requiere dependencias externas ni Pandoc.
 *
 * @param {string} latex   - LaTeX sin delimitadores $ o $$.
 * @param {boolean} display - true = bloque centrado ($$), false = inline ($).
 * @returns {string} XML OMML listo para insertar en document.xml
 */
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
        if (ch === '{')  return this.group();
        if (ch === '^')  { this.pos++; return this.sup(this.arg()); }
        if (ch === '_')  { this.pos++; return this.sub(this.arg()); }

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
        this.pos++; // saltar '\'
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
        // Fracciones
        if (c === 'frac') {
            const n = this.arg(), d = this.arg();
            return `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
        }

        // Raíz
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

        // N-arios: integral, suma, producto
        const nary = { int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏' };
        if (nary[c]) {
            const loc = (c === 'sum' || c === 'prod') ? 'undOvr' : 'subSup';
            const { sub, sup } = this.limits();
            return `<m:nary><m:naryPr><m:chr m:val="${nary[c]}"/><m:limLoc m:val="${loc}"/></m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e><m:r><m:t/></m:r></m:e></m:nary>`;
        }

        // Límite
        if (c === 'lim') {
            const { sub } = this.limits();
            const subEl = sub ? `<m:sSub><m:e/><m:sub>${sub}</m:sub></m:sSub>` : '';
            return `<m:func><m:funcPr/><m:fName><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>lim</m:t></m:r>${subEl}</m:fName><m:e><m:r><m:t/></m:r></m:e></m:func>`;
        }

        // Decoradores (vec, hat, bar, etc.)
        const accents = { vec: '⃗', hat: '^', bar: '‾', tilde: '~', dot: '˙', ddot: '¨', widehat: '^', overrightarrow: '⃗' };
        if (accents[c]) {
            const e = this.arg();
            return `<m:acc><m:accPr><m:chr m:val="${accents[c]}"/></m:accPr><m:e>${e}</m:e></m:acc>`;
        }

        // text{}
        if (c === 'text') {
            const inner = this.arg();
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${inner}</m:t></m:r>`;
        }

        // left/right (delimitadores)
        if (c === 'left' || c === 'right') {
            const d = this.src[this.pos] === '.' ? '' : (this.src[this.pos] || '');
            if (this.src[this.pos]) this.pos++;
            return d ? `<m:r><m:t>${xmlEscape(d)}</m:t></m:r>` : '';
        }

        // Funciones (sin, cos, log, etc.)
        const funcs = ['sin','cos','tan','cot','sec','csc','log','ln','exp','max','min','sup','inf','det','arg','deg','gcd','lcm'];
        if (funcs.includes(c)) {
            return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${c}</m:t></m:r>`;
        }

        // Griegos
        const greek = {
            alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', zeta:'ζ', eta:'η',
            theta:'θ', iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', xi:'ξ', pi:'π',
            rho:'ρ', sigma:'σ', tau:'τ', upsilon:'υ', phi:'φ', chi:'χ', psi:'ψ', omega:'ω',
            Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Xi:'Ξ', Pi:'Π',
            Sigma:'Σ', Phi:'Φ', Psi:'Ψ', Omega:'Ω',
        };
        if (greek[c]) return `<m:r><m:t>${greek[c]}</m:t></m:r>`;

        // Símbolos
        const syms = {
            cdot:'·', times:'×', div:'÷', pm:'±', mp:'∓',
            leq:'≤', geq:'≥', neq:'≠', approx:'≈', equiv:'≡', sim:'∼',
            infty:'∞', partial:'∂', nabla:'∇', forall:'∀', exists:'∃',
            in:'∈', notin:'∉', subset:'⊂', supset:'⊃', subseteq:'⊆', supseteq:'⊇',
            cup:'∪', cap:'∩', emptyset:'∅', varnothing:'∅',
            rightarrow:'→', leftarrow:'←', Rightarrow:'⇒', Leftarrow:'⇐',
            leftrightarrow:'↔', Leftrightarrow:'⟺', to:'→',
            ldots:'…', cdots:'⋯', vdots:'⋮', ddots:'⋱',
            '|':'|', '\\':'',
        };
        if (syms[c] !== undefined) return syms[c] ? `<m:r><m:t>${syms[c]}</m:t></m:r>` : '';

        // Big / Bigg (delimitadores de tamaño — ignorar el modificador, mostrar el siguiente char)
        if (['Big','Bigg','big','bigg','bigl','bigr','Bigl','Bigr'].includes(c)) {
            return this.next();
        }

        // Comando desconocido → mostrar como texto
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
        this.pos++; // '{'
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
 * Convierte un string con markdown básico y fórmulas LaTeX a XML de párrafos Word.
 * Genera <w:p> completos que se pueden inyectar en el body del template.
 *
 * Soporta:
 *   $$...$$ → ecuación display (párrafo centrado)
 *   $...$   → ecuación inline
 *   **txt** → negrita
 *   líneas vacías → párrafo vacío
 *   "1. item" → lista numerada (referencia numId=1 del template)
 *   "- item"  → lista viñeta  (referencia numId=2 del template)
 *
 * @param {string} input
 * @returns {string} XML Word (<w:p>…</w:p> concatenados)
 */
function markdownLatexToWordXml(input) {
    if (!input || !input.trim()) return '';

    const paras = [];
    for (const line of input.split('\n')) {
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
 * Convierte una línea de texto con $...$ y **bold** intercalados a runs Word.
 *
 * @param {string} line
 * @returns {string} w:r runs + m:oMath blocks
 */
function inlineToRuns(line) {
    const parts = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*(.+?)\*\*/g;
    let last = 0, m;

    while ((m = re.exec(line)) !== null) {
        if (m.index > last) parts.push(textToRun(line.slice(last, m.index)));
        if (m[1] !== undefined) parts.push(latexToOmml(m[1].trim(), false));  // $$ inline raro
        else if (m[2] !== undefined) parts.push(latexToOmml(m[2].trim(), false)); // $...$
        else if (m[3] !== undefined) parts.push(textToRun(m[3], true));          // **bold**
        last = re.lastIndex;
    }
    if (last < line.length) parts.push(textToRun(line.slice(last)));
    return parts.join('');
}

// ─────────────────────────────────────────────
// REEMPLAZAR PLACEHOLDER EN XML DEL TEMPLATE
// ─────────────────────────────────────────────

/**
 * Busca el <w:p> que contiene el placeholder y lo reemplaza con los párrafos OMML.
 * Word a veces fragmenta un placeholder en múltiples <w:r> runs; esta función
 * primero consolida esos runs antes de buscar.
 *
 * @param {string} xml         - XML completo de document.xml
 * @param {string} placeholder - e.g. "{inicio}"
 * @param {string} replacement - XML Word párrafos generados
 * @returns {string}
 */
function replacePlaceholderWithXml(xml, placeholder, replacement) {
    // Estrategia 1: placeholder está limpio en un solo run → buscar el <w:p> contenedor
    const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pRegex = new RegExp(`<w:p[ >](?:(?!</w:p>).)*${esc}(?:(?!</w:p>).)*</w:p>`, 's');

    if (pRegex.test(xml)) {
        return xml.replace(pRegex, replacement || '<w:p/>');
    }

    // Estrategia 2: reemplazo simple si el placeholder está tal cual en el XML
    if (xml.includes(placeholder)) {
        return xml.split(placeholder).join(replacement || '');
    }

    // Estrategia 3: el placeholder puede estar roto entre runs de Word
    // Consolidar runs dentro de cada párrafo y reintentar
    const consolidated = consolidateRunsInParagraphs(xml, placeholder);
    if (consolidated !== xml) {
        return replacePlaceholderWithXml(consolidated, placeholder, replacement);
    }

    return xml;
}

/**
 * Word a veces divide el texto de un placeholder en múltiples <w:r><w:t> runs.
 * Esta función consolida el texto de runs consecutivos dentro de cada <w:p>
 * cuando la concatenación coincide con el placeholder buscado.
 *
 * @param {string} xml
 * @param {string} placeholder
 * @returns {string}
 */
function consolidateRunsInParagraphs(xml, placeholder) {
    // Reemplazar runs fragmentados: buscar secuencias de <w:t>...</w:t> que juntas forman el placeholder
    // Simplificación: limpiar atributos de split de runs en el texto del XML
    const key = placeholder.replace('{', '').replace('}', '');

    // Construir regex que detecta el placeholder fragmentado entre tags XML
    const chars = key.split('').map(c => xmlEscape(c));
    // Cada carácter puede estar separado por tags XML de cierre/apertura de run
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

/**
 * Aplica templateVars sobre el template.docx:
 * - Campos texto plano → escape XML + reemplazo string directo.
 * - Campos markdown+LaTeX → convierte a OMML y reemplaza el <w:p> contenedor.
 *
 * El template NO se modifica en su estructura, imágenes ni relaciones.
 * Solo se reemplazan los placeholders {clave} en los XML internos.
 *
 * @param {Buffer} templateBuffer
 * @param {Object} templateVars
 * @returns {Promise<Buffer>}
 */
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
                        // Campo con fórmulas: markdown+LaTeX → párrafos OMML
                        const wordXml = markdownLatexToWordXml(templateVars[key]);
                        out = replacePlaceholderWithXml(out, placeholder, wordXml);
                    } else {
                        // Campo texto plano: escape + reemplazo directo
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
// ENDPOINT POST /convert
// ─────────────────────────────────────────────

/**
 * POST /convert
 *
 * Body JSON:
 * {
 *   "templateVars": {
 *     // ── Campos texto plano ──────────────────────────────────────────────
 *     "tituloSesion":            "Teorema de Stokes",
 *     "docente":                 "Prof. García",
 *     "institucionEducativa":    "I.E. San Marcos",
 *     "nivel":                   "Secundaria",
 *     "grado":                   "5to",
 *     "area":                    "Matemática",
 *     "seccion":                 "A",
 *     "fecha":                   "17/03/2026",
 *     "competencias":            "...",
 *     "capacidades":             "...",
 *     "desempeños":              "...",
 *     "criteriosDeEvaluacion":   "...",
 *     "instrumentosDeEvaluacion":"...",
 *     "estandarDeAprendizaje":   "...",
 *     "proposito":               "...",
 *     "evidencia":               "...",
 *     "competenciasTransversales":"...",
 *     "enfoquesTransversales":   "...",
 *     "valores":                 "...",
 *     "actitudes":               "...",
 *     "inicioTiempo":            "20 min",
 *     "desarrolloTiempo":        "50 min",
 *     "cierreTiempo":            "20 min",
 *
 *     // ── Campos markdown + LaTeX ($...$ inline, $$...$$ display) ─────────
 *     "inicio":               "Introducción al **Teorema de Stokes**: $\\int_{\\Sigma} \\omega = \\int_{\\partial\\Sigma} d\\omega$",
 *     "desarrollo":           "**Energía:** $E = mc^2$\n\n$$\\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y}$$",
 *     "cierre":               "Preguntas finales sobre $f(x) = x^2$",
 *     "ejerciciosRespuestas": "**Ej 1:** Calcular $\\int_0^1 x^2 dx$\n**Resp:** $\\frac{1}{3}$"
 *   }
 * }
 */
app.post('/convert', (req, res) => {
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

    const templatePath = path.join(__dirname, 'template.docx');
    if (!fs.existsSync(templatePath)) {
        return res.status(500).send('template.docx no encontrado en el servidor');
    }

    buildDocxFromTemplate(fs.readFileSync(templatePath), templateVars)
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
});