/* Elevador em VR (src/xr/elevador.js) num Chromium real com o IWER (Quest 3). Tudo dentro de UMA sessão imersiva:
   1. Lab: a porta do Lab é "Ir ao elevador" e leva à cabine do Hall (visor "Lab"), sem sair do VR;
   2. painel: o botão Térreo entra em foco pelo laser e acende; o gatilho viaja e as portas do térreo abrem;
   3. sair da cabine pelo stick: diante das portas, sem colisão pendente, e a locomoção volta;
   4. Hall: "Chamar elevador" abre as portas, o alvo vira "Entrar no elevador", o gatilho entra;
   5. 1º andar: chega a 4,20 m, portas do 1º abertas e do térreo fechadas; sai pelo botão; anda até o guarda-corpo sem cair;
   6. volta ao Lab: chama no 1º andar, entra, "Lab IA" → chega ao Lab, na chegada junto à porta, e anda;
   7. ponto salvo nunca dentro da cabine; sair do VR dentro da cabine devolve o jogador diante das portas;
   8. andares 2 e 3 indisponíveis; console sem erros.
   O que só se confirma no Quest: conforto do véu e da viagem, legibilidade e tamanho dos botões, mira real do laser.
   Uso: node testes/vr-elevador.js (GPU=1 recomendado) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const C = require('./vr-comum');

(async () => {
  const server = await C.servidor();
  const url = process.env.ORVALHO_URL || `http://127.0.0.1:${server.address().port}/index.html`;
  const falhas = [], erros = [], rel = {};
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas.push(m); };
  const stick = (pg, lado, x, y) => pg.evaluate(([l, x, y]) => window.__xr.controllers[l].updateAxes('thumbstick', x, y), [lado, x, y]);
  const botao = (pg, lado, id, v) => pg.evaluate(([l, id, v]) => window.__xr.controllers[l].updateButtonValue(id, v), [lado, id, v]);
  const gatilho = async (pg, lado) => { await botao(pg, lado, 'trigger', 1); await C.quadrosXR(pg, 4); await botao(pg, lado, 'trigger', 0); await C.quadrosXR(pg, 4); };
  const raioEst = pg => pg.evaluate(() => window.Orvalho.xr.sessao.raio().estado());
  const elev = pg => pg.evaluate(() => window.Orvalho.xr.sessao.elevador().estado());
  const estado = pg => pg.evaluate(() => {
    const d = window.Orvalho.jogo._debug(), v = new THREE.Vector3(); d.camera.getWorldPosition(v);
    return { amb: window.Orvalho.jogo.ambienteAtual(), ativa: window.Orvalho.xr.sessao.ativa(), cab: { x: v.x, y: v.y, z: v.z }, st: { x: d.st.x, y: d.st.y, z: d.st.z },
      folga: d.amb.colisao.folga(d.st, d.st.y), portas: d.amb.elevador ? [d.amb.elevador.aberta(0), d.amb.elevador.aberta(1)] : null,
      salvo: JSON.parse(localStorage.getItem('orvalho-jogo') || 'null') };
  });
  /* espera uma condição avaliada a cada quadro da sessão (até ms) */
  const esperar = (pg, fn, ms) => pg.evaluate(([src, ms]) => new Promise(r => {
    const f = new Function('return (' + src + ')()'), s = window.Orvalho.jogo._debug().renderer.xr.getSession(), t0 = performance.now();
    (function q(){ let v = false; try { v = f(); } catch (e) {} if (v || performance.now() - t0 > ms) r(!!v); else s.requestAnimationFrame(q); })();
  }), [fn.toString(), ms || 8000]);
  /* aponta o controle para um ponto do mundo (corrige a orientação a partir da ponta do braço) */
  const mirarEm = async (pg, lado, alvo) => {
    for (let k = 0; k < 3; k++) {
      await pg.evaluate(([lado, alvo]) => {
        const p = window.Orvalho.xr.sessao.maos().ponta(lado), c = window.__xr.controllers[lado], rig = window.Orvalho.jogo._debug().camera.parent;
        const quer = new THREE.Vector3(alvo[0] - p.pos.x, alvo[1] - p.pos.y, alvo[2] - p.pos.z).normalize();
        const qr = new THREE.Quaternion(); rig.getWorldQuaternion(qr);
        const atualL = p.dir.clone().applyQuaternion(qr.clone().invert()), querL = quer.applyQuaternion(qr.clone().invert());
        const corr = new THREE.Quaternion().setFromUnitVectors(atualL, querL), q0 = new THREE.Quaternion(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w);
        const q = corr.multiply(q0); c.quaternion.set(q.x, q.y, q.z, q.w);
      }, [lado, alvo]);
      await C.quadrosXR(pg, 3);
    }
  };
  const centroBotao = (pg, id) => pg.evaluate(id => window.Orvalho.xr.sessao.elevador().centroBotao(id), id);
  const posInterativo = (pg, id) => pg.evaluate(id => { const it = window.Orvalho.jogo._debug().amb.interativos.find(i => i.id === id), v = new THREE.Vector3(); if (it._mesh) it._mesh.getWorldPosition(v); else v.set(it.x, it.y + 0.24, it.z); return [v.x, v.y, v.z]; }, id);
  /* a cabine (paredes, piso, teto) e o painel estão sendo desenhados com a cabeça lá dentro? */
  const cabineVisivel = pg => pg.evaluate(() => {
    const d = window.Orvalho.jogo._debug(), cab = new THREE.Vector3(); d.camera.getWorldPosition(cab);
    let total = 0, vis = 0; const v = new THREE.Vector3();
    d.amb.grupo.traverse(o => {
      if (!o.isMesh) return; o.getWorldPosition(v);
      if (Math.abs(v.x - cab.x) > 0.8 || v.z - cab.z > 0.8 || cab.z - v.z > 0.75 || v.y < d.st.y - 0.1 || v.y > d.st.y + 2.6) return;
      if (o.name && /xr-/.test(o.name)) return;
      total++; let s = true; o.traverseAncestors(a => { if (!a.visible) s = false; }); if (s && o.visible) vis++;
    });
    const pn = window.Orvalho.jogo.vr.contexto().scene.getObjectByName('xr-elevador-painel');
    return { total, vis, painel: !!(pn && pn.visible) };
  });
  const andar = async (pg, y, ms) => { await stick(pg, 'left', 0, y); const r = await pg.evaluate(ms => new Promise(res => {
    const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), t0 = performance.now(), o = { minFolga: Infinity, minY: 99, maxY: -1 };
    (function f(){ const fo = d.amb.colisao.folga(d.st, d.st.y); if (fo < o.minFolga) o.minFolga = fo; if (d.st.y < o.minY) o.minY = d.st.y; if (d.st.y > o.maxY) o.maxY = d.st.y;
      if (performance.now() - t0 < ms) s.requestAnimationFrame(f); else res(o); })(); }), ms); await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 3); return r; };
  /* escolhe um botão do painel com a mão direita: mira, confere o foco e aperta o gatilho */
  const escolher = async (pg, id, nome) => {
    await mirarEm(pg, 'right', await centroBotao(pg, id));
    const r = await raioEst(pg), e = await elev(pg);
    ok(r.direita && r.direita.tipo === 'painel' && r.direita.id === 'painel-' + id && e.foco === id, `painel: o laser foca "${nome}" e o botão acende (foco ${e.foco})`);
    await gatilho(pg, 'right');
  };

  let browser;
  try {
    browser = await require('./navegador').abrir(chromium, !process.argv.includes('--janela'));
    const pg = await C.paginaXR(browser, erros);
    await C.preparar(pg, url, { amb: 'lab-ia', x: 5.6, y: 0, z: 1.2, rumo: Math.PI / 2, yaw: 0, pitch: 0.3, dist: 3 });
    await C.entrar(pg);

    console.log('1. Lab → elevador (porta do Lab)');
    await mirarEm(pg, 'right', await posInterativo(pg, 'porta'));
    let r = await raioEst(pg);
    ok(r.direita && r.direita.tipo === 'ligacao' && r.rotulo === 'Ir ao elevador', `a porta do Lab é alvo: "${r.rotulo}"`);
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.jogo.ambienteAtual() === 'hall-inovale' && window.Orvalho.xr.sessao.elevador().estado().est === 'dentro', 15000);
    await C.quadrosXR(pg, 30);
    let h = await estado(pg), e = await elev(pg), cv = await cabineVisivel(pg);
    rel.doLab = { h, e, cv };
    ok(h.amb === 'hall-inovale' && h.ativa && e.est === 'dentro' && e.piso === 'lab' && e.visor === 'lab', `chega à cabine do Hall sem sair do VR (visor "${e.visor}")`);
    ok(Math.hypot(h.cab.x - 14.6, h.cab.z - 15.81) < 0.3 && Math.abs(h.st.y) < 0.01, `cabeça no centro da cabine do térreo (${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)})`);
    ok(cv.painel && cv.total > 3 && cv.vis === cv.total, `a cabine e o painel são desenhados por dentro (${cv.vis}/${cv.total} peças, painel ${cv.painel})`);
    ok(h.portas[0] < 0.05, 'vindo do Lab, as portas do térreo começam fechadas');
    ok(h.salvo && h.salvo.amb === 'hall-inovale' && h.salvo.z < 14.5, `o ponto salvo fica diante das portas, não na cabine (z salvo ${h.salvo && h.salvo.z})`);

    console.log('2. painel → Térreo');
    await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 20); await stick(pg, 'left', 0, 0);
    h = await estado(pg);
    ok(Math.hypot(h.cab.x - 14.6, h.cab.z - 15.81) < 0.3 && (await elev(pg)).est === 'dentro', 'com as portas fechadas, o stick não tira da cabine');
    await mirarEm(pg, 'right', await centroBotao(pg, 'p2')); await gatilho(pg, 'right');
    ok((await elev(pg)).est === 'dentro' && (await pg.evaluate(() => window.Orvalho.xr.sessao.aviso().texto())) === 'ANDAR INDISPONÍVEL', '2º andar: indisponível (aviso, não viaja)');
    await escolher(pg, 0, 'Térreo');
    ok(/fechando|viagem/i.test((await elev(pg)).texto), `viagem começa ("${(await elev(pg)).texto}")`);
    await esperar(pg, () => { const d = window.Orvalho.jogo._debug(); return window.Orvalho.xr.sessao.elevador().estado().est === 'dentro' && d.amb.elevador.aberta(0) > 0.9; }, 8000);
    h = await estado(pg); e = await elev(pg);
    ok(e.piso === 0 && h.portas[0] > 0.9 && h.ativa, `chegou ao térreo e as portas abriram (${h.portas[0].toFixed(2)})`);

    console.log('3. sair da cabine (stick) e explorar o Hall');
    await pg.waitForTimeout(800);   // o stick só tira da cabine 0,6 s depois da chegada (não sai com o stick ainda inclinado)
    await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 10); await stick(pg, 'left', 0, 0);
    await esperar(pg, () => window.Orvalho.xr.sessao.elevador().estado().est === 'fora', 4000);
    await C.quadrosXR(pg, 20);
    h = await estado(pg);
    ok(Math.hypot(h.cab.x - 14.6, h.cab.z - 13.75) < 0.4 && h.folga >= 0, `fora, diante das portas (${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)}; folga ${h.folga.toFixed(2)})`);
    const a1 = await andar(pg, -1, 1500); const h1 = await estado(pg);
    ok(Math.hypot(h1.cab.x - h.cab.x, h1.cab.z - h.cab.z) > 0.8 && a1.minFolga >= -0.01, `a locomoção volta: andou ${Math.hypot(h1.cab.x - h.cab.x, h1.cab.z - h.cab.z).toFixed(2)} m sem atravessar nada`);
    await pg.waitForTimeout(2200);
    ok((await estado(pg)).portas[0] < 0.1, 'as portas do térreo fecham depois que o jogador sai');

    console.log('4. Hall: chamar e entrar');
    /* leva a cabeça para perto do botão de chamada (z 13,4) */
    await pg.evaluate(() => { const d = window.Orvalho.jogo._debug(); d.camera.parent.position.x += 14.6 - (d.camera.getWorldPosition(new THREE.Vector3()).x); d.camera.parent.position.z += 13.4 - (d.camera.getWorldPosition(new THREE.Vector3()).z); });
    await C.quadrosXR(pg, 10);
    await mirarEm(pg, 'right', await posInterativo(pg, 'elevador-terreo'));
    r = await raioEst(pg);
    ok(r.direita && r.direita.tipo === 'elevador' && r.rotulo === 'Chamar elevador', `o botão de chamada é alvo: "${r.rotulo}"`);
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.jogo._debug().amb.elevador.aberta(0) > 0.9, 4000);
    await C.quadrosXR(pg, 3);
    r = await raioEst(pg);
    ok((await estado(pg)).portas[0] > 0.9 && r.rotulo === 'Entrar no elevador', `as portas abrem e o alvo vira "${r.rotulo}"`);
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.xr.sessao.elevador().estado().est === 'dentro', 4000);
    h = await estado(pg); e = await elev(pg);
    ok(e.est === 'dentro' && e.piso === 0 && Math.hypot(h.cab.x - 14.6, h.cab.z - 15.81) < 0.3, 'entrou na cabine do térreo');

    console.log('5. 1º andar');
    await escolher(pg, 1, '1º andar');
    await esperar(pg, () => { const d = window.Orvalho.jogo._debug(); return window.Orvalho.xr.sessao.elevador().estado().est === 'dentro' && d.amb.elevador.aberta(1) > 0.9; }, 8000);
    await C.quadrosXR(pg, 10);
    h = await estado(pg); e = await elev(pg); cv = await cabineVisivel(pg);
    rel.primeiro = { h, e, cv };
    ok(e.piso === 1 && Math.abs(h.st.y - 4.2) < 0.01 && Math.hypot(h.cab.x - 14.6, h.cab.z - 15.41) < 0.3, `chegou ao 1º andar (piso ${h.st.y.toFixed(2)} m, cabeça em ${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)})`);
    ok(h.portas[1] > 0.9 && h.portas[0] < 0.1, `portas do 1º abertas (${h.portas[1].toFixed(2)}), do térreo fechadas (${h.portas[0].toFixed(2)})`);
    ok(cv.painel && cv.vis === cv.total && cv.total > 3, `cabine do 1º andar desenhada por dentro (${cv.vis}/${cv.total})`);
    await escolher(pg, 'sair', 'Sair da cabine');
    await esperar(pg, () => window.Orvalho.xr.sessao.elevador().estado().est === 'fora', 4000);
    await C.quadrosXR(pg, 20);
    h = await estado(pg);
    ok(Math.hypot(h.cab.x - 14.6, h.cab.z - 13.15) < 0.4 && Math.abs(h.st.y - 4.2) < 0.01 && h.folga >= 0, `fora no 1º andar, diante das portas (${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)}, piso ${h.st.y.toFixed(2)})`);
    const a2 = await andar(pg, -1, 4000); const h2 = await estado(pg);
    rel.guarda = { a2, h2 };
    ok(a2.minY > 4.19 && a2.minFolga >= -0.01, `anda pelo corredor do 1º andar até a borda: não cai (cota mínima ${a2.minY.toFixed(2)}) nem atravessa o guarda-corpo (folga mínima ${a2.minFolga.toFixed(3)})`);

    console.log('6. volta ao Lab');
    await pg.evaluate(() => { const d = window.Orvalho.jogo._debug(), v = new THREE.Vector3(); d.camera.getWorldPosition(v); d.camera.parent.position.x += 14.6 - v.x; d.camera.parent.position.z += 12.9 - v.z; });
    await C.quadrosXR(pg, 10);
    await mirarEm(pg, 'right', await posInterativo(pg, 'elevador-primeiro'));
    r = await raioEst(pg);
    ok(r.direita && r.direita.id === 'elevador-primeiro' && r.rotulo === 'Chamar elevador', `no 1º andar, o botão de chamada é alvo ("${r.rotulo}")`);
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.jogo._debug().amb.elevador.aberta(1) > 0.9, 4000);
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.xr.sessao.elevador().estado().est === 'dentro', 4000);
    await escolher(pg, 'lab', 'Lab IA');
    await esperar(pg, () => window.Orvalho.jogo.ambienteAtual() === 'lab-ia' && window.Orvalho.xr.sessao.elevador().estado().est === 'fora', 10000);
    await C.quadrosXR(pg, 30);
    h = await estado(pg);
    ok(h.amb === 'lab-ia' && h.ativa && Math.hypot(h.cab.x - 6.3, h.cab.z - 0.95) < 0.6 && Math.abs(h.st.y) < 0.01, `chegou ao Lab sem sair do VR, junto à porta (${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)})`);
    const a3 = await andar(pg, -1, 1000), h3 = await estado(pg);
    ok(Math.hypot(h3.cab.x - h.cab.x, h3.cab.z - h.cab.z) > 0.3 && a3.minFolga >= -0.01, 'no Lab, a locomoção funciona e a colisão segura');

    console.log('7. sair do VR dentro da cabine');
    await mirarEm(pg, 'right', await posInterativo(pg, 'porta'));
    await gatilho(pg, 'right');
    await esperar(pg, () => window.Orvalho.xr.sessao.elevador().estado().est === 'dentro', 15000);
    await C.quadrosXR(pg, 10);
    await C.sair(pg);
    await pg.waitForTimeout(300);
    const fim = await pg.evaluate(() => { const d = window.Orvalho.jogo._debug(); return { amb: window.Orvalho.jogo.ambienteAtual(), st: { x: d.st.x, y: d.st.y, z: d.st.z }, boneco: d.player.root.visible, folga: d.amb.colisao.folga(d.st, d.st.y), salvo: JSON.parse(localStorage.getItem('orvalho-jogo')) }; });
    rel.fim = fim;
    ok(fim.amb === 'hall-inovale' && fim.st.z < 14.2 && fim.boneco && fim.folga >= 0 && fim.salvo.z < 14.5, `fora do VR, o boneco volta diante das portas, não preso na cabine (z ${fim.st.z.toFixed(2)}, salvo ${fim.salvo.z})`);
    await pg.close();

    const errosReais = erros.filter(x => !/favicon/i.test(x));
    ok(errosReais.length === 0, 'console sem erros' + (errosReais.length ? ': ' + errosReais.slice(0, 3).join(' | ') : ''));
  } catch (err) {
    falhas.push('exceção: ' + err.message); console.error(err);
  } finally {
    if (browser) await browser.close();
    server.close();
    fs.writeFileSync(path.join(__dirname, 'relatorio-vr-elevador.json'), JSON.stringify({ data: new Date().toISOString(), falhas, erros, rel }, null, 2));
    if (falhas.length) { console.log(`\n✘ ${falhas.length} falha(s) · relatório em testes/relatorio-vr-elevador.json`); process.exit(1); }
    console.log('\n✔ elevador em VR validado no emulador · relatório em testes/relatorio-vr-elevador.json');
  }
})();
