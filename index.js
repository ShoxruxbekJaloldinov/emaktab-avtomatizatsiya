require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

const LOGIN_URL = 'https://login.emaktab.uz/';
// Default report url from the instructions
const REPORT_BASE_URL = 'https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher';

async function run() {
    const login = process.env.EMAKTAB_LOGIN;
    const password = process.env.EMAKTAB_PASSWORD;

    if (!login || !password) {
        console.error("Xatolik: .env faylida EMAKTAB_LOGIN va EMAKTAB_PASSWORD ko'rsatilmagan.");
        process.exit(1);
    }

    console.log("Brauzer ishga tushirilmoqda...");
    const browser = await puppeteer.launch({
        headless: false, // Set to true for background execution
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    // 1-qadam: Tizimga kirish
    console.log("Avtorizatsiya sahifasiga o'tilmoqda...");
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

    // Wait for login inputs
    try {
        await page.waitForSelector('input[name="login"]', { timeout: 10000 });
        await page.type('input[name="login"]', login);
        await page.type('input[name="password"]', password);
        await page.click('button[type="submit"], input[type="submit"], .login__submit button'); // adjust selector as needed
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Avtorizatsiyadan muvaffaqiyatli o'tildi.");
    } catch (e) {
        console.error("Avtorizatsiya jarayonida xatolik yuz berdi. Login sahifasi strukturasi o'zgargan bo'lishi mumkin.", e.message);
        await browser.close();
        process.exit(1);
    }

    // 2-qadam: Hisobot sahifasini ochish
    console.log("Hisobot sahifasiga o'tilmoqda...");
    await page.goto(REPORT_BASE_URL, { waitUntil: 'networkidle2' });

    // 3-qadam: O'qituvchilar ro'yxatini yig'ish
    console.log("O'qituvchilar ro'yxati yig'ilmoqda...");
    let teachers = [];
    try {
        await page.waitForSelector('select[name="teacher"], select#teacher, select[id*="teacher"]', { timeout: 10000 });
        teachers = await page.evaluate(() => {
            const selectElement = document.querySelector('select[name="teacher"], select#teacher, select[id*="teacher"]');
            if (!selectElement) return [];
            
            return Array.from(selectElement.options)
                .filter(option => option.value && option.value !== '0' && option.value !== '-1' && !option.text.toLowerCase().includes('tanlang'))
                .map(option => ({
                    id: option.value,
                    name: option.text.trim()
                }));
        });
        console.log(`Jami ${teachers.length} ta o'qituvchi topildi.`);
    } catch (e) {
        console.error("O'qituvchilar ro'yxatini topib bo'lmadi.", e.message);
        await browser.close();
        process.exit(1);
    }

    // 4-qadam: Ma'lumotlarni iteratsiya qilish
    const finalReport = [];

    for (let i = 0; i < teachers.length; i++) {
        const teacher = teachers[i];
        console.log(`[${i + 1}/${teachers.length}] ${teacher.name} ma'lumotlari yuklanmoqda...`);
        
        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
            try {
                // Manually construct the URL for the specific teacher to avoid UI interaction flakiness
                const teacherUrl = `${REPORT_BASE_URL}&teacher=${teacher.id}`;
                await page.goto(teacherUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                
                // Wait for the table to appear or show "Ma'lumot yo'q"
                await page.waitForSelector('.grid, table.report-table, .empty-result', { timeout: 15000 });
                
                const data = await page.evaluate(() => {
                    const rows = Array.from(document.querySelectorAll('table.report-table tbody tr, .grid tbody tr'));
                    if (!rows || rows.length === 0) return [];
                    
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        // Assuming standard table format: Sinf, Fan, Ishtirokchilar, Mavzularni to'ldirish %, Jurnalni yuritish %
                        return cells.map(cell => cell.innerText.trim());
                    });
                });
                
                finalReport.push({
                    teacherId: teacher.id,
                    teacherName: teacher.name,
                    data: data
                });
                
                success = true;
                
            } catch (error) {
                console.log(`Xatolik yuz berdi (${teacher.name}). Qayta urinish: ${4 - retries}... (${error.message})`);
                retries--;
                if (retries === 0) {
                    console.log(`${teacher.name} ma'lumotlarini yuklash imkoni bo'lmadi.`);
                    finalReport.push({
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                        data: [] // Bo'sh massiv qo'shiladi
                    });
                }
            }
        }
    }

    // 5-qadam: Natijani eksport qilish
    console.log("Barcha ma'lumotlar yig'ildi. Natija eksport qilinmoqda...");
    const outputPath = 'report.json';
    fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 4), 'utf-8');
    
    console.log(`Jarayon muvaffaqiyatli yakunlandi. Natijalar ${outputPath} fayliga saqlandi.`);
    await browser.close();
}

run().catch(err => {
    console.error("Kutilmagan xatolik:", err);
});
