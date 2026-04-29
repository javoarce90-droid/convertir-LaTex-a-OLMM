const puppeteer = require('puppeteer');

async function renderHtmlToPdf(html) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for MathJax to finish rendering all formulas
        await page.waitForFunction('window._mathJaxReady === true', { timeout: 15000 });

        // Los márgenes reservan top/bottom para que el contenido no se solape
        // con el header/footer ilustrado del PNG (logo, QR, lema).
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '18mm', right: '13mm', bottom: '30mm', left: '13mm' },
        });
        return pdf;
    } finally {
        await browser.close();
    }
}

module.exports = { renderHtmlToPdf };
