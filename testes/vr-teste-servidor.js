/* Ferramentas de medição do VR no Quest, servidas SÓ pelo `npm run servir:https` (testes/servir-https.js). Nada daqui vai para o
   site: o GitHub Pages publica só index.html, css/, src/, ambientes/ e vendor/, e o `npm run servir` (HTTP) não monta estas rotas.
   - GET /t e /vr-teste.html: página com um botão grande por teste (texto legível com o laser do Quest Browser). Cada botão abre o
     jogo com ?vr-log=1&vr-fov=1&vr-fb=auto, o ponto (?vr-ponto), os parâmetros da variação e ?vr-teste=<id>. Os pontos vêm de
     src/xr/pontos.js e os padrões de src/xr/opcoes.js (lidos a cada pedido, então a página acompanha o código).
   - POST /__orvalho/medicoes: o jogo em modo teste (src/xr/teste.js) manda os registros; cada um vira uma linha JSON em
     testes/medicoes-vr/<AAAA-MM-DD>.jsonl (pasta fora do Git). Segurança: só IPs de rede privada/loopback, só JSON, corpo de no
     máximo 32 KB, nome do arquivo decidido pelo servidor (a data de hoje), arquivo do dia com no máximo 20 MB, e nenhuma rota
     de leitura. Sem autenticação: existe só enquanto o servidor de teste está rodando. ORVALHO_MEDICOES=0 desliga o endpoint. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { RAIZ } = require('./servir');

const PASTA = process.env.ORVALHO_MEDICOES_DIR || path.join(__dirname, 'medicoes-vr');   // o teste automático grava numa pasta temporária
const LIMITE_CORPO = 32 * 1024, LIMITE_DIA = 20 * 1024 * 1024;
const TIPOS = ['inicio', 'resumo', 'setores', 'marca', 'fim'];

function ipPrivado(ip) {
  ip = String(ip || '').replace(/^::ffff:/i, '');
  return ip === '::1' || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || /^169\.254\./.test(ip) || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
}
function hoje() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function arquivoDoDia() { return path.join(PASTA, hoje() + '.jsonl'); }

/* lê os pontos e os padrões direto dos scripts do jogo, numa sandbox sem DOM */
function lerJogo() {
  const ctx = { window: { Orvalho: {} }, location: { search: '' }, URLSearchParams, console: { info() {}, warn() {}, log() {} },
    localStorage: { getItem() { return null; }, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'src/xr/pontos.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'src/xr/opcoes.js'), 'utf8'), ctx);
  const O = ctx.window.Orvalho;
  return { pontos: O.xr.pontos.lista, variacoes: O.xr.pontos.variacoes, baterias: O.xr.pontos.baterias.map(b => O.xr.pontos.bateria(b.id)), padrao: O.xr.opcoes.padrao };
}

/* testes da página: todos os pontos com o padrão e as variações nas piores vistas (listas em src/xr/pontos.js) */
function listaTestes(pontos, padrao, variacoes) {
  const base = { 'vr-contorno': padrao.contorno, 'vr-zonas': padrao.zonas ? 1 : 0, 'vr-dist': padrao.dist };
  const nome = id => (pontos.find(p => p.id === id) || { rotulo: id }).rotulo;
  const t = (id, ponto, extra, nota) => ({ id, ponto, rotulo: nome(ponto), nota, params: Object.assign({}, base, extra || {}) });
  return [{ titulo: 'Pontos (padrão)', itens: pontos.map(p => t(p.id, p.id)) }]
    .concat((variacoes || []).map(g => ({ titulo: g.titulo, itens: g.itens.map(v => t(v.id, v.ponto, v.params, v.nota)) })));
}
function urlDe(teste) {
  const q = new URLSearchParams({ 'vr-log': 1, 'vr-fov': 1, 'vr-fb': 'auto' });
  Object.entries(teste.params).forEach(([k, v]) => q.set(k, v));
  q.set('vr-ponto', teste.ponto); q.set('vr-teste', teste.id);
  return '/index.html?' + q.toString();
}
/* bateria: começa no ponto do 1º passo, com os padrões explícitos (cada passo põe os seus por cima) */
function urlBateria(b, padrao) {
  const q = new URLSearchParams({ 'vr-log': 1, 'vr-fov': 1, 'vr-fb': 'auto', 'vr-contorno': padrao.contorno, 'vr-zonas': padrao.zonas ? 1 : 0, 'vr-dist': padrao.dist });
  q.set('vr-ponto', b.passos[0].ponto); q.set('vr-bateria', b.id); q.set('vr-teste', 'bateria-' + b.id);
  return '/index.html?' + q.toString();
}
/* quantos testes já chegaram hoje (registro "setores" ou "fim"), para a página marcar o que já foi medido */
function feitosHoje() {
  const feitos = {};
  try {
    fs.readFileSync(arquivoDoDia(), 'utf8').split('\n').forEach(l => {
      if (!l) return; let r; try { r = JSON.parse(l); } catch (e) { return; }
      if (r.tipo !== 'setores' && r.tipo !== 'fim') return;
      const f = feitos[r.teste] || (feitos[r.teste] = { sessoes: new Set(), setores: 0 });
      f.sessoes.add(r.sessao); f.setores = Math.max(f.setores, r.setoresCobertos || 0);
    });
  } catch (e) { /* sem arquivo hoje */ }
  return feitos;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pagina() {
  const { pontos, padrao, variacoes, baterias } = lerJogo(), grupos = listaTestes(pontos, padrao, variacoes), feitos = feitosHoje();
  const tempo = b => Math.round((20 + 30 + (b.passos.length - 1) * (10 + 30 + 2)) / 60);   // aquecimento + volta (+ véu e pausa) por passo
  const botaoBateria = b => {
    const n = b.passos.filter(p => feitos[p.id]).length;
    return `<a class="b bat${n === b.passos.length ? ' feito' : ''}" href="${esc(urlBateria(b, padrao))}"><span class="id">bateria ${esc(b.id)}</span><span class="r">${esc(b.rotulo)} · ~${tempo(b)} min</span>`
      + `<span class="p">${esc(b.passos.map(p => p.id).join(' → '))}</span>${n ? `<span class="ok">✓ ${n}/${b.passos.length} passos medidos hoje</span>` : ''}</a>`;
  };
  const botao = t => {
    const f = feitos[t.id], p = t.params;
    const par = `fb ${p['vr-fb'] != null ? p['vr-fb'] : 'auto'} · contorno ${p['vr-contorno'] || '∞'} · zonas ${p['vr-zonas']} · dist ${p['vr-dist'] || '∞'}`;
    return `<a class="b${f ? ' feito' : ''}" href="${esc(urlDe(t))}"><span class="id">${esc(t.id)}</span><span class="r">${esc(t.rotulo)}${t.nota ? ' · <b>' + esc(t.nota) + '</b>' : ''}</span>`
      + `<span class="p">${esc(par)}</span>${f ? `<span class="ok">✓ medido hoje · ${f.sessoes.size}× · setores ${f.setores}/8</span>` : ''}</a>`;
  };
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orvalho · testes VR</title><link rel="icon" href="data:,"><style>
body{margin:0;font:600 26px/1.3 Nunito,"Segoe UI",Arial,sans-serif;color:#0c2c4a;background:linear-gradient(#bfe9ff,#eaf8ff 40%,#fff)}
main{max-width:1500px;margin:0 auto;padding:28px}
h1{font-size:46px;margin:0 0 6px}h2{font-size:34px;margin:34px 0 14px}
.passos{background:#fff;border:5px solid #0b3a6e;border-radius:28px;box-shadow:8px 8px 0 #0b3a6e;padding:18px 28px;margin:16px 0}
.passos li{margin:6px 0}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:22px}
.b{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:#0c2c4a;background:linear-gradient(#fff,#d6f0ff);border:5px solid #0b3a6e;border-radius:30px;box-shadow:8px 8px 0 #0b3a6e;padding:22px 26px;min-height:120px}
.b:hover,.b:focus{background:linear-gradient(#fff,#a8e2ff);outline:6px solid #5ff0ff}
.b.feito{background:linear-gradient(#fff,#d9f7c8)}
.b.bat{background:linear-gradient(#fff,#e6f8d4);border-color:#2b6b0d;box-shadow:8px 8px 0 #2b6b0d}
.id{font:800 40px/1 "JetBrains Mono",Consolas,monospace}.r{font-size:27px}.p{font:700 22px "JetBrains Mono",Consolas,monospace;color:#3c5d7a}.ok{color:#3b8f17;font-weight:800}
.restaurar{display:inline-block;margin-top:10px;font-size:24px;color:#0b3a6e}
</style></head><body><main>
<h1>Orvalho · testes VR</h1>
<ol class="passos">
<li>Toque num teste. No jogo, toque em <b>Entrar em VR</b>.</li>
<li>Fique <b>parado olhando para a frente</b> (pode sentar). Os primeiros 20 s são aquecimento (descartado). <b>1 bipe</b>: acabou o aquecimento.</li>
<li>O jogo <b>gira sozinho</b> uma volta (12°/s, ~30 s), sem sair do lugar. Não gire a cabeça; se o giro incomodar, feche os olhos. <b>2 bipes</b>: acabou a volta.</li>
<li>Viu algo estranho (travada, objeto surgindo)? Aperte <b>A</b> ou o <b>gatilho</b>: registra uma marca.</li>
<li>Saia <b>segurando B por 1,5 s</b> (o anel enche e o controle vibra) e volte para esta página (Voltar). Os números já foram gravados no PC.</li>
<li><b>Bateria:</b> vários testes seguidos numa sessão só. Entre os passos a vista escurece e você vai ao próximo ponto; a cada passo, 1 bipe (aquecimento de 10 s) e 2 bipes (volta). <b>3 bipes</b>: fim da bateria, e a sessão termina sozinha.</li>
</ol>
<h2>Controles em VR</h2>
<ol class="passos">
<li><b>Stick esquerdo</b>: andar (ou, no modo teleporte, empurrar para a frente para mirar e soltar para ir) · <b>clique</b> enquanto empurra: correr.</li>
<li><b>Stick direito</b>: girar 30° (ou suave) · <b>clique</b>: alterna giro por passos / suave.</li>
<li><b>Gatilho</b>: com o laser num alvo, executa (sentar, ir para outro ambiente). <b>A</b>: pular (no modo teste, A e gatilho marcam).</li>
<li><b>Y</b>: alterna andar suave / teleporte. <b>X</b>: vinheta desligada → fraca → forte. (Ficam salvos; atalhos até existir o painel de opções.)</li>
<li><b>B rápido</b>: levantar / fechar · <b>B segurado 1,5 s</b>: sair do VR · <b>botão Meta segurado</b>: recentralizar.</li>
</ol>
<h2>Jogar (sem modo teste) · andar e interagir</h2>
<p class="restaurar">Abre o jogo no ponto, com o log. Depois toque em <b>Entrar em VR</b>. Dentro do VR: <b>Y</b> alterna andar suave / teleporte e o <b>clique do stick direito</b> alterna giro por passos / suave (ficam salvos).</p>
<div class="g">${[['lab', 'Lab'], ['hall-entrada', 'Hall · entrada'], ['escada-pe', 'Hall · pé da escada'], ['andar1-vao', '1º andar · vão'], ['acioc', '1º andar · ACIOC']].map(([p, r]) => `<a class="b" href="/index.html?vr-log=1&vr-ponto=${p}"><span class="id">jogar ${esc(p)}</span><span class="r">${esc(r)}</span></a>`).join('')}
</div>
<h2>Opções de movimento (ficam salvas no jogo)</h2>
<div class="g">${[
    ['vr-mov=suave', 'andar suave (padrão)'], ['vr-mov=teleporte', 'teleporte'],
    ['vr-giro-tipo=passos&vr-giro-passo=30', 'giro por passos de 30° (padrão)'], ['vr-giro-passo=15', 'passos de 15°'], ['vr-giro-passo=45', 'passos de 45°'], ['vr-giro-passo=90', 'passos de 90°'], ['vr-giro-tipo=suave', 'giro suave (90°/s)'],
    ['vr-vinheta=0', 'vinheta desligada'], ['vr-vinheta=1', 'vinheta fraca (padrão)'], ['vr-vinheta=2', 'vinheta forte'],
    ['vr-postura=pe', 'em pé (padrão)'], ['vr-postura=sentado', 'sentado (vista a 1,60 m)'],
    ['vr-pulo=1', 'pulo ligado (padrão)'], ['vr-pulo=0', 'pulo desligado'], ['vr-vel=1.5&vr-correr=2.5', 'velocidades padrão (1,5 / 2,5 m/s)']
  ].map(([q, r]) => `<a class="b" href="/index.html?vr-log=1&${esc(q)}"><span class="id">${esc(q.split('&')[0].replace('vr-', ''))}</span><span class="r">${esc(r)}</span></a>`).join('')}</div>
<h2>Baterias (uma por ambiente: o framebuffer só muda ao entrar)</h2><div class="g">${baterias.map(botaoBateria).join('')}</div>
${grupos.map(g => `<h2>${esc(g.titulo)}</h2><div class="g">${g.itens.map(botao).join('')}</div>`).join('\n')}
<p class="restaurar">Os parâmetros dos testes não ficam salvos no jogo. Gravando em <code>testes/medicoes-vr/${hoje()}.jsonl</code>.</p>
</main></body></html>`;
}

function responder(rsp, cod, txt, tipo) { rsp.writeHead(cod, { 'Content-Type': tipo || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); rsp.end(txt || ''); }

function receber(req, rsp) {
  if (process.env.ORVALHO_MEDICOES === '0') return responder(rsp, 404, '404');
  if (req.method !== 'POST') return responder(rsp, 405, 'só POST');
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return responder(rsp, 415, 'só JSON');
  const tam = +req.headers['content-length'];
  if (tam > LIMITE_CORPO) return responder(rsp, 413, 'grande demais');
  let corpo = '', recebido = 0, cortado = false;
  req.setEncoding('utf8');
  req.on('data', c => { recebido += Buffer.byteLength(c); if (recebido > LIMITE_CORPO) { cortado = true; responder(rsp, 413, 'grande demais'); req.destroy(); } else corpo += c; });
  req.on('end', () => {
    if (cortado) return;
    let reg; try { reg = JSON.parse(corpo); } catch (e) { return responder(rsp, 400, 'JSON inválido'); }
    if (!reg || typeof reg !== 'object' || Array.isArray(reg) || !TIPOS.includes(reg.tipo) || typeof reg.teste !== 'string' || reg.teste.length > 40)
      return responder(rsp, 400, 'registro inválido');
    const arq = arquivoDoDia();
    try { if (fs.existsSync(arq) && fs.statSync(arq).size > LIMITE_DIA) return responder(rsp, 507, 'arquivo do dia cheio'); } catch (e) {}
    const linha = JSON.stringify(Object.assign({ recebido: new Date().toISOString(), ip: String(req.socket.remoteAddress || '').replace(/^::ffff:/i, '') }, reg)) + '\n';
    fs.mkdir(PASTA, { recursive: true }, () => fs.appendFile(arq, linha, e => {
      if (e) return responder(rsp, 500, 'falha ao gravar');
      if (reg.tipo === 'inicio' || reg.tipo === 'fim' || reg.tipo === 'marca')
        console.log(`  [medição] ${reg.tipo.padEnd(6)} ${reg.teste} · ${reg.ponto || '—'}` + (reg.tipo === 'marca' ? ` · marca ${reg.marca}` : '') + (reg.tipo === 'fim' ? ` · setores ${reg.setoresCobertos}/8` : ''));
      responder(rsp, 204);
    }));
  });
}

/* devolve true se tratou o pedido */
function tratar(req, rsp) {
  const rota = (req.url || '').split('?')[0];
  if (rota !== '/t' && rota !== '/t/' && rota !== '/vr-teste.html' && rota !== '/__orvalho/medicoes') return false;
  if (!ipPrivado(req.socket.remoteAddress)) { responder(rsp, 403, 'só na rede local'); return true; }
  if (rota === '/__orvalho/medicoes') { receber(req, rsp); return true; }
  try { responder(rsp, 200, pagina(), 'text/html; charset=utf-8'); }
  catch (e) { responder(rsp, 500, 'falha ao montar a página: ' + e.message); }
  return true;
}

module.exports = { tratar, ipPrivado, pagina, listaTestes, lerJogo, PASTA };
