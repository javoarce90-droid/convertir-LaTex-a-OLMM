/**
 * xml-helpers.js
 * Utilidades pequeñas para generar XML Word válido.
 */

/**
 * Escapa caracteres especiales XML para usarlos dentro de atributos o texto.
 * Sin esto, un símbolo como '<' en una fórmula rompería el XML del documento.
 */
function xmlEscape(str) {
  return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

/**
* Genera un <w:r> (run de texto) Word.
* Un "run" es la unidad mínima de texto en Word: una cadena con formato uniforme.
*
* @param {string}  text - Texto a insertar
* @param {boolean} bold - Si es true, agrega <w:b/> al bloque de propiedades
*/
function textToRun(text, bold = false) {
  if (!text) return '';
  const rpr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

module.exports = { xmlEscape, textToRun };