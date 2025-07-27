# Change Log

All notable changes to the `GDXViewer` extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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