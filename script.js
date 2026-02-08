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
let currentMonthIdx = new Date().getMonth();
const currentYear = 2026;

async function initCalendar() {
    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/"/g, '').trim()));
        
        const headers = rows.find(r => r.includes('Event'));
        if (!headers) return;

        allEvents = rows.slice(rows.indexOf(headers) + 1)
            .filter(r => r[headers.indexOf('Event')])
            .map(row => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                obj._start = parseDate(obj["Start date"]);
                obj._end = parseDate(obj["End date"]);
                return obj;
            })
            .filter(e => e._start);

        renderFilter();
        setupMonthSelect();
        render(currentMonthIdx);
        updateNext();
        updateActivityChart();
    } catch (e) {
        console.error("Hiba az adatok betöltésekor:", e);
    }
}

function parseDate(d) {
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length >= 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    const isoDate = new Date(d);
    return isNaN(isoDate) ? null : isoDate;
}

function render(m) {
    const cal = document.getElementById('calendar');
    const header = document.getElementById('currentMonthHeader');
    const months = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    
    header.innerText = months[m];
    cal.innerHTML = ["H","K","Sze","Cs","P","Szo","V"].map(d => `<div class="weekday">${d}</div>`).join('');

    const firstDay = (new Date(currentYear, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, m + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) cal.innerHTML += `<div class="day empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear, m, d).setHours(0,0,0,0);
        const isToday = date === new Date().setHours(0,0,0,0);
        
        const dailyEvents = allEvents.filter(e => date >= e._start.getTime() && date <= e._end.getTime());
        
        let eventHtml = '';
        dailyEvents.forEach(e => {
            let tags = '';
            Object.keys(resztvevokMap).forEach(name => {
                const status = (e[name] || "").toLowerCase();
                if (validStatuses.some(vs => status.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    const isTalan = status.includes("talan") || status.includes("talán");
                    tags += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}" title="${name}">${resztvevokMap[name]}</div>`;
                }
            });

            if (tags) {
                eventHtml += `
                    <div class="event-card">
                        <span class="event-title">${e.Event}</span>
                        <div class="participants-container">${tags}</div>
                    </div>`;
            }
        });

        cal.innerHTML += `
            <div class="day ${isToday ? 'today' : ''}">
                <span class="day-number">${d}</span>
                ${eventHtml}
            </div>`;
    }
}

/* Kiegészítő funkciók (szűrő, chart, navigáció) */
function renderFilter() {
    const container = document.getElementById('memberFilter');
    container.innerHTML = Object.keys(resztvevokMap).map(name => `
        <button class="filter-btn ${activeFilter === name ? 'active' : ''}" onclick="toggleFilter('${name}')">
            <span>${resztvevokMap[name]}</span> ${name}
        </button>
    `).join('');
}

window.toggleFilter = (name) => {
    activeFilter = activeFilter === name ? null : name;
    renderFilter();
    render(currentMonthIdx);
};

window.changeMonth = (delta) => {
    currentMonthIdx = (currentMonthIdx + delta + 12) % 12;
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
};

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    const months = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    sel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`).join('');
    sel.onchange = (e) => { currentMonthIdx = parseInt(e.target.value); render(currentMonthIdx); };
}

function updateActivityChart() {
    const container = document.getElementById('activityChart');
    const total = allEvents.length;
    if (total === 0) return;

    container.innerHTML = Object.keys(resztvevokMap).map(name => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = (count / total) * 60 + 10; // Arányos magasság
        return `
            <div class="chart-column-wrapper">
                <span class="chart-label">${count}</span>
                <div class="chart-bar" style="height: ${height}px"></div>
                <span class="chart-emoji">${resztvevokMap[name]}</span>
            </div>`;
    }).join('');
}

function updateNext() {
    const container = document.getElementById('nextEventContent');
    const now = new Date().setHours(0,0,0,0);
    const next = allEvents.filter(e => e._end.getTime() >= now).sort((a,b) => a._start - b._start)[0];

    if (next) {
        const diff = Math.ceil((next._start - now) / 86400000);
        container.innerHTML = `
            <div class="next-event-card">
                <strong style="color:var(--hfs-red); display:block; margin-bottom:5px;">${next.Event}</strong>
                <div style="font-size:0.85em; color:var(--text-muted);">
                    📍 ${next.Location || 'Helyszín...'}<br>
                    📅 ${next["Start date"]}
                </div>
                <div style="margin-top:10px; font-weight:bold; font-size:0.9em;">
                    ${diff <= 0 ? "🔥 ÉPPEN ZAJLIK" : "🚀 Még " + diff + " nap"}
                </div>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    // Theme Switcher logikája
    const toggle = document.getElementById('checkbox');
    if(localStorage.getItem('theme') === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        toggle.checked = true;
    }
    toggle.addEventListener('change', () => {
        const theme = toggle.checked ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    });
    
    document.getElementById('sidebarToggle').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
});
