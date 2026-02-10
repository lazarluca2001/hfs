/* jshint esversion: 11 */

const CONFIG = {
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv',
    members: {"Csongi":"🌈","Merci":"🦆","Mózes":"🦄","Luca":"🐶","Zoli":"🕺"},
    validStatuses: ["igen", "talán", "talan", "fizetve", "igazolt"],
    months: ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"],
    weekdays: ["H","K","Sze","Cs","P","Szo","V"]
};

const TIER_TABLE = {
    1: [3, 2, 1], 2: [6, 4, 3, 2, 1], 3: [10, 8, 6, 4, 2, 1],
    4: [15, 12, 10, 8, 6, 1], 5: [20, 16, 14, 12, 10, 2], 6: [25, 22, 18, 15, 12, 2]
};

const hfsStats = [
    { name: "Lázár Luca", div: "Newcomer", points: 0 },
    { name: "Ferenczi Csongor", div: "Intermediate", points: 19 },
    { name: "Bende Márton", div: "Novice", points: 15 },
    { name: "Angyal Mercédesz", div: "Novice", points: 4 },
    { name: "Dominguez Zoltán", div: "Intermediate", points: 0 }
];

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
    return dt && !isNaN(dt) ? dt.setHours(0, 0, 0, 0) : null;
};

/* --- ADATOK BETÖLTÉSE --- */
async function initCalendar() {
    try {
        const res = await fetch(CONFIG.url);
        const csv = await res.text();
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/"/g, '').trim()));
        
        const headerIndex = rows.findIndex(r => r.includes('Event'));
        const headers = rows[headerIndex];
        
        allEvents = rows.slice(headerIndex + 1)
            .filter(r => r[headers.indexOf('Event')])
            .map(row => {
                const obj = {};
                headers.forEach((h, i) => { obj[h] = row[i]; });
                obj._startTs = parseDate(row[headers.indexOf('Start date')]);
                obj._endTs = parseDate(row[headers.indexOf('End date')]) || obj._startTs;
                return obj;
            })
            .filter(e => e._startTs);

        updateDashboardUI();
    } catch (e) { console.error("Hiba:", e); }
}

/* --- DASHBOARD UI FUNKCIÓK --- */
function updateDashboardUI() {
    renderFilter();
    updateActivityChart();
    updateNextCountdown();
    populateEventDropdown();
    
    // Ha van naptár elem, akkor azt is rendereljük
    if (document.getElementById('calendar')) renderCalendar(currentMonthIdx);
}

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
    updateDashboardUI();
};

function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    
    container.innerHTML = Object.entries(CONFIG.members).map(([name, emoji]) => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return CONFIG.validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = Math.min(80, (count / 20) * 80); // 20 esemény a 100%
        return `
            <div class="chart-column-wrapper">
                <div class="chart-bar" style="height:${height}px"></div>
                <span class="chart-label">${count}</span>
                <span class="chart-emoji">${emoji}</span>
            </div>`;
    }).join('');
}

function updateNextCountdown() {
    const box = document.getElementById('nextEventContent');
    if (!box) return;
    const now = new Date().setHours(0, 0, 0, 0);
    const next = allEvents.filter(e => e._endTs >= now).sort((a, b) => a._startTs - b._startTs)[0];

    if (next) {
        const diff = Math.round((next._startTs - now) / 86400000);
        box.innerHTML = `<div class="next-event-title">${next.Event}</div><div class="next-event-countdown">${diff > 0 ? 'Még ' + diff + ' nap' : 'MA kezdődik! 🔥'}</div>`;
    }
}

function populateEventDropdown() {
    const sel = document.getElementById('compEvent');
    if (!sel) return;
    sel.innerHTML = '<option disabled selected>Válassz...</option>';
    [...new Set(allEvents.map(e => e.Event))].sort().forEach(name => sel.add(new Option(name, name)));
}

/* --- KALKULÁTOR LOGIKA --- */
window.loadMemberData = () => {
    const idx = document.getElementById('memberSelect').value;
    if(idx !== "custom") {
        const m = hfsStats[idx];
        document.getElementById('currentDivision').value = m.div;
        document.getElementById('currentPoints').value = m.points;
    }
    calculate();
};

window.calculate = () => {
    const div = document.getElementById('currentDivision').value;
    const pts = parseInt(document.getElementById('currentPoints').value) || 0;
    const rule = { "Newcomer": 1, "Novice": 30, "Intermediate": 45, "Advanced": 90 }[div];
    
    const percent = Math.min(100, (pts / rule) * 100);
    document.getElementById('xpBar').style.width = percent + "%";
    document.getElementById('nextLevelResult').innerHTML = `Muszáj: <strong>${Math.max(0, rule - pts)}</strong> pont múlva szintlépés.`;
};

window.calcPrelim = (prefix) => {
    const y = parseInt(document.getElementById(`${prefix}_vYes`).value) || 0;
    const a1 = parseInt(document.getElementById(`${prefix}_vAlt1`).value) || 0;
    const a2 = parseInt(document.getElementById(`${prefix}_vAlt2`).value) || 0;
    const a3 = parseInt(document.getElementById(`${prefix}_vAlt3`).value) || 0;
    const score = (y * 10) + (a1 * 4.5) + (a2 * 4.3) + (a3 * 4.2);
    document.getElementById(`${prefix}_score`).innerText = `Pontszám: ${score.toFixed(1)}`;
};

window.toggleNextSection = (type) => {
    const isPass = document.getElementById(type === 'semi' ? 'p_pass' : 's_pass').checked;
    document.getElementById(`section-${type}`).style.display = isPass ? 'block' : 'none';
};

window.calculateResults = () => {
    const count = parseInt(document.getElementById('competitorCount').value) || 0;
    const place = parseInt(document.getElementById('finalPlacement').value) || 0;
    let tier = 0;
    if (count >= 130) tier = 6; else if (count >= 80) tier = 5; else if (count >= 40) tier = 4;
    else if (count >= 20) tier = 3; else if (count >= 11) tier = 2; else if (count >= 5) tier = 1;

    const points = (TIER_TABLE[tier] && TIER_TABLE[tier][place - 1]) || 0;
    const display = document.getElementById('finalResultDisplay');
    display.style.display = place > 0 ? 'block' : 'none';
    document.getElementById('finalPlaceText').innerText = `${place}. Helyezés (Tier ${tier})`;
    document.getElementById('wsdcPointsEarned').innerText = `Szerzett WSDC pont: ${points}`;
};

/* --- TÉMA ÉS INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    
    const sel = document.getElementById('memberSelect');
    if(sel) hfsStats.forEach((m, i) => sel.add(new Option(m.name, i)));

    const themeToggle = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    if(themeToggle) {
        themeToggle.checked = isDark;
        themeToggle.onchange = () => {
            const t = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.dataset.theme = t;
            localStorage.setItem('theme', t);
        };
    }
});
