# gdxviewer
This extension renders the GAMS GDX file in VSCode Webview. It executes a Python script in the background using Node's `child_process`. The python interperter, which contains the `gams` library, must be set before using the extension. 

## Features
The `gdxviewer` renders the content of the GAMS GDX file in VSCode WebView. 

1. Simply select a symbol from the sidebar to display its content.
2. User can search for a symbol in the GDX file.
3. Since `gdxviewer` parses JSON string to display the content in the Webview, values like `Infinity` and `-Infinity` has been replaced with `1e+300` and `1e-300`.

## Requirements

The python script that reads the data from the GDX file requires that gams\[transfer] is installed in the provided Python interpreter.

## Extension Settings

This extension contributes the following settings:

* `gdx.Display`: Display the GDX File.

## Release Notes

### 1.0.0

- Initial release of `gdxviewer`.