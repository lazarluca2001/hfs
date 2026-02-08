const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = { "Csongi": "🌈", "Merci": "🦆", "Mózes": "🦄", "Luca": "🐶", "Zoli": "🕺" };
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];

let allEvents = [], activeFilter = null, currentMonthIdx = new Date().getMonth();

// --- KÖZÖS FUNKCIÓK (Landing Page és Naptár) ---

/**
 * Kezeli a sötét/világos mód váltást és menti az állapotot.
 */
function initTheme() {
    const toggle = document.querySelector('#checkbox');
    if (!toggle) return;

    // Mentett téma betöltése
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

// --- NAPTÁR SPECIFIKUS FUNKCIÓK ---

/**
 * Magyar dátumformátum (éééé.hh.nn.) feldolgozása JS dátummá.
 */
function parseHungarianDate(dStr) {
    if(!dStr) return null;
    const p = dStr.trim().replace(/\.+$/, '').split('.');
    return p.length < 3 ? null : new Date(p[0], p[1]-1, p[2]);
}

/**
 * Adatok letöltése a Google Sheets-ből és a naptár inicializálása.
 */
async function initCalendar() {
    // Csak akkor fut le, ha a naptár rács létezik (naptar.html oldalon vagyunk)
    if (!document.getElementById('calendar')) return;

    try {
        const res = await fetch(wishlistUrl);
        const csv = await res.text();
        // CSV sorokra bontása és tisztítása
        const rows = csv.split('\n').map(r => r.split(',').map(c => c.trim().replace(/"/g, '')));
        
        // A fejléc a 4. sorban van (index 3)
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
    } catch(e) { 
        console.error("Hiba az adatok betöltésekor", e); 
    }
}

/**
 * A sidebarban lévő tag-szűrők generálása.
 */
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
        
        // Tartalom frissítése az időjárás konténerrel együtt
        nextBox.innerHTML = `
            <h2 style="font-size:1.1em; margin:0">${next.Event}</h2>
            <p style="margin:5px 0; font-size:0.9em; opacity:0.8">📍 ${next.Location || 'TBD'}</p>
            <p style="margin:5px 0; font-size:0.9em; opacity:0.8">📅 ${next["Start date"]}</p>
            <span style="font-weight:bold; color:var(--hfs-red)">
                ${diff <= 0 ? "MA KEZDŐDIK! 🔥" : "Még " + diff + " nap"}
            </span>
            <div id="weatherForecast" style="display: flex; flex-direction: column; gap: 8px;">
                <p style="font-size:0.8em; opacity:0.6;">Időjárás betöltése...</p>
            </div>
        `;

        // Időjárás lekérése a helyszín alapján
        if (next.Location) {
            fetchWeather(next.Location);
        }
    } else {
        nextBox.innerHTML = "Nincs következő esemény.";
    }
}

/**
 * Időjárás adatok lekérése a helyszín alapján
 */
async function fetchWeather(city) {
    const forecastDiv = document.getElementById('weatherForecast');
    if (!city || !forecastDiv) return;

    try {
        // 1. Koordináták keresése a városhoz (Geocoding)
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=hu&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) throw new Error("Város nem található");
        const { latitude, longitude } = geoData.results[0];

        // 2. 3 napos előrejelzés lekérése
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const weatherData = await weatherRes.json();

        forecastDiv.innerHTML = ''; 
        
        // Ikon választó segédfüggvény
        const getWeatherIcon = (code) => {
            if (code <= 3) return "☀️";
            if (code <= 48) return "☁️";
            if (code <= 67) return "🌧️";
            if (code <= 77) return "❄️";
            return "⛈️";
        };

        // Mai és a következő 2 nap megjelenítése
        for (let i = 0; i < 3; i++) {
            const dateLabel = i === 0 ? "Ma" : (i === 1 ? "Holnap" : "Utána");
            const maxTemp = Math.round(weatherData.daily.temperature_2m_max[i]);
            const minTemp = Math.round(weatherData.daily.temperature_2m_min[i]);
            const icon = getWeatherIcon(weatherData.daily.weathercode[i]);

            forecastDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-color); padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9em;">
                    <span style="font-weight: 600;">${dateLabel}</span>
                    <span>${icon} ${maxTemp}° / ${minTemp}°</span>
                </div>
            `;
        }
    } catch (e) {
        console.error("Időjárás hiba:", e);
        forecastDiv.innerHTML = '<p style="color:var(--hfs-red); font-size:0.8em;">Időjárás nem elérhető.</p>';
    }
}

/**
 * Kirajzolja a naptár rácsot az adott hónapra.
 */
function render(m) {
    const cal = document.getElementById('calendar'); 
    if (!cal) return;
    cal.innerHTML = '';
    
    const mNames = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    document.getElementById('currentMonthHeader').innerText = mNames[m];
    
    // Hét napjai fejléc
    ["Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat","Vasárnap"].forEach(name => {
        cal.innerHTML += `<div class="weekday">${name}</div>`;
    });
    
    // Első nap eltolása (hétfőre korrigálva)
    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m+1, 0).getDate();
    
    // Üres napok a hónap előtt
    for(let i=0; i<first; i++) cal.innerHTML += `<div class="day empty-day-pre"></div>`;
    
    // Napok feltöltése
    for(let d=1; d<=days; d++) {
        const currDate = new Date(2026, m, d);
        const curr = currDate.setHours(0,0,0,0);
        const today = new Date().setHours(0,0,0,0);
        
        const evs = allEvents.filter(e => curr >= e._start.getTime() && curr <= e._end.getTime());
        
        let html = `<div class="day ${today === curr ? 'today' : ''}">
                    <span class="day-number">${d}</span>`;
        
        evs.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const s = (e[name]||"").toLowerCase();
                // Csak akkor mutatjuk, ha pozitív státuszú ÉS nincs szűrve, vagy ő a szűrt személy
                if(validStatuses.some(vs => s.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    const isTalan = s.includes("talan") || s.includes("talán");
                    tags += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}">
                                <span>${resztvevokMap[name]}</span> ${name}
                             </div>`;
                }
            });
            
            if(tags) {
                html += `<div class="event-card">
                            <span class="event-title">${e.Event}</span>
                            <div class="participants-container">${tags}</div>
                         </div>`;
            }
        });
        cal.innerHTML += html + `</div>`;
    }
    
    // Üres napok a hónap végén a rács kitöltéséhez
    const totalProcessed = first + days;
    const remaining = totalProcessed % 7 === 0 ? 0 : 7 - (totalProcessed % 7);
    for(let i=0; i<remaining; i++) cal.innerHTML += `<div class="day empty-day-post"></div>`;
}

/**
 * Hónapválasztó legördülő menü beállítása.
 */
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

/**
 * Lapozás a hónapok között.
 */
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

// --- AUTOMATIKUS INDÍTÁS ---

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCalendar();
});

/**
 * Kiszámolja és kirajzolja a tagok aktivitási diagramját.
 */
function updateActivityChart() {
    const chartContainer = document.getElementById('activityChart');
    if (!chartContainer || allEvents.length === 0) return;

    const stats = {};
    Object.keys(resztvevokMap).forEach(name => stats[name] = 0);
    const totalPossibleEvents = allEvents.length;

    // Statisztika gyűjtése
    allEvents.forEach(e => {
        Object.keys(resztvevokMap).forEach(name => {
            const s = (e[name] || "").toLowerCase();
            if (["igen", "fizetve", "igazolt", "talán"].some(vs => s.includes(vs))) {
                stats[name]++;
            }
        });
    });

    chartContainer.innerHTML = '';

    // Segédfüggvény egy oszlop létrehozásához
    const createColumn = (val, emoji, count, isTotal = false) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-column-wrapper';
        // A magasságot az összes eseményhez viszonyítjuk (max 100px)
        const height = (count / totalPossibleEvents) * 100;
        
        wrapper.innerHTML = `
            <span class="chart-label">${count}</span>
            <div class="chart-bar" style="height: ${height}px; opacity: ${isTotal ? '0.5' : '1'}"></div>
            <span class="chart-emoji">${emoji}</span>
        `;
        return wrapper;
    };

    // 1. oszlop: Összes event
    chartContainer.appendChild(createColumn(totalPossibleEvents, "📅", totalPossibleEvents, true));

    // 2-6. oszlop: Tagok
    Object.keys(resztvevokMap).forEach(name => {
        chartContainer.appendChild(createColumn(stats[name], resztvevokMap[name], stats[name]));
    });
}

