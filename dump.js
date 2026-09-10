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
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 5000));
    
    const html = await page.content();
    fs.writeFileSync('login_page.html', html);
    
    await browser.close();
    console.log("HTML saved to login_page.html");
})();
