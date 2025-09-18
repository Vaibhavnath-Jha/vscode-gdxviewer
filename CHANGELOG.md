# Change Log

All notable changes to the `GDXViewer` extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- Backend pagination for large symbols

## [1.2.0] - 17.09.2025

- Added support for Remote VS Code instance
- Added `CustomEditor` for better UX.
- Selecting the gdx file now directly opens the view, if `GDX Viewer` is set as the default editor.

## [1.1.1] - 28.07.2025

- Refactor javascript and css into distinct files for maintainability

## [1.1.0] - 27.07.2025

### Added

- Use `spawn` instead of `execFile` to load symbols on-demand
- Use file picker dialog box for selecting the GDX file instead of input box
- Cache fetched symbols

### Fixed

- Large GDX files can now be viewed since the `maxBuffer ` limitation has been removed
- Support for VSCode light themes

## [1.0.1] - 21.07.2025

- Updated README

## [1.0.0] - 20.07.2025

- Initial release of `GDXViewer`