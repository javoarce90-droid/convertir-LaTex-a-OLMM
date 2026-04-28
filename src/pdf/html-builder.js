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

function sectionHeader(text) {
    return `<tr><td colspan="2" class="sec-header">${escHtml(text)}</td></tr>`;
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

function fullWidthLabelRow(label) {
    return `<tr><td colspan="2" class="sec-header">${escHtml(label)}</td></tr>`;
}

function fullWidthValueRow(value, isMarkdown = false) {
    const content = isMarkdown
        ? markdownLatexToHtml(value || '')
        : `<span class="plain-text">${escHtml(value || '')}</span>`;
    return `<tr><td colspan="2" class="field-value">${content}</td></tr>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

function buildPdfHtml(templateVars) {
    const v = templateVars;

    const bgStyle = BG_BASE64
        ? `background-image: url('data:image/png;base64,${BG_BASE64}'); background-size: 100% 100%;`
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
  @page { size: A4; margin: 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #000;
  }

  /* MathJax renders async — hide content until done to avoid flash */
  body.mathjax-loading { visibility: hidden; }

  /* Full-page background — repeats on every PDF page */
  .page-bg {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: -1;
    ${bgStyle}
  }

  .content {
    padding: 16mm 13mm 14mm 13mm;
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

  /* ── Datos generales 5-column row ── */
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
    width: 12%;
    padding: 3px;
  }

  .tiempo-value {
    font-size: 8.5pt;
    text-align: center;
    vertical-align: top;
    width: 14%;
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

<div class="content">

  <!-- ═══════════════════════ TÍTULO PRINCIPAL ═══════════════════════ -->
  <div class="main-title">Sesión de Aprendizaje</div>

  <div style="height:3px;"></div>

  <!-- Título de la sesión -->
  <table class="doc-table">
    <tr><td class="session-title-label"><strong>Título de la sesión</strong></td></tr>
    <tr><td class="session-title-value">${escHtml(v.titulosesion || '')}</td></tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════════ I. DATOS GENERALES ═══════════════════════ -->
  <table class="doc-table">
    <tr><td colspan="2" class="sec-header">I. Datos Generales</td></tr>
    <tr>
      <td style="width:16%; font-weight:bold; font-size:8pt; padding:2px 4px;">Docente:</td>
      <td style="font-size:8.5pt; padding:2px 4px;">${escHtml(v.nombredocente || '')}</td>
    </tr>
    <tr>
      <td style="width:16%; font-weight:bold; font-size:8pt; padding:2px 4px;">Institución Educativa:</td>
      <td style="font-size:8.5pt; padding:2px 4px;">${escHtml(v.ie || '')}</td>
    </tr>
    <tr>
      <td class="col-header">Nivel</td>
      <td class="col-header">Grado</td>
    </tr>
    <tr>
      <td class="col-value">${escHtml(v.nivel || '')}</td>
      <td class="col-value">${escHtml(v.grado || '')}</td>
    </tr>
    <tr>
      <td class="col-header">Área</td>
      <td class="col-header">Sección</td>
    </tr>
    <tr>
      <td class="col-value">${escHtml(v.area || '')}</td>
      <td class="col-value">${escHtml(v.seccion || '')}</td>
    </tr>
    <tr>
      <td class="col-header">Fecha</td>
      <td class="col-value">${escHtml(v.fecha || '')}</td>
    </tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ II. PROPÓSITOS DE APRENDIZAJE ═══════════════ -->
  <table class="doc-table">
    <tr><td colspan="2" class="sec-header">II. Propósitos de Aprendizaje</td></tr>
    ${labelRow('Competencias', v.Competencias)}
    ${labelRow('Capacidades', v.Capacidades)}
    <tr>
      <td class="field-label">Desempeños</td>
      <td class="field-value"></td>
    </tr>
    ${labelRow('Criterios de Evaluación', v.Criterios)}
    ${labelRow('Instrumentos de Evaluación', v.Evaluacion)}
    ${labelRow('Estándar de Aprendizaje', v.estandar)}
    ${labelRow('Propósito', v.proposito)}
    ${labelRow('Evidencia', v.evidencia)}
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ COMPETENCIAS TRANSVERSALES ═══════════════════ -->
  <table class="doc-table">
    ${labelRow('Competencias Transversales', v.competenciastrans)}
    ${labelRow('Capacidades', v.capacidadestrans)}
    ${labelRow('Enfoques Transversales', v.enfoques)}
    ${labelRow('Valores', v.valores)}
    ${labelRow('Actitudes / Acciones Observables', v.actitudes)}
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ III. SECUENCIA DIDÁCTICA ════════════════════ -->
  <table class="doc-table">
    <tr><td colspan="3" class="sec-header">III. Secuencia Didáctica</td></tr>
    <tr>
      <td class="sec-header" style="width:12%; text-align:center;">Momento</td>
      <td class="sec-header" style="width:74%;">Actividades / Estrategias</td>
      <td class="sec-header" style="width:14%; text-align:center;">Tiempo (min)</td>
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
    <tr><td class="sec-header">Ficha de Aprendizaje</td></tr>
    <tr><td class="field-value">${markdownLatexToHtml(v.fichadeaprendizaje || '')}</td></tr>
  </table>

  <div style="height:3px;"></div>

  <!-- ═══════════════ EJERCICIOS Y RESPUESTAS ══════════════════════ -->
  <table class="doc-table">
    <tr><td class="sec-header">Ejercicios y Respuestas</td></tr>
    <tr><td class="field-value" style="min-height:30px;"></td></tr>
  </table>

</div>
</body>
</html>`;
}

module.exports = { buildPdfHtml };
