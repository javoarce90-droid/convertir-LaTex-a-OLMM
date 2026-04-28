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

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        return pdf;
    } finally {
        await browser.close();
    }
}

module.exports = { renderHtmlToPdf };
