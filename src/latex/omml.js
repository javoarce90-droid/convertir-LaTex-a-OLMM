/**
 * omml.js
 * API pública para convertir LaTeX + Markdown a XML Word.
 *
 * Expone tres funciones:
 *
 *   latexToOmml(latex, display)
 *     Convierte una expresión LaTeX pura a XML OMML.
 *     display=true → fórmula centrada en su propia línea.
 *     display=false → fórmula inline dentro del texto.
 *
 *   markdownLatexToWordXml(input)
 *     Convierte texto completo (Markdown + LaTeX) a párrafos <w:p> Word.
 *     Maneja: $$...$$, $...$, **negrita**, listas, saltos de línea.
 *
 *   inlineToRuns(line)
 *     Convierte una sola línea con $...$ y **bold** a runs Word.
 *     Uso interno, pero exportada para testing.
 */

const { LatexOmmlParser } = require('./parser');
const { normalizeLatexDelimiters } = require('./normalizer');
const { textToRun } = require('./xml-helpers');

// ── latexToOmml ───────────────────────────────────────────────────────────────

/**
 * Convierte LaTeX → OMML envuelto en el tag raíz correcto.
 *
 * La diferencia entre display e inline en OMML:
 *   display → <m:oMathPara> con justificación centrada
 *   inline  → <m:oMath> sin contenedor extra
 */
function latexToOmml(latex, display = false) {
    const ns = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
    const parser = new LatexOmmlParser(latex.trim());
    const inner  = parser.parse();

    if (display) {
        return [
            `<m:oMathPara ${ns}>`,
            `<m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>`,
            `<m:oMath>${inner}</m:oMath>`,
            `</m:oMathPara>`,
        ].join('');
    }

    return `<m:oMath ${ns}>${inner}</m:oMath>`;
}

// ── markdownLatexToWordXml ────────────────────────────────────────────────────

/**
 * Convierte texto con Markdown + LaTeX a párrafos Word (<w:p>).
 *
 * Reglas de detección por línea:
 *   $$...$$ solo       → fórmula display centrada
 *   1. texto           → lista numerada
 *   - texto / * texto  → lista con viñeta
 *   (resto)            → párrafo normal con inlineToRuns()
 */
function markdownLatexToWordXml(input) {
    if (!input || !input.trim()) return '';

    const normalized = normalizeLatexDelimiters(input);
    const paras = [];

    for (const line of normalized.split('\n')) {
        const t = line.trim();

        // ── Línea vacía → párrafo vacío ───────────────────────────
        if (!t) {
            paras.push('<w:p/>');
            continue;
        }

        // ── $$...$$ como línea completa → display math ────────────
        const dm = t.match(/^\$\$([\s\S]+?)\$\$$/);
        if (dm) {
            paras.push(
                `<w:p>` +
                `<w:pPr><w:jc w:val="center"/></w:pPr>` +
                `${latexToOmml(dm[1].trim(), true)}` +
                `</w:p>`
            );
            continue;
        }

        // ── Lista numerada: "1. texto" ────────────────────────────
        const nm = t.match(/^(\d+)\.\s+(.+)/);
        if (nm) {
            paras.push(
                `<w:p>` +
                `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>` +
                `${inlineToRuns(nm[2])}` +
                `</w:p>`
            );
            continue;
        }

        // ── Lista con viñeta: "- texto" o "* texto" ───────────────
        const bm = t.match(/^[-*]\s+(.+)/);
        if (bm) {
            paras.push(
                `<w:p>` +
                `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>` +
                `${inlineToRuns(bm[1])}` +
                `</w:p>`
            );
            continue;
        }

        // ── Párrafo normal ────────────────────────────────────────
        paras.push(`<w:p>${inlineToRuns(t)}</w:p>`);
    }

    return paras.join('');
}

// ── inlineToRuns ──────────────────────────────────────────────────────────────

/**
 * Convierte una línea con $...$ y **bold** intercalados a runs Word.
 *
 * Tokens detectados (en orden de prioridad por la regex):
 *   $$...$$  → OMML inline (display dentro de línea, poco común pero válido)
 *   $...$    → OMML inline
 *   **...**  → run en negrita
 *   (resto)  → run de texto normal
 */
function inlineToRuns(line) {
    const parts = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*(.+?)\*\*/g;
    let last = 0;
    let m;

    while ((m = re.exec(line)) !== null) {
        // Texto antes del token
        if (m.index > last) {
            parts.push(textToRun(line.slice(last, m.index)));
        }

        if (m[1] !== undefined) {
            // $$...$$ inline
            parts.push(latexToOmml(m[1].trim(), false));
        } else if (m[2] !== undefined) {
            // $...$ inline
            parts.push(latexToOmml(m[2].trim(), false));
        } else if (m[3] !== undefined) {
            // **negrita**
            parts.push(textToRun(m[3], true));
        }

        last = re.lastIndex;
    }

    // Texto restante después del último token
    if (last < line.length) {
        parts.push(textToRun(line.slice(last)));
    }

    return parts.join('');
}

module.exports = { latexToOmml, markdownLatexToWordXml, inlineToRuns };