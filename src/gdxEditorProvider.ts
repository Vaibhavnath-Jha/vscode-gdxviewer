import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { getWebviewContent } from './utils/webviewUtils';
import { getPythonPath, checkPrerequisites } from './utils/pythonUtils';

interface GdxViewState {
  interactiveProcess: ChildProcessWithoutNullStreams | null;
  indexData?: any;
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
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview')]
    };
    webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context.extensionUri);

    // 2. Set up state management and cleanup
    const currentState: GdxViewState = { interactiveProcess: null };
    gdxViewStates.set(fileToParse, currentState);

    webviewPanel.onDidDispose(() => {
      currentState.interactiveProcess?.kill();
      gdxViewStates.delete(fileToParse);
    });

    // 3. Validate Python environment
    let pythonPath: string;
    try {
      pythonPath = await getPythonPath();
      await checkPrerequisites(pythonPath);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
      webviewPanel.webview.html = `<h1>Error</h1><p>${err.message}</p>`;
      return;
    }

    // 4. Fetch the initial list of symbols from the GDX file
    const scriptPath = path.join(this.context.extensionPath, 'scripts', 'readgdx.py');
    const indexProcess = spawn(pythonPath, [scriptPath, fileToParse]);

    let stdoutBuffer = '';
    indexProcess.stdout.on('data', (data) => { stdoutBuffer += data.toString(); });
    indexProcess.stderr.on('data', (data) => { vscode.window.showErrorMessage(`${data}`); });

    indexProcess.on('close', (code) => {
      if (webviewPanel.visible && code === 0) {
        try {
          const indexData = JSON.parse(stdoutBuffer);
          currentState.indexData = indexData;
          webviewPanel.webview.postMessage({ command: 'initialize', data: indexData });
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to parse symbol index: ${e.message}.`);
        }
      }
    });

    // 5. Listen for messages from the webview to fetch specific symbol data
    webviewPanel.webview.onDidReceiveMessage(async (message: any) => {
      if (message.command === 'getSymbol') {
        const state = gdxViewStates.get(fileToParse);
        if (!state) return;

        // Start the interactive python process if it's not running
        if (!state.interactiveProcess || state.interactiveProcess.killed) {
          state.interactiveProcess = this.startInteractiveProcess(fileToParse, scriptPath, pythonPath, webviewPanel);
        }
        
        // Send the requested symbol name to the python process
        state.interactiveProcess.stdin.write(`${message.symbolName}\n`);
      }
    });
  }

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
          const symbolData = JSON.parse(messageChunk);
          webviewPanel.webview.postMessage({ command: 'displaySymbolData', data: symbolData });
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