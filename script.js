const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = { "Csongi": "🌈", "Merci": "🦆", "Mózes": "🦄", "Luca": "🐶", "Zoli": "🕺" };
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];

let allEvents = [], activeFilter = null, currentMonthIdx = new Date().getMonth();

// --- TÉMA KEZELÉS ---
function initTheme() {
    const toggle = document.querySelector('#checkbox');
    if (!toggle) return;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggle.checked = true;
    }
    toggle.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });
}

// --- ADATOK BETÖLTÉSE ---
async function initCalendar() {
    if (!document.getElementById('calendar')) return;
    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.trim().replace(/"/g, '')));
        const headers = rows[3];
        allEvents = [];
        for(let i = 4; i < rows.length; i++) {
            let obj = {}; 
            headers.forEach((h, idx) => { if(h) obj[h] = rows[i][idx]; });
            if(obj.Event) {
                obj._start = parseHungarianDate(obj["Start date"]);
                obj._end = parseHungarianDate(obj["End date"]);
                if(obj._start) allEvents.push(obj);
            }
        }
        renderFilter(); 
        updateNext(); 
        setupMonthSelect(); 
        render(currentMonthIdx);
        updateActivityChart();
    } catch(e) { console.error("Betöltési hiba", e); }
}

function parseHungarianDate(dStr) {
    if(!dStr) return null;
    const p = dStr.trim().replace(/\.+$/, '').split('.');
    return p.length < 3 ? null : new Date(p[0], p[1]-1, p[2]);
}

// --- UI GENERÁLÁS ---
function renderFilter() {
    const c = document.getElementById('memberFilter');
    if (!c) return;
    c.innerHTML = ''; 
    Object.keys(resztvevokMap).forEach(name => {
        const btn = document.createElement('div');
        btn.className = `filter-btn ${activeFilter === name ? 'active' : ''}`;
        btn.innerHTML = `<span>${resztvevokMap[name]}</span> ${name}`;
        btn.onclick = () => {
            activeFilter = (activeFilter === name) ? null : name;
            renderFilter(); 
            render(currentMonthIdx);
            if (window.innerWidth <= 1024) {
                document.querySelector('.sidebar').classList.remove('open');
                document.getElementById('sidebarToggle').innerText = "🔍 SZŰRŐK";
            }
        };
        c.appendChild(btn);
    });
}

function updateNext() {
    const nextBox = document.getElementById('nextEventContent');
    if (!nextBox) return;
    const now = new Date().setHours(0,0,0,0);
    const next = allEvents.filter(e => e._end && e._end >= now).sort((a,b) => a._start - b._start)[0];
    if(next) {
        const diff = Math.ceil((next._start - now) / 86400000);
        nextBox.innerHTML = `
            <h3>${next.Event}</h3>
            <p>📍 ${next.Location || 'TBD'}</p>
            <p>📅 ${next["Start date"]}</p>
            <span style="font-weight:bold;color:var(--hfs-red)">${diff <= 0 ? "MA KEZDŐDIK!" : "Még " + diff + " nap"}</span>
            <div id="weatherForecast"></div>
        `;
        if (next.Location) fetchWeather(next.Location);
    }
}

async function fetchWeather(city) {
    const div = document.getElementById('weatherForecast');
    try {
        const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const gd = await g.json();
        const { latitude: lat, longitude: lon } = gd.results[0];
        const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const wd = await w.json();
        div.innerHTML = '';
        for(let i=0; i<3; i++) {
            div.innerHTML += `<div style="font-size:0.8em;display:flex;justify-content:space-between;margin-top:5px;padding:5px;border:1px solid var(--border-color);border-radius:4px">
                <span>${i===0?'Ma':i===1?'Holnap':'Utána'}</span>
                <span>${wd.daily.temperature_2m_max[i]}°C</span>
            </div>`;
        }
    } catch(e) { div.innerHTML = "Időjárás nem elérhető."; }
}

function render(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    cal.innerHTML = '';
    const mNames = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    document.getElementById('currentMonthHeader').innerText = mNames[m];
    ["H","K","Sze","Cs","P","Szo","V"].forEach(n => cal.innerHTML += `<div class="weekday">${n}</div>`);
    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m+1, 0).getDate();
    for(let i=0; i<first; i++) cal.innerHTML += `<div class="day empty-day-pre"></div>`;
    for(let d=1; d<=days; d++) {
        const curr = new Date(2026, m, d).setHours(0,0,0,0);
        const evs = allEvents.filter(e => curr >= e._start.getTime() && curr <= e._end.getTime());
        let html = `<div class="day ${new Date().setHours(0,0,0,0) === curr ? 'today' : ''}"><span class="day-number">${d}</span>`;
        evs.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(n => {
                const s = (e[n]||"").toLowerCase();
                if(validStatuses.some(vs => s.includes(vs)) && (!activeFilter || activeFilter === n)) {
                    tags += `<div class="person-tag ${s.includes('talan')?'status-talan':'status-biztos'}">${resztvevokMap[n]}</div>`;
                }
            });
            if(tags) html += `<div class="event-card"><span class="event-title">${e.Event}</span><div class="participants-container">${tags}</div></div>`;
        });
        cal.innerHTML += html + `</div>`;
    }
}

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect');
    if (!sel) return;
    ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"].forEach((m, i) => {
        sel.innerHTML += `<option value="${i}" ${i === currentMonthIdx ? 'selected' : ''}>${m}</option>`;
    });
    sel.onchange = (e) => { currentMonthIdx = parseInt(e.target.value); render(currentMonthIdx); };
}

function changeMonth(d) { currentMonthIdx = (currentMonthIdx + d + 12) % 12; document.getElementById('monthSelect').value = currentMonthIdx; render(currentMonthIdx); }
function goToToday() { currentMonthIdx = new Date().getMonth(); document.getElementById('monthSelect').value = currentMonthIdx; render(currentMonthIdx); }

function updateActivityChart() {
    const chart = document.getElementById('activityChart');
    if (!chart || allEvents.length === 0) return;
    chart.innerHTML = '';
    Object.keys(resztvevokMap).forEach(name => {
        const count = allEvents.filter(e => (e[name]||"").toLowerCase().match(/igen|fizetve|igazolt|talán/)).length;
        const h = (count / allEvents.length) * 100;
        chart.innerHTML += `<div class="chart-column-wrapper"><span class="chart-label">${count}</span><div class="chart-bar" style="height:${h}px"></div><span class="chart-emoji">${resztvevokMap[name]}</span></div>`;
    });
}

// --- ESEMÉNYKEZELŐK ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.toggle('open');
                toggleBtn.innerText = sidebar.classList.contains('open') ? "✖ BEZÁR" : "🔍 SZŰRŐK";
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
});
