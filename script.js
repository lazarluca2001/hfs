/* --- KONFIGURÁCIÓ & CACHE --- */
const CONFIG = {
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv',
    members: {"Csongi":"🌈","Merci":"🦆","Mózes":"🦄","Luca":"🐶","Zoli":"🕺"},
    validStatuses: ["igen", "talán", "talan", "fizetve", "igazolt"],
    months: ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"],
    weekdays: ["H","K","Sze","Cs","P","Szo","V"]
};

let allEvents = [];
let activeFilter = null;
let currentMonthIdx = new Date().getMonth();

/* --- SEGÉDFÜGGVÉNYEK --- */
const parseDate = (d) => {
    if (!d) return null;
    const clean = d.toString().trim().replace(/\.$/, '');
    const dt = clean.includes('-') ? new Date(clean) : (() => {
        const p = clean.split('.');
        return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : null;
    })();
    return dt && !isNaN(dt) ? dt.setHours(0,0,0,0) : null;
};

/* --- ADATOK BETÖLTÉSE --- */
async function initCalendar() {
    try {
        const res = await fetch(CONFIG.url);
        const csv = await res.text();
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/"/g, '').trim()));
        
        const headerIndex = rows.findIndex(r => r.includes('Event'));
        if (headerIndex === -1) return;

        const headers = rows[headerIndex];
        allEvents = rows.slice(headerIndex + 1)
            .filter(r => r[headers.indexOf('Event')])
            .map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                obj._startTs = parseDate(obj["Start date"]);
                obj._endTs = parseDate(obj["End date"]) || obj._startTs;
                return obj;
            })
            .filter(e => e._startTs);

        renderFilter();
        setupMonthSelect();
        updateUI();
    } catch (e) {
        console.error("Betöltési hiba:", e);
    }
}

/* --- UI RENDERELÉS --- */
function updateUI() {
    render(currentMonthIdx);
    updateNext();
    updateActivityChart();
}

function render(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    
    const fragment = document.createDocumentFragment();
    cal.innerHTML = '';
    document.getElementById('currentMonthHeader').innerText = CONFIG.months[m];

    // Fejléc (Napok)
    CONFIG.weekdays.forEach(d => {
        const div = document.createElement('div');
        div.className = 'weekday';
        div.textContent = d;
        fragment.appendChild(div);
    });

    const firstDay = (new Date(2026, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(2026, m + 1, 0).getDate();
    const todayTs = new Date().setHours(0,0,0,0);

    // Üres napok (Pre)
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'day empty-day-pre';
        fragment.appendChild(div);
    }
}

    // Napok generálása
    for (let d = 1; d <= daysInMonth; d++) {
        const currTs = new Date(2026, m, d).setHours(0,0,0,0);
        const dayEvents = allEvents.filter(e => currTs >= e._startTs && currTs <= e._endTs);

        const dayDiv = document.createElement('div');
        dayDiv.className = `day ${todayTs === currTs ? 'today' : ''}`;
        dayDiv.innerHTML = `<span class="day-number">${d}</span>`;

        dayEvents.forEach(e => {
            let tagsHtml = "";
            Object.entries(CONFIG.members).forEach(([name, emoji]) => {
                const status = (e[name] || "").toLowerCase();
                if (CONFIG.validStatuses.some(vs => status.includes(vs))) {
                    if (!activeFilter || activeFilter === name) {
                        const isTalan = status.includes("talan") || status.includes("talán");
                        tagsHtml += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}"><span>${emoji}</span> ${name}</div>`;
                    }
                }
            });

            if (tagsHtml) {
                const card = document.createElement('div');
                card.className = 'event-card';
                card.innerHTML = `<span class="event-title">${e.Event}</span><div class="participants-container">${tagsHtml}</div>`;
                dayDiv.appendChild(card);
            }
        });
        fragment.appendChild(dayDiv);
    }

    // Üres napok (Post)
    const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
        const div = document.createElement('div');
        div.className = 'day empty-day-post';
        div.innerHTML = '&nbsp;'; 
        fragment.appendChild(div);
    }

    cal.appendChild(fragment);
}

/* --- STATISZTIKA & ESEMÉNYEK --- */
function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;

    container.innerHTML = Object.entries(CONFIG.members).map(([name, emoji]) => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return CONFIG.validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = allEvents.length ? (count / allEvents.length) * 80 : 0;
        return `
            <div class="chart-column-wrapper">
                <span class="chart-emoji">${emoji}</span>
                <div class="chart-bar" style="height:${height}px"></div>
                <span class="chart-label">${count}</span>
            </div>`;
    }).join('');
}

function updateNext() {
    const box = document.getElementById('nextEventContent');
    if (!box) return;

    const now = new Date().setHours(0,0,0,0);
    const next = allEvents
        .filter(e => e._endTs >= now)
        .sort((a, b) => a._startTs - b._startTs)[0];

    if (next) {
        const diff = Math.round((next._startTs - now) / 86400000);
        const dayText = diff > 0 ? `Még ${diff} nap` : (diff === 0 ? "Ma kezdődik! 🔥" : "Folyamatban... 🚀");
        box.innerHTML = `
            <div class="next-event-wrapper">
                <div class="next-event-title">${next.Event}</div>
                <div class="next-event-info">📍 ${next.Location || 'Ismeretlen'}</div>
                <div class="next-event-info">🗓️ ${next["Start date"]}</div>
                <div class="next-event-countdown">${dayText}</div>
            </div>`;
    } else {
        box.innerHTML = "Nincs több esemény.";
    }
}

/* --- EVENT HANDLERS --- */
function renderFilter() {
    const box = document.getElementById('memberFilter');
    if (!box) return;
    box.innerHTML = Object.entries(CONFIG.members).map(([name, emoji]) => `
        <div class="filter-btn ${activeFilter === name ? 'active' : ''}" onclick="toggleFilter('${name}')">
            <span>${emoji}</span> ${name}
        </div>
    `).join('');
}

window.toggleFilter = (name) => {
    activeFilter = activeFilter === name ? null : name;
    renderFilter();
    render(currentMonthIdx);
};

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    sel.innerHTML = CONFIG.months.map((m, i) => `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`).join('');
    sel.onchange = e => { currentMonthIdx = parseInt(e.target.value); render(currentMonthIdx); };
}

window.changeMonth = (d) => {
    currentMonthIdx = (currentMonthIdx + d + 12) % 12;
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
};

window.goToToday = () => {
    currentMonthIdx = new Date().getMonth();
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
};

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();
    
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        const sb = document.getElementById('sidebar');
        sb.classList.toggle(window.innerWidth <= 1024 ? 'open' : 'collapsed');
    });
});

function initTheme() {
    const toggle = document.getElementById('checkbox');
    if (!toggle) return;
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    toggle.checked = isDark;
    toggle.onchange = () => {
        const theme = toggle.checked ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    };
}

