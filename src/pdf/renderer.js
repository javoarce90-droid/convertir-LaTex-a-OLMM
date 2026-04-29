const puppeteer = require('puppeteer');
const { MATHJAX_BUNDLE_PATH } = require('./html-builder');

const LAUNCH_OPTS = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
};

let browserPromise = null;

// Lanzamos un único Chromium y reusamos la instancia entre requests. Cada
// request abre/cierra una page (~10-30 MB) en vez de un proceso completo
// (~150-250 MB), lo que reduce picos de memoria y latencia. Si el browser se
// desconecta (crash, OOM kill), invalidamos el cache para que el próximo
// request relance.
function getBrowser() {
    if (!browserPromise) {
        browserPromise = puppeteer.launch(LAUNCH_OPTS).then(browser => {
            browser.on('disconnected', () => {
                if (browserPromise && browserPromise._browser === browser) {
                    browserPromise = null;
                }
            });
            browserPromise._browser = browser;
            return browser;
        }).catch(err => {
            browserPromise = null;
            throw err;
        });
    }
    return browserPromise;
}

async function renderHtmlToPdf(html) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Inject MathJax from node_modules (no CDN). The window.MathJax config
        // declared in the HTML head is already in place, so the bundle picks
        // it up and runs its startup pipeline.
        await page.addScriptTag({ path: MATHJAX_BUNDLE_PATH });

        await page.waitForFunction('window._mathJaxReady === true', { timeout: 15000 });

        // Los márgenes reservan top/bottom para que el contenido no se solape
        // con el header/footer ilustrado del PNG (logo, QR, lema).
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '18mm', right: '13mm', bottom: '30mm', left: '13mm' },
        });
    } finally {
        await page.close().catch(() => { /* page already gone */ });
    }
}

async function shutdownBrowser() {
    if (!browserPromise) return;
    const p = browserPromise;
    browserPromise = null;
    try {
        const browser = await p;
        await browser.close();
    } catch { /* ignore */ }
}

// Cierra el Chromium si el proceso recibe señal de terminación. Sin esto, el
// proceso de Chromium puede quedar zombi en algunos hosts.
for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => {
        shutdownBrowser().finally(() => process.exit(0));
    });
}

module.exports = { renderHtmlToPdf, shutdownBrowser };
