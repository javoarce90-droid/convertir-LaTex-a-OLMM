/**
 * remote-template.js
 * Obtiene un .docx remoto (por URL pública o base64) y lo devuelve como Buffer.
 */

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;

const ALLOWED_HOSTS = [
    's3.amazonaws.com',
    's3.us-east-1.amazonaws.com',
    's3.us-west-2.amazonaws.com',
];

/** Los .docx son ZIPs y siempre empiezan con PK (0x50 0x4B). */
function assertDocxMagicBytes(buffer) {
    if (buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
        throw new Error('El archivo no parece ser un .docx válido.');
    }
}

function decodeBase64Template(b64string) {
    const base64Data = b64string.includes(',')
        ? b64string.split(',')[1]
        : b64string;

    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_SIZE_BYTES) {
        throw new Error('El template supera el tamaño máximo permitido (10 MB).');
    }

    assertDocxMagicBytes(buffer);

    return buffer;
}

async function fetchRemoteTemplate(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('templateUrl inválida.');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('templateUrl debe usar HTTPS.');
    }

    const allowed = ALLOWED_HOSTS.some(
        (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );
    if (!allowed) {
        throw new Error(`Host no permitido: ${parsed.hostname}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Error descargando template: HTTP ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
            throw new Error('El template supera el tamaño máximo permitido (10 MB).');
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length > MAX_SIZE_BYTES) {
            throw new Error('El template supera el tamaño máximo permitido (10 MB).');
        }

        assertDocxMagicBytes(buffer);

        return buffer;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(
                `No se pudo descargar el template: tiempo de espera agotado (${FETCH_TIMEOUT_MS / 1000}s).`
            );
        }
        if (err instanceof Error) {
            const m = err.message;
            if (
                m.startsWith('Error descargando') ||
                m.includes('supera el tamaño') ||
                m.includes('no parece ser un .docx')
            ) {
                throw err;
            }
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`No se pudo descargar el template: ${msg}`);
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { fetchRemoteTemplate, decodeBase64Template };
