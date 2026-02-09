/* --- KONFIGURÁCIÓ --- */
const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = {"Csongi":"🌈","Merci":"🦆","Mózes":"🦄","Luca":"🐶","Zoli":"🕺"};
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];

let allEvents = [];
let activeFilter = null;
let currentMonthIdx = new Date().getMonth();

/* --- ADATOK BETÖLTÉSE --- */
async function initCalendar() {
    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();

        const rows = csv.split('\n')
            .map(r => r.split(',').map(c => c.replace(/"/g, '').trim()))
            .filter(r => r.length > 1);

        const headerRowIndex = rows.findIndex(r => r.includes('Event'));
        if (headerRowIndex === -1) return;

        const headers = rows[headerRowIndex];
        allEvents = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            const obj = {};
            headers.forEach((h, idx) => { if (h && row[idx]) obj[h] = row[idx]; });

            if (obj.Event) {
                obj._start = parseDate(obj["Start date"]);
                obj._end = parseDate(obj["End date"]);
                if (obj._start) allEvents.push(obj);
            }
        }

        renderFilter();
        setupMonthSelect();
        render(currentMonthIdx);
        updateNext();
        updateActivityChart();
    } catch (e) {
        console.error("CSV hiba:", e);
    }
}

function parseDate(d) {
    if (!d) return null;
    const clean = d.toString().trim().replace(/\.$/, '');
    if (clean.includes('-')) {
        const dt = new Date(clean);
        return isNaN(dt) ? null : dt;
    }
    const p = clean.split('.');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
}

/* --- NAPTÁR RENDERELÉS --- */
function render(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    cal.innerHTML = '';

    const months = ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"];
    document.getElementById('currentMonthHeader').innerText = months[m];

    // Napok nevei
    ["H","K","Sze","Cs","P","Szo","V"].forEach(d => {
        const div = document.createElement('div');
        div.className = 'weekday';
        div.innerText = d;
        cal.appendChild(div);
    });

    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m + 1, 0).getDate();

    // Hónap előtti üres napok
    for (let i = 0; i < first; i++) {
        const div = document.createElement('div');
        div.className = 'day empty-day-pre';
        cal.appendChild(div);
    }

    // Hónap tényleges napjai
    for (let d = 1; d <= days; d++) {
        const currDate = new Date(2026, m, d);
        const currTimestamp = currDate.setHours(0,0,0,0);
        const todayTimestamp = new Date().setHours(0,0,0,0);
        
        const dailyEvents = allEvents.filter(e => {
            const start = new Date(e._start).setHours(0,0,0,0);
            const end = e._end ? new Date(e._end).setHours(0,0,0,0) : start;
            return currTimestamp >= start && currTimestamp <= end;
        });

        const dayDiv = document.createElement('div');
        dayDiv.className = `day ${todayTimestamp === currTimestamp ? 'today' : ''}`;
        dayDiv.innerHTML = `<span class="day-number">${d}</span>`;

        dailyEvents.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const status = (e[name] || "").toLowerCase();
                if (validStatuses.some(vs => status.includes(vs))) {
                    if (!activeFilter || activeFilter === name) {
                        const isTalan = status.includes("talan") || status.includes("talán");
                        tags += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}"><span>${resztvevokMap[name]}</span> ${name}</div>`;
                    }
                }
            });

            if (tags) {
                const eventCard = document.createElement('div');
                eventCard.className = 'event-card';
                eventCard.innerHTML = `<span class="event-title">${e.Event}</span><div class="participants-container">${tags}</div>`;
                dayDiv.appendChild(eventCard);
            }
        });
        cal.appendChild(dayDiv);
    }

    // --- JAVÍTÁS: Hónap utáni üres napok generálása ---
    const totalCells = first + days;
    const missingCells = (7 - (totalCells % 7)) % 7;

    for (let i = 0; i < missingCells; i++) {
        const div = document.createElement('div');
        div.className = 'day empty-day-post';
        cal.appendChild(div);
    }
}

/* --- FUNKCIÓK --- */
function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container || allEvents.length === 0) return;
    
    container.innerHTML = Object.keys(resztvevokMap).map(name => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return validStatuses.some(vs => s.includes(vs));
        }).length;
        
        // Magasság számítása (max 80px, hogy maradjon hely az emojinak és számnak)
        const height = (count / allEvents.length) * 80;
        
        return `
            <div class="chart-column-wrapper">
                <span class="chart-emoji">${resztvevokMap[name]}</span>
                <div class="chart-bar" style="height:${height}px"></div>
                <span class="chart-label">${count}</span>
            </div>`;
    }).join('');
}

function updateNext() {
    const box = document.getElementById('nextEventContent');
    if (!box || allEvents.length === 0) return;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = allEvents
        .filter(e => {
            const eventEnd = e._end ? new Date(e._end) : new Date(e._start);
            eventEnd.setHours(0, 0, 0, 0);
            return eventEnd >= now;
        })
        .sort((a, b) => a._start - b._start)[0];

    if (upcoming) {
        const startDate = new Date(upcoming._start);
        startDate.setHours(0, 0, 0, 0);
        
        const diffTime = startDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        let dayText = (diffDays > 0) ? `Még ${diffDays} nap` : (diffDays === 0 ? "Ma kezdődik! 🔥" : "Folyamatban... 🚀");

        box.innerHTML = `
            <div class="next-event-wrapper">
                <div class="next-event-title">${upcoming.Event}</div>
                <div class="next-event-info">📍 ${upcoming.Location || 'Ismeretlen'}</div>
                <div class="next-event-info">🗓️ ${upcoming["Start date"]}</div>
                <div class="next-event-countdown">${dayText}</div>
            </div>`;
    } else {
        box.innerHTML = "<div class='next-event-info'>Nincs következő esemény.</div>";
    }
}

function renderFilter() {
    const box = document.getElementById('memberFilter');
    if (!box) return;
    box.innerHTML = '';
    Object.keys(resztvevokMap).forEach(n => {
        const btn = document.createElement('div');
        btn.className = `filter-btn ${activeFilter === n ? 'active' : ''}`;
        btn.innerHTML = `<span>${resztvevokMap[n]}</span> ${n}`;
        btn.addEventListener('click', () => {
            activeFilter = activeFilter === n ? null : n;
            renderFilter();
            render(currentMonthIdx);
        });
        box.appendChild(btn);
    });
}

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    const months = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    sel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`).join('');
    sel.onchange = e => { currentMonthIdx = parseInt(e.target.value); render(currentMonthIdx); };
}

window.changeMonth = (d) => {
    currentMonthIdx = (currentMonthIdx + d + 12) % 12;
    const select = document.getElementById('monthSelect');
    if (select) select.value = currentMonthIdx;
    render(currentMonthIdx);
}

window.goToToday = () => {
    currentMonthIdx = new Date().getMonth();
    const select = document.getElementById('monthSelect');
    if (select) select.value = currentMonthIdx;
    render(currentMonthIdx);
}

function initTheme() {
    const toggle = document.getElementById('checkbox');
    if (!toggle) return;
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        toggle.checked = true;
    }
    toggle.onchange = () => {
        const theme = toggle.checked ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();

    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const sb = document.getElementById('sidebar');
            if (window.innerWidth <= 1024) {
                sb.classList.toggle('open');
            } else {
                sb.classList.toggle('collapsed');
            }
        });
    }
});


