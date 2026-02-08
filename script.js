const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = { "Csongi": "🌈", "Merci": "🦆", "Mózes": "🦄", "Luca": "🐶", "Zoli": "🕺" };
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];

let allEvents = [], activeFilter = null, currentMonthIdx = new Date().getMonth();

// --- KÖZÖS FUNKCIÓK ---

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

// --- NAPTÁR FUNKCIÓK ---

function parseHungarianDate(dStr) {
    if(!dStr) return null;
    const p = dStr.trim().replace(/\.+$/, '').split('.');
    return p.length < 3 ? null : new Date(p[0], p[1]-1, p[2]);
}

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
    } catch(e) { console.error("Hiba", e); }
}

// Oldalsáv szűrők generálása (Mobil barát verzió)
function renderFilter() {
    const c = document.getElementById('memberFilter');
    if (!c) return;
    c.innerHTML = ''; 

    Object.keys(resztvevokMap).forEach(name => {
        const btn = document.createElement('div');
        btn.className = 'filter-btn';
        if (activeFilter === name) btn.classList.add('active');
        
        btn.innerHTML = `<span>${resztvevokMap[name]}</span> ${name}`;
        btn.onclick = () => {
            activeFilter = (activeFilter === name) ? null : name;
            
            // Gombok vizuális frissítése
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.toggle('active', b.innerText.includes(activeFilter) && activeFilter !== null);
            });
            
            render(currentMonthIdx);

            // MOBIL: Szűrés után automatikus bezárás
            if (window.innerWidth <= 1024) {
                const sidebar = document.querySelector('.sidebar');
                if(sidebar) sidebar.classList.remove('open');
                const toggleBtn = document.getElementById('sidebarToggle');
                if(toggleBtn) toggleBtn.innerText = "🔍 SZŰRŐK";
            }
        };
        c.appendChild(btn);
    });
}

// ... (updateNext, fetchWeather, render, setupMonthSelect, changeMonth, goToToday, updateActivityChart függvények maradnak változatlanul) ...

// --- EGYETLEN ÖSSZEVONT INDÍTÁS ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();

    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                // Mobil állapot
                sidebar.classList.toggle('open');
                toggleBtn.innerText = sidebar.classList.contains('open') ? "✖ BEZÁR" : "🔍 SZŰRŐK";
            } else {
                // Webes állapot
                sidebar.classList.toggle('collapsed');
                // Weben a szöveget nem feltétlen kell cserélni, de maradhat a gomb
            }
        });
    }
});
