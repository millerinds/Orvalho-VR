/* Servidor local estático para desenvolvimento (não vai para o site). Serve a pasta do projeto em http://localhost:8000.
   Útil onde não há Python (README) e para testar no Quest com `adb reverse tcp:8000 tcp:8000`:
   http://localhost conta como contexto seguro, então o WebXR funciona sem HTTPS.
   Sem cabo nem modo desenvolvedor, use `npm run servir:https` (testes/servir-https.js), que reaproveita `atender`.
   Uso: npm run servir  (porta: npm run servir -- 8080) */
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
/* nunca servir a chave do certificado local, mesmo que alguém peça o caminho */
const BLOQUEADO = [path.join(RAIZ, '.certs'), path.join(RAIZ, 'node_modules'), path.join(RAIZ, '.git')];

function atender(req, rsp) {
  let arquivo;
  try { arquivo = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html')); }
  catch (e) { rsp.writeHead(400); return rsp.end('400'); }
  if (!arquivo.startsWith(RAIZ) || BLOQUEADO.some(b => arquivo === b || arquivo.startsWith(b + path.sep))
      || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { rsp.writeHead(404); return rsp.end('404'); }
  rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arquivo).pipe(rsp);
}

if (require.main === module) {
  const PORTA = +process.argv[2] || 8000;
  http.createServer(atender).listen(PORTA, () => console.log(`Orvalho em http://localhost:${PORTA}/  (Ctrl+C para parar)`));
}
module.exports = { atender, RAIZ };
