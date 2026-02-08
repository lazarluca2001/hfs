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

/* --- THEME --- */
function initTheme() {
    const toggle = document.getElementById('checkbox');
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        toggle.checked = true;
    }
    toggle.onchange = () => {
        document.documentElement.dataset.theme = toggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', toggle.checked ? 'dark' : 'light');
    };
}

/* --- DATA --- */
async function initCalendar() {
    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/"/g, '').trim()));

        const headers = rows[3];
        for (let i = 4; i < rows.length; i++) {
            const obj = {};
            headers.forEach((h, idx) => h && (obj[h] = rows[i][idx]));
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
    const p = d.replace('.', '').split('.');
    return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : null;
}

/* --- FILTER --- */
function renderFilter() {
    const box = document.getElementById('memberFilter');
    box.innerHTML = '';
    Object.keys(resztvevokMap).forEach(n => {
        const b = document.createElement('div');
        b.className = `filter-btn ${activeFilter === n ? 'active' : ''}`;
        b.innerHTML = `${resztvevokMap[n]} ${n}`;
        b.onclick = () => {
            activeFilter = activeFilter === n ? null : n;
            renderFilter();
            render(currentMonthIdx);
        };
        box.appendChild(b);
    });
}

/* --- CALENDAR --- */
function render(m) {
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';

    const months = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    document.getElementById('currentMonthHeader').innerText = months[m];

    ["H","K","Sze","Cs","P","Szo","V"].forEach(d => cal.innerHTML += `<div class="weekday">${d}</div>`);

    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m + 1, 0).getDate();

    for (let i = 0; i < first; i++) cal.innerHTML += `<div></div>`;

    for (let d = 1; d <= days; d++) {
        cal.innerHTML += `<div class="day"><span class="day-number">${d}</span></div>`;
    }
}

/* --- MONTH --- */
function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    sel.innerHTML = '';
    ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"]
        .forEach((m,i)=> sel.innerHTML += `<option value="${i}">${m}</option>`);
    sel.value = currentMonthIdx;
    sel.onchange = e => {
        currentMonthIdx = +e.target.value;
        render(currentMonthIdx);
    };
}

function changeMonth(d) {
    currentMonthIdx = (currentMonthIdx + d + 12) % 12;
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
}

function goToToday() {
    currentMonthIdx = new Date().getMonth();
    document.getElementById('monthSelect').value = currentMonthIdx;
    render(currentMonthIdx);
}

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();

    const btn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    btn.onclick = () => sidebar.classList.toggle(window.innerWidth <= 1024 ? 'open' : 'collapsed');
});
