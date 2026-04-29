const fs   = require('fs');
const path = require('path');
const { markdownLatexToHtml, escHtml } = require('./markdown-to-html');

const BG_IMAGE_PATH = path.join(__dirname, '..', 'template_bg.png');

function getBgBase64() {
    if (!fs.existsSync(BG_IMAGE_PATH)) return null;
    return fs.readFileSync(BG_IMAGE_PATH).toString('base64');
}

const BG_BASE64 = getBgBase64();

// ── HTML chunks ───────────────────────────────────────────────────────────────

function sectionHeader(text, colspan = 2) {
    return `<tr><td colspan="${colspan}" class="sec-header">${escHtml(text)}</td></tr>`;
}

function labelRow(label, value, isMarkdown = false) {
    const content = isMarkdown
        ? markdownLatexToHtml(value || '')
        : `<span class="plain-text">${escHtml(value || '')}</span>`;
    return `
        <tr>
            <td class="field-label">${escHtml(label)}</td>
            <td class="field-value">${content}</td>
        </tr>`;
}

/**
 * Crea una tabla con N columnas (header en una fila + valores en otra),
 * replicando el patrón "encabezados arriba, valores debajo" del template.docx.
 * @param {Array<{label: string, value: string, width: string, isMarkdown?: boolean}>} cols
 */
function columnTable(cols) {
    const headers = cols.map(c =>
        `<td class="col-label" style="width:${c.width};">${escHtml(c.label)}</td>`
    ).join('');

    const values = cols.map(c => {
        const content = c.isMarkdown
            ? markdownLatexToHtml(c.value || '')
            : `<span class="plain-text">${escHtml(c.value || '')}</span>`;
        return `<td class="field-value" style="width:${c.width};">${content}</td>`;
    }).join('');

    return `
        <table class="doc-table">
            <tr class="no-break">${headers}</tr>
            <tr>${values}</tr>
        </table>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

function buildPdfHtml(templateVars) {
    const v = templateVars;

    const bgStyle = BG_BASE64
        ? `background-image: url('data:image/png;base64,${BG_BASE64}'); background-size: 210mm 297mm; background-position: top left; background-repeat: no-repeat;`
        : 'background-color: #ffffff;';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<script>
  document.documentElement.classList.add('mathjax-loading');
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$']],
      displayMath: [['$$', '$$']],
      processEscapes: true,
    },
    svg: { fontCache: 'global' },
    startup: {
      ready() {
        MathJax.startup.defaultReady();
        MathJax.startup.promise.then(() => {
          document.documentElement.classList.remove('mathjax-loading');
          window._mathJaxReady = true;
        });
      }
    }
  };
</script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
<style>
  /* Margenes reservados para el header/footer del fondo (logo, QR, lema). */
  @page { size: A4; margin: 18mm 13mm 30mm 13mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { width: 100%; }

  body {
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #000;
  }

  /* MathJax renders async — hide content until done to avoid flash */
  body.mathjax-loading { visibility: hidden; }

  /*
   * Fondo de página: position:fixed se posiciona relativo al papel (no al margin
   * box) en el modo print de Chromium, así que el PNG cubre toda la hoja en
   * cada página y los márgenes @page reservan el espacio para que el contenido
   * no se solape con el footer ilustrado.
   */
  .page-bg {
    position: fixed;
    top: 0; left: 0;
    width: 210mm; height: 297mm;
    z-index: -1;
    ${bgStyle}
  }

  /* ── Tables ── */
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 3px;
    table-layout: fixed;
  }

  .doc-table td {
    border: 1px solid #888;
    vertical-align: top;
    padding: 2px 4px;
    word-break: break-word;
  }

  /* Permitir que las celdas grandes se partan entre páginas, pero mantener
   * los encabezados y filas cortas juntas. */
  .doc-table tr.no-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ── Section / field styles ── */
  .main-title {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 14pt;
    text-align: center;
    padding: 5px;
    border: 1px solid #888;
  }

  .session-title-label {
    font-weight: bold;
    font-size: 10pt;
    padding: 3px 4px;
  }

  .session-title-value {
    font-size: 11pt;
    text-align: center;
    padding: 4px;
  }

  .sec-header {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 9pt;
    padding: 2px 4px;
    border: 1px solid #888;
    text-align: center;
  }

  .field-label {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 8pt;
    width: 22%;
    padding: 2px 4px;
    vertical-align: top;
  }

  .field-value {
    font-size: 8.5pt;
    padding: 3px 5px;
    vertical-align: top;
  }

  /* Encabezado de columna (estilo "Competencias / Capacidades / Desempeños…") */
  .col-label {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
    padding: 3px;
    vertical-align: middle;
  }

  /* ── Datos generales 2-column row ── */
  .col-header {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
    padding: 2px 3px;
  }

  .col-value {
    font-size: 8.5pt;
    text-align: center;
    padding: 2px 3px;
  }

  /* ── Secuencia Didáctica ── */
  .momento-label {
    background-color: #2F4060;
    color: #fff;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
    vertical-align: middle;
    padding: 3px;
  }

  .tiempo-value {
    font-size: 8.5pt;
    text-align: center;
    vertical-align: top;
    padding: 2px 3px;
  }

  /* ── Markdown content styles ── */
  .plain-text { white-space: pre-wrap; }

  .md-p, .md-quote, .md-ol, .md-ul, .md-h1, .md-h2, .md-h3,
  .md-h4, .md-h5, .md-h6 {
    margin: 1px 0;
    line-height: 1.35;
  }
  .empty-line  { min-height: 0.6em; margin: 0; }
  .md-hr       { border: none; border-top: 1px solid #888; margin: 3px 0; }
  .math-display { text-align: center; margin: 4px 0; }
  .math-inline  { display: inline-block; vertical-align: middle; }
  .md-quote    { margin-left: 1.5em; }
  .md-ol       { padding-left: 2em; text-indent: -1.5em; }
  .md-ol-num   { font-weight: bold; }
  .md-ul       { padding-left: 1.5em; text-indent: -1em; }
  .md-h1       { font-size: 1.2em; font-weight: bold; }
  .md-h2       { font-size: 1.1em; font-weight: bold; }
  .md-h3, .md-h4, .md-h5, .md-h6 { font-size: 1em; font-weight: bold; }

  /* MathJax SVG scaling */
  mjx-container svg { max-height: 2.2em; vertical-align: middle; }
  .math-display mjx-container svg { max-height: none; }
</style>
</head>
<body>

<div class="page-bg"></div>

  <!-- ═══════════════════════ TÍTULO PRINCIPAL ═══════════════════════ -->
  <div class="main-title">Sesión de Aprendizaje</div>

  <div style="height:3px;"></div>

  <!-- Título de la sesión -->
  <table class="doc-table">
    <tr class="no-break"><td class="session-title-label"><strong>Título de la sesión</strong></td></tr>
    <tr><td class="session-title-value">${escHtml(v.titulosesion || '')}</td></tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════════ I. DATOS GENERALES ═══════════════════════ -->
  <table class="doc-table">
    <tr class="no-break"><td colspan="2" class="sec-header">I. Datos Generales</td></tr>
    <tr class="no-break">
      <td style="width:22%; background-color:#2F4060; color:#fff; font-weight:bold; font-size:8pt; padding:2px 4px;">Docente:</td>
      <td style="font-size:8.5pt; padding:2px 4px;">${escHtml(v.nombredocente || '')}</td>
    </tr>
    <tr class="no-break">
      <td style="width:22%; background-color:#2F4060; color:#fff; font-weight:bold; font-size:8pt; padding:2px 4px;">Institución Educativa:</td>
      <td style="font-size:8.5pt; padding:2px 4px;">${escHtml(v.ie || '')}</td>
    </tr>
    <tr class="no-break">
      <td class="col-header">Nivel</td>
      <td class="col-header">Grado</td>
    </tr>
    <tr class="no-break">
      <td class="col-value">${escHtml(v.nivel || '')}</td>
      <td class="col-value">${escHtml(v.grado || '')}</td>
    </tr>
    <tr class="no-break">
      <td class="col-header">Área</td>
      <td class="col-header">Sección</td>
    </tr>
    <tr class="no-break">
      <td class="col-value">${escHtml(v.area || '')}</td>
      <td class="col-value">${escHtml(v.seccion || '')}</td>
    </tr>
    <tr class="no-break">
      <td class="col-header">Fecha</td>
      <td class="col-value">${escHtml(v.fecha || '')}</td>
    </tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ II. PROPÓSITOS DE APRENDIZAJE ═══════════════ -->
  <!-- Encabezado de sección como tabla independiente -->
  <table class="doc-table">
    <tr class="no-break"><td class="sec-header">II. Propósitos de Aprendizaje</td></tr>
  </table>

  <!-- 5 columnas: Competencias / Capacidades / Desempeños / Criterios / Instrumentos -->
  ${columnTable([
      { label: 'Competencias',                value: v.Competencias, width: '20%' },
      { label: 'Capacidades',                 value: v.Capacidades,  width: '20%' },
      { label: 'Desempeños',                  value: v.Desempeños,   width: '21%' },
      { label: 'Criterios de Evaluación',     value: v.Criterios,    width: '19%' },
      { label: 'Instrumentos de Evaluación',  value: v.Evaluacion,   width: '20%' },
  ])}

  <!-- Estándar de Aprendizaje (1 columna) -->
  ${columnTable([
      { label: 'Estándar de Aprendizaje', value: v.estandar, width: '100%' },
  ])}

  <!-- Propósito + Evidencia (2 columnas) -->
  ${columnTable([
      { label: 'Propósito', value: v.proposito, width: '50%' },
      { label: 'Evidencia', value: v.evidencia, width: '50%' },
  ])}

  <div style="height:3px;"></div>

  <!-- ═══════════════ COMPETENCIAS TRANSVERSALES ═══════════════════ -->
  <!-- 2 columnas: Competencias Transversales | Capacidades -->
  ${columnTable([
      { label: 'Competencias Transversales', value: v.competenciastrans, width: '50%' },
      { label: 'Capacidades',                value: v.capacidadestrans,  width: '50%' },
  ])}

  <!-- 3 columnas: Enfoques Transversales | Valores | Actitudes / Acciones Observables -->
  ${columnTable([
      { label: 'Enfoques Transversales',         value: v.enfoques,  width: '33%' },
      { label: 'Valores',                        value: v.valores,   width: '29%' },
      { label: 'Actitudes / Acciones Observables', value: v.actitudes, width: '38%' },
  ])}

  <div style="height:3px;"></div>

  <!-- ═══════════════ III. SECUENCIA DIDÁCTICA ════════════════════ -->
  <table class="doc-table">
    <tr class="no-break"><td class="sec-header">III. Secuencia Didáctica</td></tr>
  </table>

  <table class="doc-table">
    <colgroup>
      <col style="width:10%;">
      <col style="width:80%;">
      <col style="width:10%;">
    </colgroup>
    <tr class="no-break">
      <td class="sec-header">Momento</td>
      <td class="sec-header">Actividades / Estrategias</td>
      <td class="sec-header">Tiempo (min)</td>
    </tr>
    <tr>
      <td class="momento-label">INICIO</td>
      <td class="field-value">${markdownLatexToHtml(v.Inicio || '')}</td>
      <td class="tiempo-value">${escHtml(v.tiempoinicio || '')}</td>
    </tr>
    <tr>
      <td class="momento-label">DESARROLLO</td>
      <td class="field-value">${markdownLatexToHtml(v.Desarrollo || '')}</td>
      <td class="tiempo-value">${escHtml(v.tiempodesarollo || '')}</td>
    </tr>
    <tr>
      <td class="momento-label">CIERRE</td>
      <td class="field-value">${markdownLatexToHtml(v.Cierre || '')}</td>
      <td class="tiempo-value">${escHtml(v.tiempocierre || '')}</td>
    </tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ FICHA DE APRENDIZAJE ════════════════════════ -->
  <table class="doc-table">
    <tr class="no-break"><td class="sec-header">Ficha de Aprendizaje</td></tr>
    <tr><td class="field-value">${markdownLatexToHtml(v.fichadeaprendizaje || '')}</td></tr>
  </table>

</body>
</html>`;
}

module.exports = { buildPdfHtml };
