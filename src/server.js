require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const fs        = require('fs');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const { buildDocxFromTemplate }              = require('./docx/builder');
const { fetchRemoteTemplate, decodeBase64Template } = require('./docx/remote-template');
const {
    ALLOWED_TEMPLATE_KEYS,
    MARKDOWN_PLACEHOLDER_KEYS_SET: MARKDOWN_PLACEHOLDER_KEYS,
} = require('./constant');

const API_KEY       = process.env.API_KEY;
const TEMPLATE_PATH = process.env.TEMPLATE_PATH
    ? path.resolve(process.env.TEMPLATE_PATH)
    : path.join(__dirname, 'template.docx');

if (!API_KEY) {
    console.warn('⚠️  ADVERTENCIA: API_KEY no definida. El endpoint no está protegido.');
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

app.post('/convert', requireApiKey, async (req, res) => {
    const raw          = (req.body.templateVars && typeof req.body.templateVars === 'object')
        ? req.body.templateVars : {};
    const templateUrl  = req.body.templateUrl  || null;
    const templateB64  = req.body.templateBase64 || null;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
});