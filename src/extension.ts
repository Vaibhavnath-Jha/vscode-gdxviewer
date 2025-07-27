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
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')]
        }
      );

      panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

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

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // for security
  const nonce = getNonce();

  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'main.js'));
  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'styles.css'));

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      
      <title>GDX Viewer</title>
      <link href="${stylesUri}" rel="stylesheet" />
    </head>
    <body>
      <aside class="sidebar" id="sidebar"></aside>
      <main class="container">
        <div id="table-container">
          <div class="nodata">Fetching symbol index...</div>
        </div>
      </main>
      
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}