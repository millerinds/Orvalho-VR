/* Teste de navegação do Orvalho (Lab de IA), no navegador de verdade.
   1. Auditoria de colisores: cada colisor bate com a geometria visível do móvel? Há colisor sem nada visível?
   2. Largura livre dos corredores principais (medida na planta de colisão, ao longo de todo o corredor).
   3. Cobertura: quanto do piso livre o boneco alcança a partir da entrada (sem bolsões isolados).
   4. Percurso real: dirige o boneco com as teclas W/A/S/D (relativas à câmera, como uma pessoa faria)
      pelos trajetos completos, interage com cada equipamento e falha se ele ficar preso.
   Uso:  npm install && npm run teste:navegacao      (opções: --ambiente=hall-inovale  --corpo=gota  --janela  CHROMIUM=/caminho/do/chrome)
   Sai com código 1 se algo falhar. Grava o relatório em testes/relatorio-navegacao.json. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const RAIZ = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const CORPO = (ARGS.find(a => a.startsWith('--corpo=')) || '--corpo=jujuba').split('=')[1];
const HEADLESS = !ARGS.includes('--janela');
const AMBIENTE = (ARGS.find(a => a.startsWith('--ambiente=')) || '--ambiente=lab-ia').split('=')[1];

/* ---------- servidor estático mínimo (sem dependência) ---------- */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.json': 'application/json' };
function servidor() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}
function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = path.join(base, d, sub); if (fs.existsSync(p)) return p;
    }
  }
  return undefined; // deixa o playwright procurar o dele
}

/* ---------- funções que rodam dentro da página ---------- */
function noNavegador() {
  const D = () => Orvalho.jogo._debug();
  /* traça um raio a partir de p na direção n até bater em algo (sphere tracing com a folga) */
  function tracar(p, n) {
    const col = D().amb.colisao; let t = 0;
    for (let i = 0; i < 200; i++) { const d = col.folga({ x: p.x + n.x * t, z: p.z + n.z * t }, 0); if (d < 0.002) break; t += d; if (t > 20) break; }
    return t;
  }
  /* largura livre ao longo de um corredor: em cada ponto da linha central, soma os dois lados na perpendicular */
  window.__largura = function (a, b, passo) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = { x: -dz / L, z: dx / L }, m = { x: -n.x, z: -n.z };
    let min = Infinity, onde = null, soma = 0, k = 0;
    for (let s = 0; s <= L + 1e-6; s += passo || 0.05) {
      const p = { x: a[0] + dx * s / L, z: a[1] + dz * s / L };
      if (D().amb.colisao.folga(p, 0) < 0.01) continue;
      const w = tracar(p, n) + tracar(p, m); soma += w; k++;
      if (w < min) { min = w; onde = [+p.x.toFixed(2), +p.z.toFixed(2)]; }
    }
    return { min: +min.toFixed(3), media: +(soma / k).toFixed(3), onde };
  };
  /* grade de ocupação: célula livre se o boneco cabe ali com folga */
  function grade(r) {
    const L = D().amb.limites, col = D().amb.colisao, h = 0.05;
    const nx = Math.ceil((L.x1 - L.x0) / h), nz = Math.ceil((L.z1 - L.z0) / h), livre = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = L.x0 + (i + 0.5) * h, z = L.z0 + (j + 0.5) * h;
      livre[i + j * nx] = L.dentroDaSala(x, z) && col.folga({ x, z }, 0) >= r ? 1 : 0;
    }
    return { L, h, nx, nz, livre, cel: (x, z) => [Math.floor((x - L.x0) / h), Math.floor((z - L.z0) / h)], pos: (i, j) => [L.x0 + (i + 0.5) * h, L.z0 + (j + 0.5) * h] };
  }
  function bfs(G, ai, aj) {
    const dist = new Int32Array(G.nx * G.nz).fill(-1), prev = new Int32Array(G.nx * G.nz).fill(-1), q = [ai + aj * G.nx];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % G.nx, j = (c / G.nx) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= G.nx || nj >= G.nz) continue;
        const n = ni + nj * G.nx; if (!G.livre[n] || dist[n] >= 0) continue;
        if (di && dj && (!G.livre[i + di + j * G.nx] || !G.livre[i + (j + dj) * G.nx])) continue; // não corta quina
        dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
      }
    }
    return { dist, prev };
  }
  function maisPerto(G, x, z) {
    let [i, j] = G.cel(x, z), best = null, bd = Infinity;
    for (let a = -12; a <= 12; a++) for (let b = -12; b <= 12; b++) { const n = (i + a) + (j + b) * G.nx; if (G.livre[n] && a * a + b * b < bd) { bd = a * a + b * b; best = [i + a, j + b]; } }
    return best;
  }
  /* cobertura: fração do piso livre alcançável a partir da entrada */
  window.__cobertura = function (r) {
    const G = grade(r), e = D().amb.entrada, a = maisPerto(G, e.x, e.z), B = bfs(G, a[0], a[1]);
    let livres = 0, alc = 0; const ilhas = [];
    for (let n = 0; n < G.livre.length; n++) if (G.livre[n]) { livres++; if (B.dist[n] >= 0) alc++; else ilhas.push(G.pos(n % G.nx, (n / G.nx) | 0)); }
    return { livres_m2: +(livres * G.h * G.h).toFixed(2), alcancavel_m2: +(alc * G.h * G.h).toFixed(2), pct: +(100 * alc / livres).toFixed(1), exemploIsolado: ilhas.slice(0, 3) };
  };
  /* caminho mais curto até (x,z) com folga r, simplificado por linha de visada */
  window.__planejar = function (x, z, r) {
    const am = D().amb; if (am.comPortasAbertas && !window.__dentroPortas) { window.__dentroPortas = true; try { return am.comPortasAbertas(() => window.__planejar(x, z, r)); } finally { window.__dentroPortas = false; } }
    const G = grade(r + 0.04), st = D().st, a = maisPerto(G, st.x, st.z), b = maisPerto(G, x, z);
    if (!a || !b) return null;
    const B = bfs(G, a[0], a[1]), fim = b[0] + b[1] * G.nx; if (B.dist[fim] < 0) return null;
    const cel = []; for (let c = fim; c >= 0; c = B.prev[c]) cel.push(G.pos(c % G.nx, (c / G.nx) | 0)); cel.reverse();
    /* os atalhos em linha reta mantêm distância maior dos obstáculos: o motorista (8 direções de tecla) não raspa em pilares */
    const G2 = grade(r + 0.14);
    const ve = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let s = 0; s <= L; s += 0.03) { const [i, j] = G2.cel(p[0] + (q[0] - p[0]) * s / L, p[1] + (q[1] - p[1]) * s / L); if (!G2.livre[i + j * G2.nx]) return false; } return true; };
    const out = [cel[0]]; let k = 0;
    while (k < cel.length - 1) { let m = cel.length - 1; while (m > k + 1 && !ve(cel[k], cel[m])) m--; out.push(cel[m]); k = m; }
    out[out.length - 1] = [x, z];
    return out.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]);
  };
  /* planejador no pavimento de cota y (1º andar): célula livre = há piso nessa cota e o boneco cabe */
  window.__planejarEm = function (x, z, r, y) {
    const am = D().amb; if (am.comPortasAbertas && !window.__dentroPortas) { window.__dentroPortas = true; try { return am.comPortasAbertas(() => window.__planejarEm(x, z, r, y)); } finally { window.__dentroPortas = false; } }
    const L = D().amb.limites, col = D().amb.colisao, amb = D().amb, h = 0.05, rr = r + 0.08;
    const nx = Math.ceil((L.x1 - L.x0) / h), nz = Math.ceil((L.z1 - L.z0) / h), livre = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const px = L.x0 + (i + 0.5) * h, pz = L.z0 + (j + 0.5) * h; livre[i + j * nx] = amb.alturaPiso(px, pz, y) === y && col.folga({ x: px, z: pz }, y) >= rr ? 1 : 0; }
    const G = { nx, nz, livre, cel: (px, pz) => [Math.floor((px - L.x0) / h), Math.floor((pz - L.z0) / h)], pos: (i, j) => [L.x0 + (i + 0.5) * h, L.z0 + (j + 0.5) * h] };
    const st = D().st, a = maisPerto(G, st.x, st.z), b = maisPerto(G, x, z); if (!a || !b) return null;
    const B = bfs(G, a[0], a[1]), fim = b[0] + b[1] * G.nx; if (B.dist[fim] < 0) return null;
    const cel = []; for (let c = fim; c >= 0; c = B.prev[c]) cel.push(G.pos(c % G.nx, (c / G.nx) | 0)); cel.reverse();
    const ve = (p, q) => { const Lq = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let s = 0; s <= Lq; s += 0.03) { const [i, j] = G.cel(p[0] + (q[0] - p[0]) * s / Lq, p[1] + (q[1] - p[1]) * s / Lq); if (!G.livre[i + j * G.nx]) return false; } return true; };
    const out = [cel[0]]; let k = 0;
    while (k < cel.length - 1) { let m = cel.length - 1; while (m > k + 1 && !ve(cel[k], cel[m])) m--; out.push(cel[m]); k = m; }
    out[out.length - 1] = [x, z];
    return out.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]);
  };
  /* auditoria: colisor × pegada visível (caixa no chão das peças do móvel, abaixo de 1,2 m) */
  window.__auditar = function () {
    const def = D().amb.def, MV = Orvalho.moveis, out = [];
    def.moveis.forEach(it => {
      const TP = MV.TIPOS[it.tipo], c = it.colisao !== undefined ? it.colisao : TP.colisao;
      const bb = new THREE.Box3(), mi = MV.M(it.x, it.y || 0, it.z, 0, it.rot || 0, 0), m = new THREE.Matrix4(), b = new THREE.Box3();
      const baseY = it.y || 0;
      TP.partes().forEach(pt => { pt.geo.computeBoundingBox(); pt.ms.forEach(ml => { m.multiplyMatrices(mi, ml); b.copy(pt.geo.boundingBox).applyMatrix4(m); if (b.min.y < baseY + 1.2) bb.union(b); }); });
      const vis = { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z };
      if (!c) { const L = D().amb.limites, fora = it.x < L.x0 || it.x > L.x1 || it.z < L.z0 || it.z > L.z1;
        out.push({ id: it.id || it.tipo, colisor: 'nenhum', motivo: fora ? 'fora da sala' : (it.y || 0) > 0.01 ? 'fica em cima de outro móvel ou da parede' : 'coberto por obstáculo da planta (ex.: bloco de cadeiras) ou rente ao chão' }); return; }
      let col;
      if (c.caixa) { const sw = Math.abs(Math.sin(it.rot || 0)) > 0.5, hw = (sw ? c.caixa[1] : c.caixa[0]) / 2, hd = (sw ? c.caixa[0] : c.caixa[1]) / 2; col = { x0: it.x - hw, x1: it.x + hw, z0: it.z - hd, z1: it.z + hd }; }
      else col = { x0: it.x - c.circulo, x1: it.x + c.circulo, z0: it.z - c.circulo, z1: it.z + c.circulo };
      let dif = Math.max(Math.abs(col.x0 - vis.x0), Math.abs(col.x1 - vis.x1), Math.abs(col.z0 - vis.z0), Math.abs(col.z1 - vis.z1));
      if (c.circulo) { // círculo: compara com o maior afastamento real dos vértices até o centro (abaixo de 1,2 m)
        let rMax = 0; const v = new THREE.Vector3();
        TP.partes().forEach(pt => { const pa = pt.geo.attributes.position; pt.ms.forEach(ml => { m.multiplyMatrices(mi, ml);
          for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(m); if (v.y < baseY + 1.2) rMax = Math.max(rMax, Math.hypot(v.x - it.x, v.z - it.z)); } }); });
        dif = Math.abs(rMax - c.circulo);
      }
      out.push({ id: it.id || it.tipo, colisor: c.caixa ? 'caixa' : 'círculo', difMax_cm: +(dif * 100).toFixed(1) });
    });
    return { itens: out, contagem: D().amb.colisao.contagem() };
  };
  window.__estado = () => { const d = D(); return { x: d.st.x, y: d.st.y, z: d.st.z, rumo: d.st.rumo, yaw: d.cam.yaw, raio: d.raio }; };
  window.__monitorFolga = function () {
    window.__min = Infinity; window.__minOnde = null;
    (function f() { const d = D(), g = d.amb.colisao.folga(d.st, d.st.y); if (g < window.__min) { window.__min = g; window.__minOnde = [+d.st.x.toFixed(2), +d.st.z.toFixed(2)]; } requestAnimationFrame(f); })();
  };
}

/* ---------- o que testar em cada ambiente ---------- */
const CONF = {
  'lab-ia': {
    corredores: {
      'corredor principal (entre as fileiras)': [[0.4, 1.95], [6.8, 1.95], 1.30],
      'corredor de fundo (atrás das cadeiras 2 e 3)': [[1.9, 4.3], [6.0, 4.3], 0.90],
      'zona da janela (lado oeste)': [[0.9, 0.4], [0.9, 4.0], 1.30],
      'zona da porta (lado leste)': [[6.15, 0.4], [6.15, 3.6], 1.30],
      'passagem cadeira 1 ↔ mesas 2/3': [[4.30, 1.0], [4.30, 2.9], 1.30, 'vertical']
    },
    paradas: [
      { nome: 'entrada → monitor 1 (bancada da parede azul)', alvo: [3.75, 1.55], olhar: [4.40, 0.31], interativo: 'Projeto de exemplo A' },
      { nome: '→ carrinho de recarga', alvo: [2.62, 1.20], olhar: [2.62, 0.40], interativo: 'Estação de recarga' },
      { nome: '→ zona da janela', alvo: [0.85, 2.3] },
      { nome: '→ fundo, atrás das cadeiras: monitor 2', alvo: [2.85, 4.32], olhar: [2.80, 2.84], interativo: 'Projeto de exemplo B' },
      { nome: '→ monitor 3 (pelo corredor de fundo)', alvo: [4.35, 4.32], olhar: [4.30, 2.84], interativo: 'Projeto de exemplo C' },
      { nome: '→ canto do puff (fundo da sala)', alvo: [5.75, 4.35] },
      { nome: '→ zona da porta', alvo: [6.4, 2.6] },
      { nome: '→ volta pelo meio, curvando entre as bancadas', alvo: [1.4, 1.9] },
      { nome: '→ retorno à entrada e porta', alvo: [6.55, 0.95], olhar: [7.12, 0.70], interativo: 'Corredor do Polo Inovale' }
    ]
  },
  'hall-inovale': {
    corredores: {
      'entrada → interior do hall': [[14.75, 2.6], [14.75, 7.6], 1.40, 'x'],
      'café: passagem entre a 1ª e a 2ª fileira de mesas': [[3.5, 5.4], [11.5, 5.4], 0.75],
      'corredor central da plateia': [[29.2, 6.25], [36.8, 6.25], 1.30],
      'passagem plateia ↔ bancos da fachada': [[29.5, 1.45], [37.5, 1.45], 0.90],
      'passagem plateia ↔ linha de pilares': [[29.5, 11.05], [36.5, 11.05], 1.00],
      'frente do palco': [[37.75, 2.7], [37.75, 9.8], 1.10, 'x'],
      'corredor sob o mezanino (junto à parede)': [[10.8, 14.35], [30.5, 14.35], 1.00]
    },
    paradas: [
      { nome: 'entrada → recepção', alvo: [20.4, 7.25], olhar: [20.4, 7.95], interativo: 'Bem-vindo ao Polo Inovale' },
      { nome: '→ Keila (atendimento na frente do balcão)', alvo: [17.3, 7.55], olhar: [17.3, 9.2], interativo: 'Keila' },
      { nome: '→ painel do arco A (parede da entrada)', alvo: [22.4, 4.45], olhar: [22.4, 3.5], interativo: 'Apresentação do espaço' },
      { nome: '→ café, entre as mesas', alvo: [7.5, 5.4] },
      { nome: '→ balcão da cafeteria Pin', alvo: [4.3, 12.65], olhar: [4.3, 13.25], interativo: 'Café do hall' },
      { nome: '→ corredor sob o mezanino (entre pilares)', alvo: [12.2, 13.6] },
      { nome: '→ porta do elevador', alvo: [14.6, 14.2], olhar: [14.6, 14.7], interativo: 'Térreo e 1º andar' },
      { nome: '→ escada de emergência: porta abre e dá na antecâmara (lixeiras fora do vão)', alvo: [12.75, 15.7] },
      { nome: '→ de volta ao corredor sob o mezanino', alvo: [12.75, 13.4] },
      { nome: '→ totem de orientação', alvo: [23.0, 7.4], olhar: [22.63, 8.4], interativo: 'Onde fica cada coisa' },
      { nome: '→ sala Nexo', alvo: [36.1, 13.65], olhar: [36.1, 14.7], interativo: 'Sala Nexo' },
      { nome: '→ acesso às salas à esquerda da Nexo', alvo: [32.5, 18.8] },
      { nome: '→ corredor dos banheiros (portas nos dois lados)', alvo: [22.3, 18.7] },
      { nome: '→ balcões "Acesso às salas" (expositores)', alvo: [37.85, 11.2], olhar: [37.85, 11.9], interativo: 'Expositores e projetos' },
      { nome: '→ frente do palco (telão)', alvo: [38.0, 6.25], olhar: [41.6, 6.25], interativo: 'Telão · próximos eventos' },
      { nome: '→ corredor central da plateia', alvo: [32.5, 6.25] },
      { nome: '→ pé da escada (1º andar)', alvo: [43.3, 1.9], olhar: [43.2, 3.1], interativo: 'Acesso ao 1º andar' },
      { nome: '→ entre a plateia e os pilares', alvo: [32.5, 11.05] },
      { nome: '→ volta à entrada', alvo: [14.75, 3.4] }
    ]
  }
};

/* ---------- motorista: segue os pontos apertando W/A/S/D conforme a câmera ---------- */
async function dirigir(page, rota, nome, log) {
  const t0 = Date.now(); let i = 1, ultimo = null, parado = Date.now(), segurando = new Set();
  const soltar = async () => { for (const k of segurando) await page.keyboard.up(k); segurando.clear(); };
  try {
    while (i < rota.length) {
      const s = await page.evaluate(() => __estado());
      const [tx, tz] = rota[i], dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
      if (d < (i === rota.length - 1 ? 0.12 : 0.22)) { i++; continue; }
      if (!ultimo || Math.hypot(s.x - ultimo.x, s.z - ultimo.z) > 0.05) { ultimo = s; parado = Date.now(); }
      if (Date.now() - parado > 2500) throw new Error(`preso em (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) indo para (${tx}, ${tz})`);
      if (Date.now() - t0 > 60000) throw new Error('tempo esgotado');
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
      const a = (dx * fx + dz * fz) / d, b = (dx * rx + dz * rz) / d;
      const quero = new Set(); if (a > 0.38) quero.add('KeyW'); if (a < -0.38) quero.add('KeyS'); if (b > 0.38) quero.add('KeyD'); if (b < -0.38) quero.add('KeyA');
      for (const k of [...segurando]) if (!quero.has(k)) { await page.keyboard.up(k); segurando.delete(k); }
      for (const k of quero) if (!segurando.has(k)) { await page.keyboard.down(k); segurando.add(k); }
      await page.waitForTimeout(35);
    }
  } finally { await soltar(); }
  await page.waitForTimeout(250);
  return ((Date.now() - t0) / 1000).toFixed(1);
}
/* vira o boneco para um ponto com um toque curto de tecla (ele se vira para onde anda) */
async function virarPara(page, x, z) {
  const s = await page.evaluate(() => __estado());
  const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  const a = (dx * fx + dz * fz) / d, b = (dx * rx + dz * rz) / d, ks = [];
  if (a > 0.38) ks.push('KeyW'); if (a < -0.38) ks.push('KeyS'); if (b > 0.38) ks.push('KeyD'); if (b < -0.38) ks.push('KeyA');
  for (const k of ks) await page.keyboard.down(k); await page.waitForTimeout(260); for (const k of ks) await page.keyboard.up(k);
  await page.waitForTimeout(500);
}

(async () => {
  const srv = await servidor(), url = process.env.ORVALHO_URL || `http://127.0.0.1:${srv.address().port}/index.html`; // ORVALHO_URL: testar o site publicado
  const browser = await require('./navegador').abrir(chromium, HEADLESS);   // GPU=1 usa a placa de vídeo (testes/navegador.js)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const rel = { data: new Date().toISOString(), corpo: CORPO, falhas: [] };
  const ok = (c, msg) => { console.log((c ? '  ✔ ' : '  ✘ ') + msg); if (!c) rel.falhas.push(msg); };

  await page.goto(url);
  await page.evaluate(c => { localStorage.clear(); localStorage.setItem('orvalho-avatar-cor', 'azul'); localStorage.setItem('orvalho-avatar-corpo', c); }, CORPO);
  await page.reload(); await page.waitForTimeout(500);
  await page.click('#btn-entrar'); await page.waitForTimeout(1800);
  if (AMBIENTE !== 'lab-ia') { await page.evaluate(a => Orvalho.jogo.irPara(a), AMBIENTE); await page.waitForTimeout(2500); }
  await page.evaluate(noNavegador);
  rel.ambiente = await page.evaluate(() => Orvalho.jogo.ambienteAtual());
  console.log('Ambiente:', rel.ambiente);
  const base = await page.evaluate(() => ({ raio: Orvalho.jogo._debug().raio, escala: Orvalho.jogo._debug().escala, altura: 2.15 * Orvalho.jogo._debug().escala }));
  rel.personagem = { altura_m: +base.altura.toFixed(3), escala: +base.escala.toFixed(4), raioColisor_m: base.raio };
  console.log(`\nPersonagem (${CORPO}): altura ${base.altura.toFixed(2)} m · escala ${base.escala.toFixed(3)} · colisor r = ${base.raio} m`);

  /* 1. auditoria */
  console.log('\n1. Colisores × geometria visível');
  const aud = await page.evaluate(() => __auditar()); rel.auditoria = aud;
  aud.itens.forEach(a => { if (a.colisor === 'nenhum') console.log(`     ${a.id.padEnd(11)} sem colisor (${a.motivo})`); else ok(a.difMax_cm <= 4, `${a.id.padEnd(11)} ${a.colisor.padEnd(7)} diferença máx. ${a.difMax_cm} cm`); });
  console.log(`     colisores no total: ${JSON.stringify(aud.contagem)} (todos vêm de um móvel visível ou de uma parede)`);

  /* 2. larguras livres */
  console.log('\n2. Largura livre dos caminhos (mínimo ao longo de todo o trecho)');
  const CORR = CONF[AMBIENTE].corredores;
  rel.larguras = {};
  for (const [nome, [a, b, alvo, modo]] of Object.entries(CORR)) {
    const w = (CORR[nome][3] === 'vertical') ? await page.evaluate(([a, b]) => { // vertical: mede o vão livre entre a cadeira e a mesa
      const col = Orvalho.jogo._debug().amb.colisao; let z0 = null, z1 = null;
      for (let z = a[1]; z <= b[1]; z += 0.005) { const f = col.folga({ x: a[0], z }, 0) > 0.001; if (f && z0 === null) z0 = z; if (!f && z0 !== null && z1 === null) z1 = z; }
      return { min: +((z1 || b[1]) - z0).toFixed(3), media: null, onde: [a[0], +z0.toFixed(2)] };
    }, [a, b]) : await page.evaluate(([a, b]) => __largura(a, b, 0.05), [a, b]);
    rel.larguras[nome] = w;
    ok(w.min >= alvo, `${nome}: ${w.min.toFixed(2)} m livres${w.media ? ` (média ${w.media.toFixed(2)})` : ''} — ponto mais estreito em (${w.onde})`);
  }

  /* 3. cobertura */
  console.log('\n3. Cobertura do piso');
  const cob = await page.evaluate(r => __cobertura(r), base.raio); rel.cobertura = cob;
  ok(cob.pct >= 99, `${cob.alcancavel_m2} de ${cob.livres_m2} m² livres são alcançáveis a partir da entrada (${cob.pct}%)${cob.exemploIsolado.length ? ' · isolados ex.: ' + JSON.stringify(cob.exemploIsolado) : ''}`);

  /* 4. percurso real */
  console.log('\n4. Percurso real com o teclado (W/A/S/D relativos à câmera)');
  await page.evaluate(() => __monitorFolga());
  const PARADAS = CONF[AMBIENTE].paradas;
  rel.percurso = [];
  for (const p of PARADAS) {
    const rota = await page.evaluate(([x, z, r]) => __planejar(x, z, r), [p.alvo[0], p.alvo[1], base.raio]);
    if (!rota) { ok(false, `${p.nome}: sem caminho na planta`); continue; }
    let seg, err = null;
    try { seg = await dirigir(page, rota, p.nome); } catch (e) { err = e.message; }
    const s = await page.evaluate(() => __estado());
    const reg = { trecho: p.nome, pontos: rota.length, tempo_s: seg ? +seg : null, chegou: [+s.x.toFixed(2), +s.z.toFixed(2)], erro: err };
    ok(!err, `${p.nome}: ${err ? err : `chegou em ${seg} s (${rota.length - 1} curvas/pontos)`}`);
    if (p.interativo && !err) {
      await virarPara(page, p.olhar[0], p.olhar[1]);
      const aviso = await page.isVisible('#aviso');
      let titulo = null;
      if (aviso) { await page.keyboard.press('KeyE'); await page.waitForTimeout(350); titulo = await page.isVisible('#painel') ? await page.textContent('#painel-t') : null; await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
      reg.interacao = { aviso, titulo };
      if (titulo !== p.interativo) reg.interacao.estado = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { x: d.st.x, z: d.st.z, rumo: d.st.rumo, yaw: d.cam.yaw }; });
      ok(titulo === p.interativo, `   interação: bolha ${aviso ? 'apareceu' : 'NÃO apareceu'} → painel "${titulo}"`);
    }
    if (AMBIENTE === 'hall-inovale' && !err && ['→ balcão da cafeteria Pin', '→ sala Nexo', '→ corredor dos banheiros (portas nos dois lados)'].includes(p.nome)) {
      await page.screenshot({ path: path.join(__dirname, `validacao-${p.nome.includes('cafeteria') ? 'cafeteria' : p.nome.includes('banheiros') ? 'corredor-banheiros' : 'nexo'}-${CORPO}.png`) });
    }
    rel.percurso.push(reg);
  }
  const folga = await page.evaluate(() => ({ min: window.__min, onde: window.__minOnde }));
  rel.folgaMinima = { m: +folga.min.toFixed(4), onde: folga.onde };
  ok(folga.min >= base.raio - 0.002, `nenhuma penetração: folga mínima ${folga.min.toFixed(3)} m (colisor ${base.raio} m) em (${folga.onde})`);
  if (AMBIENTE === 'hall-inovale') {
    console.log('\n5. Sentar e levantar (assentos dos arcos)');
    const assentos = await page.evaluate(() => Orvalho.jogo._debug().amb.assentos.map(a => ({ id: a.id, x: a.x, y:a.y||0, z: a.z, saida: a.saida, altura: a.altura })));
    rel.assentos = [];
    for (const [i, a] of assentos.entries()) {
      await page.evaluate(a => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: a.saida.x, y: a.y, z: a.saida.z, rumo: Math.atan2(a.x - a.saida.x, a.z - a.saida.z) }); d.player.root.position.set(d.st.x, a.y, d.st.z); }, a);
      await page.waitForTimeout(700);
      const bolha = await page.isVisible('#aviso') ? await page.textContent('#aviso span') : null;
      await page.keyboard.press('KeyE'); await page.waitForTimeout(1100);
      const sent = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { sentado: Orvalho.jogo.sentado(), x: d.player.root.position.x, y: d.player.root.position.y, z: d.player.root.position.z, aviso: document.querySelector('#aviso span').textContent }; });
      if (i === 0 || i === 2) await page.screenshot({ path: path.join(__dirname, `sentado-${a.id}-${CORPO}.png`) });
      await page.keyboard.press('KeyE'); await page.waitForTimeout(700);
      const lev = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { sentado: Orvalho.jogo.sentado(), x: d.st.x, z: d.st.z, y: d.player.root.position.y, folga: d.amb.colisao.folga(d.st, d.st.y), raio: d.raio }; });
      await page.keyboard.down('KeyS'); await page.waitForTimeout(500); await page.keyboard.up('KeyS'); await page.waitForTimeout(200);
      const anda = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { x: d.st.x, z: d.st.z }; });
      const andou = Math.hypot(anda.x - lev.x, anda.z - lev.z) > 0.2;
      const okSent = bolha === 'Sentar' && sent.sentado && Math.hypot(sent.x - a.x, sent.z - a.z) < 0.02 && Math.abs(sent.y - (a.y + a.altura - 0.06)) < 0.02 && sent.aviso === 'Levantar';
      const okLev = !lev.sentado && Math.abs(lev.y-a.y)<0.02 && lev.folga >= lev.raio - 0.002 && andou;
      rel.assentos.push({ id: a.id, bolha, sentado: sent, levantou: lev, andou });
      ok(okSent, `${a.id}: bolha "${bolha}" → sentou no assento (y ${sent.y.toFixed(2)} m, bolha "${sent.aviso}")`);
      ok(okLev, `${a.id}: levantou em (${lev.x.toFixed(2)}, ${lev.z.toFixed(2)}), folga ${lev.folga.toFixed(3)} ≥ colisor ${lev.raio}, voltou a andar: ${andou}`);
    }
    console.log('\n6. Escada principal, 1º andar, guarda-corpos e persistência vertical');
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 43.2, y: 0, z: 2.8, rumo: 0, vx: 0, vz: 0 }); d.player.root.position.set(43.2, 0, 2.8); d.cam.yaw = Math.PI; });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(3400); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(900);
    const topo = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { x: d.st.x, y: d.st.y, z: d.st.z, cameraY: d.camera.position.y, piso: d.amb.alturaPiso(d.st.x, d.st.z, d.st.y) }; });
    ok(topo.y > 4.15 && topo.z > 12.05 && topo.piso === 4.2, `subiu 2 lances e patamar: piso y=${topo.y.toFixed(2)} m em z=${topo.z.toFixed(2)}`);
    ok(topo.cameraY > 4.5, `câmera acompanhou a altura (y=${topo.cameraY.toFixed(2)} m)`);
    await page.screenshot({ path: path.join(__dirname, `primeiro-andar-${CORPO}.png`) });

    /* sai lateralmente do vão da escada e percorre o corredor do 1º andar */
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); d.cam.yaw = Math.PI / 2; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW'); await page.waitForTimeout(350); // pode raspar no pilar da borda
    const corredorAlto = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { x: d.st.x, y: d.st.y, z: d.st.z }; });
    ok(corredorAlto.x < 41.5 && corredorAlto.y > 4.15, `percorreu o corredor do 1º andar (x=${corredorAlto.x.toFixed(2)})`);

    /* testa o guarda-corpo e um trecho sólido da frente envidraçada */
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st,{x:39,y:4.2,z:13.1,vx:0,vz:0}); d.player.root.position.set(39,4.2,13.1); d.cam.yaw = 0; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW'); await page.waitForTimeout(300);
    const guarda = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { z: d.st.z, y: d.st.y, r: d.raio }; });
    ok(guarda.z >= 11.7 + guarda.r - 0.03 && guarda.y > 4.15, `guarda-corpo impediu queda (z=${guarda.z.toFixed(2)}, y=${guarda.y.toFixed(2)})`);
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); d.cam.yaw = Math.PI; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW'); await page.waitForTimeout(300);
    const vidro = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { z: d.st.z, y: d.st.y, r: d.raio }; });
    ok(vidro.z <= 14.6 - vidro.r + 0.03 && vidro.y > 4.15, `vidro do 1º andar permaneceu sólido fora da porta (z=${vidro.z.toFixed(2)})`);

    /* anda lateralmente no corredor e espera o autosave incluir y */
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); d.cam.yaw = Math.PI / 2; });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW'); await page.waitForTimeout(2200);
    const salvoAlto = await page.evaluate(() => JSON.parse(localStorage.getItem('orvalho-jogo')));
    ok(salvoAlto && salvoAlto.y > 4.15, `persistência salvou a altura do 1º andar (y=${salvoAlto && salvoAlto.y})`);
    await page.reload(); await page.waitForTimeout(600); await page.click('#btn-continuar'); await page.waitForTimeout(2200);
    const restaurado = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { amb: Orvalho.jogo.ambienteAtual(), y: d.st.y, rootY: d.player.root.position.y }; });
    ok(restaurado.amb === 'hall-inovale' && restaurado.y > 4.15 && restaurado.rootY > 4.15, `continuar restaurou ambiente e altura (y=${restaurado.y.toFixed(2)})`);

    /* volta pelo mesmo vão e desce os dois lances */
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 43.2, y: 4.2, z: 12.3, rumo: Math.PI, vx: 0, vz: 0 }); d.player.root.position.set(43.2, 4.2, 12.3); d.cam.yaw = 0; });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(5200); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(900);
    const baseEscada = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { y: d.st.y, z: d.st.z }; });
    ok(baseEscada.y < 0.03 && baseEscada.z < 3.5, `desceu ao térreo sem travar (y=${baseEscada.y.toFixed(2)}, z=${baseEscada.z.toFixed(2)})`);
    rel.niveis = { topo, corredorAlto, guarda, vidro, salvoAlto, restaurado, baseEscada };

    console.log('\n7. Elevador, ambientes do 1º andar e NPCs');
    const antes = await page.evaluate(() => JSON.stringify(Orvalho.jogo._debug().player.cfg()));
    await page.evaluate(() => { const d=Orvalho.jogo._debug(); Object.assign(d.st,{x:14.6,y:0,z:13.7,rumo:Math.PI}); d.player.root.position.set(14.6,0,13.7); Orvalho.jogo.usarElevador(); });
    await page.waitForSelector('.elevador-ui:not([hidden])');
    const indisponiveis = await page.locator('.elevador-andares button:disabled').count();
    ok(indisponiveis === 3, `seletor mostra o térreo atual e mantém 2º/3º indisponíveis (${indisponiveis} botões desabilitados)`);
    await page.click('[data-piso="1"]'); await page.waitForTimeout(2200);
    const elevou = await page.evaluate(() => { const d=Orvalho.jogo._debug(); return {amb:Orvalho.jogo.ambienteAtual(),y:d.st.y,cfg:JSON.stringify(d.player.cfg())}; });
    ok(elevou.amb==='hall-inovale' && elevou.y>4.15 && elevou.cfg===antes, `elevador chegou ao 1º andar (y=${elevou.y.toFixed(2)}), aparência preservada`);
    const cadastro = await page.evaluate(() => { const d=Orvalho.jogo._debug(), ids=d.amb.interativos.map(i=>i.id); return {npcs:d.amb.def.npcs.map(n=>n.nome), ids, empresas:['busqme','nexus-core','quatroin','mocaplus'].some(x=>ids.includes(x))}; });
    ok(JSON.stringify(cadastro.npcs)===JSON.stringify(['Keila','Dagliê','Danimara']), `NPCs reutilizáveis presentes: ${cadastro.npcs.join(', ')}`);
    ok(!cadastro.empresas && !['busqme','nexus-core','quatroin','mocaplus'].some(x=>cadastro.ids.includes(x)) && cadastro.ids.includes('salas-incubacao'), 'Incubadora sem empresas nomeadas (só "Salas de incubação")');
    /* atravessa as três portas documentadas e comprova piso navegável dentro das salas. */
    const salas = [[5.0,13.0,'ACIOC Hub'],[47.3,7.4,'Incubadora Joaçaba (ala leste)'],[44.0,17.9,'sala de projetos'],[47.4,16.1,'área de reuniões'],[51.0,17.0,'sala de Dagliê e Danimara']];
    for(const [x,z,nome] of salas){ const s=await page.evaluate(([x,z])=>{const d=Orvalho.jogo._debug(); Object.assign(d.st,{x,y:4.2,z,vx:0,vz:0}); d.player.root.position.set(x,4.2,z); return {piso:d.amb.alturaPiso(x,z,4.2),folga:d.amb.colisao.folga({x,z},4.2)};},[x,z]); ok(s.piso===4.2 && s.folga>=base.raio-0.002,`${nome} explorável (piso ${s.piso}, folga ${s.folga.toFixed(2)} m)`); }
    await page.screenshot({path:path.join(__dirname,`primeiro-andar-ambientes-${CORPO}.png`)});

    console.log('\n8. 1º andar: percursos reais com o teclado, portas e colisões');
    /* portas que abrem (inclusive as das escadas de emergência e a porta externa da Incubadora): fechadas são sólidas;
       com o boneco perto, abrem e o vão fica livre; com ele longe, fecham e voltam a ser sólidas */
    const defsPortas = await page.evaluate(() => Orvalho.jogo._debug().amb.def.portasAnimadas.map(p => ({ id: p.id, a: p.a, b: p.b, y: p.y || 0, sentido: p.abre === 'direita' ? -1 : 1 })));
    for (const pd of defsPortas) {
      const r0 = await page.evaluate(pd => { const d = Orvalho.jogo._debug(), mx = (pd.a[0] + pd.b[0]) / 2, mz = (pd.a[1] + pd.b[1]) / 2, dx = pd.b[0] - pd.a[0], dz = pd.b[1] - pd.a[1], L = Math.hypot(dx, dz), nx = -dz / L * pd.sentido, nz = dx / L * pd.sentido;
        const fx = mx - nx * 1.0, fz = mz - nz * 1.0; Object.assign(d.st, { x: fx, y: pd.y, z: fz, vx: 0, vz: 0 }); d.player.root.position.set(fx, pd.y, fz); return { mx, mz, nx, nz }; }, pd);
      await page.waitForTimeout(800);
      const aberta = await page.evaluate(([pd, r0]) => { const d = Orvalho.jogo._debug(), c = d.amb.colisao, p = d.amb.portas().find(q => q.id === pd.id);
        return { ang: p.aberta, solida: p.solida, folga: Math.min(c.folga({ x: r0.mx, z: r0.mz }, pd.y), c.folga({ x: r0.mx + r0.nx * 0.4, z: r0.mz + r0.nz * 0.4 }, pd.y), c.folga({ x: r0.mx - r0.nx * 0.4, z: r0.mz - r0.nz * 0.4 }, pd.y)) }; }, [pd, r0]);
      await page.evaluate(([pd, r0]) => { const d = Orvalho.jogo._debug(), fx = r0.mx - r0.nx * 4, fz = r0.mz - r0.nz * 4; Object.assign(d.st, { x: fx, z: fz }); d.player.root.position.set(fx, pd.y, fz); }, [pd, r0]);
      await page.waitForTimeout(900);
      const fechada = await page.evaluate(pd => Orvalho.jogo._debug().amb.portas().find(q => q.id === pd.id), pd);
      ok(aberta.ang > 0.9 && !aberta.solida && aberta.folga >= base.raio - 0.002 && fechada.aberta < 0.05 && fechada.solida,
        `porta ${pd.id}: abre perto (${aberta.ang.toFixed(2)}, vão com folga ${aberta.folga.toFixed(2)} m) e fecha longe (${fechada.aberta.toFixed(2)}, sólida)`);
    }
    const nichos = await page.evaluate(() => [[24.0, 15.2], [26.5, 15.2]].map(q => Orvalho.jogo._debug().amb.colisao.folga({ x: q[0], z: q[1] }, 4.2)));
    nichos.forEach((f, i) => ok(f >= base.raio - 0.002, `entrada do nicho de banheiro ${i + 1} livre (folga ${f.toFixed(2)} m)`));
    const lixo = await page.evaluate(() => Orvalho.jogo._debug().amb.colisao.folga({ x: 12.75, z: 14.4 }, 0));
    ok(lixo >= base.raio + 0.1, `lixeiras fora da frente da escada de emergência do térreo (folga ${lixo.toFixed(2)} m)`);
    /* geometria das salas ajustadas: painéis acústicos só dentro do estúdio, mesa dentro dele, armário baixo do vão até a parede,
       bancada de café no vidro, impressora na parede da área de reuniões, divisória de vidro na Incubadora */
    const geo = await page.evaluate(() => {
      const d = Orvalho.jogo._debug(), MV = Orvalho.moveis, m = new THREE.Matrix4(), b = new THREE.Box3();
      const caixa = it => { const bb = new THREE.Box3(), mi = MV.M(it.x, it.y || 0, it.z, 0, it.rot || 0, 0); MV.TIPOS[it.tipo].partes().forEach(pt => { pt.geo.computeBoundingBox(); pt.ms.forEach(ml => { m.multiplyMatrices(mi, ml); b.copy(pt.geo.boundingBox).applyMatrix4(m); bb.union(b); }); }); return bb; };
      const its = t => d.amb.def.moveis.filter(i => i.tipo === t).map(caixa);
      const dentro = (bb, r, mg) => bb.min.x >= r[0] + mg && bb.max.x <= r[2] - mg && bb.min.z >= r[1] + mg && bb.max.z <= r[3] - mg;
      const POD = [38.05, 14.6, 41.8, 19.9];
      const paineis = its('painel-acustico').concat(its('painel-acustico-2'));
      const mesa = its('mesa-podcast-compacta')[0], arm = its('armario-baixo-longo')[0], banc = its('bancada-cafe')[0];
      const imp = d.amb.def.moveis.filter(i => i.tipo === 'balcao-impressora').map(caixa)[0];
      const vidroInc = d.amb.def.paineis.find(p => p.a[0] === 46.5 && p.a[1] === 11.6 && p.b[1] === 14.6);
      /* nada além da folha atravessa o vão de cada porta animada (montante, trilho, vidro fixo ou geometria duplicada) */
      const intrusos = [];
      d.amb.def.portasAnimadas.forEach(pd => {
        const dx = pd.b[0] - pd.a[0], dz = pd.b[1] - pd.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, y0 = (pd.y || 0) + 0.15, y1 = (pd.y || 0) + (pd.altura || 2.1) - 0.12, v = new THREE.Vector3();
        d.amb.grupo.traverse(o => { if (!o.isMesh || intrusos.length > 20) return; let p = o; while (p) { if (p.userData && p.userData.porta) return; p = p.parent; }
          const pos = o.geometry.attributes.position; if (!pos) return; o.updateWorldMatrix(true, false);
          const n = o.isInstancedMesh ? 0 : pos.count;
          for (let k = 0; k < n; k += 1) { v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld); if (v.y < y0 || v.y > y1) continue;
            const rx = v.x - pd.a[0], rz = v.z - pd.a[1], ao = rx * ux + rz * uz, pe = -rx * uz + rz * ux;
            if (ao > 0.08 && ao < L - 0.08 && Math.abs(pe) < 0.04) { intrusos.push(pd.id + ':' + (o.material && o.material.type)); break; } } });
      });
      return { paineis: paineis.length, fora: paineis.filter(bb => !dentro(bb, POD, 0.005)).length, larguraPod: POD[2] - POD[0],
        mesa: mesa && dentro(mesa, POD, 0.3), arm: arm && { x0: arm.min.x, x1: arm.max.x, z0: arm.min.z, h: arm.max.y - 4.2 },
        banc: banc && { x1: banc.max.x, z0: banc.min.z, z1: banc.max.z }, imp: imp && { z0: imp.min.z, z1: imp.max.z, x: (imp.min.x + imp.max.x) / 2 },
        vidroInc: !!vidroInc && vidroInc.tipo !== 'parede', intrusos };
    });
    ok(geo.larguraPod <= 4.0 && geo.paineis >= 6 && geo.fora === 0, `estúdio de podcast com ${geo.larguraPod.toFixed(2)} m de largura; ${geo.paineis} painéis acústicos, todos só na face interna (${geo.fora} fora)`);
    ok(geo.mesa, 'mesa, cadeiras e microfones do estúdio dentro da sala, com folga das paredes');
    ok(geo.arm && geo.arm.x0 <= 32.1 && geo.arm.x1 >= 36.55 && geo.arm.x1 <= 36.8 && geo.arm.z0 >= 14.59 && geo.arm.h < 0.8, `armário baixo da sala do servidor do vão da porta (x ${geo.arm && geo.arm.x1.toFixed(2)}) até a parede (x ${geo.arm && geo.arm.x0.toFixed(2)}), ${geo.arm && geo.arm.h.toFixed(2)} m de altura`);
    ok(geo.banc && geo.banc.x1 >= 50.35 && geo.banc.z1 - geo.banc.z0 >= 3.4, `bancada de café contínua no vidro da sala de Dagliê e Danimara (${geo.banc && (geo.banc.z1 - geo.banc.z0).toFixed(2)} m)`);
    ok(geo.imp && geo.imp.z0 >= 14.59 && geo.imp.z1 <= 15.2 && geo.imp.x > 45.9 && geo.imp.x < 48.9, 'impressora na parede da área de reuniões, de frente para a mesa');
    ok(geo.vidroInc, 'Incubadora: divisória junto à porta 103 é de vidro (antes parede cinza)');
    ok(geo.intrusos.length === 0, `vãos das portas livres de montantes, trilhos ou vidro fixo${geo.intrusos.length ? ': ' + geo.intrusos.join(', ') : ''}`);

    /* arte do elevador: com as portas fechadas, a metade esquerda da arte fica na folha da esquerda de quem olha (x maior) */
    const arte = await page.evaluate(() => [0, 1].map(p => Orvalho.jogo._debug().amb.elevador.folhas(p)));
    ok(arte.every(f => f.length === 2 && f.find(q => q.x === Math.max(f[0].x, f[1].x)).metade === 'esquerda' && f.find(q => q.x === Math.min(f[0].x, f[1].x)).metade === 'direita'),
      `arte do elevador na ordem certa nos dois pavimentos (${JSON.stringify(arte)})`);
    await page.evaluate(noNavegador); await page.evaluate(() => __monitorFolga());   // a página foi recarregada no teste de persistência
    await page.evaluate(() => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x: 43.2, y: 4.2, z: 12.7, rumo: Math.PI, vx: 0, vz: 0 }); d.player.root.position.set(43.2, 4.2, 12.7); d.cam.yaw = 0; d.cam.pitch = 0.3; });
    await page.waitForTimeout(400); await page.evaluate(() => { window.__min = Infinity; window.__minOnde = null; });
    const ROTAS = [
      { nome: 'entrada do Administrativo → sala de projetos (de frente)', alvo: [44.0, 17.9] },
      { nome: '→ da sala de projetos para a área de reuniões', alvo: [47.4, 16.1] },
      { nome: '→ sala das funcionárias: Dagliê (logo na entrada)', alvo: [51.0, 15.65], olhar: [52.6, 15.65], interativo: 'Dagliê' },
      { nome: '→ Danimara (mesa mais ao fundo)', alvo: [51.45, 18.75], olhar: [53.1, 18.75], interativo: 'Danimara' },
      { nome: '→ passa ao lado da mesa da Danimara até o fundo da sala', alvo: [51.3, 19.45] },
      { nome: '→ volta à saída do Administrativo', alvo: [42.5, 13.4] },
      { nome: '→ nicho dos banheiros (PCD)', alvo: [26.5, 15.25] },
      { nome: '→ escada de emergência leste do 1º andar (antecâmara)', alvo: [31.05, 15.4] },
      { nome: '→ corredor do núcleo (entre os pilares e a parede)', alvo: [20.0, 13.5] },
      { nome: '→ escada de emergência oeste do 1º andar (antecâmara)', alvo: [12.72, 15.4] },
      { nome: '→ entrada e interior do ACIOC Hub', alvo: [5.0, 13.4] },
      { nome: '→ ACIOC: entre as ilhas e a bancada da parede', alvo: [5.0, 18.1] },
      { nome: '→ corredor do núcleo, de volta', alvo: [20.0, 13.5] },
      { nome: '→ corredor diante da sala de podcast', alvo: [38.0, 13.4] },
      { nome: '→ sala de reuniões com servidor: porta (junto à divisória) e entrada', alvo: [37.2, 15.6] },
      { nome: '→ contorna a mesa redonda (lado leste, diante da TV)', alvo: [36.95, 17.5] },
      { nome: '→ contorna a mesa redonda (fundo)', alvo: [35.0, 19.3] },
      { nome: '→ diante do armário e do servidor', alvo: [33.15, 18.75], olhar: [32.45, 19.55], interativo: 'Equipamento de servidor' },
      { nome: '→ contorna a mesa redonda (lado oeste, junto ao armário baixo)', alvo: [33.0, 15.6] },
      { nome: '→ sai da sala de reuniões', alvo: [37.3, 13.4] },
      { nome: '→ estúdio de podcast (compacto): porta e entrada', alvo: [38.6, 15.4] },
      { nome: '→ diante da mesa do estúdio', alvo: [39.9, 15.75], olhar: [39.9, 17.4], interativo: 'Estúdio de podcast' },
      { nome: '→ sai do estúdio', alvo: [38.6, 13.4] },
      { nome: '→ entrada da Incubadora (porta sul, 103)', alvo: [47.6, 11.0] },
      { nome: '→ salinha atrás da divisória de vidro', alvo: [47.8, 12.8] },
      { nome: '→ sai da salinha para o coworking', alvo: [48.6, 10.9] },
      { nome: '→ Incubadora: corredor junto às salas de incubação', alvo: [50.65, 8.8], olhar: [52.5, 8.8], interativo: 'Salas de incubação' },
      { nome: '→ dentro de uma sala de incubação (porta de vidro)', alvo: [53.0, 3.7] },
      { nome: '→ parte norte (101), integrada ao coworking', alvo: [48.0, 1.9] },
      { nome: '→ sai pela porta externa norte para o corredor', alvo: [45.4, 2.1] }
    ];
    for (const p of ROTAS) {
      const rota = await page.evaluate(([x, z, r]) => __planejarEm(x, z, r, 4.2), [p.alvo[0], p.alvo[1], base.raio]);
      if (!rota) { ok(false, `${p.nome}: sem caminho no 1º andar`); continue; }
      let seg, err = null; try { seg = await dirigir(page, rota, p.nome); } catch (e) { err = e.message; }
      const s2 = await page.evaluate(() => __estado());
      ok(!err && s2.y > 4.15, `${p.nome}: ${err ? err : `chegou em ${seg} s`}`);
      if (p.interativo && !err) {
        await virarPara(page, p.olhar[0], p.olhar[1]);
        const aviso = await page.isVisible('#aviso'); let titulo = null;
        if (aviso) { await page.keyboard.press('KeyE'); await page.waitForTimeout(400); titulo = await page.isVisible('#painel') ? await page.textContent('#painel-t') : null; await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
        ok(titulo === p.interativo, `   interação: bolha ${aviso ? 'apareceu' : 'NÃO apareceu'} → painel "${titulo}"`);
      }
    }
    const folga1 = await page.evaluate(() => ({ min: window.__min, onde: window.__minOnde }));
    ok(folga1.min >= base.raio - 0.002, `1º andar sem penetração em paredes/móveis: folga mínima ${folga1.min.toFixed(3)} m em (${folga1.onde})`);
    /* portas do elevador: abrem, ficam abertas, fecham; nas duas paradas */
    for (const piso of [0, 1]) {   // termina no 1º andar: o passo seguinte desce de elevador
      await page.evaluate(p => { const d = Orvalho.jogo._debug(), y = p ? 4.2 : 0, z = p ? 13.15 : 13.75; Object.assign(d.st, { x: 14.6, y, z, rumo: 0, vx: 0, vz: 0 }); d.player.root.position.set(14.6, y, z); }, piso);
      await page.waitForTimeout(500);
      const antesP = await page.evaluate(p => Orvalho.jogo._debug().amb.elevador.aberta(p), piso);
      await page.evaluate(() => Orvalho.jogo.usarElevador()); await page.waitForTimeout(250);
      const meio = await page.evaluate(p => Orvalho.jogo._debug().amb.elevador.aberta(p), piso); await page.waitForTimeout(700);
      const aberta = await page.evaluate(p => Orvalho.jogo._debug().amb.elevador.aberta(p), piso);
      await page.click('.elevador-fechar'); await page.waitForTimeout(1200);
      const fechada = await page.evaluate(p => Orvalho.jogo._debug().amb.elevador.aberta(p), piso);
      ok(antesP === 0 && meio > 0.2 && meio < 0.99 && aberta > 0.97 && fechada < 0.01, `portas do elevador (${piso ? '1º andar' : 'térreo'}): fechadas ${antesP} → abrindo ${meio.toFixed(2)} → abertas ${aberta.toFixed(2)} → fechadas ${fechada.toFixed(3)}`);
    }
    await page.evaluate(()=>Orvalho.jogo.usarElevador()); await page.waitForSelector('.elevador-ui:not([hidden])'); await page.click('[data-piso="0"]'); await page.waitForTimeout(2200);
    const voltou=await page.evaluate(()=>({y:Orvalho.jogo._debug().st.y,amb:Orvalho.jogo.ambienteAtual()}));
    ok(voltou.amb==='hall-inovale' && voltou.y<0.03,`elevador voltou ao térreo sem trocar de ambiente (y=${voltou.y.toFixed(2)})`);
    console.log('\n9. Pulo (Espaço): física, chão, teto, paredes e mureta');
    const amostraPulo = async (seg) => page.evaluate(ms => new Promise(res => { let max = 0, aterrissou = false, t0 = performance.now(), saiu = false;
      (function f(){ const d = Orvalho.jogo._debug(); max = Math.max(max, d.st.jy); if (d.st.jy > 0.01) saiu = true; if (saiu && d.st.jy === 0) aterrissou = true;
        if (performance.now() - t0 < ms) requestAnimationFrame(f); else res({ max, aterrissou, jy: d.st.jy, y: d.st.y, x: d.st.x, z: d.st.z, escala: d.player.root.scale.y / d.escala }); })(); }), seg);
    const por = (x, y, z, yaw) => page.evaluate(([x, y, z, yaw]) => { const d = Orvalho.jogo._debug(); Object.assign(d.st, { x, y, z, vx: 0, vz: 0, jy: 0, vy: 0 }); d.player.root.position.set(x, y, z); if (yaw != null) d.cam.yaw = yaw; }, [x, y, z, yaw]);
    /* parado, no térreo */
    await por(20, 0, 5, 0); await page.waitForTimeout(400);
    await page.keyboard.press('Space'); let r1 = await amostraPulo(1100);
    ok(r1.max > 0.3 && r1.max < 0.5 && r1.aterrissou && r1.jy === 0 && Math.abs(r1.y) < 0.01 && Math.abs(r1.escala - 1) < 0.05, `pulo parado no térreo: altura ${r1.max.toFixed(2)} m, aterrissou no piso (y ${r1.y.toFixed(2)}), forma normal de volta`);
    /* sem pulo infinito: apertar de novo no ar não ganha altura */
    await page.keyboard.press('Space'); await page.waitForTimeout(220); await page.keyboard.press('Space'); await page.waitForTimeout(120); await page.keyboard.press('Space');
    let r2 = await amostraPulo(1100);
    ok(r2.max < 0.5 && r2.aterrissou, `sem pulo duplo/infinito: apertos no ar não somam altura (máx ${r2.max.toFixed(2)} m)`);
    /* andando, no 1º andar, junto à parede do núcleo e de frente para a mureta */
    await por(20, 4.2, 13.6, 0); await page.waitForTimeout(300);
    await page.keyboard.down('KeyW'); for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); } await page.keyboard.up('KeyW'); await page.waitForTimeout(700);
    const m1 = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { z: d.st.z, y: d.st.y, jy: d.st.jy, folga: d.amb.colisao.folga(d.st, d.st.y), r: d.raio }; });
    ok(m1.y > 4.15 && m1.z >= 11.7 + 0.285 + m1.r - 0.03 && m1.jy === 0 && m1.folga >= m1.r - 0.002, `pulando e andando contra a mureta: ficou no 1º andar (z ${m1.z.toFixed(2)}, colisor na face do tampo), sem atravessar`);
    await por(20, 4.2, 13.2, Math.PI); await page.waitForTimeout(300);
    await page.keyboard.down('KeyW'); for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); } await page.keyboard.up('KeyW'); await page.waitForTimeout(700);
    const m2 = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { z: d.st.z, y: d.st.y, folga: d.amb.colisao.folga(d.st, d.st.y), r: d.raio }; });
    ok(m2.z <= 14.6 - m2.r + 0.03 && m2.y > 4.15 && m2.folga >= m2.r - 0.002, `pulando contra a parede do núcleo: não atravessou (z ${m2.z.toFixed(2)})`);
    /* vidro: pulando contra a frente da sala de reuniões (vidro jateado) */
    await por(33.4, 4.2, 13.4, Math.PI); await page.waitForTimeout(300);
    await page.keyboard.down('KeyW'); for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); } await page.keyboard.up('KeyW'); await page.waitForTimeout(700);
    const m3 = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return { z: d.st.z, r: d.raio }; });
    ok(m3.z <= 14.6 - m3.r + 0.03, `pulando contra o vidro: não atravessou (z ${m3.z.toFixed(2)})`);
    /* teto baixo: dentro do nicho do banheiro (forro a 2,4 m) a cabeça não passa do forro */
    await por(24.0, 4.2, 15.2, 0); await page.waitForTimeout(300); await page.keyboard.press('Space'); const r3 = await amostraPulo(1100);
    const teto = await page.evaluate(() => Orvalho.jogo._debug().amb.limites.tetoEm(24.0, 15.2, 4.2));
    ok(4.2 + r3.max + 1.3 <= teto + 0.01 && r3.aterrissou, `pulo sob o forro do nicho (${teto.toFixed(2)} m): topo da cabeça a ${(4.2 + r3.max + 1.3).toFixed(2)} m, aterrissou`);
    /* na escada: pula no meio do lance e pousa na rampa */
    await por(43.2, 1.0, 5.1, Math.PI); await page.waitForTimeout(500); await page.keyboard.press('Space'); const r4 = await amostraPulo(1100);
    const pisoEsc = await page.evaluate(() => { const d = Orvalho.jogo._debug(); return d.amb.alturaPiso(d.st.x, d.st.z, d.st.y); });
    ok(r4.aterrissou && Math.abs(r4.y - pisoEsc) < 0.02, `pulo na escada: pousou na rampa (y ${r4.y.toFixed(2)} = piso ${pisoEsc.toFixed(2)})`);
    await por(20, 0, 5, 0); await page.waitForTimeout(300);

    const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f(){ n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); })(); }));
    const inf = await page.evaluate(() => { const i = Orvalho.jogo._debug().info.render; return { calls: i.calls, tris: i.triangles }; });
    rel.desempenho = { fps, ...inf }; console.log(`     desempenho: ${fps} fps · ${inf.calls} chamadas de desenho · ${inf.tris} triângulos`);
  }
  await page.screenshot({ path: path.join(__dirname, `percurso-final-${AMBIENTE}-${CORPO}.png`) });
  ok(erros.length === 0, `console sem erros${erros.length ? ': ' + erros.join(' | ') : ''}`);

  const nomeRel = AMBIENTE === 'lab-ia' ? `relatorio-navegacao-${CORPO}.json` : `relatorio-navegacao-${AMBIENTE}-${CORPO}.json`;
  fs.writeFileSync(path.join(__dirname, nomeRel), JSON.stringify(rel, null, 2));
  console.log(`\n${rel.falhas.length ? '✘ ' + rel.falhas.length + ' falha(s)' : '✔ tudo certo'} · relatório em testes/${nomeRel}\n`);
  await browser.close(); srv.close();
  process.exit(rel.falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
