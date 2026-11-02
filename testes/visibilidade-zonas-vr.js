/* Visibilidade real entre as zonas do Hall, por geometria (ferramenta de análise; não faz parte do teste:tudo).
   Para cada zona de zonasVR: amostra posições caminháveis (grade; piso válido e folga para o corpo) em duas alturas de cabeça
   (1,3 e 1,9 m), e de cada uma renderiza as 6 direções de um cubo (128×128) com um "item buffer": cada bloco de móveis, pessoa
   e marcador numa cor própria; paredes, pisos, lajes e o resto opaco em preto (ocluem); vidros e transparentes ocultos (não
   ocluem); a cor por instância é desligada (multiplicaria a cor-id); folhas de porta ocultas (como abertas, o caso conservador); contornos ocultos. O que aparece em algum pixel é visível.
   Saída: para cada zona de origem, quantos itens de cada zona de destino são vistos (e de quantas amostras), a tabela "ve"
   atual × a calculada, e, com DETALHE=<zona origem>:<zona destino>, a lista dos itens vistos (tipo, posição). JSON em
   testes/relatorio-visibilidade-zonas-vr.json. Uso: GPU=1 node testes/visibilidade-zonas-vr.js   (PASSO=1 · PASSO_HALL=2 m) */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const { atender } = require('./servir');
const navegador = require('./navegador');
const PASSO = +(process.env.PASSO || 1), PASSO_HALL = +(process.env.PASSO_HALL || 2), DETALHE = process.env.DETALHE || '';

(async () => {
  const server = http.createServer(atender).listen(0, '127.0.0.1');
  await new Promise(r => server.on('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await navegador.abrir(chromium, true);
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); window.Orvalho.avatar.store(window.Orvalho.avatar.load());
    localStorage.setItem('orvalho-jogo', JSON.stringify({ amb: 'hall-inovale', x: 20, y: 0, z: 6, rumo: 0, yaw: 0, pitch: 0.3, dist: 4 })); });
  await page.reload();
  await page.click('#btn-continuar');
  await page.waitForFunction(() => window.Orvalho.jogo.ativo() && window.Orvalho.jogo.ambienteAtual() === 'hall-inovale', null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const t0 = Date.now();
  const res = await page.evaluate(({ PASSO, PASSO_HALL }) => {
    window.Orvalho.jogo.pausar();
    const d = Object.assign({}, window.Orvalho.jogo._debug(), { scene: window.Orvalho.jogo.vr.contexto().scene }), a = d.amb, r = d.renderer, TIPOS = window.Orvalho.moveis.TIPOS, ZV = a.zonasVR;
    a.modoVR(false);   // antes da troca: modoVR(false) torna as cascas de contorno visíveis de novo
    const pisoDe = y => (y > 3.5 ? 4.2 : 0);
    /* itens: blocos de móveis, pessoas, marcadores */
    const itens = [], dono = new Map();
    a.grupo.traverse(o => { if (o.isInstancedMesh && TIPOS[o.name]) { const e = o.geometry.boundingSphere; itens.push({ obj: o, tipo: o.name, x: e.center.x, y: e.center.y, z: e.center.z, zona: a.zonaEm(e.center.x, e.center.z, pisoDe(e.center.y)) }); } });
    a.grupo.traverse(o => { if (o.userData && o.userData.npc) { const p = new THREE.Vector3(); o.getWorldPosition(p); itens.push({ obj: o, tipo: 'pessoa', x: p.x, y: p.y, z: p.z, zona: a.zonaEm(p.x, p.z, pisoDe(p.y)) }); } });
    d.scene.traverse(o => { if (o.userData && o.userData.it && o.isMesh) { const it = o.userData.it; itens.push({ obj: o, tipo: 'marcador', x: it.x, y: it.y, z: it.z, zona: a.zonaEm(it.x, it.z, it.piso != null ? it.piso : pisoDe(it.y)) }); } });
    itens.forEach((it, i) => { it.id = i + 1; it.obj.traverse(o => dono.set(o, it)); });
    /* troca de materiais */
    const guard = [], pretos = [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide].map(sd => new THREE.MeshBasicMaterial({ color: 0, side: sd })), mats = itens.map(it => { const m = new THREE.MeshBasicMaterial({ toneMapped: false }); m.color.r = ((it.id >> 16) & 255) / 255; m.color.g = ((it.id >> 8) & 255) / 255; m.color.b = (it.id & 255) / 255; return m; });   // direto: setHex/setRGB convertem sRGB → linear e trocariam os ids
    d.scene.traverse(o => {
      if (!o.isMesh && !o.isSprite && !o.isLine && !o.isPoints) return;
      guard.push([o, o.material, o.visible, o.instanceColor]);
      if (o.isInstancedMesh) o.instanceColor = null;   // a cor por instância multiplicaria a cor-id e trocaria o item
      const it = dono.get(o), ms = [].concat(o.material || []), transp = ms.some(m => m && (m.transparent || m.opacity < 1 || m.side === THREE.BackSide));
      let porta = false; for (let p = o; p; p = p.parent) if (p.userData && p.userData.porta) porta = true;
      if (o.isSprite || o.isLine || o.isPoints || porta || o === d.player.root) { o.visible = false; return; }
      if (it) { if (it.obj !== o && transp) { o.visible = false; return; } o.material = mats[it.id - 1]; o.visible = true; return; }
      if (transp) { o.visible = false; return; }
      o.material = pretos[(ms[0] && ms[0].side) || 0];   // o mesmo lado do material original: uma parede de dupla face continua ocluindo por trás
    });
    d.player.root.visible = false;
    const rt = new THREE.WebGLRenderTarget(128, 128), cam = new THREE.PerspectiveCamera(90, 1, 0.05, 200); var buf = new Uint8Array(128 * 128 * 4);
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], ups = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
    const fundo = d.scene.background; d.scene.background = new THREE.Color(0); const fog = d.scene.fog; d.scene.fog = null;
    r.setRenderTarget(rt); r.setClearColor(0, 1);
    /* calibração: um plano na frente da câmera com a cor de vários ids precisa voltar com o mesmo id */
    const cal = new THREE.Scene(), plano = new THREE.Mesh(new THREE.PlaneGeometry(4, 4)); cal.add(plano); plano.position.set(0, 0, -1);
    const camC = new THREE.PerspectiveCamera(90, 1, 0.05, 10), erradas = [];
    [1, 2, 26, 255, 256, 282, itens.length].forEach(id => { plano.material = mats[id - 1]; r.clear(); r.render(cal, camC); r.readRenderTargetPixels(rt, 64, 64, 1, 1, buf);
      const lido = (buf[0] << 16) | (buf[1] << 8) | buf[2]; if (lido !== id) erradas.push(id + '→' + lido); });
    plano.geometry.dispose();
    if (erradas.length) throw new Error('calibração das cores-id falhou: ' + erradas.join(', '));
    function vistos(x, y, z, out){
      cam.position.set(x, y, z);
      for (let f = 0; f < 6; f++) {
        cam.up.set(...ups[f]); cam.lookAt(x + dirs[f][0], y + dirs[f][1], z + dirs[f][2]); cam.updateMatrixWorld();
        r.clear(); r.render(d.scene, cam); r.readRenderTargetPixels(rt, 0, 0, 128, 128, buf);
        for (let i = 0; i < buf.length; i += 4) { const id = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]; if (id && id <= itens.length) out.add(id); }
      }
    }
    /* amostras por zona */
    const zonas = ZV.zonas, saida = {};
    zonas.forEach(z => {
      if (z.todas) return;
      const passo = z.id === 'hall' ? PASSO_HALL : PASSO, pisos = z.piso == null ? [0, 4.2] : [z.piso === 1 ? 4.2 : z.piso];
      const vis = new Map(); let n = 0;
      z.r.forEach(R => { for (let x = R[0] + passo / 2; x < R[2]; x += passo) for (let zz = R[1] + passo / 2; zz < R[3]; zz += passo) pisos.forEach(py => {
        const h = a.alturaPiso(x, zz, py); if (h == null || Math.abs(h - py) > 0.05) return;
        if (a.zonaEm(x, zz, py) !== z.id) return;
        const c = { x, z: zz }; a.colisao.resolver(c, 0.25, py); if (Math.hypot(c.x - x, c.z - zz) > 0.01) return;
        n++;
        [1.3, 1.9].forEach(hc => { const s = new Set(); vistos(x, py + hc, zz, s); s.forEach(id => vis.set(id, (vis.get(id) || 0) + 1)); });
      }); });
      const porZona = {};
      vis.forEach((k, id) => { const it = itens[id - 1]; if (!it) return; const zd = it.zona || '-'; const e = porZona[zd] || (porZona[zd] = { itens: 0, total: itens.filter(q => (q.zona || '-') === zd).length, lista: [] });
        e.itens++; e.lista.push({ tipo: it.tipo, x: +it.x.toFixed(1), y: +it.y.toFixed(1), z: +it.z.toFixed(1), vezes: k }); });
      saida[z.id] = { amostras: n, porZona };
    });
    r.setRenderTarget(null); d.scene.background = fundo; d.scene.fog = fog;
    guard.forEach(([o, m, v, ic]) => { o.material = m; o.visible = v; if (o.isInstancedMesh) o.instanceColor = ic; });
    rt.dispose(); pretos.forEach(m => m.dispose()); mats.forEach(m => m.dispose());
    const totais = {}; itens.forEach(it => { const z = it.zona || '-'; totais[z] = (totais[z] || 0) + 1; });
    return { saida, ve: ZV.ve, totais, nItens: itens.length };
  }, { PASSO, PASSO_HALL });
  console.log(`${res.nItens} itens (blocos de móveis, pessoas, marcadores) · ${((Date.now() - t0) / 1000).toFixed(0)} s · itens por zona: ${JSON.stringify(res.totais)}`);
  const linhas = [];
  Object.entries(res.saida).forEach(([zo, s]) => {
    const vistas = Object.keys(s.porZona).filter(z => z !== zo && z !== '-' && z !== 'escada');
    const atual = (res.ve[zo] || []).slice().sort(), calc = vistas.sort();
    console.log(`\n■ de ${zo} (${s.amostras} posições × 2 alturas)`);
    Object.entries(s.porZona).sort().forEach(([zd, e]) => console.log(`   ${zd.padEnd(20)} ${String(e.itens).padStart(4)} de ${String(e.total).padStart(4)} itens vistos`));
    console.log(`   tabela atual:    ${atual.join(', ')}`);
    console.log(`   por geometria:   ${calc.join(', ')}`);
    const sobra = atual.filter(z => !calc.includes(z)), falta = calc.filter(z => !atual.includes(z));
    if (sobra.length) console.log(`   pode esconder:   ${sobra.join(', ')}`);
    if (falta.length) console.log(`   FALTA mostrar:   ${falta.join(', ')}`);
    linhas.push({ de: zo, atual, calculado: calc, podeEsconder: sobra, faltaMostrar: falta });
  });
  DETALHE.split(',').filter(Boolean).forEach(par => { const [o, dd] = par.split(':'); const e = res.saida[o] && res.saida[o].porZona[dd]; console.log(`
itens de ${dd} vistos de ${o}:`); (e ? e.lista : []).sort((p, q) => p.x - q.x).forEach(i => console.log(`   ${i.tipo.padEnd(22)} (${i.x}, ${i.y}, ${i.z}) em ${i.vezes} vistas`)); });
  /* tabela sugerida: zona inteira se ≥ INTEIRA dos itens dela são vistos; senão, só os itens vistos (retângulo de ±0,75 m em
     volta do centro de cada um: visibilidade parcial de sala.js) */
  const INTEIRA = +(process.env.INTEIRA || 0.3), sug = {};
  Object.entries(res.saida).forEach(([zo, s]) => {
    sug[zo] = Object.entries(s.porZona).filter(([zd]) => zd !== zo && zd !== '-' && zd !== 'escada').sort().map(([zd, e]) => {
      if (e.itens / e.total >= INTEIRA) return zd;
      const em = []; e.lista.forEach(i => { const r = [+(i.x - 0.75).toFixed(2), +(i.z - 0.75).toFixed(2), +(i.x + 0.75).toFixed(2), +(i.z + 0.75).toFixed(2)];
        if (!em.some(q => q.join() === r.join())) em.push(r); });
      return { zona: zd, em };
    });
  });
  console.log('\nve sugerido (inteira se ≥ ' + Math.round(INTEIRA * 100) + '% dos itens vistos; senão só os itens vistos):');
  Object.entries(sug).forEach(([zo, l]) => console.log("        '" + zo + "': [" + l.map(x => typeof x === 'string' ? "'" + x + "'" : "{ zona: '" + x.zona + "', em: " + JSON.stringify(x.em).replace(/,/g, ', ') + ' }').join(', ') + '],'));
  res.sugerido = sug;
  fs.writeFileSync(path.join(__dirname, 'relatorio-visibilidade-zonas-vr.json'), JSON.stringify({ data: new Date().toISOString(), passo: PASSO, passoHall: PASSO_HALL, linhas, sugerido: res.sugerido, saida: res.saida, totais: res.totais }, null, 2));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
