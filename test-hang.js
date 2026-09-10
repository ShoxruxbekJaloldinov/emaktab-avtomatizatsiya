const puppeteer = require('puppeteer');
require('dotenv').config();

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://login.emaktab.uz/');
    await page.type('input[name="login"]', process.env.EMAKTAB_LOGIN);
    await page.type('input[name="password"]', process.env.EMAKTAB_PASSWORD);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log("Logged in");
    const teacherUrl = "https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=08.09.2026&dateto=08.09.2026&teacher=1000004405044";
    
    try {
        await page.goto(teacherUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log("Page loaded");
        
        const submitBtn = await page.$('a.button_blue, input[type="submit"], button[type="submit"], .button_submit');
        if (submitBtn) {
            console.log("Clicking submit");
            await submitBtn.evaluate(b => b.click());
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log("Nav timeout:", e.message));
        }
        
        console.log("Waiting for table");
        await page.waitForSelector('.grid, table.report-table, .empty-result', { timeout: 10000 });
        
        const rows = await page.$$eval('table.report-table tbody tr, .grid tbody tr', els => els.length);
        console.log("Rows found:", rows);
        
    } catch(e) {
        console.log("Error:", e.message);
    }
    
    await browser.close();
})();
