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

    ["H","K","Sze","Cs","P","Szo","V"].forEach(d => cal.innerHTML += `<div class="weekday">${d}</div>`);

    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m + 1, 0).getDate();

    for (let i = 0; i < first; i++) cal.innerHTML += `<div class="day empty-day-pre"></div>`;

    for (let d = 1; d <= days; d++) {
        const currDate = new Date(2026, m, d);
        const currTimestamp = currDate.setHours(0,0,0,0);
        const todayTimestamp = new Date().setHours(0,0,0,0);
        const dailyEvents = allEvents.filter(e => currTimestamp >= e._start.getTime() && currTimestamp <= e._end.getTime());

        let html = `<div class="day ${todayTimestamp === currTimestamp ? 'today' : ''}">
                    <span class="day-number">${d}</span>`;

        dailyEvents.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const status = (e[name] || "").toLowerCase();
                if (validStatuses.some(vs => status.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    const isTalan = status.includes("talan") || status.includes("talán");
                    tags += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}"><span>${resztvevokMap[name]}</span> ${name}</div>`;
                }
            });

            if (tags) {
                // Hozzáadtuk az onclick eseményt: rákattintáskor hozzáad/elvesz egy 'expanded' osztályt
                html += `
                    <div class="event-card" onclick="this.classList.toggle('expanded')">
                        <span class="event-title">${e.Event}</span>
                        <div class="participants-container">${tags}</div>
                    </div>`;
            }
        });

    const totalCells = first + days;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) cal.innerHTML += `<div class="day empty-day-post"></div>`;
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
        const height = (count / allEvents.length) * 70;
        return `<div class="chart-column-wrapper"><span class="chart-label">${count}</span><div class="chart-bar" style="height:${height}px"></div><span class="chart-emoji">${resztvevokMap[name]}</span></div>`;
    }).join('');
}

function updateNext() {
    const box = document.getElementById('nextEventContent');
    if (!box || allEvents.length === 0) return;
    
    // Aktuális időpont kérése és az idő lecsupaszítása (csak a nap számítson)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Megkeressük a legközelebbi jövőbeli eseményt
    const upcoming = allEvents
        .filter(e => {
            if (!e._end) return false;
            const eventEnd = new Date(e._end);
            eventEnd.setHours(0, 0, 0, 0);
            return eventEnd >= now;
        })
        .sort((a, b) => a._start - b._start)[0];

    if (upcoming) {
        // Dátumok normalizálása a pontos különbséghez
        const startDate = new Date(upcoming._start);
        startDate.setHours(0, 0, 0, 0);
        
        const diffTime = startDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        let dayText = "";
        if (diffDays > 0) {
            dayText = `Még ${diffDays} nap`;
        } else if (diffDays === 0) {
            dayText = "Ma kezdődik! 🔥";
        } else {
            dayText = "Folyamatban... 🚀";
        }

        box.innerHTML = `
            <div class="next-event-wrapper">
                <div class="next-event-title">${upcoming.Event}</div>
                <div class="next-event-info">📍 ${upcoming.Location || 'Praga'}</div>
                <div class="next-event-info">🗓️ ${upcoming["Start date"]}</div>
                <div class="next-event-countdown">${dayText}</div>
            </div>
        `;
    } else {
        box.innerHTML = "<div class='next-event-info'>Nincs következő esemény.</div>";
    }
}

function renderFilter() {
    const box = document.getElementById('memberFilter');
    if (!box) return;
    box.innerHTML = Object.keys(resztvevokMap).map(n => `
        <div class="filter-btn ${activeFilter === n ? 'active' : ''}" onclick="toggleFilter('${n}')">
            <span>${resztvevokMap[n]}</span> ${n}
        </div>`).join('');
}

window.toggleFilter = (name) => {
    activeFilter = activeFilter === name ? null : name;
    renderFilter();
    render(currentMonthIdx);
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
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
}

window.goToToday = () => {
    currentMonthIdx = new Date().getMonth();
    document.getElementById('monthSelect').value = currentMonthIdx;
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

/* --- INICIALIZÁLÁS --- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();

    document.getElementById('sidebarToggle').onclick = () => {
        const sb = document.getElementById('sidebar');
        if (window.innerWidth <= 1024) sb.classList.toggle('open');
        else sb.classList.toggle('collapsed');
    };
});



