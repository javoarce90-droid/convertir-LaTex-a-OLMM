/**
 * builder.js
 * Abre un .docx (que internamente es un ZIP de XMLs), reemplaza los
 * placeholders con contenido procesado, y devuelve el nuevo .docx como Buffer.
 *
 * Un .docx tiene esta estructura interna:
 *
 *   word/
 *     document.xml    ← cuerpo principal del documento
 *     header1.xml     ← encabezados (opcionales)
 *     footer1.xml     ← pies de página (opcionales)
 *   [Content_Types].xml
 *   _rels/
 *   ...
 *
 * Solo modificamos los archivos word/document.xml, word/header*.xml y word/footer*.xml.
 */

const JSZip = require('jszip');
const { xmlEscape } = require('../latex/xml-helpers');
const { markdownLatexToWordXml } = require('../latex/omml');
const { replacePlaceholderWithXml } = require('./placeholder');

/**
 * @param {Buffer}   templateBuffer  Buffer del archivo .docx template
 * @param {Object}   templateVars    { clave: valor, ... }
 * @param {Set}      markdownKeys    Set de claves que deben procesarse como Markdown+LaTeX
 * @returns {Promise<Buffer>}        Buffer del nuevo .docx generado
 */
function buildDocxFromTemplate(templateBuffer, templateVars, markdownKeys) {
    return JSZip.loadAsync(templateBuffer).then((zip) => {

        // Archivos XML que pueden contener placeholders
        const xmlFiles = Object.keys(zip.files).filter((name) =>
            /^word\/(document|header\d*|footer\d*)\.xml$/.test(name)
        );

        const processFile = (relPath) => {
            const file = zip.file(relPath);
            if (!file) return Promise.resolve();

            return file.async('string').then((xml) => {
                let out = xml;

                for (const key of Object.keys(templateVars)) {
                    const placeholder = `{${key}}`;
                    if (!out.includes(placeholder)) continue;

                    if (markdownKeys.has(key) && templateVars[key]) {
                        // Procesar como Markdown + LaTeX
                        const wordXml = markdownLatexToWordXml(templateVars[key]);
                        out = replacePlaceholderWithXml(out, placeholder, wordXml);
                    } else {
                        // Texto plano: solo escapar XML
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

module.exports = { buildDocxFromTemplate };