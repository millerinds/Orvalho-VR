/* Análise de "pulos" das zonas de visibilidade do VR no Hall (ferramenta de análise; não faz parte do teste:tudo).
   Para cada passagem entre zonas (porta, chegada da escada, fim do corredor), compara os blocos de móveis visíveis com a cabeça
   0,4 m antes e 0,4 m depois da passagem, com as zonas e a distância máxima (?vr-dist) da configuração pedida. Os blocos que
   aparecem ou somem na travessia são os candidatos a "pulo": a tabela diz quantos são, de que zona e a que distância da passagem
   está o mais próximo. Só a visibilidade é calculada (não há teste de oclusão): um bloco que aparece atrás de uma parede opaca
   não é visto pela pessoa, então o número é um limite superior do que se percebe.
   Uso: DIST=25 GPU=1 node testes/pulos-zonas-vr.js   (DIST=0 = sem limite de distância) → testes/relatorio-pulos-zonas-vr.json */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const { atender } = require('./servir');
const navegador = require('./navegador');
const DIST = process.env.DIST != null ? +process.env.DIST : 25;

/* passagens: ponto no chão, direção de travessia (de A para B) e altura do piso */
const PASSAGENS = [
  { id: 'porta do ACIOC', x: 10.5, z: 12.7, dx: 1, dz: 0, y: 4.2 },
  { id: 'porta do Administrativo', x: 42.5, z: 14.6, dx: 0, dz: 1, y: 4.2 },
  { id: 'porta do podcast', x: 38.6, z: 14.6, dx: 0, dz: 1, y: 4.2 },
  { id: 'porta das reuniões', x: 37.3, z: 14.6, dx: 0, dz: 1, y: 4.2 },
  { id: 'fim do corredor → corredor da Incubadora', x: 44, z: 13.2, dx: 1, dz: 0, y: 4.2 },
  { id: 'porta 103 da Incubadora', x: 46.5, z: 11.1, dx: 1, dz: 0, y: 4.2 },
  { id: 'porta 101 da Incubadora', x: 46.5, z: 2.1, dx: 1, dz: 0, y: 4.2 },
  { id: 'chegada da escada (1º andar)', x: 43.2, z: 12.45, dx: 0, dz: 1, y: 4.2, deEscada: true },
  { id: 'saída da escada para o oeste (1º andar)', x: 42.4, z: 12.2, dx: -1, dz: 0, y: 4.2 },
  { id: 'pé da escada (térreo)', x: 43.2, z: 3.0, dx: 0, dz: 1, y: 0, paraEscada: true }
];

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
  await page.waitForFunction(() => window.Orvalho.jogo.ativo() && window.Orvalho.jogo.ambienteAtual() === 'hall-inovale', null, { timeout: 60000 }).catch(async e => { console.error(await page.evaluate(() => ({ ativo: window.Orvalho.jogo.ativo(), amb: window.Orvalho.jogo.ambienteAtual(), salvo: localStorage.getItem('orvalho-jogo') }))); throw e; });
  const res = await page.evaluate(({ PASSAGENS, DIST }) => {
    const a = window.Orvalho.jogo._debug().amb, TIPOS = window.Orvalho.moveis.TIPOS, blocos = [];
    a.grupo.traverse(o => { if (o.isInstancedMesh && TIPOS[o.name]) blocos.push(o); });
    const p = new THREE.Vector3();
    function visiveis(x, y, z){ p.set(x, y, z); a.visibilidadeVR(p, { contorno: 0, zonas: true, dist: DIST }); return blocos.map(b => b.visible); }
    const out = PASSAGENS.map(ps => {
      /* cabeça a 1,6 m do piso; na escada, a meia altura (fora de zona) */
      const yA = ps.deEscada ? 4.0 + 1.6 : ps.y + 1.6, yB = ps.paraEscada ? 0.2 + 1.6 : ps.y + 1.6;
      const xA = ps.x - ps.dx * 0.4, zA = ps.z - ps.dz * 0.4, xB = ps.x + ps.dx * 0.4, zB = ps.z + ps.dz * 0.4;
      const vA = visiveis(xA, yA, zA), zonaA = a.zonaVR(), vB = visiveis(xB, yB, zB), zonaB = a.zonaVR();
      const muda = []; blocos.forEach((b, i) => { if (vA[i] !== vB[i]) { const e = b.geometry.boundingSphere;
        muda.push({ aparece: vB[i], zona: a.zonaEm(e.center.x, e.center.z, e.center.y > 3.5 ? 4.2 : 0), dist: Math.max(0, Math.hypot(e.center.x - ps.x, e.center.z - ps.z) - e.radius), tipo: b.name, inst: b.count }); } });
      const resumo = (lista) => { const porZona = {}; lista.forEach(m => { const z = porZona[m.zona] || (porZona[m.zona] = { blocos: 0, maisPerto: Infinity }); z.blocos++; z.maisPerto = Math.min(z.maisPerto, m.dist); });
        Object.values(porZona).forEach(z => { z.maisPerto = +z.maisPerto.toFixed(1); }); return porZona; };
      return { id: ps.id, de: zonaA, para: zonaB, aparecem: resumo(muda.filter(m => m.aparece)), somem: resumo(muda.filter(m => !m.aparece)) };
    });
    a.modoVR(false);
    return out;
  }, { PASSAGENS, DIST });
  const fmt = o => Object.entries(o).map(([z, v]) => `${z} ${v.blocos} (a ${v.maisPerto} m)`).join(', ') || '—';
  console.log(`zonas ligadas · distância máxima dos móveis de outras zonas: ${DIST || '∞'} m · blocos de móveis que mudam ao atravessar (zona, quantidade, o mais perto da passagem)`);
  res.forEach(r => console.log(`${r.id.padEnd(42)} ${String(r.de).padEnd(20)} → ${String(r.para).padEnd(20)} aparecem: ${fmt(r.aparecem)} · somem: ${fmt(r.somem)}`));
  fs.writeFileSync(path.join(__dirname, 'relatorio-pulos-zonas-vr.json'), JSON.stringify({ data: new Date().toISOString(), dist: DIST, passagens: res }, null, 2));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
