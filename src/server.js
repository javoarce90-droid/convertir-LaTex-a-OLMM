require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const fs        = require('fs');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const { buildDocxFromTemplate }              = require('./docx/builder');
const { fetchRemoteTemplate, decodeBase64Template } = require('./docx/remote-template');
const { buildPdfHtml }                       = require('./pdf/html-builder');
const { renderHtmlToPdf }                    = require('./pdf/renderer');
const {
    ALLOWED_TEMPLATE_KEYS,
    MARKDOWN_PLACEHOLDER_KEYS_SET: MARKDOWN_PLACEHOLDER_KEYS,
} = require('./constant');

const API_KEY       = process.env.API_KEY;
const LOG_REQUEST_BODY =
    process.env.LOG_REQUEST_BODY === '1' ||
    /^true$/i.test(process.env.LOG_REQUEST_BODY || '') ||
    /^yes$/i.test(process.env.LOG_REQUEST_BODY || '');
/** Máx. caracteres por campo de templateVars al loguear (evita volcar textos enormes). */
const LOG_REQUEST_BODY_MAX_FIELD_CHARS = Math.max(
    0,
    parseInt(process.env.LOG_REQUEST_BODY_MAX_FIELD_CHARS, 10) || 8000
);

const TEMPLATE_PATH = process.env.TEMPLATE_PATH
    ? path.resolve(process.env.TEMPLATE_PATH)
    : path.join(__dirname, 'template.docx');

if (!API_KEY) {
    console.warn('⚠️  ADVERTENCIA: API_KEY no definida. El endpoint no está protegido.');
}

if (LOG_REQUEST_BODY) {
    console.warn(
        '[convert] LOG_REQUEST_BODY está activo: cada POST /convert volcará templateVars en consola (costoso en Railway). ' +
            'En producción suele desactivarse con LOG_REQUEST_BODY=0 o sin definir la variable.'
    );
}

const app = express();
// Bubble / CDN / reverse proxy envían X-Forwarded-For; sin esto express-rate-limit avisa y req.ip no refleja al cliente.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS, 10) || 1);
app.use(cors());
app.use(express.json({ limit: '20mb' })); // ← límite ampliado para el base64

const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MIN) || 10) * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
});
app.use('/convert', limiter);

function requireApiKey(req, res, next) {
    if (!API_KEY) return next();
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'API Key inválida o ausente.' });
    }
    next();
}

/**
 * Copia del body apta para consola: no vuelca templateBase64 completo; trunca valores largos.
 */
function bodySnapshotForLog(body) {
    const snap = { ...body };
    if (snap.templateBase64) {
        const len = String(snap.templateBase64).length;
        snap.templateBase64 = `[omitido: ${len} caracteres base64]`;
    }
    if (snap.templateVars && typeof snap.templateVars === 'object') {
        const out = {};
        const max = LOG_REQUEST_BODY_MAX_FIELD_CHARS;
        for (const [k, v] of Object.entries(snap.templateVars)) {
            const s = v == null ? '' : String(v);
            if (max > 0 && s.length > max) {
                out[k] = `${s.slice(0, max)}\n... [truncado, ${s.length} caracteres en total]`;
            } else {
                out[k] = s;
            }
        }
        snap.templateVars = out;
    }
    return snap;
}

app.post('/convert', requireApiKey, async (req, res) => {
    const raw          = (req.body.templateVars && typeof req.body.templateVars === 'object')
        ? req.body.templateVars : {};
    const templateUrl  = req.body.templateUrl  || null;
    const templateB64  = req.body.templateBase64 || null;

    if (LOG_REQUEST_BODY) {
        console.log('[convert] POST body:', JSON.stringify(bodySnapshotForLog(req.body), null, 2));
        const dropped = Object.keys(raw).filter((k) => !ALLOWED_TEMPLATE_KEYS.has(k));
        if (dropped.length) {
            console.log('[convert] Claves en templateVars ignoradas (no están en ALLOWED_TEMPLATE_KEYS):', dropped);
        }
    }

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

    // ── Resolver template: base64 > URL pública > archivo local ──
    let templateBuffer;
    try {
        if (templateB64) {
            templateBuffer = decodeBase64Template(templateB64);
        } else if (templateUrl) {
            templateBuffer = await fetchRemoteTemplate(templateUrl);
        } else {
            if (!fs.existsSync(TEMPLATE_PATH)) {
                return res.status(500).send('template.docx no encontrado en el servidor');
            }
            templateBuffer = fs.readFileSync(TEMPLATE_PATH);
        }
    } catch (err) {
        console.error('Error resolviendo template:', err.message);
        return res.status(400).send(`Template inválido: ${err.message}`);
    }

    // ── Generar el documento ──────────────────────────────────────
    try {
        const buf = await buildDocxFromTemplate(templateBuffer, templateVars, MARKDOWN_PLACEHOLDER_KEYS);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="clase_matematicas.docx"');
        res.send(buf);
    } catch (err) {
        console.error('Error generando documento:', err);
        res.status(500).send('Error al generar el documento');
    }
});

// ── POST /convert-pdf ────────────────────────────────────────────────────────

app.post('/convert-pdf', requireApiKey, async (req, res) => {
    const raw = (req.body.templateVars && typeof req.body.templateVars === 'object')
        ? req.body.templateVars : {};

    if (LOG_REQUEST_BODY) {
        console.log('[convert-pdf] POST body:', JSON.stringify(bodySnapshotForLog(req.body), null, 2));
    }

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

    try {
        const html = buildPdfHtml(templateVars);
        const pdf  = await renderHtmlToPdf(html);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="sesion_aprendizaje.pdf"');
        res.send(pdf);
    } catch (err) {
        console.error('Error generando PDF:', err);
        res.status(500).send('Error al generar el PDF');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
});