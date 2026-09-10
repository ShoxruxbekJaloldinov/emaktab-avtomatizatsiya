const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://login.emaktab.uz/');
    await page.type('input[name="login"]', process.env.EMAKTAB_LOGIN);
    await page.type('input[name="password"]', process.env.EMAKTAB_PASSWORD);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));
    
    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const userAgent = await browser.userAgent();
    await browser.close();
    
    const url = "https://schools.emaktab.uz/v2/AsyncProgressReportHandler?a=htmlResultStatsJournalTeacherData&tid=00000000-0000-0000-0000-000000000000&tcid=1000004405044&sid=1000003851985&dfrom=08.09.2026&dto=08.09.2026";
    
    console.log("Fetching API...");
    try {
        let res = await axios.get(url, { headers: { 'Cookie': cookieStr, 'User-Agent': userAgent } });
        let $ = cheerio.load(res.data);
        let table = $('table.report-table, .grid').length;
        console.log("Table found via GET?", table > 0);
        if (table > 0) {
            console.log("Success! API works directly.");
        } else {
            console.log("Response:", res.data.substring(0, 500));
        }
    } catch(e) {
        console.log("Error:", e.message);
        if (e.response) {
            console.log(e.response.data);
        }
    }
})();
