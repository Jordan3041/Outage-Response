/**
 * OUTAGE RESPONSE - Master App Logic
 * Version: 2.4 (Integrated Status Board)
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

const syncTimeNote = document.getElementById('sync-timestamp-note');
const syncTimeText = document.getElementById('sync-time-text');

let currentAgencyData = null;
let currentFocus = -1;

// --- STATUS BOARD STATE ---
let units = JSON.parse(localStorage.getItem('localDispatchUnits')) || [];
let incidents = JSON.parse(localStorage.getItem('localDispatchIncidents')) || [];

// Ensure units have IDs
units.forEach(u => { if(!u.id) u.id = Date.now().toString() + Math.random().toString(); });

const statusOptions = [
  { value: 'inquarters', label: 'In Quarters', class: 'status-inquarters' },
  { value: 'available', label: 'Available', class: 'status-available' },
  { value: 'enroute', label: 'En Route', class: 'status-enroute' },
  { value: 'onscene', label: 'On Scene', class: 'status-onscene' },
  { value: 'oos', label: 'Out of Service', class: 'status-oos' }
];

// 1. INITIAL LOAD & CHECK CACHE
window.addEventListener('load', () => {
    const savedData = localStorage.getItem('dispatch_data');
    const savedName = localStorage.getItem('agency_name');
    const savedTime = localStorage.getItem('last_sync_time');
    
    if (savedData && savedName) {
        currentAgencyData = JSON.parse(savedData);
        renderApp(savedName, savedTime);
    }

    window.addEventListener('online', updateNetworkStatusIndicator);
    window.addEventListener('offline', updateNetworkStatusIndicator);
});

// 2. LOGIN / SYNC HANDLER
async function handleLogin() {
    const key = keyInput.value.trim().toLowerCase();
    if (!key) { alert("Please enter a valid key."); return; }

    try {
        const indexRes = await fetch(INDEX_FILE);
        if (!indexRes.ok) throw new Error("Could not load agencies.json");
        
        const validAgencies = await indexRes.json();
        const agencyMatch = validAgencies.find(a => a.key === key);

        if (!agencyMatch) { alert("Invalid Agency Key. Access Denied."); return; }

        const dataRes = await fetch(`${DATA_FOLDER}${key}.json`);
        if (!dataRes.ok) throw new Error(`Data file for ${key} not found.`);
        
        const data = await dataRes.json();
        const syncTime = new Date().toLocaleString();
        
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

// 3. RENDER FUNCTION
function renderApp(name, syncTime) {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    agencyDisplay.innerText = name;

    if(syncTime) {
        syncTimeNote.style.display = 'block';
        syncTimeText.innerText = `Last Data Sync: ${syncTime}`;
    }
        
    updateNetworkStatusIndicator();
    
    // Initialize Status Board upon successful access
    renderBoard();
}

function updateNetworkStatusIndicator() {
    const badge = document.getElementById('network-badge');
    const dot = document.getElementById('network-dot');
    const text = document.getElementById('network-text');
    const appCard = document.getElementById('main-app-card');
    
    if (!badge || !dot || !text) return;

    if (navigator.onLine) {
        if (appCard) appCard.style.borderColor = 'var(--border-color)';
        badge.className = 'sync-badge online-mode';
        dot.className = 'badge-dot online-dot';
        text.innerText = "Live Server Link Active";
    } else {
        if (appCard) appCard.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.className = 'sync-badge offline-mode';
        dot.className = 'badge-dot offline-dot';
        text.innerHTML = "⚠️ PRIMARY LINK DROPPED - Local Cache Active";
    }
}

// 4. AUTOCOMPLETE SEARCH LOGIC
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const query = this.value.toUpperCase().trim();
        closeAllLists();
        if (!query) return; 
        currentFocus = -1;

        const matches = currentAgencyData.plans.filter(p => p.determinant.toUpperCase().startsWith(query)).slice(0, 10);
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

function selectCode(item) {
    searchInput.value = item.determinant;
    closeAllLists();
    let rows = '';
    for (const [name, res] of Object.entries(item.agencies)) {
        const color = (currentAgencyData.theme && currentAgencyData.theme[name]) ? currentAgencyData.theme[name] : '#3b82f6';
        rows += `<div class="agency-row"><strong style="color:${color}">${name}</strong><span>${res}</span></div>`;
    }
    const savedTime = localStorage.getItem('last_sync_time');
    const systemOfflineText = !navigator.onLine ? ' | Operating via Offline Fallback Cache' : '';

    activeResult.innerHTML = `
        <div class="result-item">
            <span class="level-badge">${item.level}</span>
            <div class="determinant-title">${item.determinant} - ${item.description}</div>
            <div class="agency-list">${rows}</div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                <span style="font-size: 0.65rem; color: #4b5563;">Verified Data Sync: ${savedTime}${systemOfflineText}</span>
            </div>
        </div>`;
}

// 5. STATUS BOARD LOGIC
function saveBoardData() {
  localStorage.setItem('localDispatchUnits', JSON.stringify(units));
  localStorage.setItem('localDispatchIncidents', JSON.stringify(incidents));
}

let dragSrcIndex = null;
let dragType = null;

function handleDragStart(e, index, type) {
  dragSrcIndex = index;
  dragType = type;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
function handleDragEnter(e) { if (e.target.classList.contains('board-card-item')) e.target.classList.add('drag-over'); }
function handleDragLeave(e) { if (e.target.classList.contains('board-card-item')) e.target.classList.remove('drag-over'); }

function handleDrop(e, targetIndex, targetType) {
  e.stopPropagation(); e.preventDefault();
  document.querySelectorAll('.board-card-item').forEach(c => c.classList.remove('drag-over'));
  if (dragType !== targetType || dragSrcIndex === null || dragSrcIndex === targetIndex) return false;

  const list = targetType === 'unit' ? units : incidents;
  const draggedItem = list.splice(dragSrcIndex, 1)[0];
  list.splice(targetIndex, 0, draggedItem);
  saveBoardData(); renderBoard(); return false;
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.board-card-item').forEach(c => c.classList.remove('drag-over'));
}

function addIncident() {
  const typeInput = document.getElementById('new-inc-type');
  const locInput = document.getElementById('new-inc-loc');
  const type = typeInput.value.trim();
  const loc = locInput.value.trim();
  
  if (type && loc) {
    incidents.push({ id: Date.now().toString(), type: type, location: loc });
    typeInput.value = ''; locInput.value = '';
    saveBoardData(); renderBoard();
  }
}

function deleteIncident(id) {
  if(confirm("Clear this incident? Units will automatically be unassigned.")) {
    incidents = incidents.filter(inc => inc.id !== id);
    units.forEach(unit => { if (unit.incidentId === id) unit.incidentId = null; });
    saveBoardData(); renderBoard();
  }
}

function addUnit() {
  const input = document.getElementById('new-unit-name');
  const unitName = input.value.trim().toUpperCase();
  
  if (unitName) {
    units.push({ id: Date.now().toString(), name: unitName, status: 'inquarters', incidentId: null });
    input.value = ''; saveBoardData(); renderBoard();
  }
}

window.updateUnitStatus = function(id, newStatus) {
  const unit = units.find(u => u.id === id);
  if(unit) { 
    unit.status = newStatus; 
    if (newStatus === 'available' || newStatus === 'inquarters') unit.incidentId = null;
    saveBoardData(); renderBoard(); 
  }
}

window.assignUnit = function(unitId, incidentId) {
  const unit = units.find(u => u.id === unitId);
  if(unit) { 
    unit.incidentId = incidentId || null; 
    if (incidentId) unit.status = 'enroute';
    saveBoardData(); renderBoard(); 
  }
}

window.removeUnit = function(id) {
  if(confirm("Remove this unit from the roster?")) {
    units = units.filter(u => u.id !== id);
    saveBoardData(); renderBoard();
  }
}

function renderBoard() {
  const incGrid = document.getElementById('incident-grid');
  const unitGrid = document.getElementById('unit-grid');
  if(!incGrid || !unitGrid) return; // Prevent rendering if elements aren't present
  
  incGrid.innerHTML = ''; unitGrid.innerHTML = '';

  if(incidents.length === 0) {
    incGrid.innerHTML = '<p style="color: #64748b; font-style: italic; margin: 0;">No active incidents.</p>';
  } else {
    incidents.forEach((inc, index) => {
      const assignedUnits = units.filter(u => u.incidentId === inc.id);
      const badgesHtml = assignedUnits.length > 0 
        ? assignedUnits.map(u => `<span class="unit-badge">${u.name}</span>`).join('')
        : '<span style="color:#64748b; font-size:0.85rem;">No units assigned</span>';

      const card = document.createElement('div');
      card.className = 'board-card-item incident-card';
      card.setAttribute('draggable', true);
      
      card.addEventListener('dragstart', (e) => handleDragStart(e, index, 'incident'));
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('dragenter', handleDragEnter);
      card.addEventListener('dragleave', handleDragLeave);
      card.addEventListener('drop', (e) => handleDrop(e, index, 'incident'));
      card.addEventListener('dragend', handleDragEnd);

      card.innerHTML = `
        <div class="card-header">
          <div>
            <h4 class="card-title">${inc.type}</h4>
            <p class="card-subtitle">📍 ${inc.location}</p>
          </div>
          <button class="delete-btn" onclick="deleteIncident('${inc.id}')" title="Clear Incident">&times;</button>
        </div>
        <div class="assigned-units-list">${badgesHtml}</div>
      `;
      incGrid.appendChild(card);
    });
  }

  units.forEach((unit, index) => {
    const currentStatus = statusOptions.find(opt => opt.value === unit.status) || statusOptions[0];
    let statusOptionsHtml = statusOptions.map(opt => `<option value="${opt.value}" ${unit.status === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
    let assignOptionsHtml = `<option value="">-- Unassigned --</option>`;
    incidents.forEach(inc => { assignOptionsHtml += `<option value="${inc.id}" ${unit.incidentId === inc.id ? 'selected' : ''}>${inc.type} @ ${inc.location}</option>`; });

    const card = document.createElement('div');
    card.className = 'board-card-item unit-card';
    card.setAttribute('draggable', true);
    
    card.addEventListener('dragstart', (e) => handleDragStart(e, index, 'unit'));
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', (e) => handleDrop(e, index, 'unit'));
    card.addEventListener('dragend', handleDragEnd);

    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${unit.name}</span>
        <button class="delete-btn" onclick="removeUnit('${unit.id}')" title="Remove Unit">&times;</button>
      </div>
      <select class="status-select ${currentStatus.class}" onchange="updateUnitStatus('${unit.id}', this.value)">${statusOptionsHtml}</select>
      <span class="assign-label">Assigned To:</span>
      <select class="incident-assign" onchange="assignUnit('${unit.id}', this.value)">${assignOptionsHtml}</select>
    `;
    unitGrid.appendChild(card);
  });
}

// 6. HELPERS
function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add("autocomplete-active");
}

function removeActive(items) { for (let i = 0; i < items.length; i++) items[i].classList.remove("autocomplete-active"); }
function closeAllLists() { autocompleteList.innerHTML = ''; }

function logout() {
    if(confirm("Logout and clear offline cache?")) {
        localStorage.clear();
        location.reload();
    }
}

// ATTACH EVENT LISTENERS
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
document.addEventListener('click', (e) => { if (e.target !== searchInput) closeAllLists(); });
document.addEventListener('keypress', (e) => {
  if (e.target.id === 'new-unit-name' && e.key === 'Enter') addUnit();
  if (e.target.id === 'new-inc-loc' && e.key === 'Enter') addIncident();
});