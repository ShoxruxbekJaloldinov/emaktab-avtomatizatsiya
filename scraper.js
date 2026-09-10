require('dotenv').config();
const puppeteer = require('puppeteer');

const LOGIN_URL = 'https://login.emaktab.uz/';

async function runScraper(dateFrom, dateTo, onProgress) {
    const login = process.env.EMAKTAB_LOGIN;
    const password = process.env.EMAKTAB_PASSWORD;

    if (!login || !password) {
        throw new Error(".env faylida EMAKTAB_LOGIN va EMAKTAB_PASSWORD ko'rsatilmagan.");
    }

    onProgress({ status: 'info', message: "Brauzer ishga tushirilmoqda...", progress: 5 });
    
    const browser = await puppeteer.launch({
        headless: true, // Run in background
        defaultViewport: null,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        onProgress({ status: 'info', message: "Avtorizatsiya sahifasiga o'tilmoqda...", progress: 10 });
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

        try {
            await page.waitForSelector('input[name="login"]', { timeout: 10000 });
            await page.type('input[name="login"]', login);
            await page.type('input[name="password"]', password);
            
            // Tugmani bosish (yoki Enter bosish)
            await page.keyboard.press('Enter');
            
            onProgress({ status: 'info', message: "Agar tizim Captcha so'rasa, ochilgan brauzerda kiriting. Skript sizni (2 daqiqa) kutmoqda...", progress: 15 });
            
            // Login sahifasidan muvaffaqiyatli o'tib ketganligini tekshirish uchun 3 soniya kutamiz
            try {
                await page.waitForFunction(() => !window.location.href.includes('login.emaktab.uz'), { timeout: 3000 });
            } catch (timeoutError) {
                // Agar 3 soniyadan keyin ham login sahifasida qolsak, bu Captcha so'ralganini anglatadi.
                if (page.url().includes('login.emaktab.uz')) {
                    const captchaElement = await page.$('img.captcha__image, img[src*="capcha"], img[src*="captcha"]');
                    if (captchaElement) {
                        const base64Image = await captchaElement.screenshot({ encoding: 'base64' });
                        
                        onProgress({ 
                            status: 'captcha_required', 
                            message: "Iltimos, rasmdagi kodni kiriting", 
                            progress: 15,
                            image: `data:image/png;base64,${base64Image}`
                        });
                        
                        // Kutib turamiz (Backend orqali kiritilguncha)
                        const captchaSolution = await new Promise(resolve => {
                            global.captchaResolver = resolve;
                        });
                        
                        // Captcha inputiga yozish
                        const captchaInput = await page.$('input[name="Captcha.Input"], input[name="capchaCode"], input[name="captcha"]');
                        if (captchaInput) {
                            await captchaInput.type(captchaSolution);
                            
                            // Kutamiz
                            await Promise.all([
                                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
                                page.keyboard.press('Enter')
                            ]);
                            
                            // Captcha yana so'raldimi tekshiramiz (noto'g'ri bo'lsa)
                            const isStillCaptcha = await page.$('input[name="Captcha.Input"]');
                            if (isStillCaptcha) {
                                throw new Error("Captcha noto'g'ri kiritildi yoki qabul qilinmadi!");
                            }
                        } else {
                            throw new Error("Captcha kiritish maydoni topilmadi");
                        }
                    } else {
                        throw new Error("Tizimga kirishda xatolik yuz berdi (Captcha rasmi topilmadi).");
                    }
                }
            }
            
            onProgress({ status: 'info', message: "Avtorizatsiyadan muvaffaqiyatli o'tildi.", progress: 20 });
            
        } catch (e) {
            throw new Error("Avtorizatsiya xatosi: Kiritilgan login xato yoki Captcha kiritilmadi. " + e.message);
        }
        
        const REPORT_BASE_URL = `https://schools.emaktab.uz/v2/reports/default?school=1000003851985&year=2026&report=statJournal-subjectteacher&datefrom=${dateFrom}&dateto=${dateTo}`;
        
        onProgress({ status: 'info', message: "O'qituvchilar ro'yxati yig'ilmoqda...", progress: 25 });
        await page.goto(REPORT_BASE_URL, { waitUntil: 'networkidle2' });

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
            onProgress({ status: 'info', message: `Jami ${teachers.length} ta o'qituvchi topildi.`, progress: 30 });
        } catch (e) {
            throw new Error("O'qituvchilar ro'yxatini topib bo'lmadi.");
        }

        const reportData = [];
        const totalTeachers = teachers.length;

        let completed = 0;
        
        for (let i = 0; i < totalTeachers; i++) {
            const teacher = teachers[i];
            let retries = 3;
            let success = false;
            
            while (retries > 0 && !success) {
                try {
                    const teacherUrl = `${REPORT_BASE_URL}&teacher=${teacher.id}`;
                    await page.goto(teacherUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    
                    // "Hisobot qurish" tugmasi
                    const submitBtn = await page.$('#build_report_button, input[value="Hisobot qurish"]');
                    if (submitBtn) {
                        await submitBtn.evaluate(b => b.click());
                    }
                    
                    // Jadval domga tushishini kutamiz (reportPlaceHolder ko'rinadigan bo'lguncha)
                    await page.waitForFunction(() => {
                        const placeholder = document.getElementById('reportPlaceHolder');
                        const hasReport = placeholder && placeholder.style.display !== 'none' && placeholder.innerHTML.trim() !== '';
                        const hasError = document.querySelector('.error__title') !== null;
                        const msg = document.getElementById('reports_message');
                        const hasNoDataMsg = msg && msg.style.display !== 'none' && !msg.innerText.includes('parametrlarni aniqlang');
                        return hasReport || hasError || hasNoDataMsg;
                    }, { timeout: 60000 });
                    
                    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
                    
                    const data = await page.evaluate(() => {
                        const rows = Array.from(document.querySelectorAll('table.report-table tbody tr, .grid tbody tr'));
                        if (!rows || rows.length === 0) return [];
                        
                        return rows.map(row => {
                            const cells = Array.from(row.querySelectorAll('td, th'));
                            return cells.map(cell => cell.innerText.trim());
                        });
                    });
                    
                    reportData.push({
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                        data: data
                    });
                    
                    success = true;
                    completed++;
                    onProgress({ message: `[${completed}/${totalTeachers}] ${teacher.name} ma'lumotlari yuklandi...`, progress: 25 + Math.floor((completed/totalTeachers)*70) });
                } catch (e) {
                    retries--;
                    if (retries === 0) {
                        reportData.push({
                            teacherId: teacher.id,
                            teacherName: teacher.name,
                            data: []
                        });
                        completed++;
                        onProgress({ message: `[${completed}/${totalTeachers}] ${teacher.name} ma'lumotlarini yuklashda xatolik!`, progress: 25 + Math.floor((completed/totalTeachers)*70) });
                    }
                }
            }
        }

        onProgress({ status: 'done', message: "Barcha ma'lumotlar yig'ildi.", progress: 100 });
        await browser.close();
        return reportData;

    } catch (err) {
        await browser.close();
        throw err;
    }
}

module.exports = { runScraper };
