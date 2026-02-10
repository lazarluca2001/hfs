/* jshint esversion: 11 */

/* --- KONFIGURÁCIÓ & ADATOK --- */
const CONFIG = {
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv',
    databaseAppUrl: 'IDE_MÁSOLD_A_SCRIPT_DEPLOY_URL_ED',
    members: {"Csongi":"🌈","Merci":"🦆","Mózes":"🦄","Luca":"🐶","Zoli":"🕺"},
    validStatuses: ["igen", "talán", "talan", "fizetve", "igazolt"],
    months: ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"],
    weekdays: ["H","K","Sze","Cs","P","Szo","V"]
};

const TIER_TABLE = {
    1: [3, 2, 1], 2: [6, 4, 3, 2, 1], 3: [10, 8, 6, 4, 2, 1],
    4: [15, 12, 10, 8, 6, 1], 5: [20, 16, 14, 12, 10, 2], 6: [25, 22, 18, 15, 12, 2]
};

const WSDC_RULES = {
    "Newcomer": { required: 1, next: "Novice" },
    "Novice": { required: 30, next: "Intermediate" },
    "Intermediate": { required: 45, next: "Advanced" },
    "Advanced": { required: 90, next: "All Star" }
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

        updateUI();
    } catch (e) { 
        console.error("Adatbetöltési hiba:", e); 
    }
}

/* --- UI FRISSÍTÉS --- */
function updateUI() {
    if (document.getElementById('calendar')) {
        renderCalendar(currentMonthIdx);
        setupMonthSelect();
    }
    renderFilter();
    updateActivityChart();
    updateNextCountdown();
    populateEventDropdown();
}

/* --- NAPTÁR GENERÁLÁSA --- */
function renderCalendar(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    
    cal.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const monthHeader = document.getElementById('currentMonthHeader');
    if (monthHeader) monthHeader.innerText = CONFIG.months[m];

    CONFIG.weekdays.forEach(d => {
        const div = document.createElement('div');
        div.className = 'weekday';
        div.textContent = d;
        fragment.appendChild(div);
    });

    const firstDay = (new Date(2026, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(2026, m + 1, 0).getDate();
    const todayTs = new Date().setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'day empty-day-pre';
        fragment.appendChild(div);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const currTs = new Date(2026, m, d).setHours(0, 0, 0, 0);
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
                        tagsHtml += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}"><span>${emoji}</span></div>`;
                    }
                }
            });

            if (tagsHtml || !activeFilter) {
                const card = document.createElement('div');
                card.className = 'event-card';
                card.innerHTML = `<span class="event-title">${e.Event}</span><div class="participants-container">${tagsHtml}</div>`;
                dayDiv.appendChild(card);
            }
        });
        fragment.appendChild(dayDiv);
    }
    cal.appendChild(fragment);
}

/* --- NAVIGÁCIÓ --- */
function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    sel.innerHTML = CONFIG.months.map((m, i) => `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`).join('');
    sel.onchange = e => { 
        currentMonthIdx = parseInt(e.target.value, 10); 
        renderCalendar(currentMonthIdx); 
    };
}

window.changeMonth = (d) => {
    currentMonthIdx = (currentMonthIdx + d + 12) % 12;
    renderCalendar(currentMonthIdx);
    if (document.getElementById('monthSelect')) document.getElementById('monthSelect').value = currentMonthIdx;
};

window.goToToday = () => {
    currentMonthIdx = new Date().getMonth();
    renderCalendar(currentMonthIdx);
    if (document.getElementById('monthSelect')) document.getElementById('monthSelect').value = currentMonthIdx;
};

/* --- STATISZTIKÁK ÉS SZŰRŐK --- */
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
    updateUI();
};

function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    container.innerHTML = Object.entries(CONFIG.members).map(([name, emoji]) => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return CONFIG.validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = Math.min(80, (count / 20) * 80);
        return `<div class="chart-column-wrapper"><div class="chart-bar" style="height:${height}px"></div><span class="chart-label">${count}</span><span class="chart-emoji">${emoji}</span></div>`;
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

/* --- KALKULÁTOR ÉS XP SÁV --- */
window.calculate = () => {
    const div = document.getElementById('currentDivision').value;
    const pts = parseInt(document.getElementById('currentPoints').value) || 0;
    const rule = WSDC_RULES[div];
    if(!rule) return;

    const percent = Math.min(100, (pts / rule.required) * 100);
    const xpBar = document.getElementById('xpBar');
    if (xpBar) xpBar.style.width = percent + "%";

    const resultBox = document.getElementById('nextLevelResult');
    if (resultBox) {
        resultBox.innerHTML = `Következő: <strong>${rule.next}</strong> | Muszáj: ${Math.max(0, rule.required - pts)} pont múlva szintlépés.`;
    }
};

window.loadMemberData = () => {
    const idx = document.getElementById('memberSelect').value;
    if(idx !== "custom") {
        const m = hfsStats[idx];
        document.getElementById('currentDivision').value = m.div;
        document.getElementById('currentPoints').value = m.points;
    }
    window.calculate();
};

/* --- VERSENY NAPLÓZÓ --- */
function populateEventDropdown() {
    const sel = document.getElementById('compEvent');
    if (!sel) return;
    sel.innerHTML = '<option disabled selected>Válassz...</option>';
    [...new Set(allEvents.map(e => e.Event))].sort().forEach(name => sel.add(new Option(name, name)));
}

window.calcPrelim = (prefix) => {
    const y = parseInt(document.getElementById(`${prefix}_vYes`).value) || 0;
    const a1 = parseInt(document.getElementById(`${prefix}_vAlt1`).value) || 0;
    const a2 = parseInt(document.getElementById(`${prefix}_vAlt2`).value) || 0;
    const a3 = parseInt(document.getElementById(`${prefix}_vAlt3`).value) || 0;
    const score = (y * 10) + (a1 * 4.5) + (a2 * 4.3) + (a3 * 4.2);
    const scoreElem = document.getElementById(`${prefix}_score`);
    if (scoreElem) scoreElem.innerText = `Pontszám: ${score.toFixed(1)}`;
};

window.toggleNextSection = (type) => {
    const checkboxId = type === 'semi' ? 'p_pass' : 's_pass';
    const isPass = document.getElementById(checkboxId)?.checked;
    const target = document.getElementById(`section-${type}`);
    if (target) target.style.display = isPass ? 'block' : 'none';
};

window.calculateResults = () => {
    const count = parseInt(document.getElementById('competitorCount').value) || 0;
    const place = parseInt(document.getElementById('finalPlacement').value) || 0;
    let tier = 0;
    if (count >= 130) tier = 6; else if (count >= 80) tier = 5; else if (count >= 40) tier = 4;
    else if (count >= 20) tier = 3; else if (count >= 11) tier = 2; else if (count >= 5) tier = 1;

    const points = (TIER_TABLE[tier] && TIER_TABLE[tier][place - 1]) || 0;
    const display = document.getElementById('finalResultDisplay');
    if (display) {
        display.style.display = place > 0 ? 'block' : 'none';
        document.getElementById('finalPlaceText').innerText = `${place}. Helyezés (Tier ${tier})`;
        document.getElementById('wsdcPointsEarned').innerText = `Szerzett WSDC pont: ${points}`;
    }
};

/* --- TÉMA ÉS INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    
    const mSel = document.getElementById('memberSelect');
    if(mSel) hfsStats.forEach((m, i) => mSel.add(new Option(m.name, i)));

    // Téma kezelése - HTML-edben 'checkbox' az ID!
    const themeToggle = document.getElementById('checkbox') || document.getElementById('theme-toggle');
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
