/**
 * OUTAGE RESPONSE - Master App Logic
 * Version: 2.2 (Enhanced Sync Tracking)
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
    const savedTime = localStorage.getItem('last_sync_time');
    
    if (savedData && savedName) {
        currentAgencyData = JSON.parse(savedData);
        renderApp(savedName, savedTime);
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
        const indexRes = await fetch(INDEX_FILE);
        if (!indexRes.ok) throw new Error("Could not load agencies.json");
        
        const validAgencies = await indexRes.json();
        const agencyMatch = validAgencies.find(a => a.key === key);

        if (!agencyMatch) {
            alert("Invalid Agency Key. Access Denied.");
            return;
        }

        const dataRes = await fetch(`${DATA_FOLDER}${key}.json`);
        if (!dataRes.ok) throw new Error(`Data file for ${key} not found.`);
        
        const data = await dataRes.json();
        
        // Create a timestamp
        const syncTime = new Date().toLocaleString();
        
        // Save to LocalStorage
        localStorage.setItem('dispatch_data', JSON.stringify(data));
        localStorage.setItem('agency_name', agencyMatch.name);
        localStorage.setItem('last_sync_time', syncTime);
        
        currentAgencyData = data;
        renderApp(agencyMatch.name, syncTime);
        
    } catch (e) {
        console.error("Login Error:", e);
        alert("System Error: " + e.message);
    }
}

// 3. RENDER FUNCTION (Displays the sync note)
function renderApp(name, syncTime) {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    agencyDisplay.innerText = name;

    // Display the last sync note at the bottom of the card or top of results
    activeResult.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 0.75rem; color: #64748b; background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                Last Data Sync: ${syncTime || 'Offline Mode'}
            </span>
        </div>`;
}

// 4. AUTOCOMPLETE SEARCH LOGIC
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const query = this.value.toUpperCase().trim();
        closeAllLists();
        if (!query) { 
            // Return the sync note if search is cleared
            const savedTime = localStorage.getItem('last_sync_time');
            renderApp(localStorage.getItem('agency_name'), savedTime);
            return; 
        }
        currentFocus = -1;

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

    searchInput.addEventListener('keydown', function(e) {
        let items = autocompleteList.getElementsByTagName('div');
        if (e.keyCode == 40) { currentFocus++; addActive(items); } 
        else if (e.keyCode == 38) { currentFocus--; addActive(items); } 
        else if (e.keyCode == 13) { 
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) items[currentFocus].click();
        }
    });
}

// 5. SELECTION & DISPLAY
function selectCode(item) {
    searchInput.value = item.determinant;
    closeAllLists();
    
    let rows = '';
    for (const [name, res] of Object.entries(item.agencies)) {
        const color = (currentAgencyData.theme && currentAgencyData.theme[name]) 
                      ? currentAgencyData.theme[name] : '#3b82f6';
        rows += `
            <div class="agency-row">
                <strong style="color:${color}">${name}</strong>
                <span>${res}</span>
            </div>`;
    }

    // Capture sync time for the footer of the result
    const savedTime = localStorage.getItem('last_sync_time');

    activeResult.innerHTML = `
        <div class="result-item">
            <span class="level-badge">${item.level}</span>
            <div class="determinant-title">${item.determinant} - ${item.description}</div>
            <div class="agency-list">${rows}</div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                <span style="font-size: 0.65rem; color: #4b5563;">Verified Data Sync: ${savedTime}</span>
            </div>
        </div>`;
}

// 6. HELPERS
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

function logout() {
    if(confirm("Logout and clear offline cache?")) {
        localStorage.clear();
        location.reload();
    }
}

// ATTACH EVENT LISTENERS
if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
}

document.addEventListener('click', (e) => {
    if (e.target !== searchInput) closeAllLists();
});