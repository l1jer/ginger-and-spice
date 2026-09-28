import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const rootDir = fileURLToPath(new URL('../public/', import.meta.url));

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(message);
}

function getFilePath(requestUrl) {
  try {
    const url = new URL(requestUrl, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    const normalisedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const requestedPath = normalisedPath === '/' ? '/index.html' : normalisedPath;
    const filePath = resolve(join(rootDir, requestedPath));

    if (!filePath.startsWith(rootDir)) {
      return null;
    }

    return filePath;
  } catch {
    return null;
  }
}

function serveFile(filePath, request, response) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendText(response, 404, 'Not found');
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) {
        sendText(response, 500, 'Internal server error');
      } else {
        response.destroy();
      }
    })
    .pipe(response);
}

const server = createServer((request, response) => {
  if (!request.url) {
    sendText(response, 400, 'Bad request');
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, {
      'allow': 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8'
    });
    response.end('Method not allowed');
    return;
  }

  if (request.url === '/healthz') {
    sendText(response, 200, 'ok');
    return;
  }

  const filePath = getFilePath(request.url);
  if (!filePath) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  serveFile(filePath, request, response);
});

server.on('error', (error) => {
  console.error(JSON.stringify({
    code: error.code,
    event: 'server_error',
    message: error.message,
    service: 'ginger-and-spice'
  }));
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    event: 'server_started',
    host,
    port,
    service: 'ginger-and-spice'
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({
    event: 'server_shutdown',
    signal,
    service: 'ginger-and-spice'
  }));

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
