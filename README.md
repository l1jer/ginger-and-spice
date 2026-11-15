# Ginger and Spice

Node.js static website for Ginger and Spice in Gungahlin.

## Project Structure

```text
.
├── public/
│   ├── assets/
│   ├── gingerandspice_menu.pdf
│   ├── index.html
│   ├── menu/index.html      (generated, do not edit by hand)
│   ├── robots.txt
│   └── sitemap.xml
├── data/
│   └── menu.json            (menu source: dishes, prices, tags)
├── scripts/
│   └── build-menu.mjs       (builds public/menu/index.html)
├── src/
│   └── server.js
├── package.json
└── README.md
```

## Requirements

- Node.js 20 or newer
- npm

## Local Development

```bash
npm run dev
```

The site runs at `http://localhost:3000` by default.

## Production

```bash
npm start
```

The server reads `PORT` from the environment and binds to `0.0.0.0`, which is suitable for Render and similar Node.js hosts.

## Updating the Menu

The web menu at `/menu/` is generated from `data/menu.json`. To change a dish or price, edit the JSON and rebuild:

```bash
node scripts/build-menu.mjs
```

Commit both `data/menu.json` and the regenerated `public/menu/index.html`. The PDF menu stays available for download.

## Health Check

Use this path for uptime checks:

```text
/healthz
```

## Notes

- The homepage is served from `public/index.html`; other pages live in folders (`public/menu/index.html` is served at `/menu/`).
- Local public assets are stored in `public/assets/`.
- The menu PDF is served from `public/gingerandspice_menu.pdf`.
- Local SEO files are served from `public/robots.txt` and `public/sitemap.xml`.
- Google Maps and order widgets still use external provider URLs.
- Google review information is shown as a static public summary with links to the live Google profile.
