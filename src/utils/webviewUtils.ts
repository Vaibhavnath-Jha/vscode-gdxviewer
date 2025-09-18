import * as vscode from 'vscode';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'main.js'));
  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'styles.css'));

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF--8" />
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