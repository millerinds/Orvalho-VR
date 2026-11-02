/* Resume as medições do Quest gravadas pelo `npm run servir:https` (modo ?vr-teste) em testes/medicoes-vr/<data>.jsonl.
   Para cada sessão de teste: parâmetros, framebuffer real, Hz, e a tabela dos 8 setores de yaw (o último registro "setores"
   ou "fim" da sessão), mais as marcas. Uso: npm run medicoes:vr            (arquivo mais recente)
                                         npm run medicoes:vr -- 2026-10-31   (um dia)   · -- todos   (todos os arquivos) */
const fs = require('fs'), path = require('path');
const PASTA = path.join(__dirname, 'medicoes-vr');
const arg = process.argv[2];
let arquivos = fs.existsSync(PASTA) ? fs.readdirSync(PASTA).filter(f => f.endsWith('.jsonl')).sort() : [];
if (!arquivos.length) { console.log('Nenhuma medição em testes/medicoes-vr/ ainda.'); process.exit(0); }
if (arg === 'todos') { /* todos */ } else if (arg) arquivos = arquivos.filter(f => f.startsWith(arg)); else arquivos = arquivos.slice(-1);

const sessoes = new Map();
arquivos.forEach(f => fs.readFileSync(path.join(PASTA, f), 'utf8').split('\n').forEach(l => {
  if (!l.trim()) return; let r; try { r = JSON.parse(l); } catch (e) { return; }
  const s = sessoes.get(r.sessao) || { regs: [], marcas: [] }; sessoes.set(r.sessao, s);
  s.regs.push(r); if (r.tipo === 'marca') s.marcas.push(r);
  if (r.tipo === 'inicio') s.inicio = r;
  if (r.tipo === 'setores' || r.tipo === 'fim') s.tabela = r;
}));
const n = (v, w) => String(v == null ? '—' : v).padStart(w);
const compacto = [];
for (const [id, s] of sessoes) {
  const r0 = s.inicio || s.regs[0], p = r0.parametros || {};
  /* o "inicio" sai antes de a sessão informar o Hz ativo e o tamanho real do framebuffer: vale o primeiro valor conhecido */
  const fbReal = (s.regs.find(r => r.fbReal && r.fbReal !== 'camadas') || r0).fbReal, hz = (s.regs.find(r => r.hzAtivo) || r0).hzAtivo;
  const bat = s.inicio && s.inicio.bateria ? ` · bateria ${s.inicio.bateria.id} ${s.inicio.bateria.passo}/${s.inicio.bateria.de}` : '';
  const giro = s.inicio && s.inicio.giroAuto != null ? ` · giro ${s.inicio.giroAuto ? s.inicio.giroAuto + '°/s' : 'manual'}` : '';
  console.log(`\n■ ${r0.teste} · ponto ${r0.ponto} · ${r0.quando}  (sessão ${id})${bat}`);
  console.log(`  fb ×${p.fb}${p.fbAuto ? ' auto' : ''} real ${fbReal} · ${hz || '?'} Hz · fov ${p.fov} · contorno ${p.contorno || '∞'} · zonas ${p.zonas ? 1 : 0} · dist ${p.dist || '∞'}${giro}`
    + (s.inicio ? ` · GPU ${s.inicio.gpuDisponivel ? 'sim' : 'não (' + s.inicio.gpuMotivo + ')'}` : ''));
  if (!s.tabela) { console.log('  (sem tabela de setores: a sessão terminou antes do fim do aquecimento)'); continue; }
  const st = s.tabela.setores.filter(l => l.quadros);
  if (st.length) {
    const med = k => st.reduce((a, l) => a + l[k], 0) / st.length, pior = st.reduce((a, l) => l.fps < a.fps ? l : a);
    compacto.push({ teste: r0.teste, setores: st.length, fps: med('fps'), pior, piorMs: Math.max(...st.map(l => l.piorMs)), draws: med('draws'),
      drawsMax: Math.max(...st.map(l => l.drawsMax)), cpu: med('cpuAtualizacao') + med('cpuRender'), cpuMax: Math.max(...st.map(l => l.cpuAtualizacao + l.cpuRender)) });
  }
  console.log('  setor  rumo  quadros   fps  pior ms   draws  máx   tri K  máx K  atual ms  render ms  gpu ms');
  s.tabela.setores.forEach(l => console.log(`  ${n(l.yaw + '°', 5)}  ${n(l.rumo, 4)}  ${n(l.quadros, 7)}  ${n(l.fps, 5)}  ${n(l.piorMs, 7)}  ${n(l.draws, 6)}  ${n(l.drawsMax, 4)}  ${n(l.tris == null ? null : Math.round(l.tris / 1000), 6)}  ${n(l.trisMax == null ? null : Math.round(l.trisMax / 1000), 5)}  ${n(l.cpuAtualizacao, 8)}  ${n(l.cpuRender, 9)}  ${n(l.gpu, 6)}`));
  /* quadros acima de 25 ms (registros a partir de 02/11): quantos por minuto depois do aquecimento e com que evento do
     instrumento coincidem (nos 3 últimos quadros): medidor, log (redesenho e envio da textura), envio (POST), console */
  const pic = new Map(); s.regs.forEach(r => (r.picos || []).forEach(p => pic.set(p.t, p)));
  if (pic.size || s.regs.some(r => r.picosTotal != null)) {
    const aq = (s.inicio && s.inicio.aquecimento) || 0, L = [...pic.values()].filter(p => p.t >= aq), dur = Math.max(1, ((s.tabela && s.tabela.t) || 0) - aq);
    const ev = {}; L.forEach(p => (p.ev.length ? p.ev : ['nenhum']).forEach(e => ev[e] = (ev[e] || 0) + 1));
    const fase = new Array(10).fill(0); L.forEach(p => fase[Math.floor(p.t % 10)]++);
    console.log(`  quadros > 25 ms depois do aquecimento: ${L.length} (${(L.length / dur * 60).toFixed(1)}/min) · coincidem com: ${Object.entries(ev).map(([k, v]) => k + ' ' + Math.round(v / L.length * 100) + '%').join(', ') || '—'} · por segundo do ciclo de 10 s: ${fase.join(' ')}`);
  }
  s.marcas.forEach(m => console.log(`  marca ${m.marca} · t ${m.t} s · yaw ${Math.round(m.yaw)}° ${m.rumo} · (${m.pos.x}, ${m.pos.z})` + (m.medidas ? ` · ${m.medidas.fps} fps, pior ${m.medidas.piorMs} ms, ${m.medidas.draws} draw, CPU ${m.medidas.cpuAtualizacao}+${m.medidas.cpuRender} ms` : '')));
}
/* uma linha por teste: fps médio dos setores (cada direção pesa igual), pior setor, draws e CPU (atualização + render) */
if (compacto.length) {
  console.log('\n■ resumo por teste (médias dos setores; cada direção pesa igual)');
  console.log('  teste            set  fps méd  pior setor           pior ms  draws méd  máx   CPU méd  máx');
  compacto.forEach(c => console.log(`  ${c.teste.padEnd(15)} ${n(c.setores, 4)}  ${n(c.fps.toFixed(1), 7)}  ${(c.pior.fps + ' (' + c.pior.yaw + '° ' + c.pior.rumo + ')').padEnd(19)} ${n(c.piorMs, 7)}  ${n(Math.round(c.draws), 9)}  ${n(c.drawsMax, 4)}  ${n(c.cpu.toFixed(1), 7)}  ${n(c.cpuMax.toFixed(1), 4)}`));
}
