// Local server: serves Draft Room and, from this machine only, your locally built index at /local-index.json.
//   node serve.mjs [port]   (index path: DRAFTROOM_INDEX or .local/index.json)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const indexFile = path.resolve(process.env.DRAFTROOM_INDEX ?? path.join(root, '.local', 'index.json'));
const port = Number(process.argv[2] ?? 4891);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/local-index.json') {
    if (!fs.existsSync(indexFile)) { res.writeHead(404); return res.end('no local index: run node tools/build-index.mjs'); }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return fs.createReadStream(indexFile).pipe(res);
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || f.startsWith(path.join(root, '.local')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Draft Room on http://127.0.0.1:${port}/`));
