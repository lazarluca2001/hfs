/* --- KONFIGURÁCIÓ --- */
const wishlistUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDDBNbIkZize7hPMfYPovbLgnIFWNuseLg0mjzDYGhLCwEEiF_-CiXnV76lgg2mvb54QabZ8y3Sork/pub?gid=338581218&single=true&output=csv';
const resztvevokMap = {"Csongi":"🌈","Merci":"🦆","Mózes":"🦄","Luca":"🐶","Zoli":"🕺"};
const validStatuses = ["igen", "talán", "talan", "fizetve", "igazolt"];
let allEvents = [];
let activeFilter = null;
let currentMonthIdx = new Date().getMonth();

/* --- NAPTÁR RENDERELÉS --- */
function render(m) {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    cal.innerHTML = '';

    const months = ["JANUÁR","FEBRUÁR","MÁRCIUS","ÁPRILIS","MÁJUS","JÚNIUS","JÚLIUS","AUGUSZTUS","SZEPTEMBER","OKTÓBER","NOVEMBER","DECEMBER"];
    document.getElementById('currentMonthHeader').innerText = months[m];

    ["H","K","Sze","Cs","P","Szo","V"].forEach(d => cal.innerHTML += `<div class="weekday">${d}</div>`);

    const first = (new Date(2026, m, 1).getDay() + 6) % 7;
    const days = new Date(2026, m + 1, 0).getDate();

    // Üres napok az elején (pöttyözött)
    for (let i = 0; i < first; i++) cal.innerHTML += `<div class="day empty-day-pre"></div>`;

    for (let d = 1; d <= days; d++) {
        const currDate = new Date(2026, m, d);
        const currTimestamp = currDate.setHours(0,0,0,0);
        const todayTimestamp = new Date().setHours(0,0,0,0);
        const dailyEvents = allEvents.filter(e => currTimestamp >= e._start.getTime() && currTimestamp <= e._end.getTime());

        let html = `<div class="day ${todayTimestamp === currTimestamp ? 'today' : ''}">
                    <span class="day-number">${d}</span>`;

        dailyEvents.forEach(e => {
            let tags = "";
            Object.keys(resztvevokMap).forEach(name => {
                const status = (e[name] || "").toLowerCase();
                if (validStatuses.some(vs => status.includes(vs)) && (!activeFilter || activeFilter === name)) {
                    const isTalan = status.includes("talan") || status.includes("talán");
                    tags += `<div class="person-tag ${isTalan ? 'status-talan' : 'status-biztos'}"><span>${resztvevokMap[name]}</span> ${name}</div>`;
                }
            });

            if (tags) {
                html += `<div class="event-card"><span class="event-title">${e.Event}</span><div class="participants-container">${tags}</div></div>`;
            }
        });
        cal.innerHTML += html + `</div>`;
    }
    
    // Üres napok a végén a rács kitöltéséhez
    const totalCells = first + days;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remaining; i++) cal.innerHTML += `<div class="day empty-day-post"></div>`;
}

/* --- FUNKCIÓK --- */
function updateActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container || allEvents.length === 0) return;
    container.innerHTML = Object.keys(resztvevokMap).map(name => {
        const count = allEvents.filter(e => {
            const s = (e[name] || "").toLowerCase();
            return validStatuses.some(vs => s.includes(vs));
        }).length;
        const height = (count / allEvents.length) * 70;
        return `<div class="chart-column-wrapper"><span class="chart-label">${count}</span><div class="chart-bar" style="height:${height}px"></div><span class="chart-emoji">${resztvevokMap[name]}</span></div>`;
    }).join('');
}

/* --- INICIALIZÁLÁS --- */
document.addEventListener('DOMContentLoaded', () => {
    // Téma és adatbetöltés hívása (korábbi kódjaid alapján)
    initTheme();
    initCalendar();

    document.getElementById('sidebarToggle').onclick = () => {
        const sb = document.getElementById('sidebar');
        if (window.innerWidth <= 1024) sb.classList.toggle('open');
        else sb.classList.toggle('collapsed');
    };
});
