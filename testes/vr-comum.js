/* Peças comuns dos testes de VR com o IWER (usadas por testes/vr-locomocao.js; o testes/vr.js tem as suas próprias).
   servidor(): estático na raiz + rotas do servir:https (/t e o endpoint de medições). paginaXR(browser, erros): página com o
   IWER (Quest 3) instalado. preparar(page, url, salvo): aparência salva e, opcionalmente, um ponto salvo. */
const http = require('http'), fs = require('fs'), path = require('path');
const vrTeste = require('./vr-teste-servidor');
const RAIZ = path.resolve(__dirname, '..');
const IWER = fs.readFileSync(require.resolve('iwer/build/iwer.min.js'), 'utf8');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.json': 'application/json' };

function servidor() {
  return new Promise(resolve => {
    const server = http.createServer((req, rsp) => {
      if (vrTeste.tratar(req, rsp)) return;
      const arquivo = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      fs.createReadStream(arquivo).pipe(rsp);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
async function paginaXR(browser, erros) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /change size while VR/i.test(m.text())) erros.push(m.text()); });
  await page.addInitScript(IWER);
  await page.addInitScript(() => { window.__xr = new window.IWER.XRDevice(window.IWER.metaQuest3); window.__xr.installRuntime({ forceInstall: true }); });
  return page;
}
async function preparar(page, url, salvo) {
  await page.goto(url);
  await page.evaluate(s => {
    localStorage.clear();
    window.Orvalho.avatar.store(window.Orvalho.avatar.load());
    if (s) localStorage.setItem('orvalho-jogo', JSON.stringify(s));
  }, salvo || null);
  await page.reload();
}
/* entra em VR pelo botão e espera alguns quadros da sessão */
async function entrar(page) {
  await page.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
  await page.click('#btn-vr');
  await page.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 30000 }).catch(() => {});
  await quadrosXR(page, 15);
}
/* espera n quadros da sessão XR (o requestAnimationFrame da janela não serve durante a sessão) */
const quadrosXR = (page, n) => page.evaluate(n => new Promise(r => {
  const s = window.Orvalho.jogo._debug().renderer.xr.getSession(); let k = 0;
  if (!s) return r();
  (function f(){ if (++k >= n) r(); else s.requestAnimationFrame(f); })();
}), n);
async function sair(page) {
  await page.evaluate(() => window.Orvalho.xr.sessao.sair());
  await page.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
}
module.exports = { servidor, paginaXR, preparar, entrar, quadrosXR, sair, RAIZ };
