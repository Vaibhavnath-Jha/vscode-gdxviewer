import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';

export async function getPythonPath(): Promise<string> {
  const pythonExtension = vscode.extensions.getExtension('ms-python.python');
  if (!pythonExtension) {
    throw new Error("The Python extension ('ms-python.python') is not installed. Please install it to proceed.");
  }
  if (!pythonExtension.isActive) {
    await pythonExtension.activate();
  }
  const pythonPath = await vscode.commands.executeCommand<string>(
    'python.interpreterPath', { workspaceFolder: vscode.workspace.workspaceFolders?.[0] }
  );
  if (pythonPath) { return pythonPath; }
  throw new Error("No Python interpreter is selected. Please use the 'Python: Select Interpreter' command.");
}

function isPythonPackageAvailable(pythonPath: string, packageName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = ['-c', `import importlib.util; exit(0) if importlib.util.find_spec('${packageName}') else exit(1)`];

    spawn(pythonPath, command)
      .on('close', (code) => {
        resolve(code === 0);
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

function isGamsExecutableAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'where gams' : 'which gams';
    exec(command, (error) => {
      resolve(!error);
    });
  });
}

export async function checkPrerequisites(pythonPath: string): Promise<void> {
  // Run all checks in parallel for efficiency
  const [
    gamsExecFound,
    gamsTransferFound,
    gamspyBaseFound
  ] = await Promise.all([
    isGamsExecutableAvailable(),
    isPythonPackageAvailable(pythonPath, 'gams.transfer'),
    isPythonPackageAvailable(pythonPath, 'gamspy_base')
  ]);

  if (!(gamsExecFound || gamspyBaseFound)) {
    throw new Error("Neither the 'gams' executable nor the 'gamspy_base' Python package could be found. Refer to the README of this extension.");
  }

  if (!gamsTransferFound) {
    throw new Error("The 'gams.transfer' Python package was not found. Refer to the README of this extension.");
  }
}