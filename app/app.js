/**
 * OUTAGE RESPONSE - Master App Logic
 * Version: 2.1 (VPS & Autocomplete Optimized)
 */

const DATA_FOLDER = 'data/';
const INDEX_FILE = 'agencies.json';

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const keyInput = document.getElementById('agency-key');
const loginBtn = document.getElementById('login-btn');
const searchInput = document.getElementById('search-input');
const autocompleteList = document.getElementById('autocomplete-list');
const activeResult = document.getElementById('active-result');
const agencyDisplay = document.getElementById('agency-name-display');

let currentAgencyData = null;
let currentFocus = -1;

// 1. INITIAL LOAD & CHECK CACHE
window.addEventListener('load', () => {
    const savedData = localStorage.getItem('dispatch_data');
    const savedName = localStorage.getItem('agency_name');
    if (savedData && savedName) {
        currentAgencyData = JSON.parse(savedData);
        renderApp(savedName);
    }
});

// 2. LOGIN / SYNC HANDLER
async function handleLogin() {
    const key = keyInput.value.trim().toLowerCase();
    if (!key) {
        alert("Please enter a valid key.");
        return;
    }

    try {
        // Fetch the index file to validate agency
        const indexRes = await fetch(INDEX_FILE);
        if (!indexRes.ok) throw new Error("Could not load agencies.json");
        
        const validAgencies = await indexRes.json();
        const agencyMatch = validAgencies.find(a => a.key === key);

        if (!agencyMatch) {
            alert("Invalid Agency Key. Access Denied.");
            return;
        }

        // Fetch the specific agency data
        const dataRes = await fetch(`${DATA_FOLDER}${key}.json`);
        if (!dataRes.ok) throw new Error(`Data file for ${key} not found on server.`);
        
        const data = await dataRes.json();
        
        // Save to LocalStorage
        localStorage.setItem('dispatch_data', JSON.stringify(data));
        localStorage.setItem('agency_name', agencyMatch.name);
        
        currentAgencyData = data;
        renderApp(agencyMatch.name);
        
    } catch (e) {
        console.error("Login Error:", e);
        alert("System Error: " + e.message);
    }
}

// 3. AUTOCOMPLETE SEARCH LOGIC
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const query = this.value.toUpperCase().trim();
        closeAllLists();
        if (!query) { activeResult.innerHTML = ''; return; }
        currentFocus = -1;

        // Filter based on "Starts With"
        const matches = currentAgencyData.plans.filter(p => 
            p.determinant.toUpperCase().startsWith(query)
        ).slice(0, 10);

        matches.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `<strong>${item.determinant}</strong> - ${item.description}`;
            div.addEventListener('click', () => selectCode(item));
            autocompleteList.appendChild(div);
        });
    });

    // Keyboard Navigation (Arrows & Enter)
    searchInput.addEventListener('keydown', function(e) {
        let items = autocompleteList.getElementsByTagName('div');
        if (e.keyCode == 40) { // DOWN
            currentFocus++;
            addActive(items);
        } else if (e.keyCode == 38) { // UP
            currentFocus--;
            addActive(items);
        } else if (e.keyCode == 13) { // ENTER
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) items[currentFocus].click();
        }
    });
}

// 4. SELECTION & DISPLAY
function selectCode(item) {
    searchInput.value = item.determinant;
    closeAllLists();
    
    let rows = '';
    for (const [name, res] of Object.entries(item.agencies)) {
        const color = (currentAgencyData.theme && currentAgencyData.theme[name]) 
                      ? currentAgencyData.theme[name] : '#9ca3af';
        rows += `
            <div class="agency-row">
                <strong style="color:${color}">${name}</strong>
                <span>${res}</span>
            </div>`;
    }

    activeResult.innerHTML = `
        <div class="result-item">
            <span class="level-badge">${item.level}</span>
            <div class="determinant-title">${item.determinant} - ${item.description}</div>
            <div class="agency-list">${rows}</div>
        </div>`;
}

// 5. HELPERS
function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add("autocomplete-active");
}

function removeActive(items) {
    for (let i = 0; i < items.length; i++) items[i].classList.remove("autocomplete-active");
}

function closeAllLists() { autocompleteList.innerHTML = ''; }

function renderApp(name) {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    agencyDisplay.innerText = name;
}

function logout() {
    if(confirm("Logout and clear offline cache?")) {
        localStorage.clear();
        location.reload();
    }
}

// ATTACH LOGIN BUTTON
if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
}

// CLOSE DROPDOWN ON OUTSIDE CLICK
document.addEventListener('click', (e) => {
    if (e.target !== searchInput) closeAllLists();
});