const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = { "Csongi": "🌈", "Merci": "🦆", "Mózes": "🦄", "Luca": "🐶", "Zoli": "🕺" };
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];
let allEvents = [], activeFilter = null, currentMonthIdx = new Date().getMonth();

// --- KÖZÖS FUNKCIÓK (Landing Page és Naptár) ---

function initTheme() {
    const toggle = document.querySelector('#checkbox');
    if (!toggle) return; // Ha a landing page-en nincs kapcsoló, ne fusson tovább

    if (localStorage.getItem('theme') === 'dark') { 
        document.documentElement.setAttribute('data-theme', 'dark'); 
        toggle.checked = true; 
    }

    toggle.addEventListener('change', (e) => {
        const t = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
    });
}

// --- NAPTÁR SPECIFIKUS FUNKCIÓK ---

function parseHungarianDate(dStr) {
    if(!dStr) return null;
    const p = dStr.trim().replace(/\.+$/, '').split('.');
    return p.length < 3 ? null : new Date(p[0], p[1]-1, p[2]);
}

async function initCalendar() {
    // Csak akkor fut le, ha a naptár rács létezik az oldalon
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
    } catch(e) { 
        console.error("Hiba az adatok betöltésekor", e); 
    }
}

function renderFilter() {
    const c = document.getElementById('memberFilter');
    if (!c) return;
    c.innerHTML = ''; // Meglévő gombok ürítése újragenerálás előtt
    Object.keys(resztvevokMap).forEach(name => {
        const btn = document.createElement('div');
        btn.className = 'filter-btn';
        btn.innerHTML = `<span>${resztvevokMap[name]}</span> ${name}`;
        btn.onclick = () => {
            activeFilter = (activeFilter === name) ? null : name;
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.toggle('active', b.innerText.includes(activeFilter));
            });
            render(currentMonthIdx);
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
            <h2 style="font-size:1.1em; margin:0">${next.Event}</h2>
            <p style="margin:5px 0; font-size:0.9em; opacity:0.8">📍 ${next.Location || 'TBD'}</p>
            <p style="margin:5px 0; font-size:0.9em; opacity:0.8">📅 ${next["Start date"]}</p>
            <span style="font-weight:bold; color:var(--hfs-red)">${diff <= 0 ? "MA KEZDŐDIK! 🔥" : "Még " + diff + " nap"}</span>
        `;
    }
}

function render(m) {
    const cal = document.getElementById('calendar'); 
    if (!cal) return;
    cal.innerHTML = '';
    
    const mNames = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    document.getElementById('currentMonthHeader').innerText = mNames[m];
    
    ["Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat","Vasárnap"].forEach(name => {
        cal.innerHTML += `<div class="weekday">${name}</div>`;
    });
    
    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m+1, 0).getDate();
    
    for(let i=0; i<first; i++) cal.innerHTML += `<div class="day empty-day-pre"></div>`;
    
    for(let d=1; d<=days; d++) {
        const currDate = new Date(2026, m, d);
        const curr = currDate.setHours(0,0,0,0);
        const evs = allEvents.filter(e => curr >= e._start.getTime() && curr <= e._end.getTime());
        let html = `<div class="day ${new Date().setHours(0,0,0,0) === curr ? 'today' : ''}"><span class="day-number">${d}</span>`;
        
        evs.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const s = (e[name]||"").toLowerCase();
                if(validStatuses.some(vs => s.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    tags += `<div class="person-tag ${s.includes("talan") ? 'status-talan' : 'status-biztos'}"><span>${resztvevokMap[name]}</span> ${name}</div>`;
                }
            });
            
            if(tags) {
                html += `
                    <div class="event-card">
                        <span class="event-title">${e.Event}</span>
                        <div class="participants-container">${tags}</div>
                    </div>`;
            }
        });
        cal.innerHTML += html + `</div>`;
    }
    
    const totalProcessed = first + days;
    const remaining = totalProcessed % 7 === 0 ? 0 : 7 - (totalProcessed % 7);
    for(let i=0; i<remaining; i++) cal.innerHTML += `<div class="day empty-day-post"></div>`;
}

// Navigációs segédfunkciók
function goToToday() {
    currentMonthIdx = new Date().getMonth();
    const sel = document.getElementById('monthSelect');
    if (sel) sel.value = currentMonthIdx;
    render(currentMonthIdx);
}

function setupMonthSelect() {
    const sel = document.getElementById('monthSelect'); 
    if (!sel) return;
    sel.innerHTML = '';
    const mNames = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    mNames.forEach((m, i) => {
        const opt = document.createElement('option'); 
        opt.value = i; 
        opt.textContent = m;
        if(i === currentMonthIdx) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.onchange = (e) => { 
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

// --- INDÍTÁS ---

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();
});
