import * as vscode from 'vscode';
import { Buffer } from 'buffer';
import { exec } from 'child_process';

function isDockerInstalled(): Promise<boolean> {
	return new Promise((resolve) => {
		exec('docker --version', (error) => {
			if (error) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

export async function createDevContainerFile() {
	const dockerAvailable = await isDockerInstalled();
	if (!dockerAvailable) {
		const selection = await vscode.window.showErrorMessage(
			"Docker is not installed or running. The Dev Containers extension requires Docker to function.",
			"Install Docker"
		);
		if (selection === "Install Docker") {
			vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
		}
		return;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage("Please open a folder to create a dev container.");
		return;
	}
	const workspaceRoot = workspaceFolders[0].uri;

	const devContainerConfig = {
		"name": "Python DevContainer",
		"image": "mcr.microsoft.com/devcontainers/python:3.11",
		"postCreateCommand": "python3 -m venv .venv && .venv/bin/pip install gamsapi[transfer]>=50.1.0 gamspy_base>=50.1.0",
		"customizations": {
			"vscode": {
				"settings": {
					"python.pythonPath": "${workspaceFolder}/.venv/bin/python"
				},
				"extensions": [
					"VaibhavnathJha.gdxviewer"
				]
			}
		},
		"remoteUser": "vscode"
	};
	const configContent = JSON.stringify(devContainerConfig, null, 4);

	// 4. Define paths and check for an existing file
	const devContainerFolderPath = vscode.Uri.joinPath(workspaceRoot, '.devcontainer');
	const devContainerFilePath = vscode.Uri.joinPath(devContainerFolderPath, 'devcontainer.json');

	try {
		await vscode.workspace.fs.stat(devContainerFilePath);
		vscode.window.showInformationMessage("A devcontainer.json file already exists.");
		return;
	} catch {
	}

	// 5. Create the directory, file, and show the prompt
	try {
		await vscode.workspace.fs.createDirectory(devContainerFolderPath);
		const contentAsUint8Array = Buffer.from(configContent, 'utf8');
		await vscode.workspace.fs.writeFile(devContainerFilePath, contentAsUint8Array);

		const selection = await vscode.window.showInformationMessage(
			"Dev container file created successfully!",
			"Reopen in Container"
		);

		if (selection === "Reopen in Container") {
			vscode.commands.executeCommand('remote-containers.reopenInContainer');
		}

	} catch (error) {
		vscode.window.showErrorMessage(`Failed to create dev container file: ${error}`);
	}
}