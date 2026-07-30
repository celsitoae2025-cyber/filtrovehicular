/* ============================================================
   Dev server local (puerto 5500). Sirve archivos estáticos
   del frontend para pruebas locales contra el bridge en :3030.
   Uso:  node dev-server.js
============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
};

const server = http.createServer((req, res) => {
  try {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/" || url === "") url = "/index.html";
    const filePath = path.normalize(path.join(ROOT, url));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); return res.end("forbidden");
    }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404 not found: " + url);
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(PORT, () => {
  console.log("[dev-server] http://localhost:" + PORT);
  console.log("[dev-server] sirviendo desde " + ROOT);
});
