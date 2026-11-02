/* Opções do modo VR, guardadas no localStorage ('orvalho-vr'). O painel de opções em mundo vem na etapa 6; até lá elas vêm
   na URL (e ficam salvas), nos links do /t e, dentro do VR, em dois atalhos (Y: suave/teleporte; clique do stick direito:
   giro por passos/suave; ver locomocao.js). No modo teste nada é salvo.
   Desempenho e diagnóstico:
     ?vr-fb=1.3      escala do framebuffer (0,5–1,5; 1 = resolução padrão do aparelho). ?vr-fb=auto volta ao padrão:
                     no jogo normal, ×1,2 em qualquer ambiente (02/11: o Hall é o caso crítico e o valor não muda dentro da sessão);
                     só no modo teste, por ambiente: Lab 1,5 (~71 fps no Quest 3S com foveação 1) e Hall 1,2.
                     Teto 1,5: no Quest 3S, 1,5 e 1,7 deram o mesmo framebuffer (5040×2640, os dois olhos), o navegador limita ali.
                     O framebuffer só muda ao entrar na sessão.
     ?vr-hz=72       taxa de quadros pedida ao aparelho (padrão 72; 0 = deixar a do navegador). Vale a mais próxima entre as suportadas.
     ?vr-fov=0.5     foveated rendering fixo (0 desligado … 1 máximo; padrão 1)
     ?vr-contorno=10 contornos dos móveis só até essa distância da cabeça, em m (padrão 10; 0 = todos). Só em VR.
     ?vr-zonas=0     desliga a visibilidade por zonas do Hall (padrão 1: móveis, portas e itens pequenos das zonas que não se veem
                     da zona da cabeça ficam ocultos; ver zonasVR em ambientes/hall-inovale/hall-inovale.js). Só em VR.
     ?vr-dist=25     distância máxima de desenho dos blocos de móveis das OUTRAS zonas, em m (padrão 25; 0 = sem limite); os da zona em que
                     a cabeça está sempre aparecem (no térreo do Hall, uma zona só, nada some à distância). Só em VR.
     ?vr-medidor=0   esconde o medidor de fps
     ?vr-log=1       liga o diagnóstico/log (quadro fora do VR e painel dentro do VR; ver log.js); ?vr-log=0 desliga
     ?vr-teste=<id>  modo de medição (src/xr/teste.js, página /t do npm run servir:https). Com ele, os parâmetros da URL valem
                     só nesta carga e NÃO são salvos: um teste não deixa o próximo (nem o jogo normal) com outra configuração.
     ?vr-giro=12     só no modo teste: depois do aquecimento, o rig gira sozinho em torno da cabeça a essa velocidade (°/s, padrão 12)
                     por uma volta; 0 desliga (a volta fica por conta de quem testa).
     ?vr-bateria=hall  só no modo teste: roda uma bateria de testes (src/xr/pontos.js) numa sessão só; cada passo troca os
                     parâmetros com definirTeste().
   Locomoção (etapa 2):
     ?vr-mov=suave|teleporte     stick esquerdo anda (padrão suave) ou mira o teleporte
     ?vr-giro-tipo=passos|suave  stick direito gira por passos (padrão) ou suave
     ?vr-giro-passo=30           ângulo do giro por passos: 15, 30 (padrão), 45 ou 90
     ?vr-giro-vel=90             velocidade do giro suave, °/s (padrão 90)
     ?vr-vinheta=1               vinheta de conforto: 0 desligada, 1 fraca (padrão), 2 forte
     ?vr-postura=pe|sentado      sentado eleva a vista até OLHOS_SENTADO (locomocao.js); padrão em pé
     ?vr-vel=1.5 · ?vr-correr=2.5  velocidades andando e correndo, m/s
     ?vr-pulo=0                  desliga o pulo (A)
   API: O.xr.opcoes.ler() · salvar(parcial) · alterar(parcial) · escalaPara(idAmbiente) · teste() · bateria() · definirTeste(id, paramsUrl) · padrao */
(function(O){
  O.xr = O.xr || {};
  var CHAVE = 'orvalho-vr';
  /* escalaFb null = automático (padrão por ambiente) */
  var PADRAO = { escalaFb: null, hz: 72, foveacao: 1, contorno: 10, zonas: true, dist: 25, medidor: true, log: false, giroTeste: 12,
    mov: 'suave', giroTipo: 'passos', giroPasso: 30, giroVel: 90, vinheta: 1, postura: 'pe', vel: 1.5, velCorrer: 2.5, pulo: true };
  var FAIXA = { escalaFb: [0.5, 1.5], hz: [0, 144], foveacao: [0, 1], contorno: [0, 200], dist: [0, 200], giroTeste: [0, 720],
    giroPasso: [15, 90], giroVel: [20, 240], vinheta: [0, 2], vel: [0.5, 4], velCorrer: [0.5, 6] };
  var ESCOLHAS = { mov: ['suave', 'teleporte'], giroTipo: ['passos', 'suave'], postura: ['pe', 'sentado'], giroPasso: [15, 30, 45, 90], vinheta: [0, 1, 2] };
  var FB_AMBIENTE = { 'lab-ia': 1.5 }, FB_OUTROS = 1.2;   // só no modo teste (Hall 1,2: no Quest, 1,0 e 1,2 deram o mesmo fps no pior ponto)
  var FB_JOGO = 1.2;                                        // jogo normal, qualquer ambiente
  var temporario = null, idTeste = null, idBateria = null, tempBase = null;   // modo teste: parâmetros da URL só desta carga

  function limpar(o){
    var r = {};
    Object.keys(PADRAO).forEach(function(k){
      /* sem nada salvo, o é null: o valor fica undefined e vale o padrão (antes, isFinite(null) virava 0 e caía no mínimo da faixa) */
      var v = o ? o[k] : undefined, p = PADRAO[k];
      if (typeof p === 'boolean') r[k] = typeof v === 'boolean' ? v : p;
      else if (typeof p === 'string') r[k] = ESCOLHAS[k].indexOf(v) >= 0 ? v : p;
      else if (typeof v === 'number' && isFinite(v)) {
        r[k] = Math.min(FAIXA[k][1], Math.max(FAIXA[k][0], v));
        if (ESCOLHAS[k]) r[k] = ESCOLHAS[k].reduce(function(m, c){ return Math.abs(c - r[k]) < Math.abs(m - r[k]) ? c : m; });   // a escolha mais próxima
      }
      else r[k] = p;
    });
    return r;
  }
  function lerSalvo(){
    var o = null;
    try { o = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) {}
    return limpar(o);
  }
  function ler(){
    var o = lerSalvo();
    if (temporario) Object.keys(temporario).forEach(function(k){ o[k] = temporario[k]; });
    return limpar(o);
  }
  function salvar(parcial){
    var o = lerSalvo();
    Object.keys(parcial || {}).forEach(function(k){ o[k] = parcial[k]; if (temporario) delete temporario[k]; });   // escolha explícita vence a da URL
    o = limpar(o);
    try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) {}
    return ler();
  }
  /* troca feita dentro do VR (atalhos): salva no jogo normal; no modo teste vale só nesta carga */
  function alterar(parcial){
    if (!idTeste) return salvar(parcial);
    temporario = Object.assign(temporario || {}, parcial);
    return ler();
  }
  /* escala do framebuffer para a sessão: a escolhida na URL ou, em automático, ×1,2 (jogo) ou a do ambiente (modo teste) */
  function escalaPara(amb){
    var op = ler();
    if (op.escalaFb != null) return { valor: op.escalaFb, auto: false };
    return { valor: idTeste ? (FB_AMBIENTE[amb] || FB_OUTROS) : FB_JOGO, auto: true };
  }
  function limparId(v){ return String(v == null ? '' : v).replace(/[^\w.\-]/g, '').slice(0, 40); }
  /* parâmetros com os nomes da URL (vr-fb, vr-zonas…) → opções. tem(k)/val(k) leem de um URLSearchParams ou de um objeto. */
  function deUrl(tem, val){
    var p = {};
    if (tem('vr-fb')) p.escalaFb = /^auto$/i.test(String(val('vr-fb'))) ? null : parseFloat(val('vr-fb'));
    if (tem('vr-fov')) p.foveacao = parseFloat(val('vr-fov'));
    if (tem('vr-hz')) p.hz = parseFloat(val('vr-hz'));
    if (tem('vr-contorno')) p.contorno = parseFloat(val('vr-contorno'));
    if (tem('vr-zonas')) p.zonas = String(val('vr-zonas')) !== '0';
    if (tem('vr-dist')) p.dist = parseFloat(val('vr-dist'));
    if (tem('vr-medidor')) p.medidor = String(val('vr-medidor')) !== '0';
    if (tem('vr-log')) p.log = String(val('vr-log')) !== '0';
    if (tem('vr-giro')) p.giroTeste = parseFloat(val('vr-giro'));
    if (tem('vr-mov')) p.mov = String(val('vr-mov'));
    if (tem('vr-giro-tipo')) p.giroTipo = String(val('vr-giro-tipo'));
    if (tem('vr-giro-passo')) p.giroPasso = parseFloat(val('vr-giro-passo'));
    if (tem('vr-giro-vel')) p.giroVel = parseFloat(val('vr-giro-vel'));
    if (tem('vr-vinheta')) p.vinheta = parseFloat(val('vr-vinheta'));
    if (tem('vr-postura')) p.postura = String(val('vr-postura'));
    if (tem('vr-vel')) p.vel = parseFloat(val('vr-vel'));
    if (tem('vr-correr')) p.velCorrer = parseFloat(val('vr-correr'));
    if (tem('vr-pulo')) p.pulo = String(val('vr-pulo')) !== '0';
    return p;
  }
  /* modo teste: troca o teste atual e os parâmetros dele (passo de bateria). Parte dos parâmetros da URL e põe os do passo por
     cima; o framebuffer não muda (só vale ao entrar na sessão). Fora do modo teste, não faz nada. */
  function definirTeste(id, params){
    if (!idTeste) return false;
    var p = params || {}, d = deUrl(function(k){ return k in p; }, function(k){ return p[k]; });
    delete d.escalaFb;
    temporario = Object.assign({}, tempBase, d);
    idTeste = limparId(id) || idTeste;
    return true;
  }
  /* parâmetros da URL, lidos uma vez ao carregar */
  (function(){
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var p = deUrl(function(k){ return q.has(k); }, function(k){ return q.get(k); });
    if (q.has('vr-teste') || q.has('vr-bateria')) {
      idTeste = limparId(q.get('vr-teste')) || 'teste';
      if (q.has('vr-bateria')) idBateria = limparId(q.get('vr-bateria')) || null;
      temporario = p; tempBase = Object.assign({}, p);   // não salva: vale só nesta carga
      return;
    }
    delete p.giroTeste;   // o giro automático só existe no modo teste
    if (Object.keys(p).length) salvar(p);
  })();

  O.xr.opcoes = { ler: ler, salvar: salvar, alterar: alterar, escalaPara: escalaPara, teste: function(){ return idTeste; }, bateria: function(){ return idBateria; },
    definirTeste: definirTeste, padrao: limpar({}) };
})(window.Orvalho);
