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
    
    const url = "https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=08.09.2026&dateto=08.09.2026&teacher=1000004405044";
    
    console.log("Fetching GET...");
    let res = await axios.get(url, { headers: { 'Cookie': cookieStr, 'User-Agent': userAgent } });
    let $ = cheerio.load(res.data);
    let table = $('table.report-table, .grid').length;
    console.log("Table found via GET?", table > 0);
    
    if (table === 0) {
        console.log("Trying POST...");
        // maybe it requires form submit with exact params
        const formData = new URLSearchParams();
        // find the form inputs
        $('form').find('input, select').each((i, el) => {
            const name = $(el).attr('name');
            const val = $(el).val() || '';
            if (name) formData.append(name, val);
        });
        
        res = await axios.post(url, formData.toString(), { 
            headers: { 
                'Cookie': cookieStr, 
                'User-Agent': userAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            } 
        });
        $ = cheerio.load(res.data);
        table = $('table.report-table, .grid').length;
        console.log("Table found via POST?", table > 0);
    }
})();
