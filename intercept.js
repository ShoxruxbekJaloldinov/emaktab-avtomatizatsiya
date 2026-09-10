const puppeteer = require('puppeteer');
require('dotenv').config();

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://login.emaktab.uz/');
    await page.type('input[name="login"]', process.env.EMAKTAB_LOGIN);
    await page.type('input[name="password"]', process.env.EMAKTAB_PASSWORD);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000)); // wait for login
    
    const url = "https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=08.09.2026&dateto=08.09.2026&teacher=1000004405044";
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    page.on('request', request => {
        if (request.url().includes('reports/default') || request.method() === 'POST') {
            console.log("REQUEST:", request.method(), request.url(), request.postData());
        }
    });
    
    const submitBtn = await page.$('input[type="submit"], button[type="submit"], .button_blue');
    if (submitBtn) {
        await submitBtn.click();
        await new Promise(r => setTimeout(r, 5000));
    }
    
    await browser.close();
    console.log("Done");
})();
