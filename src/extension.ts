import * as vscode from 'vscode';
import { GdxEditorProvider } from './gdxEditorProvider';
import { createDevContainerFile } from './devContainerCreator';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'gdx.Display',
      new GdxEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gdx.Display', async (resource?: vscode.Uri) => {
      let uriToOpen: vscode.Uri | undefined = resource;

      if (!uriToOpen) {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: "Select GDX File",
          filters: {
            '': ['gdx']
          }
        });

        if (uris && uris.length > 0) {
          uriToOpen = uris[0];
        }
      }

      if (uriToOpen) {
        vscode.commands.executeCommand('vscode.openWith', uriToOpen, 'gdx.Display');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gdx.initializeDevContainer',
      () => {
        createDevContainerFile();
      }
    )
  );
}