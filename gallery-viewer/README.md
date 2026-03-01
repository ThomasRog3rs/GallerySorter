# Gallery Viewer

Standalone Next.js app for browsing photos that were already organized by the CLI into `YYYY/MM` folders.

## Requirements

- Node.js 20+
- A sorted photo directory structure like:

```text
/your/sorted/photos
  /2023
    /01
    /02
  /2024
    /03
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Configure photo directory

In the app, set **Photo directory** to your sorted folder path and click **Save**.

The path is stored in `config.json` in this folder (gitignored). You can also set `PHOTO_ROOT` in the environment to override it.

## API routes

- `GET /api/config`
- `PUT /api/config`
- `GET /api/years`
- `GET /api/years/[year]/months`
- `GET /api/years/[year]/months/[month]/photos`
- `GET /api/photos/serve?year=YYYY&month=MM&file=name.jpg`
