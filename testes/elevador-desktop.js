/* Elevador no modo desktop (sem VR), com a mesma lógica do VR: a porta do Lab leva ao elevador do Hall (painel aberto, visor
   "Lab"), o painel tem "Lab IA" sem número de pavimento, e o Hall volta ao Lab pelo elevador. Tudo pelo que o jogador faz:
   aproximar, clicar no aviso (bolha), clicar na ação, clicar nos botões do painel e andar com o teclado.
   Uso: node testes/elevador-desktop.js (GPU=1 recomendado; ORVALHO_URL testa o site publicado) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const C = require('./vr-comum');   // só o servidor estático

(async () => {
  const server = await C.servidor();
  const url = process.env.ORVALHO_URL || `http://127.0.0.1:${server.address().port}/index.html`;
  const falhas = [], erros = [], rel = {};
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas.push(m); };
  let browser;
  try {
    browser = await require('./navegador').abrir(chromium, !process.argv.includes('--janela'));
    const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    pg.on('pageerror', e => erros.push(e.message));
    pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    const est = () => pg.evaluate(() => {
      const d = Orvalho.jogo._debug(), el = d.amb.elevador, ui = document.querySelector('.elevador-ui');
      const lab = document.querySelector('[data-piso="lab"]');
      return { amb: Orvalho.jogo.ambienteAtual(), st: { x: d.st.x, y: d.st.y, z: d.st.z }, folga: d.amb.colisao.folga(d.st, d.st.y),
        portas: el ? [el.aberta(0), el.aberta(1)] : null, painel: !!(ui && !ui.hidden), visor: ui ? ui.querySelector('.elevador-visor b').textContent : '',
        lab: lab ? { disabled: lab.disabled, atual: lab.classList.contains('atual'), texto: lab.textContent } : null,
        bloqueados: document.querySelectorAll('.elevador-andares button:disabled').length,
        salvo: JSON.parse(localStorage.getItem('orvalho-jogo') || 'null') };
    });
    /* anda com a tecla por ms e devolve o deslocamento */
    const andar = async (tecla, ms) => { const a = await est(); await pg.keyboard.down(tecla); await pg.waitForTimeout(ms); await pg.keyboard.up(tecla); await pg.waitForTimeout(150); const b = await est(); return Math.hypot(b.st.x - a.st.x, b.st.z - a.st.z); };
    /* no Lab, diante da porta: aviso → painel → ação "Ir ao elevador" */
    const portaDoLab = async () => {
      await pg.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 6.55, y: 0, z: 0.95, rumo: Math.atan2(7.12 - 6.55, 0.70 - 0.95), vx: 0, vz: 0 }); d.player.root.position.set(6.55, 0, 0.95); });
      await pg.waitForSelector('#aviso:not([hidden])', { timeout: 5000 });
      await pg.click('#aviso');
      await pg.waitForSelector('#painel:not([hidden]) .btn.leaf', { timeout: 5000 });
      const rot = await pg.textContent('#painel .btn.leaf');
      await pg.click('#painel .btn.leaf');
      return rot.trim();
    };

    await pg.goto(url);
    await pg.evaluate(() => { localStorage.clear(); Orvalho.avatar.store(Orvalho.avatar.load()); });
    await pg.reload();
    await pg.click('#btn-entrar'); await pg.waitForTimeout(1200);

    console.log('1. Lab → porta → elevador do Hall');
    const rot = await portaDoLab();
    ok(rot === 'Ir ao elevador (Hall do Inovale)', `a ação da porta do Lab é "${rot}"`);
    await pg.waitForSelector('.elevador-ui:not([hidden])', { timeout: 8000 });
    await pg.waitForTimeout(600);
    let e = await est(); rel.doLab = e;
    ok(e.amb === 'hall-inovale' && e.painel && e.visor === 'Lab', `chega ao Hall com o painel do elevador aberto e o visor em "${e.visor}"`);
    ok(Math.hypot(e.st.x - 14.6, e.st.z - 13.95) < 0.4 && e.folga >= 0, `diante das portas do elevador (${e.st.x.toFixed(2)}, ${e.st.z.toFixed(2)})`);
    ok(e.lab && e.lab.disabled && e.lab.atual && /Lab IA/.test(e.lab.texto) && !/\d/.test(e.lab.texto.replace('IA', '')), '"Lab IA" aparece sem número de pavimento e marcado como origem');
    ok(e.portas[0] < 0.05, 'vindo do Lab, as portas do térreo estão fechadas');

    console.log('2. painel → 1º andar');
    await pg.click('[data-piso="1"]'); await pg.waitForTimeout(2300);
    e = await est();
    ok(e.amb === 'hall-inovale' && Math.abs(e.st.y - 4.2) < 0.03 && !e.painel && e.portas[1] > 0.5, `chegou ao 1º andar (y ${e.st.y.toFixed(2)}), portas do 1º abrindo (${e.portas[1].toFixed(2)})`);
    const d1 = await andar('KeyW', 700);
    ok(d1 > 0.3 && (await est()).st.y > 4.15, `anda no 1º andar depois da viagem (${d1.toFixed(2)} m)`);

    console.log('3. Hall → elevador → Lab IA');
    await pg.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 14.6, y: 4.2, z: 13.15, rumo: 0, vx: 0, vz: 0 }); d.player.root.position.set(14.6, 4.2, 13.15); Orvalho.jogo.usarElevador(); });
    await pg.waitForSelector('.elevador-ui:not([hidden])');
    e = await est();
    ok(e.lab && !e.lab.disabled && e.bloqueados === 3, `no 1º andar, "Lab IA" está disponível; 1º (atual), 2 e 3 bloqueados (${e.bloqueados})`);
    await pg.click('[data-piso="lab"]');
    await pg.waitForFunction(() => Orvalho.jogo.ambienteAtual() === 'lab-ia', null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    e = await est(); rel.paraLab = e;
    ok(e.amb === 'lab-ia' && !e.painel && Math.hypot(e.st.x - 6.3, e.st.z - 0.95) < 0.4 && Math.abs(e.st.y) < 0.01, `chegou ao Lab, junto à porta (${e.st.x.toFixed(2)}, ${e.st.z.toFixed(2)})`);
    ok(e.salvo && e.salvo.amb === 'lab-ia', 'a exploração salva fica no Lab');
    const d2 = await andar('KeyA', 600);
    ok(d2 > 0.2, `no Lab, o boneco anda (${d2.toFixed(2)} m): não ficou travado`);

    console.log('4. Lab → elevador e fechar o painel sem escolher');
    await portaDoLab();
    await pg.waitForSelector('.elevador-ui:not([hidden])', { timeout: 8000 });
    await pg.click('.elevador-fechar'); await pg.waitForTimeout(700);
    e = await est();
    ok(e.amb === 'hall-inovale' && !e.painel && e.portas[0] > 0.5, `fechar o painel abre as portas do térreo (${e.portas[0].toFixed(2)}) e devolve o controle`);
    const d3 = await andar('KeyS', 700);
    ok(d3 > 0.3 && (await est()).folga >= 0, `anda pelo Hall (${d3.toFixed(2)} m)`);
    await pg.waitForTimeout(2200);
    ok((await est()).portas[0] < 0.2, 'as portas do térreo fecham depois');

    console.log('5. térreo ↔ 1º andar como antes');
    await pg.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 14.6, y: 0, z: 13.7, rumo: Math.PI, vx: 0, vz: 0 }); d.player.root.position.set(14.6, 0, 13.7); Orvalho.jogo.usarElevador(); });
    await pg.waitForSelector('.elevador-ui:not([hidden])');
    e = await est();
    ok(e.visor === 'T' && e.bloqueados === 3 && e.portas[0] >= 0, `no térreo: visor "T", térreo (atual), 2 e 3 bloqueados (${e.bloqueados})`);
    await pg.click('[data-piso="1"]'); await pg.waitForTimeout(2300);
    ok(Math.abs((await est()).st.y - 4.2) < 0.03, 'sobe ao 1º andar');
    await pg.evaluate(() => Orvalho.jogo.usarElevador()); await pg.waitForSelector('.elevador-ui:not([hidden])');
    await pg.click('[data-piso="0"]'); await pg.waitForTimeout(2300);
    e = await est();
    ok(e.st.y < 0.03 && e.amb === 'hall-inovale', 'desce ao térreo sem trocar de ambiente');

    const errosReais = erros.filter(x => !/favicon/i.test(x));
    ok(errosReais.length === 0, 'console sem erros' + (errosReais.length ? ': ' + errosReais.slice(0, 3).join(' | ') : ''));
    await pg.close();
  } catch (err) {
    falhas.push('exceção: ' + err.message); console.error(err);
  } finally {
    if (browser) await browser.close();
    server.close();
    fs.writeFileSync(path.join(__dirname, 'relatorio-elevador-desktop.json'), JSON.stringify({ data: new Date().toISOString(), falhas, erros, rel }, null, 2));
    if (falhas.length) { console.log(`\n✘ ${falhas.length} falha(s) · relatório em testes/relatorio-elevador-desktop.json`); process.exit(1); }
    console.log('\n✔ elevador no desktop validado · relatório em testes/relatorio-elevador-desktop.json');
  }
})();
