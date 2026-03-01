# Gallery Sorter CLI

A .NET 8 command-line application that scans files in a directory, reads metadata dates when available, and organizes files into:

- `YYYY/MM` folders (for example `2024/03`)

## Features

- Reads metadata dates (EXIF first, then common date tags)
- Falls back to file system timestamps if metadata is missing
- Supports `--dry-run` to preview actions
- Supports `--move` (default behavior is copy)
- Supports `--recursive` directory scanning
- Handles duplicate names by suffixing (`photo_1.jpg`, `photo_2.jpg`)

## Build

```bash
dotnet build GallerySorter.sln
```

## Usage

```bash
dotnet run --project GallerySorter/GallerySorter.csproj -- <source-path> [options]
```

Options:

- `--output <path>`: output base directory (default: source directory)
- `--dry-run`: preview actions without file changes
- `--move`: move files instead of copying
- `--recursive`: include subdirectories

Examples:

```bash
dotnet run --project GallerySorter/GallerySorter.csproj -- ./Photos --output ./Sorted --dry-run
dotnet run --project GallerySorter/GallerySorter.csproj -- ./Photos --output ./Sorted --move --recursive
```

## Gallery Viewer Web App

A standalone Next.js app is available in `gallery-viewer/` for browsing the sorted directory with a local TypeScript backend and React frontend.
