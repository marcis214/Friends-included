import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import dashboard from '../api/dashboard.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  if (req.url === '/api/dashboard') return dashboard(req, res);
  const path = normalize(req.url === '/' ? 'index.html' : req.url.replace(/^\//, ''));
  if (path.includes('..')) { res.writeHead(400).end('Bad request'); return; }
  try { const content = await readFile(join(process.cwd(), 'public', path)); res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(content); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(4173, () => console.log('Preview: http://127.0.0.1:4173'));
