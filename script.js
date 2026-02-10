/* jshint esversion: 11 */

/* --- KONFIGURÁCIÓ & ADATOK --- */
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
        if (headerIndex === -1) return;

        const headers = rows[headerIndex];
        const eventIdx = headers.indexOf('Event');
        const startIdx = headers.indexOf('Start date');
        const endIdx = headers.indexOf('End date');

        allEvents = rows.slice(headerIndex + 1)
            .filter(r => r[eventIdx])
            .map(row => {
                const obj = {};
                headers.forEach((h, i) => { obj[h] = row[i]; });
                obj._startTs = parseDate(row[startIdx]);
                obj._endTs = parseDate(row[endIdx]) || obj._startTs;
                return obj;
            })
            .filter(e => e._startTs);

        // NAPTÁR OLDAL FUNKCIÓI
        if (document.getElementById('calendar')) {
            renderFilter();
            setupMonthSelect();
            updateUI();
        }
        
        // INDEX OLDAL FUNKCIÓI
        if (document.getElementById('compEvent')) {
            populateEventDropdown();
        }

    } catch (e) {
        console.error("Betöltési hiba:", e);
    }
}

/* --- NAPTÁR UI RENDERELÉS --- */
function updateUI() {
    render(currentMonthIdx);
    updateNext();
    updateActivityChart();
}

function render(m) {
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
    cal.appendChild(fragment);
}

/* --- STATISZTIKA --- */
function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    container.innerHTML = Object.entries(CONFIG.members).map(([name, emoji]) => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return CONFIG.validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = allEvents.length ? (count / allEvents.length) * 80 : 0;
        return `<div class="chart-column-wrapper"><span class="chart-emoji">${emoji}</span><div class="chart-bar" style="height:${height}px"></div><span class="chart-label">${count}</span></div>`;
    }).join('');
}

function updateNext() {
    const box = document.getElementById('nextEventContent');
    if (!box) return;
    const now = new Date().setHours(0, 0, 0, 0);
    const next = allEvents.filter(e => e._endTs >= now).sort((a, b) => a._startTs - b._startTs)[0];
    if (next) {
        const diff = Math.round((next._startTs - now) / 86400000);
        box.innerHTML = `<div class="next-event-title">${next.Event}</div><div class="next-event-countdown">${diff > 0 ? 'Még ' + diff + ' nap' : 'Ma kezdődik! 🔥'}</div>`;
    }
}

/* --- INDEX OLDAL - KOMPLEX KALKULÁTOR --- */

function toggleNextSection(type) {
    if (type === 'semi') {
        const isPassing = document.getElementById('p_pass').checked;
        document.getElementById('section-semi').style.display = isPassing ? 'block' : 'none';
        if (!isPassing) {
            document.getElementById('s_pass').checked = false;
            toggleNextSection('final');
        }
    } else if (type === 'final') {
        const isPassing = document.getElementById('s_pass').checked;
        document.getElementById('section-final').style.display = isPassing ? 'block' : 'none';
        if (isPassing) generateJudgeInputs();
    }
}

function calcPrelim(prefix) {
    const y = parseInt(document.getElementById(`${prefix}_vYes`).value) || 0;
    const a1 = parseInt(document.getElementById(`${prefix}_vAlt1`).value) || 0;
    const score = (y * 10) + (a1 * 7);
    document.getElementById(`${prefix}_score`).innerText = `Pontszám: ${score}`;
}

function generateJudgeInputs() {
    const count = document.getElementById('finalJudgeCount').value;
    const container = document.getElementById('judgeInputsContainer');
    if(!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        container.innerHTML += `<input type="number" class="rp-input" placeholder="J${i}" style="width:50px; margin:2px;">`;
    }
}

function runRelativePlacement() {
    const inputs = document.querySelectorAll('.rp-input');
    const scores = Array.from(inputs).map(i => parseInt(i.value)).filter(v => !isNaN(v));
    if (scores.length < 3) return alert("Kérlek add meg a bírói helyezéseket!");

    const majority = Math.ceil(scores.length / 2);
    let finalPlace = 0;
    for (let p = 1; p <= 20; p++) {
        if (scores.filter(s => s <= p).length >= majority) {
            finalPlace = p;
            break;
        }
    }

    const count = parseInt(document.getElementById('competitorCount').value) || 0;
    let tier = 0;
    if (count >= 130) tier = 6; else if (count >= 80) tier = 5; else if (count >= 40) tier = 4;
    else if (count >= 20) tier = 3; else if (count >= 11) tier = 2; else if (count >= 5) tier = 1;

    const points = (TIER_TABLE[tier] && TIER_TABLE[tier][finalPlace - 1]) || 0;
    document.getElementById('finalResultDisplay').style.display = 'block';
    document.getElementById('finalPlaceText').innerText = `Helyezés: ${finalPlace}.`;
    document.getElementById('wsdcPointsEarned').innerText = `Szerzett WSDC pont: ${points}`;
}

function populateEventDropdown() {
    const sel = document.getElementById('compEvent');
    if (!sel || allEvents.length === 0) return;
    sel.innerHTML = '<option disabled selected>Válassz...</option>';
    [...new Set(allEvents.map(e => e.Event))].forEach(name => sel.add(new Option(name, name)));
    sel.onchange = (e) => {
        const ev = allEvents.find(event => event.Event === e.target.value);
        if (ev && ev._startTs) {
            const d = new Date(ev._startTs);
            const diff = (d.getDay() <= 6) ? (6 - d.getDay()) : 0;
            d.setDate(d.getDate() + diff);
            document.getElementById('compDate').value = d.toISOString().split('T')[0];
        }
    };
}

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    
    // Téma kapcsoló inicializálása mindkét oldalon
    const themeToggle = document.getElementById('theme-toggle') || document.getElementById('checkbox');
    if(themeToggle) {
        const isDark = localStorage.getItem('theme') === 'dark';
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        themeToggle.checked = isDark;
        themeToggle.onchange = () => {
            const t = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.dataset.theme = t;
            localStorage.setItem('theme', t);
        };
    }

    // Sidebar toggle (mobilhoz)
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
});

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    sel.innerHTML = CONFIG.months.map((m, i) => `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`).join('');
    sel.onchange = e => { currentMonthIdx = parseInt(e.target.value, 10); render(currentMonthIdx); };
}

window.changeMonth = (d) => { currentMonthIdx = (currentMonthIdx + d + 12) % 12; render(currentMonthIdx); };
window.goToToday = () => { currentMonthIdx = new Date().getMonth(); render(currentMonthIdx); };
