# Gallery Sorter

A .NET 8 CLI that organizes media files into `YYYY/MM` folders using metadata dates, plus a Next.js gallery app to browse, upload, and manage the sorted library.

## Gallery Sorter CLI

Scans a directory, reads metadata dates when available (EXIF first, then common date tags), and organizes files into year/month folders (e.g. `2024/03`).

### Features

- Reads metadata dates (EXIF first, then common date tags)
- Falls back to file system timestamps if metadata is missing
- Supports `--dry-run` to preview actions
- Supports `--move` (default is copy)
- Supports `--recursive` directory scanning
- Handles duplicate names by suffixing (`photo_1.jpg`, `photo_2.jpg`)

### Build

```bash
dotnet build GallerySorter.sln
```

### Usage

```bash
dotnet run --project GallerySorter/GallerySorter.csproj -- --source <path> [options]
```

**Options**

| Option | Description |
|--------|-------------|
| `--source <path>` | Source directory containing files to organize (required unless set in config) |
| `--output <path>` | Output base directory (default: from config, or source directory) |
| `--dry-run` | Preview actions without changing files |
| `--move` | Move files instead of copying |
| `--recursive` | Include subdirectories |

You can set defaults in `GallerySorter/appsettings.json`:

```json
{
  "GallerySorter": {
    "SourcePath": "/path/to/source",
    "OutputPath": "/path/to/sorted"
  }
}
```

**Examples**

```bash
dotnet run --project GallerySorter/GallerySorter.csproj -- --source ./Photos --output ./Sorted --dry-run
dotnet run --project GallerySorter/GallerySorter.csproj -- --source ./Photos --output ./Sorted --move --recursive
```

---

## Gallery Viewer (Web App)

Next.js app in `gallery-viewer/` for browsing your sorted photo directory: year/month navigation, “this week” / “today” views, lightbox, delete, and bulk upload (files are sorted into year/month on upload).

### Requirements

- Node.js 20+
- A sorted directory structure (e.g. produced by the CLI):

```
/your/sorted/photos
  2023/
    01/
    02/
  2024/
    03/
```

### Run

```bash
cd gallery-viewer
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

- **Settings**: Set **Photo directory** to your sorted folder path and save. Stored in `config.json` (gitignored). You can also set `PHOTO_ROOT` in the environment.
- **Upload**: Bulk upload images/videos; they are sorted into year/month folders using metadata (or file dates) and saved under your configured photo directory.

### Features

- Browse by year and month
- “This week” and “today” views (photos taken in that range across years)
- Lightbox with keyboard navigation
- Delete photos from disk
- Bulk upload with automatic year/month organization

### API routes

- `GET` / `PUT` `/api/config` — photo directory
- `GET` `/api/years`
- `GET` `/api/years/[year]/months`
- `GET` `/api/years/[year]/months/[month]/photos`
- `GET` `/api/this-week/photos?scope=week|today`
- `GET` `/api/photos/serve?year=...&month=...&file=...`
- `POST` `/api/upload` — multipart file upload

See `gallery-viewer/README.md` for more detail.
