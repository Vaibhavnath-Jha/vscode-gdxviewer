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
            'Parsed Data Viewer',
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

function getWebviewContent(data: any): string {
  const dataString = JSON.stringify(data).replace(/</g, '\\u003c');
  const categoryKeys = Object.keys(data || {});

  return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VSCode Tables</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      display: flex;
      height: 100vh;
      background: #1e1e1e;
      color: #e7e7e7;
    }
    .sidebar {
		width: 238px;
		background: #191d20;
		color: #dde2ee;
		box-sizing: border-box;
		border-right: 1px solid #22252b;
		display: flex;
		flex-direction: column;
		padding-top: 0.7em;
		/** NEW/EDITED: **/
		height: 100vh;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative; /* Optional for compatibility */
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
      background: #23293c;
      color: #fff;
    }
    .category:focus { outline: 2px solid #446ff2; }
    .cat-icon {
      font-size: 1em;
      transition: transform 0.15s;
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
      color: #c8d3f6;
      background: none;
      transition: background 0.1s, color 0.15s;
    }
    .table-li.selected, .table-li:hover {
      background: #446ff2;
      color: #fff;
    }
    .none-li {
      color: #888ea8;
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
      background: #23293c;
      color: #e5e8ee;
      border-radius: 7px 7px 6px 6px;
      overflow: hidden;
      box-shadow: 0 2px 7px #0003, 0 0px 0 #2226;
    }
    th, td {
      border: 1px solid #262c33;
      padding: 0.40em 0.77em;
      font-size: 1.05em;
      text-align: left;
      border-top: none;
      border-left: none;
    }
    th {
      background: #3c4760;
      font-weight: bold;
      color: #fff;
      border-bottom: 2px solid #446ff2;
    }
    tr:nth-child(even) td {
      background: #22252b;
    }
    .nodata {
      margin: 1.7em 1em 0 2.4em;
      color: #ccc;
      font-size: 1.13em;
      font-style: italic;
    }
    @media (max-width: 700px) {
      body { flex-direction: column; }
      .sidebar { width: 99vw; flex-direction: row; border-bottom: 1px solid #23293c; border-right: none; }
      .container { padding: 1.1em 3vw; }
    }
  </style>
</head>
<body>
  <aside class="sidebar" id="sidebar"></aside>
  <main class="container">
    <div id="table-container">
      <div class="nodata">Select a table from a category in the sidebar</div>
    </div>
  </main>
  <script>
    const data = ${dataString};
    const categories = Object.keys(data);
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
  </script>
</body>
</html>
  `;
}
