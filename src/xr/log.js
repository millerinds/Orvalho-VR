/* Diagnóstico e log do VR, para testar no Quest sem chrome://inspect (sem cabo e sem modo desenvolvedor).
   - Captura SEMPRE, desde o primeiro script (este arquivo vem antes do three.js no index.html): console.error, console.warn,
     erros não capturados (inclusive de carregamento de script/imagem), promessas rejeitadas sem catch e as linhas
     "[Orvalho VR] …" (sessão iniciada/encerrada e o resumo do medidor a cada 10 s). Guarda as últimas 60, juntando repetidas.
   - Mostra só com o log ligado: ?vr-log=1 na URL liga e fica salvo em 'orvalho-vr' (?vr-log=0 ou o × do quadro desliga).
       · fora do VR: quadro pequeno no canto inferior esquerdo (tela inicial e jogo) com isSecureContext, navigator.xr,
         suporte a immersive-vr, endereço, as últimas medidas do medidor e as mensagens;
       · dentro do VR: painel preso à vista, à direita (o medidor fica à esquerda), com os mesmos dados.
   API: O.xr.log = { entradas(), diagnostico(), medidas(d), versao(), ligado(), ligar(v), criarPainel(camera) } */
window.Orvalho = window.Orvalho || {};
(function(O){
  O.xr = O.xr || {};
  var MAX = 60, entradas = [], versao = 0, versaoEnt = 0, t0 = Date.now(), ultimaMedida = null, suporteVR = null, quadro = null;

  function texto(a){
    if (a instanceof Error) return a.message + (a.stack ? ' @ ' + String(a.stack).split('\n').slice(1, 2).join('').trim() : '');
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a).slice(0, 200); } catch (e) { return String(a); }
  }
  function registrar(nivel, msg){
    msg = String(msg).replace(/\s+/g, ' ').slice(0, 300);
    var u = entradas[entradas.length - 1];
    if (u && u.nivel === nivel && u.texto === msg) { u.vezes++; u.t = (Date.now() - t0) / 1000; }
    else { entradas.push({ t: (Date.now() - t0) / 1000, nivel: nivel, texto: msg, vezes: 1 }); if (entradas.length > MAX) entradas.shift(); }
    versao++; versaoEnt++;
    if (quadro) quadro.marcar();
  }

  /* console: mantém o comportamento original e copia para o log */
  ['error', 'warn', 'info', 'log'].forEach(function(m){
    var orig = console[m]; if (!orig) return;
    console[m] = function(){
      var msg = Array.prototype.map.call(arguments, texto).join(' ');
      if (m === 'error') registrar('erro', msg);
      else if (m === 'warn') registrar('aviso', msg);
      else if (/^\[Orvalho VR\]/.test(msg)) registrar('info', msg);
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function(ev){
    var alvo = ev.target;
    if (alvo && alvo !== window && (alvo.src || alvo.href)) { registrar('erro', 'falha ao carregar ' + (alvo.src || alvo.href)); return; }
    var onde = ev.filename ? ' (' + String(ev.filename).split('/').pop() + ':' + ev.lineno + ')' : '';
    registrar('erro', 'não capturado: ' + (ev.error ? texto(ev.error) : ev.message) + onde);
  }, true);
  window.addEventListener('unhandledrejection', function(ev){ registrar('erro', 'promessa rejeitada: ' + texto(ev.reason)); });

  /* estado do WebXR nesta página */
  function diagnostico(){
    var ua = navigator.userAgent, m = ua.match(/OculusBrowser\/([\d.]+)/), c = ua.match(/Chrome\/(\d+)/);
    return {
      seguro: !!window.isSecureContext,
      xr: !!navigator.xr,
      immersiveVR: suporteVR,               // null = ainda verificando / sem navigator.xr
      endereco: location.protocol + '//' + location.host,
      navegador: m ? 'Quest Browser ' + m[1] : (c ? 'Chrome ' + c[1] : ua.slice(0, 60))
    };
  }
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(function(ok){ suporteVR = !!ok; versao++; if (quadro) quadro.marcar(); },
      function(e){ suporteVR = false; registrar('aviso', 'isSessionSupported falhou: ' + texto(e)); });
  }

  function lerLigado(){ return !!(O.xr.opcoes && O.xr.opcoes.ler().log); }
  function simNao(v){ return v == null ? '…' : (v ? 'sim' : 'NÃO'); }
  function linhaMedidas(d){
    return d ? d.fps + ' fps (ativo ' + (d.hzAtivo || '?') + ' Hz, pedido ' + (d.hzPedido || 'padrão') + ') · ' + d.ms + ' ms, pior ' + d.pior + ' · CPU ' + d.cpu + ' ms · ' + d.calls + ' draw · ' + Math.round(d.tris / 1000) + 'K tri · FB ×' + d.escalaFb + ' ' + d.fb + ' · fov ' + d.foveacao : null;
  }
  function hora(t){ var s = Math.floor(t); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  /* ---------- quadro no DOM (fora do VR) ---------- */
  function criarQuadro(){
    var el = document.createElement('section');
    el.className = 'diag-vr'; el.id = 'diag-vr'; el.setAttribute('aria-label', 'Diagnóstico do VR');
    el.innerHTML = '<header><b>Diagnóstico VR</b><button type="button" aria-label="Desligar o diagnóstico" title="Desligar (?vr-log=1 liga de novo)">×</button></header>' +
      '<dl></dl><p class="diag-med" hidden></p><ol></ol>' +
      (O.xr.opcoes && O.xr.opcoes.teste() ? '<p class="diag-teste">Teste <b></b> · <a href="/t">voltar aos testes</a></p>' : '');
    document.body.appendChild(el);
    var dl = el.querySelector('dl'), med = el.querySelector('.diag-med'), ol = el.querySelector('ol'), sujo = true, agendado = false;
    el.querySelector('button').addEventListener('click', function(){ ligar(false); });
    if (el.querySelector('.diag-teste b')) el.querySelector('.diag-teste b').textContent = O.xr.opcoes.teste();
    function desenhar(){
      agendado = false; if (!sujo) return; sujo = false;
      var d = diagnostico();
      dl.innerHTML = '';
      [['isSecureContext', simNao(d.seguro), d.seguro], ['navigator.xr', simNao(d.xr), d.xr], ['immersive-vr', d.xr ? simNao(d.immersiveVR) : '—', d.immersiveVR !== false && d.xr],
       ['endereço', d.endereco, true], ['navegador', d.navegador, true]].forEach(function(l){
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = l[0]; dd.textContent = l[1]; if (!l[2]) dd.className = 'ruim';
        dl.appendChild(dt); dl.appendChild(dd);
      });
      var lm = linhaMedidas(ultimaMedida);
      med.hidden = !lm; med.textContent = lm ? 'Último VR: ' + lm : '';
      ol.innerHTML = '';
      if (!entradas.length) { var v = document.createElement('li'); v.textContent = 'sem erros nem mensagens até agora'; ol.appendChild(v); }
      entradas.slice(-25).forEach(function(e){
        var li = document.createElement('li'); li.className = e.nivel;
        li.textContent = hora(e.t) + ' ' + (e.vezes > 1 ? '×' + e.vezes + ' ' : '') + e.texto;
        ol.appendChild(li);
      });
      ol.scrollTop = ol.scrollHeight;
    }
    return {
      el: el,
      marcar: function(){ sujo = true; if (!agendado) { agendado = true; setTimeout(desenhar, 250); } },
      remover: function(){ el.remove(); }
    };
  }
  function ligar(v, semSalvar){
    if (O.xr.opcoes && !semSalvar) O.xr.opcoes.salvar({ log: !!v });
    if (v && !quadro) { quadro = criarQuadro(); quadro.marcar(); }
    if (!v && quadro) { quadro.remover(); quadro = null; }
  }

  /* ---------- painel dentro do VR (canvas 2D numa textura presa à câmera) ---------- */
  function criarPainel(camera){
    /* leve (02/11): desenho em 640×520 lógicos num canvas de 75%, sem mipmaps. Redesenha na hora quando chega mensagem nova
       e, para o topo (posição, yaw) e a linha de medidas, no máximo a cada ATUALIZA_TOPO ms. */
    var W = 640, H = 520, LIN = 10, ESC = 0.75, ATUALIZA_TOPO = 5000;
    var cv = document.createElement('canvas'); cv.width = Math.round(W * ESC); cv.height = Math.round(H * ESC);
    var g = cv.getContext('2d'); g.setTransform(ESC, 0, 0, ESC, 0, 0);
    var tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    var geo = new THREE.PlaneGeometry(0.30, 0.30 * H / W);
    var mesh = new THREE.Mesh(geo, mat); mesh.name = 'xr-log';
    /* 70 cm à frente, abaixo e à direita do centro (espelho do medidor), inclinado para os olhos */
    mesh.position.set(0.16, -0.15, -0.7); mesh.rotation.set(0.22, -0.18, 0); mesh.renderOrder = 999; mesh.frustumCulled = false;
    camera.add(mesh);
    var visto = -1, vistoEnt = -1, ultimo = 0, rotuloVisto = '';

    function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function cortar(s, max){ if (g.measureText(s).width <= max) return s; while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }
    function quebrar(s, max){
      var palavras = s.split(' '), out = [], l = '';
      palavras.forEach(function(p){ var t = l ? l + ' ' + p : p; if (g.measureText(t).width > max && l) { out.push(l); l = p; } else l = t; });
      if (l) out.push(l);
      return out.map(function(x){ return cortar(x, max); });
    }
    function desenhar(){
      g.clearRect(0, 0, W, H);
      rr(14, 14, W - 28, H - 28, 30); g.fillStyle = '#0b3a6e'; g.fill();
      rr(6, 6, W - 28, H - 28, 30);
      var bg = g.createLinearGradient(0, 6, 0, H - 22); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d6f0ff');
      g.fillStyle = bg; g.fill(); g.lineWidth = 6; g.strokeStyle = '#0b3a6e'; g.stroke();
      var d = diagnostico(), x = 32, w = W - 84, y = 50;
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#0c2c4a'; g.font = '900 28px Nunito, "Arial Rounded MT Bold", sans-serif'; g.fillText('LOG', x, y);
      g.font = '700 19px "JetBrains Mono", monospace'; g.fillStyle = d.seguro && d.xr ? '#3b8f17' : '#e2506a';
      g.fillText(cortar('seguro ' + simNao(d.seguro) + ' · xr ' + simNao(d.xr) + ' · ' + d.endereco.replace(/^https?:\/\//, ''), w - 70), x + 70, y);
      y += 28;
      /* topo fixo: teste, ponto, parâmetros e cabeça (os mesmos do medidor) */
      var med = O.xr.sessao && O.xr.sessao.medidor && O.xr.sessao.medidor();
      if (med && med.rotulo) { g.fillStyle = '#0b3a6e'; g.font = '700 18px "JetBrains Mono", monospace'; med.rotulo().forEach(function(l){ g.fillText(cortar(l, w), x, y); y += 22; }); y += 4; }
      var lm = linhaMedidas(ultimaMedida);
      g.fillStyle = '#3c5d7a'; g.font = '700 17px "JetBrains Mono", monospace';
      if (lm) quebrar(lm, w).slice(0, 2).forEach(function(l){ g.fillText(l, x, y); y += 22; });
      y += 6; g.fillStyle = 'rgba(11,58,110,.25)'; g.fillRect(x, y - 14, w, 2); y += 10;
      var linhas = [];
      g.font = '700 17px "JetBrains Mono", monospace';
      if (!entradas.length) linhas.push({ cor: '#3c5d7a', t: 'sem erros nem mensagens' });
      for (var i = entradas.length - 1; i >= 0 && linhas.length < LIN; i--) {
        var e = entradas[i], cor = e.nivel === 'erro' ? '#c8304d' : e.nivel === 'aviso' ? '#a85a00' : '#0c2c4a';
        var partes = quebrar(hora(e.t) + ' ' + (e.vezes > 1 ? '×' + e.vezes + ' ' : '') + e.texto, w).slice(0, 3);
        linhas = partes.map(function(p){ return { cor: cor, t: p }; }).concat(linhas);
      }
      linhas.slice(-LIN - 2).forEach(function(l){ if (y < H - 30) { g.fillStyle = l.cor; g.fillText(l.t, x, y); y += 23; } });
      tx.needsUpdate = true;
    }
    desenhar();
    return {
      /* chamado a cada quadro: mensagem nova → redesenha (no máximo 1×/s); só medidas, posição ou yaw → a cada ATUALIZA_TOPO ms */
      atualizar: function(){
        var agora = performance.now();
        if (agora - ultimo < 1000 || !mesh.visible) return;
        var novaMsg = versaoEnt !== vistoEnt;
        if (!novaMsg && agora - ultimo < ATUALIZA_TOPO) return;
        var med = O.xr.sessao && O.xr.sessao.medidor && O.xr.sessao.medidor(), rot = med && med.rotulo ? med.rotulo().join('|') : '';
        if (!novaMsg && versao === visto && rot === rotuloVisto) return;
        visto = versao; vistoEnt = versaoEnt; rotuloVisto = rot; ultimo = agora; desenhar();
        if (O.xr.evento) O.xr.evento('log');   // medição dos quadros lentos (desempenho.js)
      },
      visivel: function(v){ mesh.visible = !!v; },
      dispose: function(){ camera.remove(mesh); geo.dispose(); mat.dispose(); tx.dispose(); }
    };
  }

  /* depois que opcoes.js carregou (scripts no fim do body rodam antes do DOMContentLoaded) */
  document.addEventListener('DOMContentLoaded', function(){
    if (!window.isSecureContext) registrar('aviso', 'página fora de contexto seguro: sem WebXR (use https:// ou http://localhost)');
    else if (!navigator.xr) registrar('aviso', 'navigator.xr ausente: este navegador não expõe WebXR');
    if (lerLigado()) ligar(true, true);   // só mostra: com ?vr-teste, salvar aqui gravaria as opções da URL
  });

  O.xr.log = {
    entradas: function(){ return entradas.slice(); },
    diagnostico: diagnostico,
    medidas: function(d){ if (d) { ultimaMedida = d; versao++; if (quadro) quadro.marcar(); } },
    versao: function(){ return versao; },
    ligado: lerLigado,
    ligar: ligar,
    criarPainel: criarPainel
  };
})(window.Orvalho);
