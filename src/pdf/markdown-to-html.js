const { normalizeLatexDelimiters } = require('../latex/normalizer');

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Converts a line with $...$, $$...$$, and **bold** tokens to HTML.
 * Math delimiters are preserved for MathJax to render in the browser
 * (Puppeteer/Chromium). LaTeX content is NOT server-side rendered.
 */
function inlineToHtml(line) {
    const parts = [];
    const re    = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*(.+?)\*\*/g;
    let last    = 0;
    let m;

    while ((m = re.exec(line)) !== null) {
        if (m.index > last) parts.push(escHtml(line.slice(last, m.index)));

        if (m[1] !== undefined) {
            // $$...$$ inline — keep delimiters; MathJax renders in Puppeteer
            parts.push('$$' + escHtml(m[1]) + '$$');
        } else if (m[2] !== undefined) {
            // $...$ inline
            parts.push('$' + escHtml(m[2]) + '$');
        } else if (m[3] !== undefined) {
            parts.push('<strong>' + escHtml(m[3]) + '</strong>');
        }

        last = re.lastIndex;
    }

    if (last < line.length) parts.push(escHtml(line.slice(last)));
    return parts.join('');
}

/**
 * Converts Markdown + LaTeX text to HTML.
 * Mirrors the logic of markdownLatexToWordXml() from latex/omml.js.
 * Math is left as $...$ / $$...$$ for MathJax (browser-side, via Puppeteer).
 */
function markdownLatexToHtml(input) {
    if (!input || !input.trim()) return '';

    const normalized = normalizeLatexDelimiters(input);
    const paras      = [];

    for (const line of normalized.split('\n')) {
        const t = line.trim();

        if (!t) {
            paras.push('<p class="empty-line"></p>');
            continue;
        }

        // Horizontal rule: ---, ***, ___
        if (/^([-*_])\1{2,}$/.test(t)) {
            paras.push('<hr class="md-hr">');
            continue;
        }

        // Display math: $$...$$ as its own line
        const dm = t.match(/^\$\$([\s\S]+?)\$\$$/);
        if (dm) {
            paras.push('<div class="math-display">$$' + escHtml(dm[1]) + '$$</div>');
            continue;
        }

        // Headings: # H1 through ###### H6
        const hm = t.match(/^(#{1,6})\s+(.+)/);
        if (hm) {
            const level = hm[1].length;
            paras.push('<p class="md-h' + level + '">' + inlineToHtml(hm[2]) + '</p>');
            continue;
        }

        // Blockquote: > text
        const qm = t.match(/^>\s*(.*)/);
        if (qm) {
            paras.push('<p class="md-quote">' + inlineToHtml(qm[1]) + '</p>');
            continue;
        }

        // Numbered list: 1. text
        const nm = t.match(/^(\d+)\.\s+(.+)/);
        if (nm) {
            paras.push('<p class="md-ol"><span class="md-ol-num">' + escHtml(nm[1]) + '.</span> ' + inlineToHtml(nm[2]) + '</p>');
            continue;
        }

        // Bullet list: - text, * text, + text
        const bm = t.match(/^[-*+]\s+(.+)/);
        if (bm) {
            paras.push('<p class="md-ul">&#8226; ' + inlineToHtml(bm[1]) + '</p>');
            continue;
        }

        paras.push('<p class="md-p">' + inlineToHtml(t) + '</p>');
    }

    return paras.join('\n');
}

module.exports = { markdownLatexToHtml, inlineToHtml, escHtml };
