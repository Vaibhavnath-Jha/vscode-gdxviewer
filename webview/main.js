const vscode = acquireVsCodeApi();
let symbolIndex = {};
let symbolDataCache = {}; // Cache for loaded symbol data
let categories = [];
let expandedCats = {};
let selectedCat = null;
let selectedTable = null;

function symbolSearch(term) {
    const search = term.toLowerCase();
    let found = false;
    expandedCats = {};
    selectedCat = null;
    selectedTable = null;

    for (let cat of categories) {
        const tables = symbolIndex[cat] || [];
        for (let tname of tables) {
            if (tname.toLowerCase() === search) {
                expandedCats[cat] = true;
                selectedCat = cat;
                selectedTable = tname;
                found = true;
                break;
            }
        }
        if (found) break;
    }
    if (found) {
        // Check cache before fetching
        if (symbolDataCache[selectedTable]) {
            updateView(symbolDataCache[selectedTable]);
        } else {
            vscode.postMessage({ command: 'getSymbol', symbolName: selectedTable });
            updateView('Loading data...');
        }
    } else {
        updateView("Symbol not found");
    }
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';
    categories.forEach(cat => {
        const tables = symbolIndex[cat] || [];
        const catBtn = document.createElement('button');
        catBtn.className = 'category' + (expandedCats[cat] ? ' expanded' : '') + (selectedCat === cat ? ' selected' : '');
        catBtn.dataset.cat = cat;
        catBtn.innerHTML = `<span>${cat}</span><span class="cat-icon${expandedCats[cat] ? ' expanded' : ''}">&#9654;</span>`;
        sidebar.appendChild(catBtn);

        if (expandedCats[cat]) {
            if (tables.length === 0) {
                const li = document.createElement('div');
                li.className = 'none-li';
                li.textContent = 'None';
                sidebar.appendChild(li);
            } else {
                const list = document.createElement('ul');
                list.className = 'tables-list';
                tables.forEach(tname => {
                    const tli = document.createElement('li');
                    tli.className = 'table-li' + ((selectedCat === cat && selectedTable === tname) ? ' selected' : '');
                    tli.textContent = tname;
                    tli.dataset.cat = cat;
                    tli.dataset.tname = tname;
                    list.appendChild(tli);
                });
                sidebar.appendChild(list);
            }
        }
    });
}

function renderTable(obj) {
    if (!obj || (Array.isArray(obj) && obj.length === 0)) {
        return '<div class="nodata">This symbol has no data records.</div>';
    }
    if (Array.isArray(obj) && obj.length && typeof obj[0] === 'object') {
        const columns = Array.from(new Set(obj.flatMap(o => Object.keys(o))));
        let thead = '<tr>' + columns.map(col => `<th>${col}</th>`).join('') + '</tr>';
        let tbody = obj.map(row => '<tr>' + columns.map(col => `<td>${row[col] ?? ""}</td>`).join('') + '</tr>').join('');
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    }
    return '<div class="nodata">Data is not in a recognizable table format.</div>';
}

function updateView(content) {
    renderSidebar();
    const container = document.getElementById('table-container');
    let searchInputHTML = `<input id="symbol-search" type="search" placeholder="Search for a symbol" class="symbol-search" autocomplete="off" />`;

    if (typeof content === 'string') {
        container.innerHTML = searchInputHTML + `<div class="nodata">${content}</div>`;
    } else if (typeof content === 'object') {
        container.innerHTML = searchInputHTML + renderTable(content);
    }

    const searchInput = document.getElementById('symbol-search');
    if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                const term = searchInput.value.trim();
                if (term) symbolSearch(term);
            }
        });
    }
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'initialize':
            symbolIndex = message.data;
            categories = Object.keys(symbolIndex || {});
            updateView('Select a symbol from the sidebar to view its data.');
            break;
        case 'displaySymbolData':
            // When data is received, cache it and then display it
            if (selectedTable) {
                symbolDataCache[selectedTable] = message.data;
            }
            updateView(message.data);
            break;
    }
});

// Handle sidebar clicks
document.addEventListener('click', function (e) {
    const target = e.target;
    if (target.classList.contains('category')) {
        const cat = target.dataset.cat;
        expandedCats[cat] = !expandedCats[cat];
        selectedCat = cat;
        selectedTable = null;
        updateView('Select a symbol from this category.');
    } else if (target.classList.contains('table-li')) {
        selectedCat = target.dataset.cat;
        selectedTable = target.dataset.tname;

        // Check cache first
        if (symbolDataCache[selectedTable]) {
            updateView(symbolDataCache[selectedTable]);
        } else {
            // Not in cache, so request data from the extension
            vscode.postMessage({ command: 'getSymbol', symbolName: selectedTable });
            updateView('Loading data...');
        }
    }
});