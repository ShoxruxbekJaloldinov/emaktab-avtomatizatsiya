const puppeteer = require('puppeteer');
require('dotenv').config();
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://login.emaktab.uz/');
    await page.type('input[name="login"]', process.env.EMAKTAB_LOGIN);
    await page.type('input[name="password"]', process.env.EMAKTAB_PASSWORD);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));
    
    const teacherUrl = "https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=08.09.2026&dateto=08.09.2026&teacher=1000004405044";
    await page.goto(teacherUrl, { waitUntil: 'networkidle2' });
    
    await page.screenshot({ path: 'report_page.png' });
    const html = await page.content();
    fs.writeFileSync('report_page.html', html);
    
    await browser.close();
})();
