# Ginger and Spice

Node.js static website for Ginger and Spice in Gungahlin.

## Project Structure

```text
.
├── public/
│   ├── assets/
│   ├── gingerandspice_menu.pdf
│   ├── index.html
│   ├── robots.txt
│   └── sitemap.xml
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

## Health Check

Use this path for uptime checks:

```text
/healthz
```

## Notes

- The homepage is served from `public/index.html`.
- Local public assets are stored in `public/assets/`.
- The menu PDF is served from `public/gingerandspice_menu.pdf`.
- Local SEO files are served from `public/robots.txt` and `public/sitemap.xml`.
- Google Maps and order widgets still use external provider URLs.
- Google review information is shown as a static public summary with links to the live Google profile.
