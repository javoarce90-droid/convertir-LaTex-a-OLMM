require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const { buildDocxFromTemplate }  = require('./docx/builder');
const {
    ALLOWED_TEMPLATE_KEYS,
    MARKDOWN_PLACEHOLDER_KEYS_SET: MARKDOWN_PLACEHOLDER_KEYS,
} = require('./constant');

// ── Variables de entorno ──────────────────────────────────────────────────────

const API_KEY       = process.env.API_KEY;
const TEMPLATE_PATH = process.env.TEMPLATE_PATH
    ? path.resolve(process.env.TEMPLATE_PATH)
    : path.join(__dirname, 'template.docx');

if (!API_KEY) {
    console.warn('⚠️  ADVERTENCIA: API_KEY no definida. El endpoint no está protegido.');
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────

const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MIN) || 10) * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Demasiadas solicitudes. Intentá de nuevo en unos minutos.' },
});
app.use('/convert', limiter);

// ── Middleware de autenticación ───────────────────────────────────────────────

function requireApiKey(req, res, next) {
    if (!API_KEY) return next();
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'API Key inválida o ausente.' });
    }
    next();
}

// ── POST /convert ─────────────────────────────────────────────────────────────

app.post('/convert', requireApiKey, (req, res) => {
    // 1. Extraer y sanear templateVars
    const raw = (req.body.templateVars && typeof req.body.templateVars === 'object')
        ? req.body.templateVars
        : {};

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

    // 2. Verificar que el template existe
    if (!fs.existsSync(TEMPLATE_PATH)) {
        return res.status(500).send('template.docx no encontrado en el servidor');
    }

    // 3. Generar el documento
    buildDocxFromTemplate(
        fs.readFileSync(TEMPLATE_PATH),
        templateVars,
        MARKDOWN_PLACEHOLDER_KEYS
    )
        .then((buf) => {
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="clase_matematicas.docx"'
            );
            res.send(buf);
        })
        .catch((err) => {
            console.error('Error generando documento:', err);
            res.status(500).send('Error al generar el documento');
        });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
});