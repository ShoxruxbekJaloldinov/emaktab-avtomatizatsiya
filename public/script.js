document.addEventListener('DOMContentLoaded', () => {
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const startBtn = document.getElementById('startBtn');
    
    const progressContainer = document.getElementById('progressContainer');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    
    const resultContainer = document.getElementById('resultContainer');
    const resultBody = document.getElementById('resultBody');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentData = null;

    // Initialize with today's date
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    dateFromInput.value = formattedToday;
    dateToInput.value = formattedToday;

    // Helper: Add or subtract days
    const addDays = (dateStr, days) => {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    };

    prevBtn.addEventListener('click', () => {
        dateFromInput.value = addDays(dateFromInput.value, -1);
        dateToInput.value = addDays(dateToInput.value, -1);
    });

    nextBtn.addEventListener('click', () => {
        dateFromInput.value = addDays(dateFromInput.value, 1);
        dateToInput.value = addDays(dateToInput.value, 1);
    });

    // Helper: Convert YYYY-MM-DD to DD.MM.YYYY for backend
    const formatToBackendDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    };

    startBtn.addEventListener('click', async () => {
        const dateFrom = formatToBackendDate(dateFromInput.value);
        const dateTo = formatToBackendDate(dateToInput.value);

        const captchaContainer = document.getElementById('captchaContainer');
        const captchaImage = document.getElementById('captchaImage');
        const captchaInput = document.getElementById('captchaInput');
        const submitCaptchaBtn = document.getElementById('submitCaptchaBtn');

        // Reset UI
        resultContainer.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        captchaContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.innerText = 'Serverga bog\'lanmoqda...';
        startBtn.disabled = true;

        const eventSource = new EventSource('/api/progress');
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            progressText.innerText = data.message;
            progressBar.style.width = `${data.progress}%`;
            
            if (data.status === 'captcha_required') {
                captchaImage.src = data.image;
                captchaContainer.classList.remove('hidden');
                captchaInput.focus();
            }
            
            if (data.status === 'done' || data.status === 'error') {
                eventSource.close();
            }
        };

        submitCaptchaBtn.onclick = async () => {
            const text = captchaInput.value.trim();
            if (!text) return alert("Kodni kiriting!");
            
            submitCaptchaBtn.disabled = true;
            try {
                await fetch('/api/solve-captcha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ captchaText: text })
                });
                captchaContainer.classList.add('hidden');
                captchaInput.value = '';
            } catch (e) {
                alert("Xatolik: " + e.message);
            } finally {
                submitCaptchaBtn.disabled = false;
            }
        };

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dateFrom, dateTo })
            });

            const result = await response.json();
            
            if (result.success) {
                currentData = result.data;
                renderTable(currentData);
                progressContainer.classList.add('hidden');
                resultContainer.classList.remove('hidden');
            } else {
                alert('Xatolik: ' + result.error);
                progressText.innerText = 'Xatolik yuz berdi.';
            }
        } catch (error) {
            console.error(error);
            alert('Tarmoq xatosi.');
            progressText.innerText = 'Tarmoq xatosi.';
        } finally {
            startBtn.disabled = false;
        }
    });

    function renderTable(data) {
        resultBody.innerHTML = '';
        
        data.forEach((teacher, tIndex) => {
            const trClass = tIndex % 2 === 0 ? 'teacher-even' : 'teacher-odd';
            
            if (!teacher.data || teacher.data.length === 0) {
                // If no classes
                const tr = document.createElement('tr');
                tr.className = trClass;
                tr.innerHTML = `
                    <td><strong>${teacher.teacherName}</strong></td>
                    <td colspan="9" style="text-align: center; color: var(--text-muted);">Ma'lumot topilmadi</td>
                `;
                resultBody.appendChild(tr);
                return;
            }
            let maxCols = 9;
            if (teacher.data.length > 0) {
                maxCols = Math.max(...teacher.data.map(r => r.length));
            }
            
            let previousRow = null;

            teacher.data.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.className = trClass;
                
                // Only show teacher name on the first row
                const nameCell = index === 0 
                    ? `<td rowspan="${teacher.data.length}"><strong>${teacher.teacherName}</strong></td>` 
                    : '';

                // Normalize row length to maxCols (usually 9)
                // This fixes eMaktab's rowspan where duplicate classes/subjects are omitted
                let normalizedRow = [];
                if (row.length < maxCols && previousRow) {
                    const missingCols = maxCols - row.length;
                    normalizedRow = [...previousRow.slice(0, missingCols), ...row];
                } else {
                    normalizedRow = [...row];
                }
                previousRow = [...normalizedRow];

                // Extract up to 9 columns from the normalized row
                const sinf = normalizedRow[0] || '-';
                const fan = normalizedRow[1] || '-';
                const ishtirok = normalizedRow[2] || '-';
                const mavzu = normalizedRow[3] || '-';
                const uyVazifaFoiz = normalizedRow[4] || '-';
                const uyVazifaVaqtida = normalizedRow[5] || '-';
                const rejaFoiz = normalizedRow[6] || '-';
                const jurnalFoiz = normalizedRow[7] || '-';
                const jurnalVaqtida = normalizedRow[8] || '-';

                tr.innerHTML = `
                    ${nameCell}
                    <td>${sinf}</td>
                    <td>${fan}</td>
                    <td>${ishtirok}</td>
                    <td>${mavzu}</td>
                    <td>${uyVazifaFoiz}</td>
                    <td>${uyVazifaVaqtida}</td>
                    <td>${rejaFoiz}</td>
                    <td>${jurnalFoiz}</td>
                    <td>${jurnalVaqtida}</td>
                `;
                resultBody.appendChild(tr);
            });
        });
    }

    downloadBtn.addEventListener('click', () => {
        if (!currentData) return;
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentData, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `hisobot_${dateFromInput.value}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Telegram report logic
    const tgReportBtn = document.getElementById('tgReportBtn');
    const tgModal = document.getElementById('tgModal');
    const closeTgModal = document.getElementById('closeTgModal');
    const tgReportText = document.getElementById('tgReportText');
    const copyTgBtn = document.getElementById('copyTgBtn');

    if (tgReportBtn) {
        tgReportBtn.addEventListener('click', () => {
            if (!currentData) return;
            
            let reportStr = `📊 **Kunlik Hisobot (${dateFromInput.value})**\n\nQuyidagi o'qituvchilarda kamchiliklar aniqlandi:\n\n`;
            let hasAnyErrors = false;

            currentData.forEach(teacher => {
                if (!teacher.data || teacher.data.length === 0) return;

                let teacherErrors = [];
                let maxCols = 9;
                if (teacher.data.length > 0) {
                    maxCols = Math.max(...teacher.data.map(r => r.length));
                }
                let previousRow = null;

                teacher.data.forEach(row => {
                    let normalizedRow = [];
                    if (row.length < maxCols && previousRow) {
                        const missingCols = maxCols - row.length;
                        normalizedRow = [...previousRow.slice(0, missingCols), ...row];
                    } else {
                        normalizedRow = [...row];
                    }
                    previousRow = [...normalizedRow];

                    const sinf = normalizedRow[0] || '-';
                    const fan = normalizedRow[1] || '-';
                    const mavzu = normalizedRow[3] || '-';
                    const uyVazifaVaqtida = normalizedRow[5] || '-';
                    const jurnalVaqtida = normalizedRow[8] || '-';

                    let rowIssues = [];
                    const parseVal = (val) => {
                        if (!val || val === '-' || val.trim() === '') return 0;
                        const num = parseInt(val, 10);
                        return isNaN(num) ? 0 : num;
                    };

                    const vMavzu = parseVal(mavzu);
                    const vUyVazifa = parseVal(uyVazifaVaqtida);
                    const vJurnal = parseVal(jurnalVaqtida);
                    
                    const isFirstGrade = sinf.trim().startsWith('1-') || sinf.trim().startsWith('1 ');

                    if (vMavzu < 100) rowIssues.push(`Mavzu: ${vMavzu}%`);
                    if (!isFirstGrade && vUyVazifa < 100) rowIssues.push(`Uy vazifa: ${vUyVazifa}%`);
                    if (!isFirstGrade && vJurnal < 100) rowIssues.push(`Baho qo'yilmagan: ${vJurnal}%`);

                    if (rowIssues.length > 0) {
                        teacherErrors.push(`▫️ ${sinf} (${fan}): ${rowIssues.join(', ')}`);
                    }
                });

                if (teacherErrors.length > 0) {
                    hasAnyErrors = true;
                    reportStr += `👨‍🏫 **${teacher.teacherName}**\n${teacherErrors.join('\n')}\n\n`;
                }
            });

            if (!hasAnyErrors) {
                reportStr = `📊 **Kunlik Hisobot (${dateFromInput.value})**\n\n✅ Barcha o'qituvchilarda ko'rsatkichlar 100%. Kamchiliklar yo'q!`;
            }

            tgReportText.value = reportStr;
            tgModal.classList.remove('hidden');
        });
    }

    if (closeTgModal) {
        closeTgModal.addEventListener('click', () => {
            tgModal.classList.add('hidden');
        });
    }

    if (copyTgBtn) {
        copyTgBtn.addEventListener('click', () => {
            tgReportText.select();
            document.execCommand('copy');
            
            const originalText = copyTgBtn.innerText;
            copyTgBtn.innerText = 'Nusxa olindi! ✅';
            setTimeout(() => {
                copyTgBtn.innerText = originalText;
            }, 2000);
        });
    }
});
