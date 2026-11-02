/* Modo VR (etapa 1: sessão, rig e câmera) num Chromium real, com o WebXR emulado pelo IWER (Meta, devDependency).
   O IWER simula o headset (Quest 3, mesmos controles Touch Plus do 3S); fps medidos aqui NÃO representam o aparelho.
   Verifica:
   - sem WebXR, nenhum botão de VR aparece e o site segue igual;
   - com WebXR, o botão aparece na tela inicial (com destaque no Quest Browser) e no HUD;
   - entrar pela tela inicial monta o jogo e abre a sessão; HUD/DOM somem; câmera dentro do rig; boneco oculto;
   - a cabeça entra onde o boneco estava e olhando para onde ele olhava;
   - andar fisicamente com o headset contra as paredes do Lab: a colisão vale para a cabeça e o rig recua;
   - subir a escada principal do Hall andando com o headset: a cota acompanha a rampa até o 1º andar;
   - fallback de reference space (sem local-floor; só local);
   - sair restaura o desktop (câmera solta, boneco visível, teclado andando, HUD de volta) e salva a posição;
   - medidor de fps e draw calls ativo; console sem erros;
   - log/diagnóstico (?vr-log=1): quadro na tela inicial, erros capturados, painel em VR, medidas após sair, × desliga;
   - 72 Hz pedido por padrão e mostrado no medidor; segurar B por 1,5 s encerra a sessão (anel e vibração); B rápido faz a ação
     curta; B solto antes de 1,5 s não faz nada; os dois grips não saem mais;
   - modo teste: bipes (1 no fim do aquecimento, 2 no fim da volta), giro automático em torno da cabeça sem mudar a posição, e as
     baterias Lab (troca de parâmetros e foveação no meio da sessão) e Hall (9 pontos, nos dois pavimentos) com fim automático;
   - ?vr-ponto, ?vr-fb (teto 1,5) e auto, e as otimizações do Hall (células com recorte, contornos até 10 m, vidros numa passada; desfeitas ao sair);
   - modo teste (?vr-teste): parâmetros da URL não ficam salvos, rótulo no medidor, registros por POST (início, resumo, setores de yaw,
     marca pelo botão A, fim) gravados pelo endpoint do servir:https numa pasta temporária; página /t; endpoint recusa IP público,
     corpo grande, não-JSON e registro inválido; sem o aviso "Can't change size while VR device is presenting";
   - zonas de visibilidade do Hall (?vr-zonas) e distância máxima dos móveis (?vr-dist), desfeitas ao sair.
   Uso: npm run teste:vr  (CHROMIUM=/caminho/do/chrome se o Chromium do Playwright não for achado) */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright-core');
/* o endpoint de medições do servir:https grava numa pasta temporária durante o teste (não mistura com as medições do Quest) */
const PASTA_MED = fs.mkdtempSync(path.join(os.tmpdir(), 'orvalho-medicoes-'));
process.env.ORVALHO_MEDICOES_DIR = PASTA_MED;
const vrTeste = require('./vr-teste-servidor');

const RAIZ = path.resolve(__dirname, '..');
const IWER = fs.readFileSync(require.resolve('iwer/build/iwer.min.js'), 'utf8');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.json': 'application/json' };

function servidor() {
  return new Promise(resolve => {
    const server = http.createServer((req, rsp) => {
      if (vrTeste.tratar(req, rsp)) return;   // /t e POST /__orvalho/medicoes, como no servir:https
      const arquivo = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      fs.createReadStream(arquivo).pipe(rsp);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}
function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const bases = [path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'), path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const arquivo = path.join(base, d, sub); if (fs.existsSync(arquivo)) return arquivo;
    }
  }
  return undefined;
}

/* injeta o IWER antes de qualquer script da página; variante: 'quest3' | 'sem-local-floor' | 'so-local' */
async function paginaXR(browser, variante, erros) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /change size while VR/i.test(m.text())) erros.push(m.text()); });
  if (variante) {
    await page.addInitScript(IWER);
    await page.addInitScript(v => {
      const base = window.IWER.metaQuest3;
      const tira = v === 'sem-local-floor' ? ['local-floor'] : v === 'so-local' ? ['local-floor', 'bounded-floor'] : [];
      const cfg = Object.assign({}, base, { supportedFeatures: base.supportedFeatures.filter(f => tira.indexOf(f) < 0) });
      window.__xr = new window.IWER.XRDevice(cfg);
      window.__xr.installRuntime({ forceInstall: true });   // o Chromium já traz um navigator.xr nativo (sem headset)
    }, variante);
  }
  return page;
}
/* aparência salva (pula a primeira visita) e, opcionalmente, um ponto salvo */
async function preparar(page, url, salvo) {
  await page.goto(url);
  await page.evaluate(s => {
    localStorage.clear();
    window.Orvalho.avatar.store(window.Orvalho.avatar.load());
    if (s) localStorage.setItem('orvalho-jogo', JSON.stringify(s));
  }, salvo || null);
  await page.reload();
}
const quadros = (page, n) => page.evaluate(n => new Promise(r => { let k = 0; (function f(){ if (++k >= n) r(); else requestAnimationFrame(f); })(); }), n);

(async () => {
  const server = await servidor();
  const url = process.env.ORVALHO_URL || `http://127.0.0.1:${server.address().port}/index.html`;
  const falhas = [], erros = [], rel = {};
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas.push(m); };
  let browser;
  try {
    browser = await require('./navegador').abrir(chromium, !process.argv.includes('--janela'));   // GPU=1 usa a placa de vídeo (testes/navegador.js)

    console.log('1. desktop sem WebXR');
    {
      const page = await paginaXR(browser, null, erros);
      await preparar(page, url);
      await page.waitForTimeout(300);
      ok(await page.locator('#btn-vr').isHidden(), 'sem WebXR, o botão "Entrar em VR" fica oculto');
      await page.click('#btn-entrar'); await page.waitForFunction(() => window.Orvalho.jogo.ativo());
      ok(await page.locator('#hud-vr').isHidden(), 'sem WebXR, o HUD não mostra o botão de VR');
      ok(await page.locator('#diag-vr').count() === 0, 'sem ?vr-log=1, o quadro de diagnóstico não aparece');
      await page.close();
    }

    console.log('2. entrar em VR pela tela inicial (Lab)');
    const page = await paginaXR(browser, 'quest3', erros);
    await preparar(page, url, { amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: 1.2, yaw: 0, pitch: 0.4, dist: 2.9 });
    await page.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 }).catch(() => {});
    ok(await page.locator('#btn-vr').isVisible(), 'com WebXR, o botão "Entrar em VR" aparece na tela inicial');
    ok(await page.evaluate(() => document.body.classList.contains('vr-destaque')), 'no Quest Browser (user agent do IWER) o botão ganha destaque');
    await page.click('#btn-vr');
    await page.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
    ok(await page.evaluate(() => window.Orvalho.xr.sessao.ativa()), 'a sessão immersive-vr abre a partir do clique');
    await quadros(page, 20);
    const s1 = await page.evaluate(() => {
      const O = window.Orvalho, d = O.jogo._debug(), cam = d.camera, w = new THREE.Vector3(); cam.getWorldPosition(w);
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
      return { tipo: O.xr.sessao.tipo(), presenting: d.renderer.xr.isPresenting, pai: cam.parent && cam.parent.name, emVr: document.body.classList.contains('em-vr'),
        hud: getComputedStyle(document.querySelector('.hud-top')).display, dica: getComputedStyle(document.querySelector('.hud-dica')).display,
        boneco: d.player.root.visible, amb: O.jogo.ambienteAtual(), st: { x: d.st.x, y: d.st.y, z: d.st.z, rumo: d.st.rumo },
        cabeca: { x: w.x, y: w.y, z: w.z }, yaw: Math.atan2(f.x, f.z), alvoFb: O.xr.opcoes.ler(),
        medidor: !!cam.getObjectByName('xr-medidor') };
    });
    rel.entrada = s1;
    ok(s1.presenting && s1.tipo === 'local-floor', 'renderer apresentando no reference space local-floor');
    ok(s1.amb === 'lab-ia', 'a exploração salva foi retomada (Lab)');
    ok(s1.pai === 'xr-rig', 'a câmera fica dentro do playerRig');
    ok(s1.emVr && s1.hud === 'none' && s1.dica === 'none', 'HUD e DOM somem durante a sessão');
    ok(!s1.boneco, 'o boneco do jogador fica oculto nesta etapa (o corpo em VR vem na etapa 3)');
    ok(Math.hypot(s1.cabeca.x - 3.6, s1.cabeca.z - 2.0) < 0.05, `a cabeça entra onde o boneco estava (${s1.cabeca.x.toFixed(2)}, ${s1.cabeca.z.toFixed(2)})`);
    ok(Math.abs(Math.atan2(Math.sin(s1.yaw - 1.2), Math.cos(s1.yaw - 1.2))) < 0.05, `e olhando para onde ele olhava (yaw ${s1.yaw.toFixed(2)} ≈ 1,20)`);
    ok(s1.cabeca.y > 1.2 && s1.cabeca.y < 2.0, `olhos na altura do headset sobre o piso (y = ${s1.cabeca.y.toFixed(2)} m)`);
    ok(s1.medidor, 'medidor de fps preso à vista');

    console.log('3. andar fisicamente contra as paredes do Lab');
    const anda = await page.evaluate(async () => {
      const O = window.Orvalho, d = O.jogo._debug(), xr = window.__xr, cam = d.camera, w = new THREE.Vector3();
      const espera = () => new Promise(r => requestAnimationFrame(() => r()));
      const raio = d.raio, res = { minFolga: Infinity, maxDesvio: 0, passos: 0, caminho: 0 };
      let ant = { x: d.st.x, z: d.st.z };
      /* 3 trechos de 4 m em direções diferentes, a ~1 m/s, girando o headset entre eles */
      const dirs = [0, 1.9, -2.4];
      for (const a of dirs) {
        xr.quaternion.set(0, Math.sin(a / 2), 0, Math.cos(a / 2));
        for (let i = 0; i < 200; i++) {
          xr.position.set(xr.position.x - Math.sin(a) * 0.02, xr.position.y, xr.position.z - Math.cos(a) * 0.02);
          await espera(); res.passos++;
          res.caminho += Math.hypot(d.st.x - ant.x, d.st.z - ant.z); ant = { x: d.st.x, z: d.st.z };
          const f = d.amb.colisao.folga(d.st, d.st.y); if (f < res.minFolga) res.minFolga = f;
          cam.getWorldPosition(w); const dv = Math.hypot(w.x - d.st.x, w.z - d.st.z); if (dv > res.maxDesvio) res.maxDesvio = dv;
        }
      }
      res.raio = raio;
      return res;
    });
    rel.paredesLab = anda;
    ok(anda.minFolga >= anda.raio - 0.01, `a cabeça nunca atravessa parede nem móvel (folga mínima ${anda.minFolga.toFixed(3)} m ≥ colisor ${anda.raio})`);
    ok(anda.maxDesvio < 0.06, `o rig recua o que a colisão recusa: cabeça = jogador (desvio máx. ${anda.maxDesvio.toFixed(3)} m)`);
    ok(anda.caminho > 2, `andar com o headset move o jogador (${anda.caminho.toFixed(2)} m percorridos dos 12 m tentados; o resto, barrado)`);

    console.log('4. medidor');
    await page.waitForTimeout(1200);
    const med = await page.evaluate(() => window.Orvalho.xr.sessao.medidor().amostra());
    rel.medidor = med;
    ok(med && med.fps > 0 && med.calls > 0, `medidor ativo (emulado: ${med && med.fps} fps, ${med && med.calls} draw calls, FB ${med && med.fb})`);

    console.log('5. sair do VR restaura o desktop');
    await page.evaluate(() => window.Orvalho.xr.sessao.sair());
    await page.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
    await quadros(page, 10);
    const s2 = await page.evaluate(() => {
      const O = window.Orvalho, d = O.jogo._debug();
      return { ativa: O.xr.sessao.ativa(), presenting: d.renderer.xr.isPresenting, pai: d.camera.parent, emVr: document.body.classList.contains('em-vr'),
        hud: getComputedStyle(document.querySelector('.hud-top')).display, boneco: d.player.root.visible, vr: O.jogo.vr.ativo(),
        st: { x: d.st.x, z: d.st.z }, salvo: JSON.parse(localStorage.getItem('orvalho-jogo')) };
    });
    ok(!s2.ativa && !s2.presenting && !s2.vr, 'a sessão termina e o modo VR do jogo desliga');
    ok(s2.pai === null, 'a câmera volta a ser solta (3ª pessoa)');
    ok(!s2.emVr && s2.hud !== 'none', 'o HUD volta');
    ok(s2.boneco, 'o boneco volta a aparecer');
    ok(Math.hypot(s2.salvo.x - s2.st.x, s2.salvo.z - s2.st.z) < 0.01, 'a posição de onde a pessoa estava em VR fica salva');
    await page.focus('#jogo-canvas'); await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
    const s3 = await page.evaluate(() => { const d = window.Orvalho.jogo._debug(); return { x: d.st.x, z: d.st.z }; });
    ok(Math.hypot(s3.x - s2.st.x, s3.z - s2.st.z) > 0.3, 'o teclado volta a andar (W)');
    ok(await page.locator('#hud-vr').isVisible(), 'o botão de VR do HUD permite entrar de novo');

    console.log('6. escada principal do Hall andando com o headset');
    await page.close();
    const ph = await paginaXR(browser, 'quest3', erros);
    await preparar(ph, url, { amb: 'hall-inovale', x: 43.22, y: 0, z: 2.6, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
    await ph.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
    await ph.click('#btn-vr');
    await ph.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 20000 }).catch(() => {});
    await quadros(ph, 20);
    const esc = await ph.evaluate(async () => {
      const d = window.Orvalho.jogo._debug(), xr = window.__xr;
      const espera = () => new Promise(r => requestAnimationFrame(() => r()));
      const res = { ini: d.st.y, maxY: -1, minFolga: Infinity };
      for (let i = 0; i < 520; i++) {   // ~10 m para +z (frente do jogador), a ~1 m/s
        xr.position.set(xr.position.x, xr.position.y, xr.position.z - 0.02);
        await espera();
        if (d.st.y > res.maxY) res.maxY = d.st.y;
        const f = d.amb.colisao.folga(d.st, d.st.y); if (f < res.minFolga) res.minFolga = f;
      }
      for (let i = 0; i < 30; i++) await espera();
      res.fim = { x: d.st.x, y: d.st.y, z: d.st.z }; res.raio = d.raio;
      const cam = d.camera, w = new THREE.Vector3(); cam.getWorldPosition(w); res.olhoY = w.y;
      return res;
    });
    rel.escadaHall = esc;
    ok(esc.ini < 0.05 && esc.fim.y > 4.1, `a cota sobe pela rampa da escada até o 1º andar (${esc.ini.toFixed(2)} → ${esc.fim.y.toFixed(2)} m)`);
    ok(esc.olhoY > esc.fim.y + 1.2, `os olhos acompanham a cota do piso (olho em ${esc.olhoY.toFixed(2)} m)`);
    ok(esc.minFolga >= esc.raio - 0.01, `sem atravessar o guarda-corpo na subida (folga mínima ${esc.minFolga.toFixed(3)} m)`);
    await ph.evaluate(() => window.Orvalho.xr.sessao.sair());
    await ph.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
    const yDepois = await ph.evaluate(() => JSON.parse(localStorage.getItem('orvalho-jogo')).y);
    ok(yDepois > 4.1, `ao sair, a altura do 1º andar fica salva (y = ${yDepois})`);
    await ph.close();

    console.log('7. fallback de reference space');
    for (const [variante, esperado] of [['sem-local-floor', 'bounded-floor'], ['so-local', 'local']]) {
      const pf = await paginaXR(browser, variante, erros);
      await preparar(pf, url);
      await pf.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pf.click('#btn-vr');
      await pf.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await quadros(pf, 15);
      const r = await pf.evaluate(() => { const d = window.Orvalho.jogo._debug(), w = new THREE.Vector3(); d.camera.getWorldPosition(w); return { tipo: window.Orvalho.xr.sessao.tipo(), ativa: window.Orvalho.xr.sessao.ativa(), olhoY: w.y, piso: d.st.y }; });
      rel['fallback-' + variante] = r;
      ok(r.ativa && r.tipo === esperado, `${variante}: a sessão abre com ${esperado} (${r.tipo})`);
      if (esperado === 'local') ok(r.olhoY - r.piso > 1.2, `em 'local' o rig põe os olhos acima do piso (${(r.olhoY - r.piso).toFixed(2)} m)`);
      await pf.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pf.close();
    }

    console.log('8. log e diagnóstico (?vr-log=1), para o Quest sem chrome://inspect');
    {
      const errosLog = [];   // esta página gera erros de propósito: ficam fora da checagem final do console
      const pl = await paginaXR(browser, 'quest3', errosLog);
      await preparar(pl, url + '?vr-log=1', { amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: 1.2, yaw: 0, pitch: 0.4, dist: 2.9 });
      await pl.waitForSelector('#diag-vr', { timeout: 5000 }).catch(() => {});
      await pl.waitForFunction(() => /immersive-vr\s*sim/.test(document.querySelector('#diag-vr').innerText), null, { timeout: 5000 }).catch(() => {});
      const d0 = await pl.evaluate(() => ({ txt: document.querySelector('#diag-vr') ? document.querySelector('#diag-vr').innerText : '', op: window.Orvalho.xr.opcoes.ler().log }));
      ok(/isSecureContext\s*sim/.test(d0.txt) && /navigator\.xr\s*sim/.test(d0.txt) && /immersive-vr\s*sim/.test(d0.txt), 'a tela inicial mostra isSecureContext, navigator.xr e immersive-vr');
      ok(d0.op === true, '?vr-log=1 fica salvo em orvalho-vr');
      await pl.evaluate(() => { console.error('erro-de-teste-123'); setTimeout(() => { throw new Error('nao-capturado-456'); }); Promise.reject(new Error('rejeitada-789')); });
      await pl.waitForTimeout(600);
      const d1 = await pl.evaluate(() => document.querySelector('#diag-vr').innerText);
      ok(/erro-de-teste-123/.test(d1) && /nao-capturado-456/.test(d1) && /rejeitada-789/.test(d1), 'console.error, erro não capturado e promessa rejeitada aparecem no quadro');
      await pl.click('#btn-vr');
      await pl.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await pl.waitForTimeout(1500); await quadros(pl, 10);
      const d2 = await pl.evaluate(() => { const cam = window.Orvalho.jogo._debug().camera, m = cam.getObjectByName('xr-log');
        return { painel: !!window.Orvalho.xr.sessao.painelLog(), mesh: !!m && m.visible, medidor: !!cam.getObjectByName('xr-medidor'),
          sessao: window.Orvalho.xr.log.entradas().some(e => /sessão iniciada/.test(e.texto)) }; });
      ok(d2.painel && d2.mesh && d2.medidor, 'dentro do VR, o painel de log fica preso à vista junto com o medidor');
      ok(d2.sessao, 'o log registra a sessão iniciada (reference space, framebuffer, foveação)');
      await pl.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pl.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      await pl.waitForTimeout(500);
      const d3 = await pl.evaluate(() => ({ mesh: !!window.Orvalho.jogo._debug().camera.getObjectByName('xr-log'), painel: !!window.Orvalho.xr.sessao.painelLog(),
        txt: document.querySelector('#diag-vr').innerText, visivel: getComputedStyle(document.querySelector('#diag-vr')).display !== 'none' }));
      ok(!d3.mesh && !d3.painel, 'ao sair, o painel do VR é descartado');
      ok(d3.visivel && /Último VR: [\d.]+ fps/.test(d3.txt) && /sessão encerrada/.test(d3.txt), 'fora do VR, o quadro mostra as últimas medidas e a sessão encerrada');
      await pl.click('#diag-vr header button');
      ok(await pl.locator('#diag-vr').count() === 0 && await pl.evaluate(() => window.Orvalho.xr.opcoes.ler().log === false), 'o × desliga o diagnóstico e salva');
      rel.log = { inicio: d0.txt, depoisDoVR: d3.txt };
      const inesperados = errosLog.filter(e => !/erro-de-teste-123|nao-capturado-456|rejeitada-789|favicon/.test(e));
      ok(inesperados.length === 0, 'sem erros além dos provocados' + (inesperados.length ? ': ' + inesperados.slice(0, 3).join(' | ') : ''));
      await pl.close();
    }

    console.log('9. taxa de quadros (72 Hz por padrão) e saída segurando B (B rápido = ação curta)');
    {
      const pz = await paginaXR(browser, 'quest3', erros);
      await preparar(pz, url, { amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: 1.2, yaw: 0, pitch: 0.4, dist: 2.9 });
      await pz.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pz.click('#btn-vr');
      await pz.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await pz.waitForFunction(() => window.Orvalho.xr.sessao.hz().ativo === 72, null, { timeout: 5000 }).catch(() => {});
      const h = await pz.evaluate(() => ({ hz: window.Orvalho.xr.sessao.hz(), frameRate: window.Orvalho.jogo._debug().renderer.xr.getSession().frameRate, op: window.Orvalho.xr.opcoes.ler() }));
      rel.hz = h;
      ok(h.op.hz === 72 && h.op.escalaFb === null && h.op.foveacao === 1 && h.op.contorno === 10 && h.op.zonas === true && h.op.dist === 25, `padrões: 72 Hz, framebuffer automático, foveação 1, contornos até 10 m, zonas ligadas, móveis de outras zonas até 25 m (${h.op.hz} Hz, fb ${h.op.escalaFb}, fov ${h.op.foveacao}, ${h.op.contorno} m, zonas ${h.op.zonas}, ${h.op.dist} m)`);
      ok(h.frameRate === 72 && h.hz.ativo === 72, `a sessão fica em 72 Hz (session.frameRate = ${h.frameRate}; o IWER começa em 90)`);
      await pz.waitForTimeout(1200);
      const med = await pz.evaluate(() => window.Orvalho.xr.sessao.medidor().amostra());
      ok(med && med.hzAtivo === 72 && med.hzPedido === 72, `o medidor mostra a taxa ativa e a pedida (${med && med.hzAtivo} / ${med && med.hzPedido})`);
      ok(med && med.escalaFb === 1.2, `no jogo normal o framebuffer automático é ×1,2 também no Lab (×${med && med.escalaFb}; ×1,5 só no modo teste)`);
      /* ação curta do B: conta quantas vezes foi chamada; o anel é observado a cada quadro */
      await pz.evaluate(() => {
        window.__bCurto = 0; window.__anelVisto = false;
        window.Orvalho.xr.sessao.aoBCurto(() => { window.__bCurto++; return true; });
        const s = window.Orvalho.jogo._debug().renderer.xr.getSession();
        (function vigia(){ const a = window.Orvalho.xr.sessao.anel(); if (a && a.visivel()) window.__anelVisto = true; if (window.Orvalho.xr.sessao.ativa()) s.requestAnimationFrame(vigia); })();
        window.__pulsos = 0;
        (s.inputSources || []).forEach(f => { const h = f.gamepad && f.gamepad.hapticActuators && f.gamepad.hapticActuators[0];
          if (h && f.handedness === 'right') { const orig = h.pulse; h.pulse = function(){ window.__pulsos++; return orig ? orig.apply(h, arguments) : Promise.resolve(true); }; } });
      });
      const temHaptic = await pz.evaluate(() => (window.Orvalho.jogo._debug().renderer.xr.getSession().inputSources || []).some(f => f.handedness === 'right' && f.gamepad && f.gamepad.hapticActuators && f.gamepad.hapticActuators.length));
      const estadoB = () => pz.evaluate(() => ({ ativa: window.Orvalho.xr.sessao.ativa(), curto: window.__bCurto, anel: window.__anelVisto }));
      /* os dois grips segurados não saem mais (atalho antigo removido) */
      await pz.evaluate(() => { window.__xr.controllers.left.updateButtonValue('squeeze', 1); window.__xr.controllers.right.updateButtonValue('squeeze', 1); });
      await pz.waitForTimeout(2200);
      await pz.evaluate(() => { window.__xr.controllers.left.updateButtonValue('squeeze', 0); window.__xr.controllers.right.updateButtonValue('squeeze', 0); });
      ok((await estadoB()).ativa, 'segurar os dois grips não encerra mais a sessão (atalho antigo removido)');
      /* B rápido: ação curta, sem anel e sem sair */
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 1));
      await pz.waitForTimeout(120);
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 0));
      await pz.waitForTimeout(400);
      let e = await estadoB();
      ok(e.ativa && e.curto === 1 && !e.anel, `B rápido faz a ação curta uma vez, sem anel e sem sair (ações ${e.curto}, anel ${e.anel})`);
      /* B segurado ~0,9 s e solto: o anel aparece, mas não sai nem faz a ação curta */
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 1));
      await pz.waitForTimeout(900);
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 0));
      await pz.waitForTimeout(500);
      e = await estadoB();
      ok(e.ativa && e.curto === 1 && e.anel, `B segurado e solto antes de 1,5 s: o anel aparece, não sai e não dispara a ação curta (ações ${e.curto}, anel ${e.anel})`);
      ok(await pz.evaluate(() => !window.Orvalho.xr.sessao.anel().visivel()), 'ao soltar, o anel some');
      /* B segurado: sai em ~1,5 s, vibra, e soltar depois não dispara a ação curta */
      const t0 = Date.now();
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 1));
      await pz.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 8000 }).catch(() => {});
      const dt = (Date.now() - t0) / 1000;
      await pz.evaluate(() => window.__xr.controllers.right.updateButtonValue('b-button', 0));
      await pz.waitForTimeout(300);
      const fim = await pz.evaluate(() => ({ ativa: window.Orvalho.xr.sessao.ativa(), curto: window.__bCurto, pulsos: window.__pulsos, log: window.Orvalho.xr.log.entradas().map(e => e.texto) }));
      ok(!fim.ativa && dt >= 1.4, `segurar B encerra a sessão (${dt.toFixed(1)} s)`);
      ok(fim.curto === 1, `soltar B depois de sair não dispara a ação curta (ações ${fim.curto})`);
      if (temHaptic) ok(fim.pulsos >= 1, `o controle direito vibra ao completar (${fim.pulsos} pulso)`);
      else console.log('  · o IWER não expõe atuador háptico neste controle: vibração só se confere no Quest');
      ok(fim.log.some(t => /segure B por 1,5 s/.test(t)) && !fim.log.some(t => /grips/.test(t)), 'a dica de saída no log fala do B (e não mais dos grips)');
      await pz.close();
    }

    console.log('10. ?vr-ponto, ?vr-fb=1.7 e otimizações do Hall (células, contornos até 10 m, vidro numa passada)');
    {
      const pp = await paginaXR(browser, 'quest3', erros);
      await preparar(pp, url);
      await pp.goto(url + '?vr-ponto=hall-palco');
      await pp.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      const salvo = await pp.evaluate(() => ({ ponto: window.Orvalho.xr.pontos.atual() && window.Orvalho.xr.pontos.atual().id, s: JSON.parse(localStorage.getItem('orvalho-jogo')), fb: window.Orvalho.xr.opcoes.escalaPara('hall-inovale') }));
      ok(salvo.ponto === 'hall-palco' && salvo.s.amb === 'hall-inovale' && salvo.s.x === 30 && salvo.s.z === 6, '?vr-ponto=hall-palco põe a exploração salva no ponto');
      ok(salvo.fb.valor === 1.2 && salvo.fb.auto, `no Hall o framebuffer automático continua ×1,2 (×${salvo.fb.valor})`);
      await pp.click('#btn-vr');
      await pp.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await quadros(pp, 10);
      const emVR = await pp.evaluate(() => {
        const d = window.Orvalho.jogo._debug(), cab = new THREE.Vector3(); d.camera.getWorldPosition(cab);
        let cel = 0, culled = 0, cascas = 0, visiveis = 0, longe = 0, longeVis = 0, vidros = 0, vidrosUma = 0;
        d.amb.grupo.traverse(o => {
          if (o.isInstancedMesh && o.name && !(o.parent && o.parent.isInstancedMesh)) { cel++; if (o.frustumCulled) culled++;   // móveis (luminárias e sombras do piso ficam sem recorte, de propósito)
            const c = o.children[0]; if (c && c.isInstancedMesh) { cascas++; if (c.visible) visiveis++; const e = o.geometry.boundingSphere; if (cab.distanceTo(e.center) - e.radius > 10) { longe++; if (c.visible) longeVis++; } } }
          [].concat(o.material || []).forEach(m => { if (m.transparent && m.side === THREE.DoubleSide) { vidros++; if (m.forceSinglePass) vidrosUma++; } });
        });
        return { amb: window.Orvalho.jogo.ambienteAtual(), x: d.st.x, z: d.st.z, cel, culled, cascas, visiveis, longe, longeVis, vidros, vidrosUma };
      });
      rel.otimizacoes = emVR;
      ok(emVR.amb === 'hall-inovale' && Math.hypot(emVR.x - 30, emVR.z - 6) < 0.3, `a sessão começa no ponto (${emVR.x.toFixed(2)}, ${emVR.z.toFixed(2)})`);
      ok(emVR.cel > 300 && emVR.culled === emVR.cel, `móveis em células com recorte pela câmera (${emVR.culled}/${emVR.cel})`);
      ok(emVR.longe > 0 && emVR.longeVis === 0 && emVR.visiveis > 0, `contornos só até 10 m (${emVR.visiveis} visíveis; ${emVR.longe} células longe, ${emVR.longeVis} com contorno)`);
      ok(emVR.vidros > 0 && emVR.vidrosUma === emVR.vidros, `vidros de dupla face numa passada em VR (${emVR.vidrosUma}/${emVR.vidros})`);
      await pp.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pp.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      const fora = await pp.evaluate(() => { const d = window.Orvalho.jogo._debug(); let cascasOff = 0, vidrosUma = 0;
        d.amb.grupo.traverse(o => { if (o.isInstancedMesh && o.parent && o.parent.isInstancedMesh && !o.visible) cascasOff++; [].concat(o.material || []).forEach(m => { if (m.forceSinglePass) vidrosUma++; }); });
        return { cascasOff, vidrosUma }; });
      ok(fora.cascasOff === 0 && fora.vidrosUma === 0, `ao sair, o desktop volta com todos os contornos e os vidros em duas passadas (${fora.cascasOff} / ${fora.vidrosUma})`);
      await pp.goto(url + '?vr-fb=1.7&vr-fov=0.5&vr-contorno=0');
      const op = await pp.evaluate(() => ({ op: window.Orvalho.xr.opcoes.ler(), fb: window.Orvalho.xr.opcoes.escalaPara('lab-ia') }));
      ok(op.op.escalaFb === 1.5 && !op.fb.auto && op.op.foveacao === 0.5 && op.op.contorno === 0, `?vr-fb=1.7 fica no teto 1,5 (o Quest 3S limita ali), ?vr-fov=0.5 e ?vr-contorno=0 são aceitos e salvos (fb ${op.op.escalaFb})`);
      await pp.goto(url + '?vr-fb=auto');
      ok(await pp.evaluate(() => window.Orvalho.xr.opcoes.escalaPara('lab-ia').auto), '?vr-fb=auto volta ao padrão por ambiente');
      await pp.close();
    }

    console.log('11. modo teste (?vr-teste): rótulo, registros por POST, setores de yaw, marca, página /t');
    {
      const pt = await paginaXR(browser, 'quest3', erros);
      await pt.addInitScript(() => { window.Orvalho = window.Orvalho || {}; window.Orvalho.config = { testeVR: { aquecimento: 1, envio: 2 } }; });
      await preparar(pt, url);
      const antes = await pt.evaluate(() => localStorage.getItem('orvalho-vr'));
      await pt.goto(url + '?vr-log=1&vr-fov=1&vr-fb=auto&vr-contorno=0&vr-zonas=0&vr-dist=15&vr-giro=0&vr-ponto=acioc&vr-teste=t-auto');   // giro manual: a volta é feita pelo teste
      const op = await pt.evaluate(() => ({ op: window.Orvalho.xr.opcoes.ler(), id: window.Orvalho.xr.opcoes.teste(), salvo: localStorage.getItem('orvalho-vr'), link: !!document.querySelector('#diag-vr .diag-teste a[href="/t"]') }));
      ok(op.id === 't-auto' && op.op.contorno === 0 && op.op.zonas === false && op.op.dist === 15 && op.op.log === true, 'com ?vr-teste, os parâmetros da URL valem nesta carga');
      ok(op.salvo === antes, 'e não são salvos (o próximo teste e o jogo normal não herdam a configuração)');
      ok(op.link, 'o quadro de diagnóstico mostra o teste e o link de volta para /t');
      await pt.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pt.click('#btn-vr');
      await pt.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await quadros(pt, 30);
      const rot = await pt.evaluate(() => window.Orvalho.xr.sessao.medidor().rotulo());
      ok(/TESTE t-auto · PONTO acioc/.test(rot[0]) && /FB ×1\.2A FOV 1 C∞ Z0 D15/.test(rot[1]) && /^X \d/.test(rot[2]) && /YAW \d+° \S+ · ACIOC/.test(rot[2]), 'rótulo fixo no medidor: ' + rot.join(' | '));
      /* aquecimento de 1 s; depois gira a cabeça em 8 direções */
      await pt.waitForTimeout(1300);
      for (let yaw = 0; yaw < 360; yaw += 45) {
        await pt.evaluate(Y => { const cam = window.Orvalho.jogo._debug().camera, a = Y * Math.PI / 180 - cam.parent.rotation.y - Math.PI; window.__xr.quaternion.set(0, Math.sin(a / 2), 0, Math.cos(a / 2)); }, yaw);
        await pt.waitForTimeout(350);
      }
      await pt.evaluate(() => window.__xr.controllers.right.updateButtonValue('a-button', 1));
      await quadros(pt, 5);
      await pt.evaluate(() => window.__xr.controllers.right.updateButtonValue('a-button', 0));
      await pt.waitForTimeout(2300);   // um envio de setores depois da volta
      await pt.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pt.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      await pt.waitForTimeout(500);
      const arqs = fs.readdirSync(PASTA_MED).filter(f => f.endsWith('.jsonl'));
      const regs = arqs.length ? fs.readFileSync(path.join(PASTA_MED, arqs[0]), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.teste === 't-auto') : [];
      const tipos = new Set(regs.map(r => r.tipo)), ini = regs.find(r => r.tipo === 'inicio'), fim = regs.find(r => r.tipo === 'fim'), marca = regs.find(r => r.tipo === 'marca');
      rel.medicoes = { arquivo: arqs[0], tipos: [...tipos], inicio: ini, fim: fim && { setoresCobertos: fim.setoresCobertos, setores: fim.setores } };
      ok(arqs.length === 1 && /^\d{4}-\d\d-\d\d\.jsonl$/.test(arqs[0]), `o servidor grava em <data>.jsonl (${arqs[0]})`);
      ok(['inicio', 'resumo', 'setores', 'marca', 'fim'].every(t => tipos.has(t)), 'registros de início, resumo, setores, marca e fim (' + [...tipos].join(', ') + ')');
      ok(ini && ini.ponto === 'acioc' && ini.parametros.fb === 1.2 && ini.parametros.zonas === false && ini.parametros.dist === 15 && ini.hzAtivo === 72 && ini.fbReal && typeof ini.yaw === 'number' && ini.pos && typeof ini.gpuDisponivel === 'boolean',
        `o início leva ponto, parâmetros, framebuffer real, Hz ativo, posição e yaw (fb real ${ini && ini.fbReal}, GPU ${ini && (ini.gpuDisponivel ? 'disponível' : ini.gpuMotivo)})`);
      const res = regs.find(r => r.tipo === 'resumo' && r.medidas);
      ok(res && res.medidas.fps > 0 && res.medidas.piorMs > 0 && res.medidas.draws > 0 && res.medidas.tris > 0 && res.medidas.cpuAtualizacao >= 0 && res.medidas.cpuRender > 0, 'o resumo traz fps médio e pior, draws, triângulos e CPU separada em atualização e render');
      ok(fim && fim.setoresCobertos === 8 && fim.setores.every(l => l.quadros > 0 && l.draws > 0 && l.fps > 0), `a volta de 360° cobre os 8 setores de yaw (${fim && fim.setoresCobertos}/8)`);
      ok(marca && marca.marca === 1 && marca.medidas && marca.medidas.draws > 0, 'o botão A registra uma marca com os dados do instante');
      ok(ini && ini.giroAuto === 0 && !('bateria' in ini), `com ?vr-giro=0 o início registra giro manual (giroAuto ${ini && ini.giroAuto})`);
      /* página /t e segurança do endpoint */
      const pg = await pt.goto(url.replace('/index.html', '/t'));
      const html = await pt.content();
      ok(pg.status() === 200 && /hall-palco/.test(html) && /acioc-z0/.test(html) && /vr-teste=incubadora/.test(html) && /vr-fb=auto/.test(html), 'a página /t lista um botão por teste');
      const fake = (ip, metodo, cabec, corpo) => new Promise(r => {
        const req = new (require('events'))(); req.url = '/__orvalho/medicoes'; req.method = metodo; req.headers = cabec; req.socket = { remoteAddress: ip };
        req.setEncoding = () => {}; req.destroy = () => {};
        const rsp = { writeHead(c){ this.c = c; }, end(){ r(this.c); } };
        vrTeste.tratar(req, rsp); setImmediate(() => { if (corpo != null) req.emit('data', corpo); req.emit('end'); });
      });
      const j = { 'content-type': 'application/json' };
      ok(await fake('8.8.8.8', 'POST', j, '{"tipo":"inicio","teste":"x"}') === 403, 'o endpoint recusa IP fora da rede local (403)');
      ok(await fake('192.168.0.50', 'POST', { 'content-type': 'text/plain' }, 'x') === 415, 'só aceita JSON (415)');
      ok(await fake('192.168.0.50', 'POST', j, 'x'.repeat(40 * 1024)) === 413, 'recusa corpo maior que 32 KB (413)');
      ok(await fake('192.168.0.50', 'POST', j, '{"tipo":"apagar","teste":"x"}') === 400, 'recusa registro de tipo desconhecido (400)');
      ok(await fake('192.168.0.50', 'GET', j, null) === 405, 'não tem rota de leitura (405)');
      await pt.close();
    }

    console.log('12. zonas de visibilidade do Hall e distância máxima dos móveis');
    {
      const pz = await paginaXR(browser, 'quest3', erros);
      await preparar(pz, url);
      const estado = () => pz.evaluate(() => {
        const a = window.Orvalho.jogo._debug().amb, porZona = {};
        a.grupo.traverse(o => { if (!(o.isInstancedMesh && window.Orvalho.moveis.TIPOS[o.name])) return;
          const c = o.geometry.boundingSphere.center, z = a.zonaEm(c.x, c.z, c.y > 3.5 ? 4.2 : 0) || '-', e = porZona[z] || (porZona[z] = { n: 0, vis: 0 }); e.n++; if (o.visible) e.vis++; });
        const portas = []; a.grupo.traverse(o => { if (o.userData && o.userData.porta) portas.push({ id: o.userData.porta, vis: o.visible }); });
        return { zona: a.zonaVR(), porZona, portas };
      });
      await pz.goto(url + '?vr-ponto=acioc&vr-zonas=1&vr-dist=0');
      await pz.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pz.click('#btn-vr');
      await pz.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await quadros(pz, 10);
      const z1 = await estado();
      rel.zonas = z1;
      const vis = (z, e) => e.porZona[z] ? e.porZona[z].vis : 0, tot = (z, e) => e.porZona[z] ? e.porZona[z].n : 0;
      ok(z1.zona === 'acioc', `a cabeça está na zona acioc (${z1.zona})`);
      const parcial = await pz.evaluate(() => { const a = window.Orvalho.jogo._debug().amb, ent = (a.zonasVR.ve.acioc || []).find(e => e && e.zona === 'salas'), em = ent ? ent.em : [], fora = [];
        a.grupo.traverse(o => { if (!(o.isInstancedMesh && window.Orvalho.moveis.TIPOS[o.name] && o.visible)) return; const c = o.geometry.boundingSphere.center;
          if (a.zonaEm(c.x, c.z, c.y > 3.5 ? 4.2 : 0) !== 'salas') return; if (!em.some(r => c.x >= r[0] && c.x <= r[2] && c.z >= r[1] && c.z <= r[3])) fora.push(o.name); });
        return { ret: em.length, fora }; });
      ok(tot('salas', z1) > 0 && vis('salas', z1) > 0 && vis('salas', z1) < tot('salas', z1) / 3 && parcial.fora.length === 0 && tot('administrativo', z1) > 0 && vis('administrativo', z1) === 0,
        `do ACIOC, o Administrativo fica oculto e das salas só os blocos dentro dos retângulos da visibilidade parcial (salas ${vis('salas', z1)}/${tot('salas', z1)}, ${parcial.ret} retângulo, ${parcial.fora.length} fora; administrativo ${vis('administrativo', z1)}/${tot('administrativo', z1)})`);
      ok(vis('acioc', z1) === tot('acioc', z1) && vis('corredor', z1) === tot('corredor', z1), 'os da própria zona e do corredor ficam visíveis');
      /* a porta do Administrativo fica na frente de vidro (um lado é o corredor): continua visível; a da sala de Dagliê e Danimara
         (dentro do Administrativo) some */
      const portaAdm = z1.portas.find(p => p.id === 'administrativo'), portaSala = z1.portas.find(p => p.id === 'sala-adm'), portaAcioc = z1.portas.find(p => p.id === 'acioc');
      ok(portaAcioc && portaAcioc.vis && portaAdm && portaAdm.vis && portaSala && !portaSala.vis, 'portas: a do ACIOC e a da frente do Administrativo aparecem; a da sala interna do Administrativo some');
      await pz.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pz.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      const z2 = await estado();
      ok(Object.values(z2.porZona).every(e => e.vis === e.n) && z2.portas.every(p => p.vis), 'ao sair, todos os móveis e portas voltam');
      /* sem zonas e com distância de 12 m: só os blocos perto da cabeça */
      await pz.goto(url + '?vr-ponto=acioc&vr-zonas=0&vr-dist=12');
      await pz.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pz.click('#btn-vr');
      await pz.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await quadros(pz, 10);
      const d1 = await pz.evaluate(() => { const d = window.Orvalho.jogo._debug(), a = d.amb, cab = new THREE.Vector3(); d.camera.getWorldPosition(cab); let perto = 0, pertoVis = 0, longe = 0, longeVis = 0, propria = 0, propriaVis = 0;
        const zc = a.zonaVR();
        a.grupo.traverse(o => { if (!(o.isInstancedMesh && window.Orvalho.moveis.TIPOS[o.name])) return; const e = o.geometry.boundingSphere, dd = cab.distanceTo(e.center) - e.radius;
          if (a.zonaEm(e.center.x, e.center.z, e.center.y > 3.5 ? 4.2 : 0) === zc) { propria++; if (o.visible) propriaVis++; }
          else if (dd > 12) { longe++; if (o.visible) longeVis++; } else { perto++; if (o.visible) pertoVis++; } });
        return { zc, perto, pertoVis, longe, longeVis, propria, propriaVis }; });
      ok(d1.longe > 0 && d1.longeVis === 0 && d1.pertoVis === d1.perto, `?vr-dist=12 esconde os blocos de móveis de outras zonas além de 12 m (${d1.longeVis}/${d1.longe} longe visíveis, ${d1.pertoVis}/${d1.perto} perto)`);
      ok(d1.propria > 0 && d1.propriaVis === d1.propria, `os da zona da cabeça (${d1.zc}) nunca somem pela distância (${d1.propriaVis}/${d1.propria})`);
      await pz.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pz.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      await pz.goto(url + '?vr-zonas=1&vr-dist=25');   // devolve os padrões a este navegador de teste
      await pz.close();
    }

    /* registros gravados pelo endpoint (pasta temporária) */
    const lerRegs = () => fs.readdirSync(PASTA_MED).filter(f => f.endsWith('.jsonl'))
      .flatMap(f => fs.readFileSync(path.join(PASTA_MED, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
    /* posição da cabeça no mundo a cada quadro da sessão (mín/máx de x e z depois que ela se assenta) */
    const vigiarCabeca = pg => pg.evaluate(() => {
      const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), v = new THREE.Vector3();
      window.__cab = { n: 0, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 };
      (function f(){ if (!window.Orvalho.xr.sessao.ativa()) return; d.camera.getWorldPosition(v); const c = window.__cab; c.n++;
        if (c.n > 5) { c.minX = Math.min(c.minX, v.x); c.maxX = Math.max(c.maxX, v.x); c.minZ = Math.min(c.minZ, v.z); c.maxZ = Math.max(c.maxZ, v.z); }
        s.requestAnimationFrame(f); })();
    });

    console.log('13. modo teste: giro automático em torno da cabeça e bipes');
    {
      const pg = await paginaXR(browser, 'quest3', erros);
      await pg.addInitScript(() => { window.Orvalho = window.Orvalho || {}; window.Orvalho.config = { testeVR: { aquecimento: 1.5, envio: 2 } }; });
      await preparar(pg, url);
      await pg.goto(url + '?vr-fb=auto&vr-giro=180&vr-ponto=lab&vr-teste=t-giro');
      await pg.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pg.click('#btn-vr');
      await pg.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await vigiarCabeca(pg);
      const rot0 = await pg.evaluate(() => window.Orvalho.jogo._debug().camera.parent.rotation.y);
      await pg.waitForFunction(() => window.Orvalho.xr.teste.eventos().some(e => e.n === 2), null, { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(300);
      const r = await pg.evaluate(() => ({ ev: window.Orvalho.xr.teste.eventos().map(e => e.n), rot: window.Orvalho.jogo._debug().camera.parent.rotation.y,
        cab: window.__cab, girado: window.Orvalho.xr.sessao.teste().girado(), ativa: window.Orvalho.xr.sessao.ativa() }));
      rel.giro = r;
      ok(r.ev.join(',') === '1,2', `bipes: 1 no fim do aquecimento e 2 no fim da volta (${r.ev.join(',')})`);
      ok(Math.abs(r.girado - 360) < 0.01 && Math.abs(Math.abs(r.rot - rot0) - 2 * Math.PI) < 0.05, `o rig dá exatamente uma volta (${r.girado.toFixed(1)}°, rotação do rig ${((r.rot - rot0) * 180 / Math.PI).toFixed(1)}°)`);
      const desvio = Math.max(r.cab.maxX - r.cab.minX, r.cab.maxZ - r.cab.minZ);
      ok(r.cab.n > 10 && desvio < 0.02, `a cabeça não sai do lugar durante o giro (desvio ${(desvio * 100).toFixed(1)} cm em ${r.cab.n} quadros)`);
      ok(r.ativa, 'num teste avulso, a sessão continua depois da volta (sai com B)');
      await pg.evaluate(() => window.Orvalho.xr.sessao.sair());
      await pg.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const regs = lerRegs().filter(x => x.teste === 't-giro'), fimR = regs.find(x => x.tipo === 'fim'), iniR = regs.find(x => x.tipo === 'inicio');
      ok(iniR && iniR.giroAuto === 180 && fimR && fimR.setoresCobertos === 8, `com o giro automático, os 8 setores são cobertos sem mexer a cabeça (${fimR && fimR.setoresCobertos}/8, giro ${iniR && iniR.giroAuto}°/s)`);
      ok(['inicio', 'setores', 'fim'].every(t => regs.some(x => x.tipo === t)) && regs.every(x => x.parametros && 'fbReal' in x && 'hzAtivo' in x), 'os registros continuam no mesmo formato (início, setores, fim; parâmetros, framebuffer real, Hz)');
      await pg.close();
    }

    console.log('14. bateria Lab: troca de parâmetros e foveação na mesma sessão, bipes e fim automático');
    {
      const pb = await paginaXR(browser, 'quest3', erros);
      await pb.addInitScript(() => { window.Orvalho = window.Orvalho || {}; window.Orvalho.config = { testeVR: { aquecimento: 1, aquecBateria: 0.5, pausa: 0.3, envio: 2 } }; });
      await preparar(pb, url);
      const antes = await pb.evaluate(() => localStorage.getItem('orvalho-vr'));
      await pb.goto(url + '?vr-log=1&vr-fov=1&vr-fb=auto&vr-contorno=10&vr-zonas=1&vr-dist=25&vr-giro=360&vr-ponto=lab&vr-bateria=lab&vr-teste=bateria-lab');
      await pb.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await pb.click('#btn-vr');
      await pb.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 15000 }).catch(() => {});
      await pb.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 90000 }).catch(() => {});
      await pb.waitForTimeout(500);
      const r = await pb.evaluate(() => ({ ativa: window.Orvalho.xr.sessao.ativa(), vr: window.Orvalho.jogo.vr.ativo(), ev: window.Orvalho.xr.teste.eventos().map(e => e.n),
        salvo: localStorage.getItem('orvalho-vr'), log: window.Orvalho.xr.log.entradas().map(e => e.texto) }));
      const regs = lerRegs().filter(x => ['lab', 'lab-c0', 'lab-fov05', 'lab-mudo'].includes(x.teste));
      const inis = regs.filter(x => x.tipo === 'inicio'), fins = regs.filter(x => x.tipo === 'fim');
      rel.bateriaLab = { ev: r.ev, inicios: inis.map(x => ({ teste: x.teste, bateria: x.bateria, parametros: x.parametros })), fins: fins.map(x => ({ teste: x.teste, setores: x.setoresCobertos })) };
      ok(!r.ativa && !r.vr, 'a sessão termina sozinha no fim da bateria e o desktop volta');
      ok(inis.map(x => x.teste).join(',') === 'lab,lab-c0,lab-fov05,lab-mudo' && inis.every((x, i) => x.bateria && x.bateria.id === 'lab' && x.bateria.passo === i + 1 && x.bateria.de === 4),
        `quatro testes na ordem, cada um com o passo da bateria (${inis.map(x => x.teste + (x.bateria ? ' ' + x.bateria.passo + '/' + x.bateria.de : '')).join(', ')})`);
      const par = id => (inis.find(x => x.teste === id) || {}).parametros || {};
      ok(par('lab').contorno === 10 && par('lab').fov === 1 && par('lab-c0').contorno === 0 && par('lab-c0').fov === 1 && par('lab-fov05').fov === 0.5 && par('lab-fov05').contorno === 10,
        `cada passo aplica os seus parâmetros e volta aos da bateria depois (contorno ${par('lab').contorno}/${par('lab-c0').contorno}/${par('lab-fov05').contorno}, foveação ${par('lab').fov}/${par('lab-c0').fov}/${par('lab-fov05').fov})`);
      ok(inis.every(x => x.parametros.fb === 1.5), 'o framebuffer fica o da entrada (×1,5 no Lab) em todos os passos');
      ok(fins.length === 4 && fins.every(x => x.setoresCobertos === 8), `cada passo grava o fim com os 8 setores (${fins.map(x => x.setoresCobertos).join('/')})`);
      ok(r.ev.join(',') === '1,2,1,2,1,2,1,3', `bipes: 1 e 2 a cada passo, 3 no fim (${r.ev.join(',')})`);
      ok(r.salvo === antes, 'nada da bateria fica salvo nas opções');
      const picos = regs.filter(x => x.tipo === 'resumo' || x.tipo === 'fim');
      ok(picos.length && picos.every(x => Array.isArray(x.picos) && typeof x.picosTotal === 'number'), 'resumo e fim levam os quadros acima de 25 ms (instante e eventos do instrumento)');
      ok(r.log.some(t => /bateria "lab" concluída/.test(t)), 'o log registra o fim da bateria');
      await pb.close();
    }

    console.log('15. bateria Hall: 9 pontos nos dois pavimentos numa sessão só');
    {
      const ph = await paginaXR(browser, 'quest3', erros);
      await ph.addInitScript(() => { window.Orvalho = window.Orvalho || {}; window.Orvalho.config = { testeVR: { aquecimento: 1, aquecBateria: 0.3, pausa: 0.2, envio: 2 } }; });
      await preparar(ph, url);
      await ph.goto(url + '?vr-fov=1&vr-fb=auto&vr-contorno=10&vr-zonas=1&vr-dist=25&vr-giro=720&vr-ponto=hall-entrada&vr-bateria=hall&vr-teste=bateria-hall');
      await ph.waitForSelector('#btn-vr:not([hidden])', { timeout: 5000 });
      await ph.click('#btn-vr');
      await ph.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 30000 }).catch(() => {});
      await ph.waitForFunction(() => !window.Orvalho.xr.sessao.ativa(), null, { timeout: 180000 }).catch(() => {});
      await ph.waitForTimeout(500);
      const pontos = await ph.evaluate(() => window.Orvalho.xr.pontos.lista);
      const ids = ['hall-entrada', 'hall-palco', 'hall-cafe', 'escada', 'andar1-vao', 'acioc', 'administrativo', 'incubadora-corredor', 'incubadora'];
      const inis = lerRegs().filter(x => x.tipo === 'inicio' && x.bateria && x.bateria.id === 'hall');
      const longe = inis.map(x => { const p = pontos.find(q => q.id === x.ponto); return { id: x.teste, d: Math.hypot(x.pos.x - p.x, x.pos.z - p.z), olhos: x.pos.y - p.y, zona: x.zona }; });
      rel.bateriaHall = longe;
      ok(inis.map(x => x.teste).join(',') === ids.join(','), `os 9 pontos na ordem (${inis.map(x => x.teste).join(', ')})`);
      ok(longe.every(l => l.d < 0.3 && l.olhos > 1.2 && l.olhos < 2.0), 'cada passo começa com a cabeça no ponto e na altura dos olhos daquele pavimento: ' + longe.map(l => `${l.id} ${l.d.toFixed(2)} m/${l.olhos.toFixed(2)}`).join(', '));
      const zona = id => (longe.find(l => l.id === id) || {}).zona;
      ok(zona('acioc') === 'acioc' && zona('incubadora') === 'incubadora' && zona('hall-cafe') === 'hall' && zona('administrativo') === 'administrativo', `o início de cada passo registra a zona do ponto novo (acioc ${zona('acioc')}, incubadora ${zona('incubadora')}, café ${zona('hall-cafe')}, adm ${zona('administrativo')})`);
      ok(!(await ph.evaluate(() => window.Orvalho.xr.sessao.ativa())), 'a sessão termina sozinha');
      await ph.close();
    }

    const errosReais = erros.filter(e => !/favicon/i.test(e));
    ok(errosReais.length === 0, 'console sem erros' + (errosReais.length ? ': ' + errosReais.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    falhas.push('exceção: ' + e.message); console.error(e);
  } finally {
    if (browser) await browser.close();
    server.close();
    try { fs.rmSync(PASTA_MED, { recursive: true, force: true }); } catch (e) {}
    fs.writeFileSync(path.join(__dirname, 'relatorio-vr.json'), JSON.stringify({ data: new Date().toISOString(), falhas, erros, rel }, null, 2));
    if (falhas.length) { console.log(`\n✘ ${falhas.length} falha(s) · relatório em testes/relatorio-vr.json`); process.exit(1); }
    console.log('\n✔ modo VR (etapa 1) validado no emulador · relatório em testes/relatorio-vr.json');
  }
})();
