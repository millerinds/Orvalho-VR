/* Locomoção em VR (etapa 2: 2a–2d) num Chromium real com o IWER (Quest 3). Os números de velocidade e tempo dependem do quadro
   do emulador; conforto, vinheta e mira só se confirmam no Quest.
   Verifica:
   - opções: padrões (suave, passos de 30°, vinheta fraca, em pé, 1,5 / 2,5 m/s, pulo), URL salva em orvalho-vr, framebuffer
     ×1,2 em qualquer ambiente no jogo normal;
   - andar suave: velocidade e direção da cabeça, de lado, correr com o clique enquanto empurra e parar de correr ao soltar,
     vinheta só em movimento, sem atravessar paredes no Lab;
   - giro por passos: 30° exatos em torno da cabeça, sem repetir enquanto segura, nos dois sentidos; giro suave pelo atalho;
   - atalhos Y (suave/teleporte) e clique do stick direito (passos/suave), salvos; no modo teste, nada é salvo e A não pula;
   - Hall: subir a escada com o stick até 4,20 m, encostar no guarda-corpo do 1º andar sem cair, pulo com teto de 2,10 m;
   - teleporte: alvo válido no chão, inválido na parede e no vazio do 1º andar, e a cabeça vai para o alvo ao soltar;
   - postura sentado: a vista sobe até 1,60 m acima do piso.
   Uso: npm run teste:vr (roda depois do testes/vr.js) ou node testes/vr-locomocao.js */
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright-core');
/* o modo teste grava medições: numa pasta temporária, nunca nas do Quest (testes/medicoes-vr/) */
const PASTA_MED = fs.mkdtempSync(path.join(os.tmpdir(), 'orvalho-medicoes-'));
process.env.ORVALHO_MEDICOES_DIR = PASTA_MED;
const C = require('./vr-comum');

(async () => {
  const server = await C.servidor();
  const url = process.env.ORVALHO_URL || `http://127.0.0.1:${server.address().port}/index.html`;
  const falhas = [], erros = [], rel = {};
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas.push(m); };
  let browser;
  /* SECOES=20,21 roda só essas seções (para depurar) */
  const so = (process.env.SECOES || '').split(',').filter(Boolean), roda = k => !so.length || so.includes(String(k));
  /* ações no emulador */
  const stick = (pg, lado, x, y) => pg.evaluate(([l, x, y]) => window.__xr.controllers[l].updateAxes('thumbstick', x, y), [lado, x, y]);
  const botao = (pg, lado, id, v) => pg.evaluate(([l, id, v]) => window.__xr.controllers[l].updateButtonValue(id, v), [lado, id, v]);
  const toque = async (pg, lado, id) => { await botao(pg, lado, id, 1); await C.quadrosXR(pg, 4); await botao(pg, lado, id, 0); await C.quadrosXR(pg, 4); };
  const estado = pg => pg.evaluate(() => {
    const d = window.Orvalho.jogo._debug(), v = new THREE.Vector3(); d.camera.getWorldPosition(v);
    return { cab: { x: v.x, y: v.y, z: v.z }, rot: d.camera.parent.rotation.y, rigY: d.camera.parent.position.y, st: { x: d.st.x, y: d.st.y, z: d.st.z }, raio: d.raio,
      folga: d.amb.colisao.folga(d.st, d.st.y), loc: window.Orvalho.xr.sessao.locomocao().estado(), aviso: window.Orvalho.xr.sessao.aviso().texto(),
      salvo: JSON.parse(localStorage.getItem('orvalho-vr') || 'null') };
  });
  /* velocidade média da cabeça em x/z durante ms (amostrada nos quadros da sessão) */
  const velocidade = (pg, ms) => pg.evaluate(ms => new Promise(r => {
    const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), v = new THREE.Vector3();
    d.camera.getWorldPosition(v); const x0 = v.x, z0 = v.z, t0 = performance.now();
    (function f(){ if (performance.now() - t0 < ms) return s.requestAnimationFrame(f);
      d.camera.getWorldPosition(v); const dt = (performance.now() - t0) / 1000; r({ v: Math.hypot(v.x - x0, v.z - z0) / dt, dx: v.x - x0, dz: v.z - z0 }); })();
  }), ms);
  /* segura o stick por ms e acompanha folga mínima, cota máxima e mínima */
  const empurrar = async (pg, lado, x, y, ms) => {
    await stick(pg, lado, x, y);
    const r = await pg.evaluate(ms => new Promise(res => {
      const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), t0 = performance.now(); const o = { minFolga: Infinity, maxY: -1, minY: 99 };
      (function f(){ const fo = d.amb.colisao.folga(d.st, d.st.y); if (fo < o.minFolga) o.minFolga = fo; if (d.st.y > o.maxY) o.maxY = d.st.y; if (d.st.y < o.minY) o.minY = d.st.y;
        if (performance.now() - t0 < ms) s.requestAnimationFrame(f); else res(o); })();
    }), ms);
    await stick(pg, lado, 0, 0); await C.quadrosXR(pg, 3);
    return r;
  };
  try {
    browser = await require('./navegador').abrir(chromium, !process.argv.includes('--janela'));

    if (roda(16)) {
    console.log('16. opções de locomoção e framebuffer');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url);
      const o = await pg.evaluate(() => ({ op: window.Orvalho.xr.opcoes.ler(), fbLab: window.Orvalho.xr.opcoes.escalaPara('lab-ia'), fbHall: window.Orvalho.xr.opcoes.escalaPara('hall-inovale') }));
      ok(o.op.mov === 'suave' && o.op.giroTipo === 'passos' && o.op.giroPasso === 30 && o.op.vinheta === 1 && o.op.postura === 'pe' && o.op.vel === 1.5 && o.op.velCorrer === 2.5 && o.op.pulo === true,
        `padrões: andar suave, giro por passos de 30°, vinheta fraca, em pé, 1,5 / 2,5 m/s, pulo ligado`);
      ok(o.fbLab.valor === 1.2 && o.fbHall.valor === 1.2 && o.fbLab.auto, `no jogo normal o framebuffer automático é ×1,2 no Lab e no Hall (${o.fbLab.valor} / ${o.fbHall.valor})`);
      await pg.goto(url + '?vr-mov=teleporte&vr-giro-passo=40&vr-vinheta=2&vr-vel=1.2&vr-pulo=0');
      const u = await pg.evaluate(() => JSON.parse(localStorage.getItem('orvalho-vr')));
      ok(u.mov === 'teleporte' && u.giroPasso === 45 && u.vinheta === 2 && u.vel === 1.2 && u.pulo === false, `a URL salva as opções em orvalho-vr (giro de 40° vira a escolha mais próxima, ${u.giroPasso}°)`);
      await pg.goto(url + '?vr-ponto=lab&vr-teste=t-fb');
      ok(await pg.evaluate(() => window.Orvalho.xr.opcoes.escalaPara('lab-ia').valor === 1.5), 'no modo teste o automático continua por ambiente (Lab ×1,5)');
      await pg.close();
    }

    if (roda(17)) {
    console.log('17. andar suave, correr, vinheta e giro (Hall, entrada; Lab, paredes)');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 14.75, y: 0, z: 4.2, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const e0 = await estado(pg);
      ok(e0.loc.mov === 'suave' && e0.loc.vinheta === 0, 'começa em andar suave, sem vinheta parado');
      await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 10);
      const andar = await velocidade(pg, 800);
      const emMov = await estado(pg);
      ok(Math.abs(andar.v - 1.5) < 0.2 && andar.dz > 0 && Math.abs(andar.dx) < 0.1 * Math.abs(andar.dz), `stick para a frente anda na direção da cabeça a ~1,5 m/s (${andar.v.toFixed(2)} m/s, dx ${andar.dx.toFixed(2)}, dz ${andar.dz.toFixed(2)})`);
      ok(emMov.loc.vinheta > 0.5, `a vinheta aparece andando (opacidade ${emMov.loc.vinheta})`);
      await botao(pg, 'left', 'thumbstick', 1); await C.quadrosXR(pg, 4); await botao(pg, 'left', 'thumbstick', 0); await C.quadrosXR(pg, 8);
      const correr = await velocidade(pg, 600);
      ok((await estado(pg)).loc.correndo && Math.abs(correr.v - 2.5) < 0.3, `clique do stick enquanto empurra: corre a ~2,5 m/s (${correr.v.toFixed(2)} m/s)`);
      await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 5);
      ok(!(await estado(pg)).loc.correndo, 'ao soltar o stick, para de correr');
      await stick(pg, 'left', 0, 1); await C.quadrosXR(pg, 6);   // para trás: o caminho de volta está livre
      const deNovo = await velocidade(pg, 500);
      ok(Math.abs(deNovo.v - 1.5) < 0.2 && deNovo.dz < 0, `empurrando de novo (para trás), volta a andar, sem correr (${deNovo.v.toFixed(2)} m/s)`);
      await stick(pg, 'left', 1, 0); await C.quadrosXR(pg, 6);
      const lado = await velocidade(pg, 500);
      ok(lado.dx < -0.3 && Math.abs(lado.dz) < 0.1, `stick para a direita anda para a direita da cabeça (olhando +z, direita = −x: dx ${lado.dx.toFixed(2)})`);
      await stick(pg, 'left', 0, 0);
      await pg.waitForTimeout(1200);
      ok((await estado(pg)).loc.vinheta === 0, 'parado, a vinheta some (em ~0,7 s)');
      /* giro por passos */
      const g0 = await estado(pg);
      await stick(pg, 'right', 1, 0); await C.quadrosXR(pg, 30);
      const g1 = await estado(pg);
      await stick(pg, 'right', 0, 0); await C.quadrosXR(pg, 4);
      await stick(pg, 'right', 1, 0); await C.quadrosXR(pg, 6); await stick(pg, 'right', 0, 0); await C.quadrosXR(pg, 4);
      await stick(pg, 'right', -1, 0); await C.quadrosXR(pg, 6); await stick(pg, 'right', 0, 0); await C.quadrosXR(pg, 4);
      const g3 = await estado(pg);
      const grau = r => r * 180 / Math.PI;
      ok(Math.abs(grau(g1.rot - g0.rot) + 30) < 0.01, `stick direito à direita: gira 30° (sentido horário) e não repete enquanto segura (${grau(g1.rot - g0.rot).toFixed(2)}°)`);
      ok(Math.abs(grau(g3.rot - g0.rot) + 30) < 0.01, `mais um passo à direita e um à esquerda: −30° no total (${grau(g3.rot - g0.rot).toFixed(2)}°)`);
      ok(Math.hypot(g3.cab.x - g0.cab.x, g3.cab.z - g0.cab.z) < 0.01 && g1.loc.vinheta === 0, 'o giro é em torno da cabeça (não sai do lugar) e não liga a vinheta');
      /* atalhos */
      await toque(pg, 'right', 'thumbstick');
      const s1 = await estado(pg);
      ok(s1.loc.giroTipo === 'suave' && s1.salvo && s1.salvo.giroTipo === 'suave' && s1.aviso === 'GIRO: SUAVE', `clique do stick direito: giro suave, salvo, com aviso ("${s1.aviso}")`);
      const r0 = s1.rot;
      await stick(pg, 'right', 1, 0); await C.quadrosXR(pg, 5);
      const gs = await pg.evaluate(() => new Promise(r => { const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), a = d.camera.parent.rotation.y, t0 = performance.now();
        (function f(){ if (performance.now() - t0 < 500) return s.requestAnimationFrame(f); r({ vel: -(d.camera.parent.rotation.y - a) * 180 / Math.PI / ((performance.now() - t0) / 1000), vin: window.Orvalho.xr.sessao.locomocao().estado().vinheta }); })(); }));
      await stick(pg, 'right', 0, 0); await C.quadrosXR(pg, 3);
      ok(Math.abs(gs.vel - 90) < 12 && gs.vin > 0.5, `giro suave a ~90°/s, com vinheta (${gs.vel.toFixed(0)}°/s, vinheta ${gs.vin})`);
      await toque(pg, 'right', 'thumbstick');
      await toque(pg, 'left', 'y-button');
      const s2 = await estado(pg);
      ok(s2.loc.giroTipo === 'passos' && s2.loc.mov === 'teleporte' && s2.salvo.mov === 'teleporte' && s2.aviso === 'MOVIMENTO: TELEPORTE', `Y: teleporte, salvo, com aviso ("${s2.aviso}")`);
      await toque(pg, 'left', 'y-button');
      ok((await estado(pg)).loc.mov === 'suave', 'Y de novo: volta ao andar suave');
      const vin = [];
      for (let k = 0; k < 3; k++) { await toque(pg, 'left', 'x-button'); const e = await estado(pg); vin.push([e.salvo.vinheta, e.aviso]); }
      ok(vin.map(v => v[0]).join(',') === '2,0,1' && vin[0][1] === 'VINHETA: FORTE' && vin[1][1] === 'VINHETA: DESLIGADA' && vin[2][1] === 'VINHETA: FRACA', 'X alterna a vinheta (fraca → forte → desligada → fraca), salva, com aviso: ' + vin.map(v => v[1]).join(' · '));
      const corVeu = await pg.evaluate(() => window.Orvalho.jogo._debug().camera.getObjectByName('xr-veu').material.color.getHex());
      ok(corVeu === 0, 'o véu (teleporte, sentar, troca de ambiente) é preto');
      await C.sair(pg);
      ok(await pg.evaluate(() => !window.Orvalho.jogo.vr.ativo() && window.Orvalho.jogo._debug().player.root.visible), 'ao sair, o desktop volta');
      /* Lab: andar contra as paredes */
      await C.preparar(pg, url, { amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: Math.PI / 2, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const lab = [];
      for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0], [-0.7, -0.7]]) lab.push(await empurrar(pg, 'left', x, y, 2500));
      const fim = await estado(pg);
      rel.lab = { lab, fim };
      ok(lab.every(r => r.minFolga >= fim.raio - 0.02) && fim.st.x > 0 && fim.st.x < 7.2 && fim.st.z > 0 && fim.st.z < 4.8, `no Lab, empurrando para os quatro lados por 2,5 s: não atravessa paredes nem móveis (folga mínima ${Math.min(...lab.map(r => r.minFolga)).toFixed(3)} m, raio ${fim.raio.toFixed(2)})`);
      await C.sair(pg);
      await pg.close();
    }

    if (roda(18)) {
    console.log('18. Hall: escada com o stick, guarda-corpo do 1º andar e pulo');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 43.22, y: 0, z: 2.6, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      /* empurra até chegar ao 1º andar (no máximo 25 s): o tempo depende do fps do emulador (o jogo limita o dt a 0,05 s) */
      const esc = { minFolga: Infinity, maxY: -1 };
      for (let k = 0; k < 10 && esc.maxY < 4.19; k++) { const r = await empurrar(pg, 'left', 0, -1, 2500); esc.minFolga = Math.min(esc.minFolga, r.minFolga); esc.maxY = Math.max(esc.maxY, r.maxY); }
      const e1 = await estado(pg);
      rel.escada = { esc, fim: e1.st };
      ok(e1.st.y > 4.1 && esc.minFolga >= e1.raio - 0.02, `stick para a frente sobe a escada até o 1º andar (y ${e1.st.y.toFixed(2)}, folga mínima ${esc.minFolga.toFixed(3)} m)`);
      await C.sair(pg);
      /* 1º andar, de frente para o vão */
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 25, y: 4.2, z: 12.6, rumo: Math.PI, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const vao = await empurrar(pg, 'left', 0, -1, 3000);
      const vao2 = await empurrar(pg, 'left', -0.8, -0.6, 2000);
      const e2 = await estado(pg);
      ok(vao.minY > 4.19 && vao2.minY > 4.19 && Math.min(vao.minFolga, vao2.minFolga) >= e2.raio - 0.02, `contra o guarda-corpo do vão: não passa nem cai (cota mínima ${Math.min(vao.minY, vao2.minY).toFixed(2)}, folga ${Math.min(vao.minFolga, vao2.minFolga).toFixed(3)} m)`);
      /* pulo */
      const p = await pg.evaluate(() => new Promise(r => {
        const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), y0 = d.camera.parent.position.y, o = { y0, max: 0, vin: 0, quadros: 0, voltou: false };
        window.__xr.controllers.right.updateButtonValue('a-button', 1);
        (function f(){ o.quadros++; const h = d.camera.parent.position.y - y0; if (h > o.max) o.max = h;
          const ev = window.Orvalho.xr.sessao.locomocao().estado(); if (ev.vinheta > o.vin) o.vin = ev.vinheta;
          if (o.quadros === 8) window.__xr.controllers.right.updateButtonValue('a-button', 0);
          if (o.quadros === 14) window.__xr.controllers.right.updateButtonValue('a-button', 1);   // tentativa de pulo duplo no ar
          if (o.quadros === 18) window.__xr.controllers.right.updateButtonValue('a-button', 0);
          if (o.quadros > 10 && ev.pulo.fase === 0) { o.voltou = Math.abs(d.camera.parent.position.y - y0) < 0.005; return r(o); }
          if (o.quadros < 400) s.requestAnimationFrame(f); else r(o); })();
      }));
      const olhos = await pg.evaluate(() => window.Orvalho.jogo._debug().camera.position.y);
      const limite = Math.min(0.42, 2.10 - (olhos + 0.11));
      rel.pulo = { p, olhos, limite };
      ok(Math.abs(p.max - limite) < 0.03 && p.voltou, `A: pula ${p.max.toFixed(2)} m (limite ${limite.toFixed(2)}: topo da cabeça até 2,10 m acima do piso, olhos a ${olhos.toFixed(2)}) e volta ao piso`);
      ok(p.max <= limite + 0.03, 'apertar A no ar não faz pulo duplo');
      ok(p.vin > 0.5, `vinheta durante o pulo (${p.vin})`);
      await C.sair(pg);
      await pg.close();
    }

    if (roda(19)) {
    console.log('19. teleporte, postura sentado e modo teste');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 14.75, y: 0, z: 4.2, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await pg.goto(url + '?vr-mov=teleporte');
      await C.entrar(pg);
      /* controle esquerdo à frente do corpo, apontando para a frente da cabeça e 30° para baixo */
      const mirar = (graus, atras) => pg.evaluate(([g, atras]) => { const c = window.__xr.controllers.left, a = g * Math.PI / 180, y = atras ? Math.PI : 0;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(a, y, 0, 'YXZ')); c.position.set(-0.2, 1.2, -0.3); c.quaternion.set(q.x, q.y, q.z, q.w); }, [graus, !!atras]);
      await mirar(-30);
      const a0 = await estado(pg);
      await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 8);
      const m1 = await estado(pg);
      ok(m1.loc.mira.ativa && m1.loc.mira.alvo && m1.loc.mira.valida && m1.loc.mira.pontos > 3, `empurrar o stick mostra o arco e um alvo válido no chão (${m1.loc.mira.x.toFixed(2)}, ${m1.loc.mira.z.toFixed(2)}, ${m1.loc.mira.pontos} pontos)`);
      ok(Math.hypot(m1.cab.x - a0.cab.x, m1.cab.z - a0.cab.z) < 0.01, 'mirando, não anda');
      await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 40);
      const t1 = await estado(pg);
      rel.teleporte = { de: a0.cab, alvo: m1.loc.mira, para: t1.cab };
      ok(Math.hypot(t1.cab.x - m1.loc.mira.x, t1.cab.z - m1.loc.mira.z) < 0.05 && t1.cab.z - a0.cab.z > 1, `soltar teleporta a cabeça para o alvo (${a0.cab.z.toFixed(2)} → ${t1.cab.z.toFixed(2)} em z)`);
      ok(!t1.loc.mira.ativa && Math.abs(t1.st.y) < 0.01, 'a mira some e a cota continua a do térreo');
      /* para trás, na direção da fachada, subindo: bate na parede ou vidro */
      await mirar(30, true);
      await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 8);
      const m2 = await estado(pg);
      await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 30);
      const t2 = await estado(pg);
      ok(!m2.loc.mira.valida && Math.hypot(t2.cab.x - t1.cab.x, t2.cab.z - t1.cab.z) < 0.01, `mirando a fachada: inválido (coral) e soltar não move (alvo no chão: ${m2.loc.mira.alvo})`);
      await C.sair(pg);
      /* 1º andar mirando o vazio: nunca vale */
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 25, y: 4.2, z: 12.6, rumo: Math.PI, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const vaz = [];
      for (const g of [-10, -25, -45]) { await mirar(g); await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 6); vaz.push((await estado(pg)).loc.mira); await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 30); }
      const e3 = await estado(pg);
      rel.vazio = vaz;
      ok(vaz.every(v => !v.valida) && Math.abs(e3.st.y - 4.2) < 0.01, `do 1º andar, mirando o vão em 3 ângulos: sempre inválido, e continua a 4,20 m (${vaz.map(v => (v.alvo ? 'chão ' + (v.y != null ? v.y.toFixed(1) : '?') : 'parede')).join(', ')})`);
      await C.sair(pg);
      /* escada: mirando os degraus, o alvo gruda na parada mais próxima (pé, patamar, topo); sobe e desce em 2 teleportes */
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 43.22, y: 0, z: 2.6, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await pg.goto(url + '?vr-mov=teleporte');
      await C.entrar(pg);
      const paradas = [];
      const pular = async (graus, olhando) => {   // mira, anota o alvo e solta (teleporta se for válido)
        await mirar(graus); await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 6);
        const m = (await estado(pg)).loc.mira; await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 40);
        const e = await estado(pg); paradas.push({ olhando, g: graus, escada: m.escada, valida: m.valida, alvoY: m.y, cota: +e.st.y.toFixed(2), z: +e.st.z.toFixed(2) }); return e;
      };
      await pular(-25, 'subindo');
      await pular(-25, 'subindo');
      const noTopo = await estado(pg);
      /* vira para baixo (180°) e desce */
      for (let k = 0; k < 6; k++) { await stick(pg, 'right', 1, 0); await C.quadrosXR(pg, 4); await stick(pg, 'right', 0, 0); await C.quadrosXR(pg, 4); }
      await pular(-25, 'descendo');
      await pular(-25, 'descendo');
      rel.escadaTeleporte = paradas;
      const seq = paradas.map(p => p.cota).join(' → ');
      ok(paradas.every(p => p.escada && p.valida) && Math.abs(noTopo.st.y - 4.2) < 0.01 && Math.abs(paradas[1].cota - 4.2) < 0.01 && Math.abs(paradas[3].cota) < 0.01,
        `escada no teleporte: o alvo gruda nas paradas; sobe e desce em 2 teleportes cada (cotas 0 → ${seq}; ${paradas.map(p => p.escada).join(', ')})`);
      await C.sair(pg);
      /* vinheta desligada (?vr-vinheta=0): andando, a malha nunca fica visível (não é desenhada nem enviada à GPU) */
      await pg.goto(url + '?vr-vinheta=0&vr-mov=suave');
      await C.entrar(pg);
      await stick(pg, 'left', 0, -1);
      const vin0 = await pg.evaluate(() => new Promise(r => { const d = window.Orvalho.jogo._debug(), s = d.renderer.xr.getSession(), m = d.camera.getObjectByName('xr-vinheta'); let n = 0, vis = 0;
        (function f(){ n++; if (m && m.visible) vis++; if (n < 90) s.requestAnimationFrame(f); else r({ n, vis, existe: !!m }); })(); }));
      await stick(pg, 'left', 0, 0);
      const v1 = await estado(pg);
      ok(vin0.existe && vin0.vis === 0 && v1.loc.vinheta === 0, 'vinheta desligada: andando ' + vin0.n + ' quadros, a malha não aparece em nenhum (custo zero)');
      await pg.goto(url + '?vr-vinheta=1');
      /* postura sentado: cabeça rastreada a 1,10 m → vista a 1,60 m do piso */
      await pg.goto(url + '?vr-postura=sentado&vr-mov=suave');
      await pg.evaluate(() => window.__xr.position.set(0, 1.1, 0));
      await C.entrar(pg);
      await pg.waitForFunction(() => window.Orvalho.xr.sessao.locomocao().estado().postura.altura != null, null, { timeout: 10000 }).catch(() => {});
      await C.quadrosXR(pg, 5);
      const ps = await estado(pg);
      rel.postura = ps.loc.postura;
      ok(ps.loc.postura.tipo === 'sentado' && Math.abs(ps.cab.y - ps.st.y - 1.6) < 0.02, `sentado: com a cabeça a ${ps.loc.postura.altura && ps.loc.postura.altura.toFixed(2)} m, a vista fica a ${(ps.cab.y - ps.st.y).toFixed(2)} m do piso`);
      await C.sair(pg);
      await pg.goto(url + '?vr-postura=pe');
      await pg.evaluate(() => window.__xr.position.set(0, 1.1, 0));   // cada carga recria o headset do IWER
      await C.entrar(pg);
      await C.quadrosXR(pg, 120);
      const pe = await estado(pg);
      ok(Math.abs(pe.cab.y - pe.st.y - 1.1) < 0.02, `em pé: a vista é a altura real (${(pe.cab.y - pe.st.y).toFixed(2)} m)`);
      await C.sair(pg);
      /* modo teste: A é marca (não pula) e os atalhos não salvam */
      const antes = await pg.evaluate(() => localStorage.getItem('orvalho-vr'));
      await pg.goto(url + '?vr-ponto=hall-entrada&vr-giro=0&vr-teste=t-loc');
      await C.entrar(pg);
      const y0 = (await estado(pg)).rigY;
      await toque(pg, 'right', 'a-button');
      await C.quadrosXR(pg, 10);
      const tA = await estado(pg);
      await toque(pg, 'left', 'y-button');
      const tY = await estado(pg);
      ok(tA.loc.pulo.fase === 0 && Math.abs(tA.rigY - y0) < 0.001, 'no modo teste, A não pula (é a marca)');
      ok(tY.loc.mov === 'teleporte' && await pg.evaluate(() => localStorage.getItem('orvalho-vr')) === antes, 'no modo teste, o Y troca o movimento mas não salva');
      await C.sair(pg);
      await pg.close();
    }

    /* ---------- etapas 3a e 4a: mãos, raio, sentar, troca de ambiente ---------- */
    /* aponta o controle (lado) para um ponto do mundo: corrige a orientação pelo raio medido (o targetRaySpace pode ter offset) */
    const mirarEm = async (pg, lado, alvo, desvioGraus) => {
      for (let k = 0; k < 3; k++) {
        await pg.evaluate(([lado, alvo, dv]) => {
          const p = window.Orvalho.xr.sessao.maos().ponta(lado), c = window.__xr.controllers[lado], rig = window.Orvalho.jogo._debug().camera.parent;
          const quer = new THREE.Vector3(alvo[0] - p.pos.x, alvo[1] - p.pos.y, alvo[2] - p.pos.z).normalize();
          if (dv) quer.applyAxisAngle(new THREE.Vector3(0, 1, 0), dv * Math.PI / 180);
          const qr = new THREE.Quaternion(); rig.getWorldQuaternion(qr);
          const atualL = p.dir.clone().applyQuaternion(qr.clone().invert()), querL = quer.applyQuaternion(qr.clone().invert());
          const corr = new THREE.Quaternion().setFromUnitVectors(atualL, querL), q0 = new THREE.Quaternion(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w);
          const q = corr.multiply(q0); c.quaternion.set(q.x, q.y, q.z, q.w);
        }, [lado, alvo, desvioGraus || 0]);
        await C.quadrosXR(pg, 3);
      }
    };
    const raioEst = pg => pg.evaluate(() => window.Orvalho.xr.sessao.raio().estado());
    const gatilho = async (pg, lado) => { await botao(pg, lado, 'trigger', 1); await C.quadrosXR(pg, 4); await botao(pg, lado, 'trigger', 0); await C.quadrosXR(pg, 4); };

    if (roda(20)) {
    console.log('20. mãos de gelatina nos controles (etapa 3a)');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: 1.2, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const m = await pg.evaluate(() => {
        const d = window.Orvalho.jogo._debug(), M = window.Orvalho.xr.sessao.maos(), r = {};
        ['left', 'right'].forEach(l => { const g = M.grupo(l), b = g.getObjectByName('xr-braco'), src = l === 'left' ? d.player.armL.children[0] : d.player.armR.children[0];
          const bb = new THREE.Box3().setFromObject(b), tam = bb.getSize(new THREE.Vector3()), ponta = M.ponta(l), c = window.__xr.controllers[l];
          r[l] = { visivel: g.visible, mesmaGeo: b.geometry === src.geometry, mesmoMat: b.material === src.material, contorno: !!g.getObjectByName('xr-braco-contorno'), comp: +Math.max(tam.x, tam.y, tam.z).toFixed(3), ok: ponta.ok }; });
        return r;
      });
      rel.maos = m;
      ok(['left', 'right'].every(l => m[l].visivel && m[l].ok && m[l].mesmaGeo && m[l].mesmoMat && m[l].contorno), 'as duas mãos aparecem, com a geometria, o material (cor) e o contorno dos braços do boneco');
      ok(['left', 'right'].every(l => m[l].comp > 0.25 && m[l].comp < 0.4), `em tamanho de mão (${m.left.comp} m de comprimento)`);
      /* a ponta fica na origem do raio: o laser começa nela */
      const ponta = await pg.evaluate(() => { const M = window.Orvalho.xr.sessao.maos(), g = M.grupo('right'), b = g.getObjectByName('xr-braco');
        b.geometry.computeBoundingBox(); const p = new THREE.Vector3(0, b.geometry.boundingBox.min.y, 0); b.localToWorld(p); return p.distanceTo(M.ponta('right').pos); });
      ok(ponta < 0.01, `a ponta do braço fica na origem do raio (a ${(ponta * 100).toFixed(1)} cm)`);
      /* trocar o tipo de braço no avatar muda a mão */
      const curto = await pg.evaluate(async () => { const d = window.Orvalho.jogo._debug(), cfg = Object.assign({}, window.Orvalho.avatar.load(), { arms: 'curto' }); d.player.set(cfg, true);
        await new Promise(r => { const s = d.renderer.xr.getSession(); s.requestAnimationFrame(() => s.requestAnimationFrame(r)); });
        const b = window.Orvalho.xr.sessao.maos().grupo('right').getObjectByName('xr-braco'); return b.geometry === d.player.armR.children[0].geometry; });
      ok(curto, 'trocar para o braço curto no avatar troca a mão também');
      await C.sair(pg);
      ok(await pg.evaluate(() => !window.Orvalho.jogo._debug().camera.parent || window.Orvalho.jogo._debug().camera.parent.type === 'Scene'), 'ao sair, as mãos saem com o rig');
      await pg.close();
    }

    if (roda(21)) {
    console.log('21. raio: alvo com tolerância angular, alcance e gatilho (etapa 4a)');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'lab-ia', x: 3.6, y: 0, z: 1.6, rumo: Math.PI / 2, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const bolha = await pg.evaluate(() => { const it = window.Orvalho.jogo._debug().amb.interativos.find(i => i.id === 'monitor-1'), v = new THREE.Vector3(); it._mesh.getWorldPosition(v); return [v.x, v.y, v.z]; });
      await mirarEm(pg, 'right', bolha);
      const e1 = await raioEst(pg);
      const laser = await pg.evaluate(() => { const l = window.Orvalho.jogo._debug().camera.parent.parent.getObjectByName('xr-laser-right'); return { vis: l.visible, comp: l.scale.z }; });
      ok(e1.direita && e1.direita.id === 'monitor-1' && e1.rotulo === 'Ver projeto' && laser.vis && laser.comp > 0.5, `mirando a bolha: alvo, laser até ela e rótulo ("${e1.rotulo}", ${e1.direita && e1.direita.d} m)`);
      await mirarEm(pg, 'right', bolha, 6);
      const e2 = await raioEst(pg);
      await mirarEm(pg, 'right', bolha, 20);
      const e3 = await raioEst(pg);
      ok(e2.direita && e2.direita.id === 'monitor-1' && !(e3.direita && e3.direita.id === 'monitor-1'), 'tolerância angular: 6° fora do centro ainda pega; 20° não');
      await mirarEm(pg, 'right', bolha);
      await gatilho(pg, 'right');
      const av = await pg.evaluate(() => window.Orvalho.xr.sessao.aviso().texto());
      ok(/PAINEL EM VR/.test(av), `gatilho num equipamento: aviso de que o painel em VR vem na etapa 5 ("${av}")`);
      await C.sair(pg);
      /* alcance: de longe (mais de 4,5 m) não pega */
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 17.3, y: 0, z: 1.2, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const keila = [17.3, 1.25, 9.2];
      await mirarEm(pg, 'left', keila);
      const longe = await raioEst(pg);
      await C.sair(pg);
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 17.3, y: 0, z: 6.0, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      await mirarEm(pg, 'left', keila);
      const perto = await raioEst(pg);
      await gatilho(pg, 'left');
      const avK = await pg.evaluate(() => window.Orvalho.xr.sessao.aviso().texto());
      rel.raio = { e1, e2, e3, longe, perto };
      ok(!(longe.esquerda && longe.esquerda.id === 'keila') && perto.esquerda && perto.esquerda.id === 'keila' && /CONVERSA/.test(avK), `alcance: a Keila a ~8 m não pega; a ~3 m pega com a mão esquerda ("${perto.rotulo}") e o gatilho avisa da conversa`);
      await C.sair(pg);
      await pg.close();
    }

    if (roda(22)) {
    console.log('22. sentar e levantar (em pé e com a postura "sentado")');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'hall-inovale', x: 20, y: 0, z: 6, rumo: 0, yaw: Math.PI, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const a = await pg.evaluate(() => { const as = window.Orvalho.jogo._debug().amb.assentos.filter(a => (a.y || 0) === 0); return JSON.parse(JSON.stringify(as[0])); });
      await C.sair(pg);
      const perto = { amb: 'hall-inovale', x: a.saida.x, y: 0, z: a.saida.z, rumo: Math.atan2(a.x - a.saida.x, a.z - a.saida.z), yaw: 0, pitch: 0.3, dist: 3 };
      const sentarTeste = async (postura) => {
        await C.preparar(pg, url, perto);
        await pg.goto(url + '?vr-postura=' + postura);
        await C.entrar(pg);
        await pg.waitForTimeout(1500);   // medição da postura
        const antes = await estado(pg);
        await mirarEm(pg, 'right', [a.x, a.altura + 0.15, a.z]);
        const mira = await raioEst(pg);
        await gatilho(pg, 'right'); await C.quadrosXR(pg, 50);
        const sent = await estado(pg), r = await raioEst(pg);
        /* metade do curso: andaria se não estivesse travado, mas não chega aos 0,6 que levantam */
        await stick(pg, 'left', 0, -0.5); await C.quadrosXR(pg, 30); await stick(pg, 'left', 0, 0);
        const travado = await estado(pg);
        await toque(pg, 'right', 'b-button'); await C.quadrosXR(pg, 50);
        const lev = await estado(pg), r2 = await raioEst(pg);
        await C.sair(pg);
        return { antes, mira, sent, r, travado, lev, r2 };
      };
      const pe = await sentarTeste('pe');
      const olhosSent = pe.sent.cab.y - pe.sent.st.y;
      rel.sentar = { mira: pe.mira, olhosAntes: pe.antes.cab.y - pe.antes.st.y, olhosSent, lev: pe.lev.st };
      ok(pe.mira.direita && pe.mira.direita.tipo === 'assento' && pe.mira.rotulo === 'Sentar', `mirando o assento: alvo "Sentar" (${pe.mira.direita && pe.mira.direita.id})`);
      ok(pe.r.sentado && Math.hypot(pe.sent.cab.x - a.x, pe.sent.cab.z - a.z) < 0.05 && Math.abs(olhosSent - (a.altura + 0.72)) < 0.05,
        `gatilho: senta (cabeça no assento, olhos a ${olhosSent.toFixed(2)} m do piso, antes ${(pe.antes.cab.y - pe.antes.st.y).toFixed(2)})`);
      ok(Math.hypot(pe.travado.st.x - pe.sent.st.x, pe.travado.st.z - pe.sent.st.z) < 0.02, 'sentado, o stick esquerdo não anda (a posição fica travada)');
      ok(!pe.r2.sentado && Math.hypot(pe.lev.st.x - a.saida.x, pe.lev.st.z - a.saida.z) < 0.4 && Math.abs(pe.lev.cab.y - pe.lev.st.y - (pe.antes.cab.y - pe.antes.st.y)) < 0.02, 'B curto levanta: vai para a saída do assento e a vista volta à altura de antes');
      const sp = await sentarTeste('sentado');
      ok(sp.r.sentado && Math.abs((sp.sent.cab.y - sp.sent.st.y) - (sp.antes.cab.y - sp.antes.st.y)) < 0.02 && Math.hypot(sp.travado.st.x - sp.sent.st.x, sp.travado.st.z - sp.sent.st.z) < 0.02,
        `postura "sentado": sentar só trava a posição, sem abaixar a vista (${(sp.antes.cab.y - sp.antes.st.y).toFixed(2)} → ${(sp.sent.cab.y - sp.sent.st.y).toFixed(2)} m)`);
      /* empurrar o stick também levanta */
      await C.preparar(pg, url, perto); await pg.goto(url + '?vr-postura=pe'); await C.entrar(pg);
      await mirarEm(pg, 'right', [a.x, a.altura + 0.15, a.z]); await gatilho(pg, 'right'); await C.quadrosXR(pg, 50);
      await pg.waitForTimeout(700);
      await stick(pg, 'left', 0, -1); await C.quadrosXR(pg, 40); await stick(pg, 'left', 0, 0); await C.quadrosXR(pg, 30);
      ok(!(await raioEst(pg)).sentado, 'empurrar o stick esquerdo também levanta');
      await C.sair(pg);
      await pg.close();
    }

    if (roda(23)) {
    console.log('23. troca Lab → Hall em VR (porta do Lab)');
      const pg = await C.paginaXR(browser, erros);
      await C.preparar(pg, url, { amb: 'lab-ia', x: 5.6, y: 0, z: 1.2, rumo: Math.PI / 2, yaw: 0, pitch: 0.3, dist: 3 });
      await C.entrar(pg);
      const porta = await pg.evaluate(() => { const it = window.Orvalho.jogo._debug().amb.interativos.find(i => i.id === 'porta'), v = new THREE.Vector3(); it._mesh.getWorldPosition(v); return [v.x, v.y, v.z]; });
      await mirarEm(pg, 'right', porta);
      const r = await raioEst(pg);
      ok(r.direita && r.direita.tipo === 'ligacao' && /Ir para/.test(r.rotulo), `a porta do Lab é alvo: "${r.rotulo}"`);
      await gatilho(pg, 'right');
      await pg.waitForFunction(() => window.Orvalho.jogo.ambienteAtual() === 'hall-inovale', null, { timeout: 20000 }).catch(() => {});
      await C.quadrosXR(pg, 40);
      const h = await estado(pg), info = await pg.evaluate(() => ({ amb: window.Orvalho.jogo.ambienteAtual(), ativa: window.Orvalho.xr.sessao.ativa(), boneco: window.Orvalho.jogo._debug().player.root.visible }));
      rel.troca = { info, cab: h.cab };
      ok(info.amb === 'hall-inovale' && info.ativa && !info.boneco && Math.hypot(h.cab.x - 14.6, h.cab.z - 13.95) < 0.6, `gatilho: vai para o Hall sem sair do VR, na chegada do Lab (cabeça em ${h.cab.x.toFixed(2)}, ${h.cab.z.toFixed(2)})`);
      await stick(pg, 'left', 0, 1); await C.quadrosXR(pg, 20); await stick(pg, 'left', 0, 0);
      const h2 = await estado(pg);
      ok(Math.hypot(h2.cab.x - h.cab.x, h2.cab.z - h.cab.z) > 0.1, 'no Hall, a locomoção continua funcionando');
      await C.sair(pg);
      await pg.close();
    }

    const errosReais = erros.filter(e => !/favicon/i.test(e));
    ok(errosReais.length === 0, 'console sem erros' + (errosReais.length ? ': ' + errosReais.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    falhas.push('exceção: ' + e.message); console.error(e);
  } finally {
    if (browser) await browser.close();
    server.close();
    try { fs.rmSync(PASTA_MED, { recursive: true, force: true }); } catch (e) {}
    fs.writeFileSync(path.join(__dirname, 'relatorio-vr-locomocao.json'), JSON.stringify({ data: new Date().toISOString(), falhas, erros, rel }, null, 2));
    if (falhas.length) { console.log(`\n✘ ${falhas.length} falha(s) · relatório em testes/relatorio-vr-locomocao.json`); process.exit(1); }
    console.log('\n✔ locomoção e interação em VR (etapas 2a–2d, 3a e 4a) validadas no emulador · relatório em testes/relatorio-vr-locomocao.json');
  }
})();
