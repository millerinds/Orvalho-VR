/* Pontos de medição do VR: ?vr-ponto=<id> põe o jogador nesse ponto, olhando na direção indicada, antes de entrar.
   Serve para medir fps e draw calls no Quest sempre nos mesmos lugares (o npm run medir:vr usa a mesma lista no emulador).
   Ao carregar com ?vr-ponto, a exploração salva ('orvalho-jogo') é trocada pelo ponto. Depois é só tocar em "Entrar em VR".
   A sessão começa com a cabeça onde o boneco estaria, olhando para o "rumo" (0 = +z, PI/2 = +x).
   Também as variações de parâmetros medidas nas piores vistas e as baterias (sequências de testes numa mesma sessão; ver
   src/xr/teste.js). A página /t do servir:https lê estas listas daqui, então há uma fonte só.
   Os parâmetros das variações usam os nomes da URL. Variação com vr-fb não entra em bateria: o framebuffer só muda ao entrar.
   API: O.xr.pontos = { lista, atual(), definir(id), variacoes, testes(), teste(id), baterias, bateria(id) } */
(function(O){
  O.xr = O.xr || {};
  var PI = Math.PI;
  var LISTA = [
    { id: 'lab', rotulo: 'Lab', amb: 'lab-ia', x: 3.6, y: 0, z: 2.0, rumo: 1.2 },
    { id: 'hall-entrada', rotulo: 'Hall · entrada, olhando para dentro', amb: 'hall-inovale', x: 14.75, y: 0, z: 4.2, rumo: 0 },
    { id: 'hall-palco', rotulo: 'Hall · centro, olhando o palco', amb: 'hall-inovale', x: 30, y: 0, z: 6, rumo: PI / 2 },
    { id: 'hall-cafe', rotulo: 'Hall · centro, olhando o café', amb: 'hall-inovale', x: 22, y: 0, z: 6, rumo: -PI / 2 },
    { id: 'escada-pe', rotulo: 'Hall · pé da escada, olhando os degraus', amb: 'hall-inovale', x: 43.22, y: 0, z: 2.6, rumo: 0 },
    { id: 'escada', rotulo: 'Escada · patamar, olhando o hall', amb: 'hall-inovale', x: 43.2, y: 2.1, z: 7.6, rumo: -PI / 2 },
    { id: 'andar1-vao', rotulo: '1º andar · corredor, olhando o vão', amb: 'hall-inovale', x: 25, y: 4.2, z: 12.6, rumo: PI },
    { id: 'acioc', rotulo: '1º andar · ACIOC Hub', amb: 'hall-inovale', x: 5, y: 4.2, z: 15, rumo: PI / 2 },
    { id: 'administrativo', rotulo: '1º andar · Administrativo', amb: 'hall-inovale', x: 42.5, y: 4.2, z: 16, rumo: -PI / 2 },
    { id: 'incubadora-corredor', rotulo: '1º andar · corredor da Incubadora', amb: 'hall-inovale', x: 45.3, y: 4.2, z: 6, rumo: PI },
    { id: 'incubadora', rotulo: '1º andar · dentro da Incubadora', amb: 'hall-inovale', x: 48.2, y: 4.2, z: 6, rumo: 0 }
  ];
  /* variações nas piores vistas (os pontos acima, com o padrão, também são testes, com o id do ponto) */
  var VARIACOES = [
    { titulo: 'Variações · ACIOC', itens: [
      { id: 'acioc-z0', ponto: 'acioc', params: { 'vr-zonas': 0 }, nota: 'sem zonas' },
      { id: 'acioc-d0', ponto: 'acioc', params: { 'vr-dist': 0 }, nota: 'móveis sem limite de distância' },
      { id: 'acioc-d15', ponto: 'acioc', params: { 'vr-dist': 15 }, nota: 'móveis até 15 m' },
      { id: 'acioc-c0', ponto: 'acioc', params: { 'vr-contorno': 0 }, nota: 'todos os contornos' },
      { id: 'acioc-fb1', ponto: 'acioc', params: { 'vr-fb': 1.0 }, nota: 'framebuffer ×1,0' },
      { id: 'acioc-antes', ponto: 'acioc', params: { 'vr-zonas': 0, 'vr-dist': 0 }, nota: 'sem zonas e sem distância (rodada anterior)' }
    ] },
    { titulo: 'Variações · Incubadora e Hall', itens: [
      { id: 'incub-z0', ponto: 'incubadora', params: { 'vr-zonas': 0 }, nota: 'sem zonas' },
      { id: 'incub-d0', ponto: 'incubadora', params: { 'vr-dist': 0 }, nota: 'móveis sem limite de distância' },
      { id: 'incub-antes', ponto: 'incubadora', params: { 'vr-zonas': 0, 'vr-dist': 0 }, nota: 'rodada anterior' },
      { id: 'cafe-d0', ponto: 'hall-cafe', params: { 'vr-dist': 0 }, nota: 'móveis sem limite de distância' },
      { id: 'cafe-antes', ponto: 'hall-cafe', params: { 'vr-zonas': 0, 'vr-dist': 0 }, nota: 'rodada anterior' }
    ] },
    { titulo: 'Variações · Lab', itens: [
      { id: 'lab-c0', ponto: 'lab', params: { 'vr-contorno': 0 }, nota: 'todos os contornos' },
      { id: 'lab-fov05', ponto: 'lab', params: { 'vr-fov': 0.5 }, nota: 'foveação 0,5' },
      { id: 'lab-mudo', ponto: 'lab', params: { 'vr-log': 0, 'vr-medidor': 0 }, nota: 'sem painel de log e sem medidor (controle dos quadros lentos)' }
    ] }
  ];
  /* baterias: um ambiente por bateria (o framebuffer é escolhido ao entrar na sessão e vale até sair) */
  var BATERIAS = [
    { id: 'hall', rotulo: 'Bateria Hall · 9 pontos com o padrão', passos: ['hall-entrada', 'hall-palco', 'hall-cafe', 'escada', 'andar1-vao', 'acioc', 'administrativo', 'incubadora-corredor', 'incubadora'] },
    { id: 'hall-var', rotulo: 'Bateria Hall · variações nas piores vistas', passos: ['acioc-antes', 'acioc-z0', 'acioc-d0', 'acioc-d15', 'acioc-c0', 'incub-antes', 'incub-z0', 'incub-d0', 'cafe-antes', 'cafe-d0'] },
    { id: 'lab', rotulo: 'Bateria Lab · padrão, contornos, foveação e sem painéis', passos: ['lab', 'lab-c0', 'lab-fov05', 'lab-mudo'] }
  ];
  function testes(){
    var r = LISTA.map(function(p){ return { id: p.id, ponto: p.id, params: {}, nota: null }; });
    VARIACOES.forEach(function(g){ r = r.concat(g.itens); });
    return r;
  }
  function teste(id){ return testes().filter(function(t){ return t.id === id; })[0] || null; }
  function ponto(id){ return LISTA.filter(function(x){ return x.id === id; })[0] || null; }
  function bateria(id){
    var b = BATERIAS.filter(function(x){ return x.id === id; })[0]; if (!b) return null;
    /* cada passo: o teste, o ponto e o ambiente; variações com framebuffer próprio ficam de fora */
    var passos = b.passos.map(teste).filter(function(t){ return t && !('vr-fb' in t.params); }).map(function(t){ return { id: t.id, ponto: t.ponto, params: t.params, nota: t.nota, amb: ponto(t.ponto).amb }; });
    return { id: b.id, rotulo: b.rotulo, passos: passos, amb: passos.length ? passos[0].amb : null };
  }
  var atual = null;

  (function(){
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (!q.has('vr-ponto')) return;
    var id = q.get('vr-ponto'), p = LISTA.filter(function(x){ return x.id === id; })[0];
    if (!p) { console.warn('[Orvalho VR] ponto desconhecido "' + id + '"; use: ' + LISTA.map(function(x){ return x.id; }).join(', ')); return; }
    var salvo = null; try { salvo = JSON.parse(localStorage.getItem('orvalho-jogo')); } catch (e) {}
    var s = { amb: p.amb, x: p.x, y: p.y, z: p.z, rumo: p.rumo, yaw: p.rumo + PI, pitch: (salvo && salvo.pitch) || 0.35, dist: (salvo && salvo.dist) || 4 };
    try { localStorage.setItem('orvalho-jogo', JSON.stringify(s)); } catch (e) {}
    atual = p;
    console.info('[Orvalho VR] ponto de medição: ' + p.id + ' (' + p.rotulo + ')');
  })();

  O.xr.pontos = { lista: LISTA, atual: function(){ return atual; }, definir: function(id){ atual = ponto(id) || atual; return atual; },
    variacoes: VARIACOES, testes: testes, teste: teste, baterias: BATERIAS, bateria: bateria };
})(window.Orvalho);
