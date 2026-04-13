/**
 * placeholder.js
 * Reemplaza placeholders {clave} en el XML interno de un .docx.
 *
 * El problema que resuelve:
 *   Word puede partir un placeholder como {contenido} en múltiples <w:r> (runs):
 *
 *     <w:r><w:t>{conte</w:t></w:r>
 *     <w:r><w:t>nido}</w:t></w:r>
 *
 *   Esto sucede porque los editores de Word fragmentan el texto al corregir
 *   ortografía, aplicar estilos parciales, etc.
 *
 *   Para reemplazar correctamente hay que:
 *     1. Intentar encontrar el placeholder entero en el párrafo (<w:p>)
 *     2. Si está fragmentado, reconsolidar los runs y volver a intentar
 */

const { xmlEscape } = require('../latex/xml-helpers');

// ── replacePlaceholderWithXml ─────────────────────────────────────────────────

/**
 * Reemplaza la primera aparición de {placeholder} en el XML por el XML de reemplazo.
 *
 * Estrategia en cascada:
 *   1. Buscar el placeholder dentro de un <w:p>...</w:p> completo y reemplazar el párrafo entero
 *      (útil cuando el placeholder ocupa todo el párrafo, como en bloques de fórmulas)
 *   2. Reemplazar inline (el placeholder está en medio de otro texto)
 *   3. Intentar reconsolidar runs fragmentados y repetir
 */
function replacePlaceholderWithXml(xml, placeholder, replacement) {
    const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Estrategia 1: el placeholder ocupa un párrafo completo
    const pRegex = new RegExp(
        `<w:p[ >](?:(?!</w:p>).)*${esc}(?:(?!</w:p>).)*</w:p>`,
        's'
    );
    if (pRegex.test(xml)) {
        return xml.replace(pRegex, replacement || '<w:p/>');
    }

    // Estrategia 2: el placeholder está inline
    if (xml.includes(placeholder)) {
        return xml.split(placeholder).join(replacement || '');
    }

    // Estrategia 3: reconsolidar runs fragmentados y reintentar
    const consolidated = consolidateRunsInParagraphs(xml, placeholder);
    if (consolidated !== xml) {
        return replacePlaceholderWithXml(consolidated, placeholder, replacement);
    }

    return xml;
}

// ── consolidateRunsInParagraphs ───────────────────────────────────────────────

/**
 * Cuando Word fragmenta el placeholder en múltiples <w:r>, esta función
 * detecta el patrón fragmentado y lo reconsolida en un texto continuo.
 *
 * Ejemplo de fragmentación:
 *   {cont  → </w:t></w:r><w:r><w:t> → enido}
 *
 * La regex construida une esos fragmentos y los reemplaza por el placeholder completo,
 * permitiendo que replacePlaceholderWithXml lo encuentre en el siguiente intento.
 */
function consolidateRunsInParagraphs(xml, placeholder) {
    const key   = placeholder.replace('{', '').replace('}', '');
    const chars = key.split('').map(c => xmlEscape(c));

    // Patrón que une los caracteres aunque haya separadores de run entre ellos
    const fragPattern = chars.join(
        '(?:</w:t></w:r><w:r(?:[^>]*)><w:t(?:[^>]*)>|</w:t><w:t(?:[^>]*)>)?'
    );
    const fullPattern = `\\{${fragPattern}\\}`;

    try {
        const fragRe = new RegExp(fullPattern, 'g');
        return xml.replace(fragRe, placeholder);
    } catch (_) {
        return xml;
    }
}

module.exports = { replacePlaceholderWithXml, consolidateRunsInParagraphs };