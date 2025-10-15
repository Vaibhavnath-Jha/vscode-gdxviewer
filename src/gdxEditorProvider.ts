import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { getWebviewContent } from './utils/webviewUtils';
import { getPythonPath, checkPrerequisites } from './utils/pythonUtils';

interface GdxViewState {
  interactiveProcess: ChildProcessWithoutNullStreams | null;
  indexData?: any;
  lastSelectedSymbol?: string;
}
const gdxViewStates = new Map<string, GdxViewState>();

class GdxDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) { }
  dispose(): void { }
}

export class GdxEditorProvider implements vscode.CustomEditorProvider<GdxDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<GdxDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) { }

  // --- Required stubs for the interface contract ---
  saveCustomDocument(doc: GdxDocument, cancel: vscode.CancellationToken): Thenable<void> { return Promise.resolve(); }
  saveCustomDocumentAs(doc: GdxDocument, dest: vscode.Uri, cancel: vscode.CancellationToken): Thenable<void> { return Promise.resolve(); }
  revertCustomDocument(doc: GdxDocument, cancel: vscode.CancellationToken): Thenable<void> { return Promise.resolve(); }
  backupCustomDocument(doc: GdxDocument, ctx: vscode.CustomDocumentBackupContext, cancel: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    return Promise.resolve({ id: ctx.destination.toString(), delete: () => { } });
  }

  public async openCustomDocument(uri: vscode.Uri): Promise<GdxDocument> {
    return new GdxDocument(uri);
  }

  public async resolveCustomEditor(
    document: GdxDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const fileToParse = document.uri.fsPath;

    // 1. Configure the Webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui')],
    };
    webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context.extensionUri);

    // 2. Set up state management and cleanup
    const currentState: GdxViewState = { interactiveProcess: null };
    gdxViewStates.set(fileToParse, currentState);

    // 3. Watch for file changes and re-initiate the state interactive process
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(document.uri, '*'));
    const changeSubscription = watcher.onDidChange(() => {
      webviewPanel.webview.postMessage({ command: 'fileUpdated' });
      const state = gdxViewStates.get(document.uri.fsPath);
      if (state?.interactiveProcess) {
        state.interactiveProcess.kill();
        state.interactiveProcess = null;
      }
      this.fetchAndSendIndexData(document, webviewPanel);
    });

    webviewPanel.onDidDispose(() => {
      currentState.interactiveProcess?.kill();
      gdxViewStates.delete(fileToParse);
      changeSubscription.dispose();
      watcher.dispose();
    });

    // 4. Get the categories and initial view
    this.fetchAndSendIndexData(document, webviewPanel);

    // 5. Start the interactive process when a symbol is selected
    webviewPanel.webview.onDidReceiveMessage(async (message: any) => {
      const state = gdxViewStates.get(fileToParse);
      if (!state) { return; }

      switch (message.command) {
        case 'getSymbol': {
          let pythonPath: string;
          try {
            pythonPath = await getPythonPath();
          } catch (err: any) {
            vscode.window.showErrorMessage(err.message);
            return;
          }
          const scriptPath = path.join(this.context.extensionPath, 'scripts', 'readgdx.py');

          if (!state.interactiveProcess || state.interactiveProcess.killed) {
            state.interactiveProcess = this.startInteractiveProcess(fileToParse, scriptPath, pythonPath, webviewPanel);
          }
          const params = { "symbolName": message.symbolName, "page": message.page, "rows": message.rows };
          state.interactiveProcess.stdin.write(JSON.stringify(params) + "\n");
          break;
        }
        case 'cacheState': {
          state.lastSelectedSymbol = message.selectedSymbol;
          break;
        }
      }
    });
  }

  // 6. Send the data to front-end app
  private async fetchAndSendIndexData(document: GdxDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    const fileToParse = document.uri.fsPath;
    const state = gdxViewStates.get(fileToParse);
    if (!state) return;

    let pythonPath: string;
    try {
      pythonPath = await getPythonPath();
      await checkPrerequisites(pythonPath);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
      webviewPanel.webview.html = `<h1>Error</h1><p>${err.message}</p>`;
      return;
    }
    const scriptPath = path.join(this.context.extensionPath, 'scripts', 'readgdx.py');
    const indexProcess = spawn(pythonPath, [scriptPath, fileToParse]);

    let stdoutBuffer = '';
    indexProcess.stdout.on('data', (data) => { stdoutBuffer += data.toString(); });
    indexProcess.stderr.on('data', (data) => { vscode.window.showErrorMessage(`${data}`); });

    indexProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const indexData = JSON.parse(stdoutBuffer);
          state.indexData = indexData;
          webviewPanel.webview.postMessage({
            command: 'initialize',
            data: indexData,
            lastSelectedSymbol: state.lastSelectedSymbol
          });
        } catch (e: any) {
          if (e instanceof SyntaxError) {
            vscode.window.showErrorMessage(`Failed to parse symbol index: ${e.message}. Raw: ${stdoutBuffer}`);
          } else {
            console.warn('Could not post message to a disposed webview:', e);
          }
        }
      }
    });
  }

  // 6. Request the symbol data from the backend Python process.
  private startInteractiveProcess(
    fileToParse: string,
    scriptPath: string,
    pythonPath: string,
    webviewPanel: vscode.WebviewPanel
  ): ChildProcessWithoutNullStreams {
    const process = spawn(pythonPath, [scriptPath, fileToParse, '--interactive']);

    let buffer = '';
    process.stdout.on('data', (data) => {
      buffer += data.toString();
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const messageChunk = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);
        try {
          const parsedOutput = JSON.parse(messageChunk);
          webviewPanel.webview.postMessage({
            command: 'displaySymbolData',
            data: parsedOutput.data,
            totalRecords: parsedOutput.total_records,
            symText: parsedOutput.sym_text,
          });
        } catch (e: any) {
          console.error(`Failed to parse symbol data: ${e.message}. Raw: ${messageChunk}`);
        }
        boundary = buffer.indexOf('\n');
      }
    });

    process.stderr.on('data', (data) => vscode.window.showErrorMessage(`Error from GDX script: ${data}`));

    process.on('close', () => {
      const latestState = gdxViewStates.get(fileToParse);
      if (latestState) { latestState.interactiveProcess = null; }
    });

    return process;
  }
}