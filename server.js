const express = require('express');
const { runScraper } = require('./scraper');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// For SSE (Server-Sent Events)
let clients = [];

app.get('/api/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

const sendProgress = (data) => {
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
};

app.post('/api/solve-captcha', (req, res) => {
    const { captchaText } = req.body;
    if (global.captchaResolver) {
        global.captchaResolver(captchaText);
        global.captchaResolver = null;
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: "Captcha kutilmayapti" });
    }
});

app.post('/api/scrape', async (req, res) => {
    const { dateFrom, dateTo } = req.body;
    
    if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'dateFrom va dateTo kiritilishi shart' });
    }

    try {
        const data = await runScraper(dateFrom, dateTo, sendProgress);
        res.json({ success: true, data });
    } catch (error) {
        sendProgress({ status: 'error', message: error.message, progress: 0 });
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} da ishga tushdi.`);
});
