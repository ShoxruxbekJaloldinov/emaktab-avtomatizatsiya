const puppeteer = require('puppeteer');
require('dotenv').config();

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://login.emaktab.uz/');
    await page.type('input[name="login"]', process.env.EMAKTAB_LOGIN);
    await page.type('input[name="password"]', process.env.EMAKTAB_PASSWORD);
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.keyboard.press('Enter')
    ]);
    
    await page.screenshot({ path: 'debug_login.png' });
    console.log("Screenshot saved as debug_login.png. Current URL: " + page.url());
    
    // Try to go to report page
    await page.goto('https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=08.09.2026&dateto=08.09.2026');
    await page.screenshot({ path: 'debug_report.png' });
    console.log("Screenshot saved as debug_report.png. Current URL: " + page.url());

    await browser.close();
})();
