import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gdx.Display', async (resource: vscode.Uri) => {
      const pythonPath = await vscode.commands.executeCommand<string>(
        'python.interpreterPath',
        { workspaceFolder: vscode.workspace.workspaceFolders?.[0] }
      );

      const scriptPath = path.join(context.extensionPath, 'scripts', 'readgdx.py');

      let fileToParse: string | undefined = resource?.fsPath;
      if (!fileToParse) {
        fileToParse = await vscode.window.showInputBox({ prompt: "Path to .gdx file" });
        if (!fileToParse) {
          vscode.window.showWarningMessage('No file path provided.');
          return;
        }
      }

      if (pythonPath) {
        checkPythonLibrary(pythonPath, "gams")
          .then(() => {
            // Do nothing if exists
          })
          .catch(err => {
            vscode.window.showWarningMessage(
              `The Python library "gams" is not installed in the selected Python interpreter.\n` +
              `Please install it (e.g., using 'pip install gams') and try again.\n\nDetails: ${err.message || err}`
            );
          });

        execFile(pythonPath, [scriptPath, fileToParse], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            vscode.window.showErrorMessage(`Error: ${stderr || error.message}`);
            return;
          }
          let parsedData;
          try {
            parsedData = JSON.parse(stdout);
          } catch {
            vscode.window.showErrorMessage('Failed to parse Python output as JSON.');
            return;
          }

          // Show the webview panel
          const panel = vscode.window.createWebviewPanel(
            'parsedDataView',
            path.basename(fileToParse),
            vscode.ViewColumn.One,
            { enableScripts: true }
          );

          // Passing the data to webview (as JSON string)
          panel.webview.html = getWebviewContent(parsedData);
        });
      } else {
        vscode.window.showErrorMessage(
          "Python interpreter is not set. Please select a Python interpreter before running the script."
        );
        throw new Error("Python interpreter path is not set.");
      }
    })
  );
}

function checkPythonLibrary(pythonPath: string, libName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = [
      '-c',
      `import importlib.util; exit(0) if importlib.util.find_spec('${libName}') else exit(1)`
    ];
    execFile(pythonPath, cmd, (error) => {
      if (error) {
        reject(new Error(`Python library "${libName}" not found at ${pythonPath}`));
      } else {
        resolve();
      }
    });
  });
}

function getWebviewContent(data: any): string {
  const dataString = JSON.stringify(data).replace(/</g, '\\u003c');

  const css = /*css*/ `
  :root {
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

    body {
      font-family: system-ui, sans-serif;
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
      margin: 1.7em 1em 0 2.4em;
      color: var(--nodata-fg);
      font-size: 1.13em;
      font-style: italic;
    }
    @media (max-width: 700px) {
      body { flex-direction: column; }
      .sidebar { width: 99vw; flex-direction: row; border-bottom: 1px solid var(--table-bg); border-right: none; }
      .container { padding: 1.1em 3vw; }
    }
  `;

  const js = /*javascript*/ `
  const data = ${dataString};
    const categories = Object.keys(data || {});
    let expandedCats = {};
    let selectedCat = null;
    let selectedTable = null;

    function renderSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.innerHTML = '';
      categories.forEach(cat => {
        const tablesObj = data[cat];
        const catBtn = document.createElement('button');
        catBtn.className = 'category' +
          (expandedCats[cat] ? ' expanded' : '') +
          (selectedCat === cat ? ' selected' : '');
        catBtn.setAttribute('tabindex', '0');
        catBtn.dataset.cat = cat;
        catBtn.innerHTML = \`
          <span>\${cat}</span>
          <span class="cat-icon\${expandedCats[cat] ? ' expanded' : ''}">&#9654;</span>
        \`;

        sidebar.appendChild(catBtn);

        if (expandedCats[cat]) {
          if (!tablesObj || (typeof tablesObj === "object" && Object.keys(tablesObj).length === 0)) {
            const li = document.createElement('div');
            li.className = 'none-li';
            li.textContent = 'None';
            sidebar.appendChild(li);
          } else {
            const list = document.createElement('ul');
            list.className = 'tables-list';
            Object.keys(tablesObj).forEach(tname => {
              const tli = document.createElement('li');
              tli.className = 'table-li' +
                ((selectedCat === cat && selectedTable === tname) ? ' selected' : '');
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
      if (!obj) return '';
      // Array of objects:
      if (Array.isArray(obj) && obj.length && typeof obj[0] === 'object') {
        const columns = Array.from(new Set(obj.flatMap(o => Object.keys(o))));
        let thead = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
        let tbody = obj.map(row =>
          '<tr>' + columns.map(col => '<td>' + (row[col] ?? "") + '</td>').join('') + '</tr>'
        ).join('');
        return '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
      }
      // Object of arrays:
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const columns = Object.keys(obj);
        const length = obj[columns[0]]?.length ?? 0;
        if (columns.every(k => Array.isArray(obj[k]) && obj[k].length === length)) {
          let thead = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
          let tbody = '';
          for (let i = 0; i < length; ++i)
            tbody += '<tr>' + columns.map(k => '<td>' + (obj[k][i] ?? "") + '</td>').join('') + '</tr>';
          return '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
        }
      }
      // Fallback
      return '<div class="nodata">This table has no data.</div>';
    }

    function updateView() {
      renderSidebar();
      const container = document.getElementById('table-container');
      if (selectedCat && selectedTable) {
        const td = data[selectedCat]?.[selectedTable];
        container.innerHTML = renderTable(td) || '<div class="nodata">This table has no data.</div>';
      } else {
        container.innerHTML = '<div class="nodata">Select a table from a category in the sidebar</div>';
      }
    }

    // Handle sidebar clicks
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('category')) {
        const cat = e.target.dataset.cat;
        expandedCats[cat] = !expandedCats[cat];
        selectedCat = cat;
        selectedTable = null;
        updateView();
      } else if (e.target.classList.contains('table-li')) {
        selectedCat = e.target.dataset.cat;
        selectedTable = e.target.dataset.tname;
        updateView();
      }
    });

    // Keyboard accessibility for categories
    document.addEventListener('keydown', function(e) {
      if (e.target.classList.contains('category') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.target.click();
      }
    });

    // Initial render:
    updateView();
  `;

  return /*html*/ `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VSCode Tables</title>
    <style>${css}</style>
  </head>
  <body>
    <aside class="sidebar" id="sidebar"></aside>
    <main class="container">
      <div id="table-container">
        <div class="nodata">Select a table from a category in the sidebar</div>
      </div>
    </main>
    <script>${js}</script>
  </body>
  </html>
  `;
}

