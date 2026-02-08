/* --- KONFIGURÁCIÓ ÉS GLOBÁLIS VÁLTOZÓK --- */
const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';

const resztvevokMap = {
    "Csongi": "🌈",
    "Merci": "🦆",
    "Mózes": "🦄",
    "Luca": "🐶",
    "Zoli": "🕺"
};

const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];
let allEvents = [];
let activeFilter = null;
let currentMonthIdx = new Date().getFullYear() === 2026 ? new Date().getMonth() : 1; // 2026 február az alapértelmezett kezdéshez
const currentYear = 2026;

/* --- ADATOK BETÖLTÉSE --- */
async function initCalendar() {
    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();

        const rows = csv
            .split('\n')
            .map(r => r.split(',').map(c => c.replace(/"/g, '').trim()))
            .filter(r => r.length > 1);

        const headerRowIndex = rows.findIndex(r => r.includes('Event'));
        if (headerRowIndex === -1) return;

        const headers = rows[headerRowIndex];
        allEvents = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            const obj = {};
            headers.forEach((h, idx) => {
                if (h && row[idx]) obj[h] = row[idx];
            });

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
    
    // ISO formátum kezelése (YYYY-MM-DD)
    if (clean.includes('-')) {
        const dt = new Date(clean);
        return isNaN(dt) ? null : dt;
    }
    
    // Magyar formátum kezelése (YYYY.MM.DD)
    const p = clean.split('.');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
}

/* --- NAPTÁR GENERÁLÁSA --- */
function render(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    cal.innerHTML = '';

    const months = ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"];
    document.getElementById('currentMonthHeader').innerText = months[m];

    // Napok fejléce
    ["HÉTFŐ","KEDD","SZERDA","CSÜTÖRTÖK","PÉNTEK","SZOMBAT","VASÁRNAP"].forEach(d => {
        cal.innerHTML += `<div class="weekday">${d}</div>`;
    });

    const firstDay = (new Date(currentYear, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, m + 1, 0).getDate();

    // Üres napok a hónap elején
    for (let i = 0; i < firstDay; i++) {
        cal.innerHTML += `<div class="day empty-day-pre"></div>`;
    }

    // Napok feltöltése
    for (let d = 1; d <= daysInMonth; d++) {
        const currDate = new Date(currentYear, m, d);
        const currTimestamp = currDate.setHours(0,0,0,0);
        const todayTimestamp = new Date().setHours(0,0,0,0);
        
        const dailyEvents = allEvents.filter(e => 
            currTimestamp >= e._start.getTime() && 
            currTimestamp <= e._end.getTime()
        );

        let html = `<div class="day ${todayTimestamp === currTimestamp ? 'today' : ''}">
                    <span class="day-number">${d}</span>`;

        dailyEvents.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const status = (e[name] || "").toLowerCase();
                if (validStatuses.some(vs => status.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    tags += `<div class="person-tag"><span>${resztvevokMap[name]}</span> ${name}</div>`;
                }
            });

            if (tags) {
                html += `<div class="event-card">
                            <span class="event-title">${e.Event}</span>
                            <div class="participants-container">${tags}</div>
                         </div>`;
            }
        });

        html += `</div>`;
        cal.innerHTML += html;
    }
}

/* --- SIDEBAR FUNKCIÓK --- */
function updateNext() {
    const nextBox = document.getElementById('nextEventContent');
    if (!nextBox) return;

    const now = new Date().setHours(0,0,0,0);
    const upcoming = allEvents
        .filter(e => e._end && e._end.getTime() >= now)
        .sort((a, b) => a._start - b._start)[0];

    if (upcoming) {
        const diff = Math.ceil((upcoming._start - now) / 86400000);
        nextBox.innerHTML = `
            <div class="next-event-card">
                <strong style="display:block; color:var(--hfs-red);">${upcoming.Event}</strong>
                <small>📍 ${upcoming.Location || 'Ismeretlen'}</small><br>
                <small>📅 ${upcoming["Start date"]}</small><br>
                <p style="margin-top:10px; font-weight:bold; font-size: 0.9em;">
                    ${diff <= 0 ? "Ma kezdődik! 🔥" : "Még " + diff + " nap"}
                </p>
            </div>
        `;
    } else {
        nextBox.innerHTML = "Nincs kitűzött esemény.";
    }
}

function updateActivityChart() {
    const chartContainer = document.getElementById('activityChart');
    if (!chartContainer || allEvents.length === 0) return;

    chartContainer.innerHTML = '';
    const total = allEvents.length;

    Object.keys(resztvevokMap).forEach(name => {
        const count = allEvents.filter(e => {
            const status = (e[name] || "").toLowerCase();
            return validStatuses.some(vs => status.includes(vs));
        }).length;

        const barHeight = (count / total) * 70; // Max 70px magas oszlopok
        
        const col = document.createElement('div');
        col.className = 'chart-column-wrapper';
        col.innerHTML = `
            <span class="chart-label">${count}</span>
            <div class="chart-bar" style="height: ${barHeight}px"></div>
            <span class="chart-emoji">${resztvevokMap[name]}</span>
        `;
        chartContainer.appendChild(col);
    });
}

function renderFilter() {
    const box = document.getElementById('memberFilter');
    if (!box) return;
    box.innerHTML = '';
    Object.keys(resztvevokMap).forEach(n => {
        const b = document.createElement('div');
        b.className = `filter-btn ${activeFilter === n ? 'active' : ''}`;
        b.innerHTML = `<span>${resztvevokMap[n]}</span> ${n}`;
        b.onclick = () => {
            activeFilter = activeFilter === n ? null : n;
            renderFilter();
            render(currentMonthIdx);
        };
        box.appendChild(b);
    });
}

/* --- NAVIGÁCIÓ ÉS VEZÉRLÉS --- */
function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    sel.innerHTML = '';
    ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"]
        .forEach((m,i)=> sel.innerHTML += `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`);
    
    sel.onchange = e => {
        currentMonthIdx = parseInt(e.target.value);
        render(currentMonthIdx);
    };
}

function changeMonth(d) {
    currentMonthIdx = (currentMonthIdx + d + 12) % 12;
    const sel = document.getElementById('monthSelect');
    if (sel) sel.value = currentMonthIdx;
    render(currentMonthIdx);
}

function goToToday() {
    currentMonthIdx = new Date().getMonth();
    const sel = document.getElementById('monthSelect');
    if (sel) sel.value = currentMonthIdx;
    render(currentMonthIdx);
}

/* --- THEME ÉS INITIALIZATION --- */
function initTheme() {
    const toggle = document.getElementById('checkbox');
    if (!toggle) return;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
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

    // Sidebar vezérlés (Web és Mobil)
    const btn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (btn && sidebar) {
        btn.onclick = () => {
            const isMobile = window.innerWidth <= 1024;
            if (isMobile) {
                sidebar.classList.toggle('open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        };
    }
});
