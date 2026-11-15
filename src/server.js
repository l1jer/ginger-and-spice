import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
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
  '.avif': 'image/avif',
  '.webm': 'video/webm',
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

// Asset file names are not content-hashed, so a long `immutable` cache would
// keep serving an old menu PDF or photo for a year after it is replaced.
// HTML is always revalidated; other files are cached for a day and then
// revalidated in the background.
function cacheControlFor(extension) {
  if (extension === '.html' || extension === '.xml' || extension === '.txt') {
    return 'no-cache';
  }

  return 'public, max-age=86400, stale-while-revalidate=604800';
}

const notFoundPage = join(rootDir, '404.html');

function sendNotFound(request, response) {
  if (!existsSync(notFoundPage)) {
    sendText(response, 404, 'Not found');
    return;
  }

  response.writeHead(404, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache'
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(notFoundPage).pipe(response);
}

function serveFile(filePath, request, response) {
  if (!existsSync(filePath)) {
    sendNotFound(request, response);
    return;
  }

  // Directory URLs such as /menu/ serve their index.html, and /menu redirects
  // to /menu/ so relative links and canonical URLs stay consistent (this
  // matches how GitHub Pages and most static hosts behave).
  if (statSync(filePath).isDirectory()) {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.endsWith('/')) {
      // Build the redirect from the resolved path, never the raw request, so a
      // request like `//example.com` cannot become an off-site redirect.
      const sitePath = relative(rootDir, filePath).split(sep).join('/');
      response.writeHead(301, { location: `/${sitePath}/` });
      response.end();
      return;
    }

    serveFile(join(filePath, 'index.html'), request, response);
    return;
  }

  if (!statSync(filePath).isFile()) {
    sendNotFound(request, response);
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'cache-control': cacheControlFor(extension)
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
