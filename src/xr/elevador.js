/* Elevador em VR: o mesmo elevador do Hall (portas e cabine de O.elevador.criar3D, viagem de O.elevador.viajar), com um painel
   em mundo no lugar do painel DOM (que não aparece no headset).
   Fluxo:
   - fora: o laser no botão de chamada ("Chamar elevador", interativo do Hall) abre as portas daquele pavimento; com as portas
     abertas, o mesmo alvo vira "Entrar no elevador". Sem entrar, as portas fecham sozinhas depois de FECHAR_SOZINHA s.
   - dentro: véu, e a cabeça vai para o centro da cabine, olhando para as portas. A cabine fica fora da colisão do Hall (a parede
     do vão colide inteira), então, como ao sentar, a posição fica travada (rig.fixar + loc.travar); só a cabeça gira e se inclina.
     O painel fica na parede direita da cabine; botões grandes, clicáveis pelo laser (o botão em foco acende).
   - destinos: Térreo, 1º andar e "Lab IA" (sem número de pavimento: a ligação do Lab é provisória). 2 e 3 indisponíveis.
     Entre pavimentos: portas fecham, visor e texto, véu curto, a cabine "chega" e as portas abrem. Sem movimento vertical visível.
     Para o Lab: portas fecham, véu, o Lab é montado e o jogador aparece na chegada do Lab (junto à porta).
   - do Lab: a porta do Lab ("Ir ao elevador") leva para dentro desta cabine, no térreo, com as portas fechadas e o visor em "Lab".
   - sair: botão "Sair da cabine", B curto ou empurrar o stick esquerdo (com as portas abertas): véu e o jogador fica diante das
     portas (O.jogo.vr.saidaElevador, a mesma saída do desktop); as portas fecham logo depois.
   - nunca fica preso: o ponto salvo e a saída do VR usam a saída diante das portas (pontoSeguro, dispose).
   API: O.xr.criarElevadorVR(ctx) → { rotulo(it), acionar(it), doLab(), dentro(), testar(p), focar(botao), escolher(botao),
        passo(dt), estado(), pontoSeguro(), dispose() }
   ctx: { rig, loc, veu, aviso, cena, camera } */
(function(O){
  O.xr = O.xr || {};
  var FECHAR_SOZINHA = 12, ESPERA_STICK = 0.6;
  var CW = 512, CH = 660, PW = 0.42, PH = PW * CH / CW;          // painel: canvas em px e tamanho no mundo (m)
  /* botões do painel (px no canvas) */
  var BOTOES = [
    { id: 0, x: 36, y: 176, w: 440, h: 80, sigla: 'T', txt: 'Térreo' },
    { id: 1, x: 36, y: 268, w: 440, h: 80, sigla: '1', txt: '1º andar' },
    { id: 'lab', x: 36, y: 360, w: 440, h: 80, sigla: 'IA', txt: 'Lab IA' },
    { id: 'p2', x: 36, y: 452, w: 214, h: 62, sigla: '2', txt: 'Indisponível', off: true },
    { id: 'p3', x: 262, y: 452, w: 214, h: 62, sigla: '3', txt: 'Indisponível', off: true },
    { id: 'sair', x: 36, y: 540, w: 440, h: 80, sigla: '⟵', txt: 'Sair da cabine' }
  ];

  O.xr.criarElevadorVR = function(ctx){
    var rig = ctx.rig, loc = ctx.loc, veu = ctx.veu;
    var est = 'fora', piso = 0, chamado = null, tChamado = 0, tDentro = 0, viagem = [], fecharDepois = 0, tirarB = null;
    var texto = '', visorPiso = 0, visorSentido = '', foco = null, sujo = true;

    /* painel */
    var cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    var g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter;
    var geo = new THREE.PlaneGeometry(PW, PH), mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, toneMapped: false });
    var painel = new THREE.Mesh(geo, mat); painel.name = 'xr-elevador-painel'; painel.visible = false; painel.renderOrder = 4;
    painel.rotation.y = -Math.PI / 2;                          // de frente para −x: parede direita de quem olha as portas
    ctx.cena.add(painel);

    function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function fonte(px){ return '800 ' + px + 'px Nunito, "Arial Rounded MT Bold", sans-serif'; }
    function desenhar(){
      sujo = false;
      g.clearRect(0, 0, CW, CH);
      /* placa: borda grossa, sombra dura e brilho de gota (como o rótulo do laser) */
      rr(14, 14, CW - 20, CH - 20, 40); g.fillStyle = '#0d3b5c'; g.fill();
      rr(6, 6, CW - 20, CH - 20, 40); var bg = g.createLinearGradient(0, 6, 0, CH); bg.addColorStop(0, '#f4fdff'); bg.addColorStop(1, '#cfeefc');
      g.fillStyle = bg; g.fill(); g.lineWidth = 6; g.strokeStyle = '#0d3b5c'; g.stroke();
      rr(22, 12, CW - 52, 50, 26); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#0c2c4a'; g.font = fonte(40); g.fillText('ELEVADOR', 40, 62);
      /* visor */
      rr(330, 30, 146, 80, 18); g.fillStyle = '#0b1e2e'; g.fill();
      g.fillStyle = '#5ff0ff'; g.textAlign = 'center'; g.font = fonte(visorPiso === 'lab' ? 38 : 52);
      g.fillText(visorPiso === 'lab' ? 'Lab' : visorPiso ? '1' : 'T', visorSentido ? 380 : 403, 72);
      if (visorSentido) { g.font = fonte(34); g.fillText(visorSentido === 'sobe' ? '▲' : '▼', 446, 72); }
      g.textAlign = 'left'; g.fillStyle = '#1f4d6e'; g.font = fonte(26);
      var s = texto; while (s.length > 3 && g.measureText(s).width > 440) s = s.slice(0, -2) + '…';
      g.fillText(s, 40, 140);
      var travado = est !== 'dentro';
      BOTOES.forEach(function(b){
        var atual = b.id === piso, off = b.off || (travado && b.id !== 'sair') || (est === 'viagem'), f = foco === b.id && !off && !atual;
        rr(b.x + 6, b.y + 6, b.w, b.h, 30); g.fillStyle = off ? 'rgba(60,80,95,.35)' : '#2b6b0d'; g.fill();
        rr(b.x, b.y, b.w, b.h, 30);
        var bb = g.createLinearGradient(0, b.y, 0, b.y + b.h);
        if (off && !atual) { bb.addColorStop(0, '#e7edf1'); bb.addColorStop(1, '#c9d3da'); }
        else if (atual) { bb.addColorStop(0, '#ffffff'); bb.addColorStop(1, '#bff6ff'); }
        else if (f) { bb.addColorStop(0, '#f2ffe0'); bb.addColorStop(1, '#8fe04f'); }
        else { bb.addColorStop(0, '#ffffff'); bb.addColorStop(1, '#e6f8d4'); }
        g.fillStyle = bb; g.fill(); g.lineWidth = f ? 9 : 5; g.strokeStyle = off && !atual ? '#8a9aa6' : atual ? '#1592b5' : '#2b6b0d'; g.stroke();
        rr(b.x + 10, b.y + 5, b.w - 20, b.h * 0.38, 20); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
        var cor = off && !atual ? '#7b8b97' : '#0c2c4a';
        var grande = b.h > 70, xs = b.x + (grande ? 44 : 34), xt = b.x + (grande ? 88 : 62), maxW = b.x + b.w - 18 - xt;
        g.fillStyle = cor; g.textAlign = 'center'; g.font = fonte(grande ? 40 : 30); g.fillText(b.sigla, xs, b.y + b.h / 2 + 2);
        g.textAlign = 'left';
        var tam = grande ? 36 : 24; g.font = fonte(tam);
        while (tam > 16 && g.measureText(b.txt).width > maxW) { tam -= 2; g.font = fonte(tam); }
        g.fillText(b.txt, xt, b.y + b.h / 2 + 2);
        if (atual) {   // marca discreta à direita do nome
          var w0 = g.measureText(b.txt).width; g.font = fonte(22); g.fillStyle = '#1592b5';
          if (xt + w0 + 14 + g.measureText('você está aqui').width <= b.x + b.w - 18) g.fillText('você está aqui', xt + w0 + 14, b.y + b.h / 2 + 3);
        }
      });
      tx.needsUpdate = true;
    }

    function amb(){ var c = O.jogo.vr.contexto(); return c ? c.amb : null; }
    function st(){ return O.jogo.vr.contexto().st; }
    function el(){ var a = amb(); return a && a.elevador; }
    function parada(p){ var a = amb(), ps = a && a.def.elevador ? a.def.elevador.paradas : []; for (var i = 0; i < ps.length; i++) if (ps[i].piso === p) return ps[i]; return null; }
    function cfg(){ return amb().def.elevador; }
    /* centro da cabine de um pavimento e o lugar do painel */
    function centro(p){ var pa = parada(p), c = cfg(); return { x: c.x, y: pa.y, z: pa.z + 0.11 + (c.fundo || 1.4) / 2 }; }
    function porPainel(p){
      var pa = parada(p), c = cfg(), w = c.largura || 1.1;
      painel.position.set(c.x + w / 2 + 0.105, pa.y + 1.28, pa.z + 0.11 + (c.fundo || 1.4) * 0.55);
      painel.updateMatrixWorld(true);
    }
    function pisoNum(){ return typeof piso === 'number' ? piso : 0; }
    function limparViagem(){ viagem.forEach(clearTimeout); viagem = []; }
    function aviso(t){ if (ctx.aviso) ctx.aviso.mostrar(t, 1.6); }
    function hud(t){ texto = t; sujo = true; }

    /* põe a cabeça no centro da cabine do pavimento p, olhando para as portas */
    function colocarNaCabine(p){
      var c = centro(p), s = st();
      s.x = c.x; s.y = c.y; s.z = c.z; s.rumo = Math.PI;
      rig.assento(0); rig.fixar(true); loc.travar(true); rig.centrar();
      porPainel(p); painel.visible = true; tDentro = 0;
      if (!tirarB) tirarB = O.xr.sessao.aoBCurto(function(){ if (est !== 'dentro') return est === 'viagem'; sairCabine(); return true; });
    }
    function soltar(){
      rig.fixar(false); loc.travar(false); painel.visible = false; foco = null;
      if (tirarB) { tirarB(); tirarB = null; }
    }
    function entrar(p){
      est = 'entrando'; chamado = null;
      veu.cobrir(0.3, function(){
        colocarNaCabine(p); piso = p; est = 'dentro'; visorPiso = p; visorSentido = ''; hud('Escolha o destino.');
        console.info('[Orvalho VR] elevador: entrou na cabine (' + O.elevador.nome(p) + ')');
      });
    }
    function sairCabine(){
      if (est !== 'dentro') return;
      est = 'saindo';
      veu.cobrir(0.3, function(){
        if (piso === 'lab') { var e0 = el(); if (e0) e0.porta(0, true); }   // vindo do Lab sem escolher: sai pelo térreo
        var p = pisoNum(), sd = O.jogo.vr.saidaElevador(p), s = st();
        soltar();
        s.x = sd.x; s.y = sd.y; s.z = sd.z; s.rumo = sd.rumo; rig.centrar();
        est = 'fora'; piso = p;
        clearTimeout(fecharDepois);
        fecharDepois = setTimeout(function(){ var e = el(); if (e && est === 'fora' && chamado === null) e.porta(p, false); }, 1800);
        console.info('[Orvalho VR] elevador: saiu da cabine (' + O.elevador.nome(p) + ')');
      });
    }
    function viajar(destino){
      if (est !== 'dentro' || destino === piso) return;
      est = 'viagem'; limparViagem(); var de = piso;
      console.info('[Orvalho VR] elevador: ' + O.elevador.nome(de) + ' → ' + O.elevador.nome(destino));
      viagem = O.elevador.viajar(de, destino, {
        portas: function(p, aberta){ var e = el(); if (e && typeof p === 'number') e.porta(p, aberta); },
        texto: hud,
        visor: function(p, sentido){ visorPiso = p; visorSentido = sentido; sujo = true; },
        mover: function(p){
          if (p === 'lab') {
            veu.cobrir(0.4, function(){
              limparViagem(); soltar(); est = 'fora'; piso = 0; chamado = null;
              if (O.jogo.vr.irPara('lab-ia')) rig.centrar();
            });
            return;
          }
          if (de === 'lab' && p === 0) { piso = 0; return; }       // vindo do Lab a cabine já está no térreo: só abre
          veu.cobrir(0.25, function(){
            var a = centro(p), s = st();
            rig.deslocar(a.x - s.x, a.z - s.z);                      // mantém a direção do olhar (sem recentralizar)
            s.x = a.x; s.y = a.y; s.z = a.z; piso = p; porPainel(p);
          });
        },
        fim: function(){ if (est === 'viagem') { est = 'dentro'; tDentro = 0; hud('Portas abertas. Saia ou escolha outro destino.'); } }
      });
    }

    return {
      /* rótulo do botão de chamada (interativo do Hall): muda quando as portas daquele pavimento estão abertas */
      rotulo: function(it){ var p = (it.piso || 0) > 3 ? 1 : 0; return est === 'fora' && chamado === p ? 'Entrar no elevador' : 'Chamar elevador'; },
      acionar: function(it){
        var e = el(); if (!e || est !== 'fora') return;
        var p = (it.piso || 0) > 3 ? 1 : 0;
        if (chamado === p) return entrar(p);
        clearTimeout(fecharDepois);
        if (chamado !== null) e.porta(chamado, false);
        e.porta(p, true); chamado = p; tChamado = 0;
        aviso('PORTAS ABRINDO');
        console.info('[Orvalho VR] elevador: chamado no ' + O.elevador.nome(p));
      },
      /* a porta do Lab leva à cabine, no térreo, com as portas fechadas */
      doLab: function(){
        if (est !== 'fora') return;
        est = 'entrando';
        veu.cobrir(0.4, function(){
          if (!O.jogo.vr.irPara('hall-inovale') && (!amb() || amb().def.id !== 'hall-inovale')) { est = 'fora'; return; }
          var e = el(); if (e) { e.porta(0, false); e.porta(1, false); }
          colocarNaCabine(0); piso = 'lab'; est = 'dentro'; chamado = null; visorPiso = 'lab'; visorSentido = '';
          hud('Escolha o destino.');
          console.info('[Orvalho VR] elevador: do Lab para a cabine');
        });
      },
      dentro: function(){ return est !== 'fora'; },
      /* raio da mão p ({ pos, dir }) contra o painel: { d, x, y, z, botao } ou null */
      testar: function(p){
        if (!painel.visible || est === 'entrando' || est === 'saindo') return null;
        var px = painel.position.x;                               // plano x = px, de frente para −x
        if (p.dir.x <= 1e-4) return null;
        var t = (px - p.pos.x) / p.dir.x; if (t <= 0 || t > 3) return null;
        var hx = p.pos.x + p.dir.x * t, hy = p.pos.y + p.dir.y * t, hz = p.pos.z + p.dir.z * t;
        var u = (hz - painel.position.z) / PW + 0.5, v = 0.5 - (hy - painel.position.y) / PH;
        if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return null;
        var cx = u * CW, cy = v * CH, MARGEM = 8, b = null;
        BOTOES.forEach(function(q){ if (cx >= q.x - MARGEM && cx <= q.x + q.w + MARGEM && cy >= q.y - MARGEM && cy <= q.y + q.h + MARGEM) b = q; });
        return { d: t, x: hx, y: hy, z: hz, botao: b ? b.id : null, rotulo: b ? b.txt : '' };
      },
      focar: function(b){ if (b !== foco) { foco = b; sujo = true; } },
      escolher: function(b){
        if (b === 'sair') return sairCabine();
        if (b === 0 || b === 1 || b === 'lab') {
          if (est === 'dentro' && b !== piso) return viajar(b);
          return;
        }
        if (b === 'p2' || b === 'p3') aviso('ANDAR INDISPONÍVEL');
      },
      passo: function(dt){
        if (est === 'fora' && chamado !== null) {
          tChamado += dt;
          if (tChamado > FECHAR_SOZINHA) { var e = el(); if (e) e.porta(chamado, false); chamado = null; }
        }
        if (est === 'dentro') {
          tDentro += dt;
          var ex = ctx.botoes ? ctx.botoes.eixos('left') : { x: 0, y: 0 }, e2 = el();
          var aberta = typeof piso === 'number' && e2 && e2.aberta(piso) > 0.9;
          if (aberta && tDentro > ESPERA_STICK && Math.hypot(ex.x, ex.y) > 0.6) sairCabine();
        }
        if (sujo && painel.visible) desenhar();
      },
      /* para testes: centro de um botão no mundo */
      centroBotao: function(id){
        var b = BOTOES.filter(function(q){ return q.id === id; })[0]; if (!b) return null;
        var u = (b.x + b.w / 2) / CW, v = (b.y + b.h / 2) / CH;
        return [painel.position.x, painel.position.y - (v - 0.5) * PH, painel.position.z + (u - 0.5) * PW];
      },
      estado: function(){ return { est: est, piso: piso, chamado: chamado, foco: foco, texto: texto, visor: visorPiso, painel: painel.visible }; },
      /* onde salvar o jogador: dentro da cabine, o lugar diante das portas */
      pontoSeguro: function(){ if (est === 'fora' || !amb() || amb().def.id !== 'hall-inovale') return null; return O.jogo.vr.saidaElevador(pisoNum()); },
      dispose: function(){
        limparViagem(); clearTimeout(fecharDepois);
        if (est !== 'fora' && amb() && amb().def.id === 'hall-inovale') {   // sair do VR dentro da cabine: volta para diante das portas
          var sd = O.jogo.vr.saidaElevador(pisoNum()), s = st(); s.x = sd.x; s.y = sd.y; s.z = sd.z; s.rumo = sd.rumo;
          var e = el(); if (e) e.porta(pisoNum(), false);
        }
        soltar(); est = 'fora';
        ctx.cena.remove(painel); geo.dispose(); mat.dispose(); tx.dispose();
      }
    };
  };
})(window.Orvalho);
