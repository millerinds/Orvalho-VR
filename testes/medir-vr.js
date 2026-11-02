/* Mede o custo de desenho DENTRO da vista VR (IWER, dois olhos) em pontos do Lab e do Hall. Ferramenta de análise: não faz parte do teste:tudo.
   Para cada ponto: draw calls e triângulos do quadro (os dois olhos), memória do renderer (geometrias, texturas, programas)
   e a origem de cada draw call (cada objeto é marcado com onBeforeRender/onAfterRender em volta do renderer.info).
   Com essa atribuição, estima, SEM aplicar nada, quanto cada otimização tiraria naquele ponto:
     - contornos distantes (> 6 m e > 10 m da cabeça);
     - vidros transparentes de dupla face (a r149 desenha 2× cada um: face de trás e da frente);
     - mesclar malhas estáticas que dividem o mesmo material;
     - instancing de malhas repetidas (mesma geometria e material);
     - culling por andar (objetos inteiramente no outro pavimento; limite superior, porque parte aparece pelo vão).
   Contagens de draw/triângulos dependem da cena e do campo de visão, não da GPU: valem como ordem de grandeza para o Quest,
   mas o campo de visão do IWER (Quest 3) não é idêntico ao do 3S, e o fps daqui NÃO representa o aparelho.
   Categorias de cada draw (tabela por categoria): móveis (blocos instanciados), portas (folhas que abrem, com contorno), vidros
   (materiais transparentes), pinos (marcadores de interação, com contorno), contornos (cascas dos móveis e das peças de gelatina),
   estrutura (piso, paredes, forro, molduras, luminárias, sombras) e outros (pessoas, elevador, painéis do VR, jogador).
   Cada objeto também recebe a zona de visibilidade (zonasVR) em que está, para ver de onde vem o custo de cada vista.
   VARRER=1 gira a cabeça do IWER em 8 direções (yaw 0, 45, …, 315; 0 = +z/S, 90 = +x/L) e mede cada uma.
   Uso: npm run medir:vr   (GPU=1 para rodar mais rápido) → testes/relatorio-medir-vr.json
        PONTOS=acioc,incubadora VARRER=1 VR_QUERY='vr-zonas=0&vr-dist=0' GPU=1 npm run medir:vr */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const { atender } = require('./servir');
const navegador = require('./navegador');
const IWER = fs.readFileSync(require.resolve('iwer/build/iwer.min.js'), 'utf8');
const PI = Math.PI;

/* pontos: os mesmos do ?vr-ponto (src/xr/pontos.js), lidos da página. PONTOS=lab,acioc limita; VR_QUERY acrescenta parâmetros
   (ex.: VR_QUERY='vr-contorno=0' mede sem o corte de contornos); CELULA=6 troca o lado da célula dos móveis (O.config.celulaMoveis). */
const SO = (process.env.PONTOS || '').split(',').filter(Boolean), EXTRA = process.env.VR_QUERY ? '&' + process.env.VR_QUERY : '', CELULA = +process.env.CELULA || 0;
const VARRER = process.env.VARRER === '1', SAIDA = process.env.SAIDA || 'relatorio-medir-vr.json';
const CATS = ['moveis', 'portas', 'vidros', 'pinos', 'contornos', 'estrutura', 'outros'];

const cats = m => CATS.map(c => `${c} ${m.categorias[c].draw}/${Math.round(m.categorias[c].tri / 1000)}K`).join(' · ');

/* roda na página: atribui cada draw call a um objeto durante alguns quadros e devolve o resumo */
function medirNaPagina(quadros) {
  const O = window.Orvalho, d = O.jogo._debug(), r = d.renderer, info = r.info, cena = d.camera.parent && (function(){ let o = d.camera; while (o.parent) o = o.parent; return o; })();
  const cab = new THREE.Vector3(); d.camera.getWorldPosition(cab);
  const reg = new Map(), originais = [];
  /* conta os desenhos de verdade: os ganchos pegam também o desenho do quadro em que a medição termina (antes, as categorias
     eram divididas pelo número de quadros e ficavam ~17–25% acima do total) */
  const renderOrig = r.render; let desenhos = 0;
  r.render = function(){ desenhos++; return renderOrig.apply(this, arguments); };
  const caixa = new THREE.Box3(), esfera = new THREE.Sphere();
  /* portas (pivô com userData.porta), o jogador e as pessoas (a raiz do boneco do NPC tem a etiqueta com o nome, um Sprite) */
  /* nó que representa o dono (pivô da porta, marcador, raiz da pessoa) para saber onde ele está */
  function raizDono(o){ let p = o; while (p) { if (p.userData && (p.userData.porta || p.userData.it || p.userData.npc)) return p; p = p.parent; } return o; }
  /* (as pessoas são marcadas com userData.npc em sala.js; antes, a etiqueta era reconhecida pela altura do sprite, e as bolhas
     que flutuam pelo hall às vezes caíam na mesma faixa e levavam o ambiente inteiro para "pessoas") */
  function dono(o){ let p = o; while (p) { if (p.userData && p.userData.porta) return 'porta'; if (p === d.player.root) return 'jogador'; if (p.userData && p.userData.npc) return 'npc'; p = p.parent; } return null; }
  cena.traverse(o => {
    if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return;
    const b = o.onBeforeRender, a = o.onAfterRender; originais.push([o, b, a]);
    let c0 = 0, t0 = 0;
    o.onBeforeRender = function(){ c0 = info.render.calls; t0 = info.render.triangles; return b.apply(this, arguments); };
    o.onAfterRender = function(){
      let e = reg.get(o); if (!e) { e = { calls: 0, tris: 0, vezes: 0 }; reg.set(o, e); }
      e.calls += info.render.calls - c0; e.tris += info.render.triangles - t0; e.vezes++;
      return a.apply(this, arguments);
    };
  });
  return new Promise((resolve, reject) => {
    let k = 0, total = { calls: 0, tris: 0 };
    const sessao = r.xr.getSession();
    function quadro(){ try { quadro0(); } catch (e) { r.render = renderOrig; originais.forEach(([o, b, a]) => { o.onBeforeRender = b; o.onAfterRender = a; }); reject(new Error(e.message + " @ " + String(e.stack).split(String.fromCharCode(10))[1])); } }
    function quadro0(){
      if (++k <= quadros) { total.calls += info.render.calls; total.tris += info.render.triangles; return sessao.requestAnimationFrame(quadro); }
      originais.forEach(([o, b, a]) => { o.onBeforeRender = b; o.onAfterRender = a; });
      r.render = renderOrig;
      const n = Math.max(1, desenhos), itens = [];
      reg.forEach((e, o) => {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        const contorno = !!(m && m.isMeshBasicMaterial && m.side === THREE.BackSide && o.parent && o.parent.isMesh);
        const ui = /^xr-/.test(o.name || '');
        /* distância à cabeça: para InstancedMesh, a instância mais próxima (o Box3 da r149 olharia só a geometria na origem) */
        let dist, yMin, yMax;
        if (o.isInstancedMesh) {
          const base = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere), mi = new THREE.Matrix4(), c = new THREE.Vector3();
          dist = Infinity; yMin = Infinity; yMax = -Infinity;
          for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, mi); mi.premultiply(o.matrixWorld); c.copy(base.center).applyMatrix4(mi);
            const rr = base.radius * mi.getMaxScaleOnAxis(); dist = Math.min(dist, Math.max(0, cab.distanceTo(c) - rr)); yMin = Math.min(yMin, c.y - rr); yMax = Math.max(yMax, c.y + rr); }
        } else { caixa.setFromObject(o); caixa.getBoundingSphere(esfera); dist = Math.max(0, cab.distanceTo(esfera.center) - esfera.radius); yMin = caixa.min.y; yMax = caixa.max.y; }
        /* categoria: o dono (porta, pino, pessoa) vem antes do contorno, para o contorno de um pino contar como pino */
        const dn = dono(o), pino = !!((o.userData && o.userData.it) || (o.parent && o.parent.userData && o.parent.userData.it));
        const cat = ui || dn === 'jogador' || dn === 'npc' ? 'outros' : dn === 'porta' ? 'portas' : pino ? 'pinos' : contorno ? 'contornos'
          : (o.isInstancedMesh && window.Orvalho.moveis.TIPOS[o.name]) || (contorno && o.parent && window.Orvalho.moveis.TIPOS[o.parent.name]) ? 'moveis'
          : (m && m.transparent) ? 'vidros' : 'estrutura';
        /* zona: blocos de móveis pela esfera das instâncias; portas pelo pivô; pinos e pessoas pela posição; o resto (malhas
           mescladas que atravessam o prédio) fica sem zona */
        let zona = null;
        const za = d.amb.zonaEm;
        if (za) {
          let alvo = o; if (contorno && o.parent) alvo = o.parent;
          if (alvo.isInstancedMesh && window.Orvalho.moveis.TIPOS[alvo.name]) { const c0 = alvo.geometry.boundingSphere.center; zona = za(c0.x, c0.z, c0.y > 3.5 ? 4.2 : 0); }
          else if (dn === 'porta' || dn === 'npc' || pino) { const w = new THREE.Vector3(); raizDono(o).getWorldPosition(w); zona = za(w.x, w.z, w.y > 3 ? 4.2 : 0); }
        }
        itens.push({
          assinatura: m ? [m.type, m.color && m.color.getHexString(), m.map && m.map.uuid, m.roughness, m.metalness, m.transparent, m.opacity, m.side, o.renderOrder, m.depthWrite, m.userData && m.userData.u ? 'gel' + o.uuid : ''].join('|') : '',
          cat, zona, nome: o.name || (o.parent && o.parent.name) || '', pai: o.parent ? (o.parent.name || o.parent.type) + (o.parent.parent ? '<' + (o.parent.parent.name || o.parent.parent.type) : '') : '',
          calls: e.calls / n, tris: e.tris / n, contorno, ui, instanciada: !!o.isInstancedMesh,
          transparenteDupla: !!(m && m.transparent && m.side === THREE.DoubleSide),
          dist, yMin, yMax, dono: dono(o), semCulling: o.frustumCulled === false || (o.parent && o.parent.isInstancedMesh && o.parent.frustumCulled === false), instancias: o.isInstancedMesh ? o.count : 1,
          geo: o.geometry && o.geometry.uuid, mat: m && m.uuid, tipoMat: m && m.type
        });
      });
      const soma = f => Math.round(itens.filter(f).reduce((s, i) => s + i.calls, 0));
      const somaT = f => Math.round(itens.filter(f).reduce((s, i) => s + i.tris, 0));
      const pisoJog = d.st.y, outroAndar = i => pisoJog < 2 ? i.yMin >= 4.15 : i.yMax <= 4.2;
      /* malhas estáticas não instanciadas, fora de contorno/UI/portas/elevador/pessoas: mesclar por material */
      const estaticas = itens.filter(i => !i.contorno && !i.ui && !i.instanciada && !i.dono);
      const porMat = new Map(); estaticas.forEach(i => porMat.set(i.mat, (porMat.get(i.mat) || 0) + i.calls));
      const mesclarGanho = estaticas.reduce((s, i) => s + i.calls, 0) - [...porMat.values()].reduce((s, v) => s + Math.min(v, 2), 0);
      const porGeoMat = new Map(); estaticas.forEach(i => { const k = i.geo + '|' + i.mat; const g = porGeoMat.get(k) || { n: 0, calls: 0 }; g.n++; g.calls += i.calls; porGeoMat.set(k, g); });
      let instGanho = 0, instGrupos = 0; porGeoMat.forEach(g => { if (g.n > 1) { instGanho += g.calls - Math.min(g.calls, 2); instGrupos++; } });
      /* simulação (nada é alterado): instâncias divididas em células de L m (por pavimento), cada célula com culling próprio
         pelo frustum dos dois olhos XR; opcionalmente sem contorno nas células a mais de C m da cabeça */
      const xrCam = r.xr.getCamera(), olhos = (xrCam.cameras && xrCam.cameras.length ? xrCam.cameras : [xrCam]).map(c => {
        const f = new THREE.Frustum(); f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)); return f; });
      function simular(L, corteContorno){
        let calls = 0, tris = 0; const mi = new THREE.Matrix4(), sph = new THREE.Sphere();
        reg.forEach((e, o) => {
          if (!o.isInstancedMesh || !(e.calls > 0)) return;
          const contorno = o.parent && o.parent.isInstancedMesh, g = o.geometry, triInst = (g.index ? g.index.count : g.attributes.position.count) / 3;
          const base = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere), celulas = new Map();
          for (let k = 0; k < o.count; k++) {
            o.getMatrixAt(k, mi); mi.premultiply(o.matrixWorld); sph.copy(base).applyMatrix4(mi);
            const ch = Math.floor(sph.center.x / L) + ',' + Math.floor(sph.center.z / L) + ',' + (sph.center.y > 3 ? 1 : 0);
            const c = celulas.get(ch) || { n: 0, olhos: [false, false], dist: Infinity }; c.n++;
            olhos.forEach((f, i) => { if (f.intersectsSphere(sph)) c.olhos[i] = true; });
            c.dist = Math.min(c.dist, Math.max(0, cab.distanceTo(sph.center) - sph.radius)); celulas.set(ch, c);
          }
          celulas.forEach(c => {
            if (contorno && corteContorno && c.dist > corteContorno) return;
            const v = c.olhos.filter(Boolean).length; calls += v; tris += v * c.n * triInst;
          });
        });
        return { draw: Math.round(calls), tri: Math.round(tris) };
      }
      const atualInst = { draw: Math.round(itens.filter(i => i.instanciada).reduce((s, i) => s + i.calls, 0)), tri: Math.round(itens.filter(i => i.instanciada).reduce((s, i) => s + i.tris, 0)) };
      const celulas = { atual: atualInst, cel6: simular(6, 0), cel10: simular(10, 0), cel6SemContornoAlem10m: simular(6, 10), cel6SemContornoAlem6m: simular(6, 6) };
      const mem = info.memory;
      const categorias = {}; ['moveis', 'portas', 'vidros', 'pinos', 'contornos', 'estrutura', 'outros'].forEach(c => { categorias[c] = { draw: 0, tri: 0 }; });
      const porZona = {};
      itens.forEach(i => { const c = categorias[i.cat]; c.draw += i.calls; c.tri += i.tris;
        if (i.zona && (i.cat === 'moveis' || i.cat === 'portas' || i.cat === 'pinos' || i.cat === 'outros')) {
          const z = porZona[i.zona] || (porZona[i.zona] = { draw: 0, tri: 0 }); z.draw += i.calls; z.tri += i.tris; } });
      Object.values(categorias).concat(Object.values(porZona)).forEach(c => { c.draw = Math.round(c.draw); c.tri = Math.round(c.tri); });
      const topEstrutura = itens.filter(i => i.cat === 'estrutura' || i.cat === 'vidros').sort((a, b) => b.calls - a.calls).slice(0, 12).map(i => ({ nome: i.nome, cat: i.cat, draw: +i.calls.toFixed(1), tri: Math.round(i.tris), mat: i.tipoMat, inst: i.instancias, pai: i.pai }));
      /* estimativa (nada é aplicado): se materiais de estrutura com os mesmos parâmetros fossem um só, a mescla por material
         juntaria essas malhas; sobraria ~1 draw por olho por "assinatura" de material visível */
      const assin = new Set(); let drawEstr = 0;
      itens.filter(i => (i.cat === 'estrutura' || i.cat === 'vidros') && i.calls > 0 && !i.instanciada).forEach(i => { assin.add(i.assinatura); drawEstr += i.calls; });
      const estruturaMateriaisIguais = { atual: Math.round(drawEstr), depois: assin.size * 2 };
      const nEstrutura = itens.filter(i => (i.cat === 'estrutura' || i.cat === 'vidros') && i.calls > 0).length;
      const pessoas = Math.round(itens.filter(i => i.dono === 'npc').reduce((s, i) => s + i.calls, 0));
      resolve({
        categorias, porZona, pessoas, topEstrutura, nEstrutura, estruturaMateriaisIguais, zonaCabeca: d.amb.zonaVR ? d.amb.zonaVR() : null, yaw: window.Orvalho.xr.sessao.medidor() ? window.Orvalho.xr.sessao.medidor().cabeca().yaw : null,
        calls: +(total.calls / quadros).toFixed(1), tris: Math.round(total.tris / quadros),
        porOlho: { calls: +(total.calls / quadros / 2).toFixed(1), tris: Math.round(total.tris / quadros / 2) },
        memoria: { geometrias: mem.geometries, texturas: mem.textures, programas: info.programs ? info.programs.length : null },
        cena: (() => { let t = 0, inst = 0, nInst = 0; const geos = new Set(), texs = new Set(), mats = new Set(); let triTot = 0;
          cena.traverse(o => { if (!o.isMesh) return; t++; if (o.isInstancedMesh) { inst++; nInst += o.count; }
            const g = o.geometry; if (g) { geos.add(g.uuid); triTot += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }
            [].concat(o.material).forEach(m => { if (!m) return; mats.add(m.uuid); for (const k in m) if (m[k] && m[k].isTexture) texs.add(m[k].uuid); }); });
          return { malhas: t, instancedMeshes: inst, instancias: nInst, geometriasUnicas: geos.size, texturasUnicas: texs.size, materiais: mats.size, triangulosSeTudoDesenhado: Math.round(triTot) }; })(),
        objetosDesenhados: itens.filter(i => i.calls > 0).length,
        origem: {
          contornos: soma(i => i.contorno), trisContornos: somaT(i => i.contorno), semCulling: soma(i => i.semCulling), trisSemCulling: somaT(i => i.semCulling),
          trisInstanciadas: somaT(i => i.instanciada), vidrosDuplaFace: soma(i => i.transparenteDupla), instanciadas: soma(i => i.instanciada && !i.contorno),
          ui: soma(i => i.ui), portas: soma(i => i.dono === 'porta')
        },
        celulasInstanciadas: celulas,
        estimativas: {
          contornosAlem6m: soma(i => i.contorno && i.dist > 6), contornosAlem10m: soma(i => i.contorno && i.dist > 10),
          vidrosDuplaFaceUmaPassada: Math.round(soma(i => i.transparenteDupla && !i.contorno) / 2),
          mesclarEstaticasPorMaterial: Math.round(mesclarGanho), materiaisEstaticos: porMat.size,
          instancingRepetidas: Math.round(instGanho), gruposRepetidos: instGrupos,
          cullingOutroAndar: soma(outroAndar)
        },
        jogador: { x: +d.st.x.toFixed(2), y: +d.st.y.toFixed(2), z: +d.st.z.toFixed(2) },
        cabeca: { x: +cab.x.toFixed(2), y: +cab.y.toFixed(2), z: +cab.z.toFixed(2) }
      });
    }
    sessao.requestAnimationFrame(quadro);
  });
}

(async () => {
  const server = http.createServer(atender).listen(0, '127.0.0.1');
  await new Promise(r => server.on('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await navegador.abrir(chromium, true);
  const rel = { data: new Date().toISOString(), webgl: browser.__modo, extra: EXTRA, celula: CELULA || 'padrão', pontos: {} };
  const lista = await (async () => { const p = await browser.newPage(); await p.goto(url); const l = await p.evaluate(() => window.Orvalho.xr.pontos.lista); await p.close(); return l; })();
  try {
    for (const p of lista.filter(x => !SO.length || SO.includes(x.id))) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const erros = []; page.on('pageerror', e => erros.push(e.message));
      await page.addInitScript(IWER);
      await page.addInitScript(() => { window.__xr = new window.IWER.XRDevice(window.IWER.metaQuest3); window.__xr.installRuntime({ forceInstall: true }); });
      if (CELULA) await page.addInitScript(c => { window.Orvalho = window.Orvalho || {}; window.Orvalho.config = { celulaMoveis: c }; }, CELULA);
      await page.goto(url);
      await page.evaluate(() => {
        localStorage.clear();
        window.Orvalho.avatar.store(window.Orvalho.avatar.load());
        localStorage.setItem('orvalho-vr', JSON.stringify({ medidor: false }));   // mede a cena, sem o painel do medidor
      });
      await page.goto(url + '?vr-ponto=' + p.id + EXTRA);   // o próprio ?vr-ponto põe o jogador no ponto
      const noPonto = await page.evaluate(id => { const a = window.Orvalho.xr.pontos.atual(); return a && a.id === id; }, p.id);
      if (!noPonto) throw new Error('?vr-ponto=' + p.id + ' não foi aplicado');
      await page.waitForSelector('#btn-vr:not([hidden])', { timeout: 10000 });
      await page.click('#btn-vr');
      await page.waitForFunction(() => window.Orvalho.xr.sessao.ativa(), null, { timeout: 30000 });
      await page.waitForTimeout(2500);   // portas e elevador acomodam
      const m = await page.evaluate(medirNaPagina, 6);
      m.rotulo = p.rotulo; m.desvioDoPonto = +Math.hypot(m.jogador.x - p.x, m.jogador.z - p.z).toFixed(2); m.erros = erros;
      rel.pontos[p.id] = m;
      const e = m.estimativas;
      console.log(`${p.id.padEnd(20)} ${String(m.calls).padStart(6)} draw (${m.porOlho.calls}/olho) ${String(Math.round(m.tris / 1000)).padStart(5)}K tri · geo ${m.memoria.geometrias} tex ${m.memoria.texturas} prog ${m.memoria.programas}`
        + ` · contornos ${m.origem.contornos} draw/${Math.round(m.origem.trisContornos / 1000)}K tri · vidro 2× ${m.origem.vidrosDuplaFace} · portas ${m.origem.portas}`
        + (m.desvioDoPonto > 0.3 ? ` · ATENÇÃO: posição ajustada ${m.desvioDoPonto} m` : ''));
      console.log('   ' + cats(m) + ` · zona da cabeça ${m.zonaCabeca} · estrutura com materiais iguais compartilhados: ${m.estruturaMateriaisIguais.atual} → ~${m.estruturaMateriaisIguais.depois} draw (estimativa)`);
      if (VARRER) {
        m.setores = [];
        for (let yaw = 0; yaw < 360; yaw += 45) {
          /* yaw do mundo = giro do rig + yaw local da cabeça; o IWER recebe o yaw local (câmera olha para -z) */
          await page.evaluate(Y => { const cam = window.Orvalho.jogo._debug().camera, a = Y * Math.PI / 180 - cam.parent.rotation.y - Math.PI;
            window.__xr.quaternion.set(0, Math.sin(a / 2), 0, Math.cos(a / 2)); }, yaw);
          await page.waitForTimeout(400);
          const s = await page.evaluate(medirNaPagina, 4);
          m.setores.push({ yaw, yawReal: s.yaw, calls: s.calls, tris: s.tris, categorias: s.categorias, porZona: s.porZona, zonaCabeca: s.zonaCabeca, estruturaMateriaisIguais: s.estruturaMateriaisIguais });
          console.log(`   ${String(yaw).padStart(3)}° (${String(Math.round(s.yaw)).padStart(3)}°) ${String(s.calls).padStart(6)} draw ${String(Math.round(s.tris / 1000)).padStart(5)}K · ` + cats(s)
            + ' · zonas ' + Object.entries(s.porZona).sort((a, b) => b[1].draw - a[1].draw).map(([z, v]) => z + ' ' + v.draw).join(', '));
        }
      }
      await page.close();
    }
  } finally {
    await browser.close(); server.close();
    fs.writeFileSync(path.join(__dirname, SAIDA), JSON.stringify(rel, null, 2));
    console.log('relatório em testes/' + SAIDA);
  }
})().catch(e => { console.error(e); process.exit(1); });
