/* Fluxo de integração do avatar no navegador real.
   Valida primeira visita, provador, cancelamento, salvamento durante o jogo
   e retomada da exploração. Uso: npm run teste:avatar */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.json': 'application/json' };

function servidor() {
  return new Promise(resolve => {
    const server = http.createServer((req, rsp) => {
      const arquivo = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      fs.createReadStream(arquivo).pipe(rsp);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const arquivo = path.join(base, d, sub); if (fs.existsSync(arquivo)) return arquivo;
    }
  }
  return undefined;
}

(async () => {
  const server = await servidor();
  let browser;
  const falhas = [], erros = [];
  const ok = (condicao, mensagem) => {
    console.log((condicao ? '  ✔ ' : '  ✘ ') + mensagem);
    if (!condicao) falhas.push(mensagem);
  };
  try {
    browser = await require('./navegador').abrir(chromium, !process.argv.includes('--janela'));   // GPU=1 usa a placa de vídeo (testes/navegador.js)
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', erro => erros.push(erro.message));
    page.on('console', mensagem => { if (mensagem.type() === 'error') erros.push(mensagem.text()); });
    const url = process.env.ORVALHO_URL || `http://127.0.0.1:${server.address().port}/index.html`; // ORVALHO_URL: testar o site publicado

    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    ok((await page.locator('#btn-entrar span').textContent()).includes('Criar avatar'), 'primeira visita oferece criar avatar');

    await page.click('#btn-entrar');
    await page.waitForSelector('#provador:not([hidden])');
    ok(await page.locator('#provador').isVisible(), 'provador abre antes da primeira entrada');

    await page.click('#cat-corpo');
    await page.click('#prov-pane [data-v="gota"]');
    await page.click('#cat-cores');
    await page.click('#prov-pane [data-v="rosa"]');
    await page.click('#prov-enter');
    await page.waitForFunction(() => Orvalho.jogo.ativo());
    await page.waitForTimeout(900);
    let estado = await page.evaluate(() => ({ corpo: localStorage.getItem('orvalho-avatar-corpo'), cor: localStorage.getItem('orvalho-avatar-cor'), raio: Orvalho.jogo._debug().raio }));
    ok(estado.corpo === 'gota' && estado.cor === 'rosa', 'corpo Gota e cor Rosa são salvos ao entrar');
    const raioGota = estado.raio;

    await page.keyboard.press('KeyP');
    await page.waitForSelector('#provador:not([hidden])');
    await page.click('#cat-corpo');
    await page.click('#prov-pane [data-v="esguio"]');
    await page.click('#prov-cancel');
    await page.waitForSelector('#provador', { state: 'hidden' });
    estado = await page.evaluate(() => ({ corpo: localStorage.getItem('orvalho-avatar-corpo'), raio: Orvalho.jogo._debug().raio }));
    ok(estado.corpo === 'gota' && Math.abs(estado.raio - raioGota) < 0.001, 'Cancelar descarta a mudança feita durante o jogo');

    await page.keyboard.press('KeyP');
    await page.waitForSelector('#provador:not([hidden])');
    await page.click('#cat-corpo');
    await page.click('#prov-pane [data-v="esguio"]');
    await page.click('#prov-save');
    await page.waitForSelector('#provador', { state: 'hidden' });
    estado = await page.evaluate(() => ({ corpo: localStorage.getItem('orvalho-avatar-corpo'), raio: Orvalho.jogo._debug().raio }));
    ok(estado.corpo === 'esguio' && estado.raio < raioGota, 'Salvar aplica o corpo Esguio e atualiza seu colisor');

    await page.click('#hud-casa');
    await page.waitForSelector('#inicio:not([hidden])');
    ok(await page.locator('#btn-continuar').isVisible(), 'ao voltar ao início, Continuar exploração fica disponível');
    await page.click('#btn-continuar');
    await page.waitForFunction(() => Orvalho.jogo.ativo());
    await page.waitForTimeout(900);
    estado = await page.evaluate(() => ({ corpo: localStorage.getItem('orvalho-avatar-corpo'), raio: Orvalho.jogo._debug().raio, ambiente: Orvalho.jogo._debug().amb.def.id }));
    ok(estado.corpo === 'esguio' && estado.raio < raioGota && estado.ambiente === 'lab-ia', 'Continuar restaura avatar e ambiente da exploração');
    ok(erros.length === 0, erros.length ? `console contém erros: ${erros.join(' | ')}` : 'console sem erros');

    const relatorio = { data: new Date().toISOString(), falhas, erros, estadoFinal: estado };
    fs.writeFileSync(path.join(__dirname, 'relatorio-fluxo-avatar.json'), JSON.stringify(relatorio, null, 2) + '\n');
    if (falhas.length) throw new Error(`${falhas.length} verificação(ões) falharam`);
    console.log('\n✔ fluxo do avatar validado · relatório em testes/relatorio-fluxo-avatar.json');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(erro => { console.error('\n✘ ' + erro.stack); process.exitCode = 1; });
