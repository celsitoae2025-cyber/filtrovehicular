/* Vista previa local de las páginas y los recursos web de FV+. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.FV_PREVIEW_HOST || '127.0.0.1';
const ROOT = fs.realpathSync(__dirname);

const PAGES = [
  'index.html', 'app.html', 'admin.html', 'verificar.html',
  'pago-exitoso.html', 'pago-pendiente.html', 'citv-emisor.html',
];
const ROUTES = new Map(PAGES.map(page => [`/${page.slice(0, -5)}`, `/${page}`]));
ROUTES.set('/', '/index.html');
const PUBLIC_FILES = new Set([
  ...PAGES, 'favicon-fvplus.png', 'favicon.png', 'favicon.ico',
  'manifest.json', 'sw.js', 'robots.txt', 'sitemap.xml',
  'google47a185fce23d53f3.html', 'google47a185fce23d53f3.txt',
]);
const PUBLIC_DIRECTORIES = new Set(['assets', 'css', 'icons', 'js']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const STATIC_EXTENSIONS = new Set(Object.keys(MIME).filter(ext => !['.html', '.xml', '.txt'].includes(ext)));

function isPublic(relativePath) {
  const parts = relativePath.split('/');
  if (parts.some(part => !part || part.startsWith('.') || /[\\:\0]/.test(part))) return false;
  if (parts.length === 1) return PUBLIC_FILES.has(relativePath);
  return PUBLIC_DIRECTORIES.has(parts[0]) && STATIC_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function errorResponse(res, status) {
  res.writeHead(status, { 'Content-Type': MIME['.txt'], 'Cache-Control': 'no-store' });
  res.end(http.STATUS_CODES[status]);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return errorResponse(res, 405);
  }

  let route;
  try {
    route = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return errorResponse(res, 400);
  }
  if (route === '/nueva' || route === '/nueva.html') {
    res.writeHead(301, { Location: '/app' });
    return res.end();
  }

  const relativePath = (ROUTES.get(route) || route).slice(1);
  if (!route.startsWith('/') || !isPublic(relativePath)) return errorResponse(res, 404);

  let filePath, size;
  try {
    filePath = await fs.promises.realpath(path.join(ROOT, relativePath));
    const canonicalPath = path.relative(ROOT, filePath).split(path.sep).join('/');
    if (path.isAbsolute(canonicalPath) || !isPublic(canonicalPath)) return errorResponse(res, 404);
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return errorResponse(res, 404);
    size = stat.size;
  } catch {
    return errorResponse(res, 404);
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()],
    'Content-Length': size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
});

server.listen(PORT, HOST, () => console.log(`[dev-server] http://${HOST}:${PORT}`));
