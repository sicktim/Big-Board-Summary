// Tiny static file server for local dev. Run from this folder:
//   node serve.cjs
// Then open http://127.0.0.1:8080/ in your browser.
// Ctrl+C to stop.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.includes('..')) { res.writeHead(400); return res.end('nope'); }
  const fp = path.join(__dirname, p);
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      console.log('404', p);
      return res.end('not found: ' + p);
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
    console.log(200, p, data.length + 'B');
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Big Board Curriculum Status — listening on http://127.0.0.1:${PORT}/`);
  console.log(`Serving from ${__dirname}`);
  console.log('Ctrl+C to stop.');
});
