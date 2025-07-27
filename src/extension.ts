import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// A map to hold the state for each open GDX file view
interface GdxViewState {
  panel: vscode.WebviewPanel;
  // The persistent interactive process, created on the first data request
  interactiveProcess: ChildProcessWithoutNullStreams | null;
}
const gdxViewStates = new Map<string, GdxViewState>();

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gdx.Display', async (resource: vscode.Uri) => {
      let fileToParse: string | undefined = resource?.fsPath;
      if (!fileToParse) {
        const uris = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: "Select GDX File" });
        if (uris && uris.length > 0) {
          fileToParse = uris[0].fsPath;
        }
      }

      if (!fileToParse) {
        vscode.window.showInformationMessage('No GDX file was selected.');
        return;
      }

      // If a panel for this file already exists, just reveal it.
      if (gdxViewStates.has(fileToParse)) {
        gdxViewStates.get(fileToParse)?.panel.reveal(vscode.ViewColumn.One);
        return;
      }

      let pythonPath: string;
      try {
        pythonPath = await getPythonPath();
        await checkGAMSpackage(pythonPath, "gams");
      } catch (err: any) {
        vscode.window.showErrorMessage(err.message);
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'gdxDataView',
        path.basename(fileToParse),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.html = getWebviewContent("Fetching symbol index...");

      const currentState: GdxViewState = { panel, interactiveProcess: null };
      gdxViewStates.set(fileToParse, currentState);

      // Fetch symbol names
      const scriptPath = path.join(context.extensionPath, 'scripts', 'readgdx.py');
      const indexProcess = spawn(pythonPath, [scriptPath, fileToParse]);

      let stdoutBuffer = '';
      indexProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
      });

      let stderrBuffer = '';
      indexProcess.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
      });

      indexProcess.on('close', (code) => {
        if (panel.visible === false) return; // Don't do anything if panel was closed
        if (code === 0) {
          try {
            const indexData = JSON.parse(stdoutBuffer);
            panel.webview.postMessage({ command: 'initialize', data: indexData });
          } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to parse symbol index from Python script. Error: ${e.message}. Output: ${stdoutBuffer}`);
          }
        } else {
          vscode.window.showErrorMessage(`Failed to get symbol index. Python script exited with code ${code}. Stderr: ${stderrBuffer}`);
        }
      });

      // Fetch symbol data on request from the webview
      panel.webview.onDidReceiveMessage(async (message: any) => {
        if (message.command === 'getSymbol') {
          const state = gdxViewStates.get(fileToParse!);
          if (!state) return;

          if (!state.interactiveProcess || state.interactiveProcess.killed) {
            try {
              const scriptPath = path.join(context.extensionPath, 'scripts', 'readgdx.py');
              const newProcess = spawn(pythonPath, [scriptPath, fileToParse!, '--interactive']);
              state.interactiveProcess = newProcess;

              let buffer = '';
              newProcess.stdout.on('data', (data) => {
                buffer += data.toString();
                let boundary = buffer.indexOf('\n');
                while (boundary !== -1) {
                  const messageChunk = buffer.substring(0, boundary);
                  buffer = buffer.substring(boundary + 1);
                  try {
                    const symbolData = JSON.parse(messageChunk);
                    panel.webview.postMessage({ command: 'displaySymbolData', data: symbolData });
                  } catch (e: any) {
                    vscode.window.showErrorMessage(`Failed to parse symbol data: ${e.message}. Raw data: ${messageChunk}`);
                  }
                  boundary = buffer.indexOf('\n');
                }
              });

              newProcess.stderr.on('data', (data) => {
                vscode.window.showErrorMessage(`Error from GDX script: ${data}`);
              });

              newProcess.on('close', () => {
                if (gdxViewStates.has(fileToParse!)) {
                  gdxViewStates.get(fileToParse!)!.interactiveProcess = null;
                }
              });
            } catch (err: any) {
              vscode.window.showErrorMessage(err.message);
              return;
            }
          }
          // Whether the process is new or existing, send it the symbol name
          state.interactiveProcess.stdin.write(`${message.symbolName}\n`);
        }
      });

      panel.onDidDispose(() => {
        const state = gdxViewStates.get(fileToParse!);
        if (state && state.interactiveProcess) {
          state.interactiveProcess.kill();
        }
        gdxViewStates.delete(fileToParse!);
      }, null, context.subscriptions);
    })
  );
}

async function getPythonPath(): Promise<string> {
  const pythonExtension = vscode.extensions.getExtension('ms-python.python');
  if (!pythonExtension) {
    throw new Error("The Python extension ('ms-python.python') is not installed or enabled. Please install it to proceed.");
  }
  if (!pythonExtension.isActive) {
    await pythonExtension.activate();
  }

  const pythonPath = await vscode.commands.executeCommand<string>(
    'python.interpreterPath', { workspaceFolder: vscode.workspace.workspaceFolders?.[0] }
  );
  if (pythonPath) {
    return pythonPath;
  }
  throw new Error("Python interpreter is not set. Please select a Python interpreter using the 'Python: Select Interpreter' command.");
}

function checkGAMSpackage(pythonPath: string, libName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ['-c', `import importlib.util; exit(0) if importlib.util.find_spec('${libName}') else exit(1)`];
    spawn(pythonPath, cmd).on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Required Python library not found: '${libName}'. Please install it (e.g., 'pip install ${libName}') in the selected interpreter.`));
      } else {
        resolve();
      }
    });
  });
}


function getWebviewContent(message: string = 'Select a symbol from the sidebar to view its data.'): string {
  const css = /*css*/ `
  :root {
      font-family: system-ui, sans-serif;
      margin: 0;
    }
    body.vscode-dark {
      --background: var(--vscode-editor-background, #1e1e1e);
      --sidebar-bg: var(--vscode-sideBar-background, #191d20);
      --sidebar-border: var(--vscode-sideBar-border, #22252b);
      --sidebar-fg: var(--vscode-sideBar-foreground, #dde2ee);
      --category-bg-selected: var(--vscode-list-activeSelectionBackground, #23293c);
      --category-fg-selected: var(--vscode-list-activeSelectionForeground, #fff);
      --category-outline: var(--vscode-focusBorder, #446ff2);
      --cat-icon-fg: var(--vscode-foreground, #dde2ee);
      --table-bg: var(--vscode-editorGroupHeader-tabsBackground, #23293c);
      --table-border: var(--vscode-input-border, #262c33);
      --table-header-bg: var(--vscode-tab-activeBackground, #3c4760);
      --table-header-fg: var(--vscode-tab-activeForeground, #fff);
      --table-row-bg-alt: var(--vscode-list-inactiveSelectionBackground, #22252b);
      --nodata-fg: var(--vscode-descriptionForeground, #ccc);
      --table-li-hover-bg: var(--vscode-list-hoverBackground, #446ff2);
      --table-li-hover-fg: var(--vscode-list-hoverForeground, #fff);
      --container-fg: var(--vscode-editor-foreground, #e7e7e7);
      --none-li-fg: var(--vscode-disabledForeground, #888ea8);
    }
    body.vscode-light {
      --background: var(--vscode-editor-background, #fff);
      --sidebar-bg: var(--vscode-sideBar-background, #f7f7f7);
      --sidebar-border: var(--vscode-sideBar-border, #ddd);
      --sidebar-fg: var(--vscode-sideBar-foreground, #222); /* Corrected font color source */
      --category-bg-selected: var(--vscode-list-activeSelectionBackground, #e6f0ff);
      --category-fg-selected: var(--vscode-list-activeSelectionForeground, #222);
      --category-outline: var(--vscode-focusBorder, #3399ff);
      --cat-icon-fg: var(--vscode-foreground, #222);
      --table-bg: var(--vscode-editorGroupHeader-tabsBackground, #fff);
      --table-border: var(--vscode-input-border, #d0d0d0);
      --table-header-bg: var(--vscode-tab-activeBackground, #e8eef6);
      --table-header-fg: var(--vscode-tab-activeForeground, #222);
      --table-row-bg-alt: var(--vscode-list-inactiveSelectionBackground, #f3f6fa);
      --nodata-fg: var(--vscode-descriptionForeground, #888);
      --table-li-hover-bg: var(--vscode-list-hoverBackground, #3399ff33);
      --table-li-hover-fg: var(--vscode-list-hoverForeground, #222);
      --container-fg: var(--vscode-editor-foreground, #222);
      --none-li-fg: var(--vscode-disabledForeground, #bbb);
    }
    body.vscode-high-contrast {
      --background: var(--vscode-editor-background, #000);
      --sidebar-bg: var(--vscode-sideBar-background, #000);
      --sidebar-border: var(--vscode-sideBar-border, #fff);
      --sidebar-fg: var(--vscode-sideBar-foreground, #fff);
      --category-bg-selected: var(--vscode-list-activeSelectionBackground, #000);
      --category-fg-selected: var(--vscode-list-activeSelectionForeground, #fff);
      --category-outline: var(--vscode-focusBorder, #f38518);
      --cat-icon-fg: var(--vscode-foreground, #fff);
      --table-bg: var(--vscode-editorGroupHeader-tabsBackground, #000);
      --table-border: var(--vscode-input-border, #fff);
      --table-header-bg: var(--vscode-tab-activeBackground, #000);
      --table-header-fg: var(--vscode-tab-activeForeground, #fff);
      --table-row-bg-alt: var(--vscode-list-inactiveSelectionBackground, #000);
      --nodata-fg: var(--vscode-descriptionForeground, #fff);
      --table-li-hover-bg: var(--vscode-list-hoverBackground, #000);
      --table-li-hover-fg: var(--vscode-list-hoverForeground, #fff);
      --container-fg: var(--vscode-editor-foreground, #fff);
      --none-li-fg: var(--vscode-disabledForeground, #fff);
    }
    body {
      margin: 0;
      display: flex;
      height: 100vh;
      background: var(--background);
      color: var(--container-fg);
    }
    .sidebar {
      width: 238px;
      background: var(--sidebar-bg);
      color: var(--sidebar-fg);
      box-sizing: border-box;
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      padding-top: 0.7em;
      height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      position: relative;
      scrollbar-gutter: stable;
    }
    .category {
      user-select: none;
      padding: 0.67em 1.2em 0.67em 1.2em;
      margin: 0;
      font-size: 1.06em;
      font-weight: 520;
      letter-spacing: 0.01em;
      cursor: pointer;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      outline: none;
      transition: background 0.12s;
      border-radius: 3px;
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .category.selected, .category.expanded {
      background: var(--category-bg-selected);
      color: var(--category-fg-selected);
    }
    .category:focus { outline: 2px solid var(--category-outline); }
    .cat-icon {
      font-size: 1em;
      transition: transform 0.15s;
      color: var(--cat-icon-fg);
    }
    .cat-icon.expanded {
      transform: rotate(90deg);
    }
    .tables-list {
      list-style: none;
      margin: 0;
      padding: 0 0 0 1.6em;
      background: none;
    }
    .table-li {
      padding: 0.48em 0.8em;
      margin: 0;
      font-size: 0.99em;
      border-radius: 3px;
      cursor: pointer;
      color: var(--sidebar-fg);
      background: none;
      transition: background 0.1s, color 0.15s;
    }
    .table-li.selected,
    .table-li:hover {
      background: var(--table-li-hover-bg);
      color: var(--table-li-hover-fg);
    }
    .none-li {
      color: var(--none-li-fg);
      padding: 0.4em 1.7em 0.5em 1.6em;
      font-size: 0.95em;
      font-style: italic;
    }
    .container {
      flex: 1;
      overflow: auto;
      padding: 2.2em 2.6em;
    }
    table {
      border-collapse: collapse;
      margin-bottom: 2em;
      min-width: 320px;
      background: var(--table-bg);
      color: var(--container-fg);
      border-radius: 7px 7px 6px 6px;
      overflow: hidden;
      box-shadow: 0 2px 7px #0003, 0 0px 0 #2226;
    }
    th, td {
      border: 1px solid var(--table-border);
      padding: 0.40em 0.77em;
      font-size: 1.05em;
      text-align: left;
      border-top: none;
      border-left: none;
    }
    th {
      background: var(--table-header-bg);
      font-weight: bold;
      color: var(--table-header-fg);
      border-bottom: 2px solid var(--table-li-hover-bg);
    }
    tr:nth-child(even) td {
      background: var(--table-row-bg-alt);
    }
    .nodata {
      margin: 0 0 1.8em 0;
      color: var(--nodata-fg);
      font-size: 1.13em;
      font-style: italic;
    }
    @media (max-width: 700px) {
      body { flex-direction: column; }
      .sidebar { width: 99vw; flex-direction: row; border-bottom: 1px solid var(--table-bg); border-right: none; }
      .container { padding: 1.1em 3vw; }
      .symbol-search { width: 98%; max-width: 350px;}
    }
    .symbol-search {
      width: 260px;
      padding: 0.47em 0.8em;
      margin: 0 0 1.8em 0;
      font-size: 1.06em;
      background: var(--background);
      border: 1.3px solid var(--table-border);
      color: var(--container-fg);
      border-radius: 5px;
      outline: none;
      transition: border-color 0.1s;
      display: block;
    }
    .symbol-search:focus {
      border-color: var(--category-outline);
    }
  `;

  const js = /*javascript*/ `
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
        catBtn.innerHTML = \`<span>\${cat}</span><span class="cat-icon\${expandedCats[cat] ? ' expanded' : ''}">&#9654;</span>\`;
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
        let thead = '<tr>' + columns.map(col => \`<th>\${col}</th>\`).join('') + '</tr>';
        let tbody = obj.map(row => '<tr>' + columns.map(col => \`<td>\${row[col] ?? ""}</td>\`).join('') + '</tr>').join('');
        return \`<table><thead>\${thead}</thead><tbody>\${tbody}</tbody></table>\`;
      }
      return '<div class="nodata">Data is not in a recognizable table format.</div>';
    }

    function updateView(content) {
      renderSidebar();
      const container = document.getElementById('table-container');
      let searchInputHTML = \`<input id="symbol-search" type="search" placeholder="Search for a symbol" class="symbol-search" autocomplete="off" />\`;
      
      if (typeof content === 'string') {
        container.innerHTML = searchInputHTML + \`<div class="nodata">\${content}</div>\`;
      } else if (typeof content === 'object') {
        container.innerHTML = searchInputHTML + renderTable(content);
      }

      const searchInput = document.getElementById('symbol-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('keydown', function(e) {
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
    document.addEventListener('click', function(e) {
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

    updateView("${message}");
  `;

  return /*html*/ `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GDX Viewer</title>
    <style>${css}</style>
  </head>
  <body>
    <aside class="sidebar" id="sidebar"></aside>
    <main class="container">
      <div id="table-container"></div>
    </main>
    <script>${js}</script>
  </body>
  </html>
  `;
}
