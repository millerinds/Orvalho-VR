/* Interação por raio em VR (etapa 4a). Cada mão tem um laser que sai da ponta do braço de gelatina (maos.js).
   - Alvos: os interativos do ambiente (equipamentos com bolha, assentos, pessoas, ligações entre ambientes, elevador).
     O alvo clicável é MAIOR que o visual: vale o ângulo entre o raio e o centro do alvo, até atan(RAIO_ALVO / distância), com
     um mínimo de ANG_MIN (tolerância angular). Alcance máximo ALCANCE (4,5 m), só no pavimento atual, e nunca através de
     parede, vidro ou guarda-corpo (colisao.raio no chão). Se dois alvos servem, vale o mais "centrado".
   - Laser: fino e discreto (curto, translúcido) sem alvo; com alvo, vai até ele, acende e mostra um ponto, um anel e o rótulo
     (pílula Aero virada para a cabeça). Ao entrar num alvo, um tique háptico naquela mão.
   - Gatilho daquela mão executa: assento → sentar; ligação (porta do Lab) → troca de ambiente com véu (a porta do Lab para o
     Hall leva à cabine do elevador, src/xr/elevador.js); elevador → chamar e entrar (src/xr/elevador.js); equipamento e
     pessoa → aviso de que o painel em VR vem na etapa 5 (o painel ainda é DOM, que não aparece no headset).
   - Dentro da cabine do elevador o laser só mira o painel do elevador (os botões acendem em foco); os outros alvos ficam fora.
   - Sentar: véu, a cabeça vai para o assento olhando para a frente dele, a locomoção trava e, na postura "em pé", a vista
     baixa até OLHOS_SENTADO acima do assento. Na postura "sentado", só trava a posição (a vista já é a de quem está sentado).
     Levantar: B curto (ação curta, aoBCurto) ou empurrar o stick esquerdo; vai para a saída do assento, com véu.
   - No modo teste (?vr-teste) o raio fica desligado: gatilho e A são a marca.
   API: O.xr.criarRaio(ctx) → { passo(dt, amb, st, raio), estado(), sentado(), dispose() }
   ctx: { rig, maos, botoes, veu, aviso, loc, sessaoXR, teste, cena, camera, elevador } */
(function(O){
  O.xr = O.xr || {};
  var ALCANCE = 4.5, ANG_MIN = 3 * Math.PI / 180, LASER_CURTO = 0.18, OLHOS_SENTADO = 0.72, ESPERA_LEVANTAR = 0.5;
  var RAIO_ALVO = { equipamento: 0.3, assento: 0.45, pessoa: 0.5, ligacao: 0.45, elevador: 0.4 };
  var AGUA = 0x5fe0ff, FOLHA = 0x71c935;

  O.xr.criarRaio = function(ctx){
    var rig = ctx.rig, maos = ctx.maos, botoes = ctx.botoes, cena = ctx.cena, camera = ctx.camera;
    var descartar = [], LADOS = ['left', 'right'];
    function guarda(o){ descartar.push(o); return o; }
    /* laser: cilindro de 1 m ao longo de −z, escalado no comprimento */
    var geoL = guarda(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8, 1, true)); geoL.rotateX(Math.PI / 2); geoL.translate(0, 0, -0.5);
    var geoP = guarda(new THREE.SphereGeometry(0.018, 12, 8));
    var lasers = {};
    LADOS.forEach(function(lado){
      var mat = guarda(new THREE.MeshBasicMaterial({ color: AGUA, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
      var laser = new THREE.Mesh(geoL, mat); laser.name = 'xr-laser-' + lado; laser.frustumCulled = false; laser.renderOrder = 5;
      var matP = guarda(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      var ponto = new THREE.Mesh(geoP, matP); ponto.name = 'xr-laser-ponto'; ponto.visible = false;
      maos.grupo(lado).add(laser); cena.add(ponto);
      lasers[lado] = { laser: laser, mat: mat, ponto: ponto, alvo: null };
    });
    /* anel e rótulo do alvo em foco (um só: o da última mão que achou alvo) */
    var anel = new THREE.Mesh(guarda(new THREE.RingGeometry(0.1, 0.13, 40)), guarda(new THREE.MeshBasicMaterial({ color: FOLHA, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })));
    anel.name = 'xr-alvo-anel'; anel.visible = false; anel.renderOrder = 6; cena.add(anel);
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
    var g = cv.getContext('2d'), txR = guarda(new THREE.CanvasTexture(cv)); txR.encoding = THREE.sRGBEncoding; txR.generateMipmaps = false; txR.minFilter = THREE.LinearFilter;
    var rotulo = new THREE.Mesh(guarda(new THREE.PlaneGeometry(0.34, 0.34 * 112 / 512)), guarda(new THREE.MeshBasicMaterial({ map: txR, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })));
    rotulo.name = 'xr-alvo-rotulo'; rotulo.visible = false; rotulo.renderOrder = 1001; cena.add(rotulo);
    var textoRotulo = '';
    function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function desenharRotulo(t){
      if (t === textoRotulo) return; textoRotulo = t;
      g.clearRect(0, 0, 512, 112);
      rr(10, 10, 496, 96, 44); g.fillStyle = '#2b6b0d'; g.fill();
      rr(4, 4, 496, 96, 44); var bg = g.createLinearGradient(0, 4, 0, 100); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#e6f8d4');
      g.fillStyle = bg; g.fill(); g.lineWidth = 5; g.strokeStyle = '#2b6b0d'; g.stroke();
      rr(16, 8, 472, 40, 30); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
      g.fillStyle = '#0c2c4a'; g.font = '800 38px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var s = t; while (s.length > 3 && g.measureText(s).width > 450) s = s.slice(0, -2) + '…';
      g.fillText(s, 254, 54); txR.needsUpdate = true;
    }

    /* alvos do ambiente atual */
    var v3 = new THREE.Vector3(), cab = new THREE.Vector3();
    function tipoDe(it){ return it.assento ? 'assento' : it.npc ? 'pessoa' : it.acao && it.acao.ambiente ? 'ligacao' : it.acao && it.acao.elevador ? 'elevador' : 'equipamento'; }
    function centroDe(it, out){
      var t = tipoDe(it);
      if (t === 'assento') { var a = it.assento; return out.set(a.x, (a.y || 0) + a.altura + 0.15, a.z); }
      if (t === 'pessoa' && it.alvo) return out.set(it.alvo[0], it.alvo[1] - 0.25, it.alvo[2]);
      if (it._mesh) return it._mesh.getWorldPosition(out);
      return out.set(it.x, it.y + 0.24, it.z);
    }
    function viaElevador(it){ return !!(ctx.elevador && it.acao && it.acao.ambiente === 'hall-inovale' && O.ambientes.lista['hall-inovale'] && O.ambientes.lista['hall-inovale'].elevador); }
    function rotuloDe(it){
      if (it.painel) return it.rotulo;
      if (viaElevador(it)) return 'Ir ao elevador';
      if (it.acao && it.acao.elevador && ctx.elevador) return ctx.elevador.rotulo(it);
      if (it.acao && it.acao.ambiente) { var d = O.ambientes.lista[it.acao.ambiente]; return 'Ir para ' + (d ? d.nome.replace('Laboratório', 'Lab') : it.acao.ambiente); }
      return it.rotulo || 'Interagir';
    }
    function procurar(amb, st, p){
      var lista = amb.interativos || [], melhor = null, ms = Infinity;
      for (var i = 0; i < lista.length; i++) {
        var it = lista[i], piso = it.piso != null ? it.piso : (it.y > 3 ? 4.2 : 0);
        if (Math.abs(piso - st.y) > 1.15) continue;
        if (it._mesh && it._mesh.parent && !it._mesh.visible && !it.assento) continue;   // marcador oculto (outro pavimento, zona)
        centroDe(it, v3); var dx = v3.x - p.pos.x, dy = v3.y - p.pos.y, dz = v3.z - p.pos.z, d = Math.hypot(dx, dy, dz);
        if (d > ALCANCE || d < 0.05) continue;
        var cosA = (dx * p.dir.x + dy * p.dir.y + dz * p.dir.z) / d; if (cosA <= 0) continue;
        var ang = Math.acos(Math.min(1, cosA)), tol = Math.max(ANG_MIN, Math.atan(RAIO_ALVO[tipoDe(it)] / d));
        if (ang > tol) continue;
        /* parede, vidro ou guarda-corpo entre a mão e o alvo? Para pessoas, até o ponto de atendimento à frente delas (a Keila
           fica atrás do balcão, que barra a câmera e contaria como obstáculo) */
        var ox = it.npc ? it.x - p.pos.x : dx, oz = it.npc ? it.z - p.pos.z : dz, dxz = Math.hypot(ox, oz);
        if (dxz > 0.4 && amb.colisao.raio(p.pos.x, p.pos.z, ox / dxz, oz / dxz, st.y) < dxz - 0.35) continue;
        var s = ang / tol; if (s < ms) { ms = s; melhor = { it: it, d: d, x: v3.x, y: v3.y, z: v3.z }; }
      }
      return melhor;
    }

    /* sentar e levantar */
    var sentadoEm = null, tSentado = 0, tirarB = null;
    function sentar(a, amb, st){
      ctx.veu.cobrir(0.25, function(){
        if (sentadoEm) rig.assento(0);
        sentadoEm = a; tSentado = 0;
        st.x = a.x; st.z = a.z; var h = amb.alturaPiso ? amb.alturaPiso(a.x, a.z, st.y) : 0; if (h != null) st.y = h;
        st.rumo = a.rumo; rig.centrar(); rig.fixar(true); ctx.loc.travar(true);
        var op = O.xr.opcoes.ler();
        if (op.postura !== 'sentado') rig.assento(Math.min(0, (a.altura + OLHOS_SENTADO) - rig.olhosNoRig()));
        if (!tirarB) tirarB = O.xr.sessao.aoBCurto(function(){ if (!sentadoEm) return false; levantar(amb, st); return true; });
        console.info('[Orvalho VR] sentado em ' + (a.id || 'assento') + (op.postura === 'sentado' ? ' (postura sentado: só trava a posição)' : ''));
      });
    }
    function levantar(amb, st){
      var a = sentadoEm; if (!a) return;
      sentadoEm = null;
      ctx.veu.cobrir(0.25, function(){
        rig.assento(0); rig.fixar(false); ctx.loc.travar(false);
        var p = { x: a.saida.x, z: a.saida.z }; amb.colisao.resolver(p, ctx.raioCorpo(), st.y);
        st.x = p.x; st.z = p.z; st.rumo = Math.atan2(a.saida.x - a.x, a.saida.z - a.z); rig.centrar();
        if (tirarB) { tirarB(); tirarB = null; }
        console.info('[Orvalho VR] levantou');
      });
    }
    function trocarAmbiente(id){
      ctx.veu.cobrir(0.35, function(){
        if (sentadoEm) { sentadoEm = null; rig.assento(0); rig.fixar(false); ctx.loc.travar(false); if (tirarB) { tirarB(); tirarB = null; } }
        if (O.jogo.vr.irPara(id)) rig.centrar();
      });
    }
    function executar(alvo, amb, st, lado){
      var it = alvo.it, t = tipoDe(it);
      botoes.vibrar(lado, 0.6, 50);
      if (t === 'assento') return sentar(it.assento, amb, st);
      if (t === 'ligacao') return viaElevador(it) ? ctx.elevador.doLab() : trocarAmbiente(it.acao.ambiente);
      if (t === 'elevador' && ctx.elevador) return ctx.elevador.acionar(it);
      var msg = t === 'pessoa' ? 'CONVERSA EM VR: NA ETAPA 5' : t === 'elevador' ? 'ELEVADOR EM VR: NA ETAPA 5' : 'PAINEL EM VR: NA ETAPA 5';
      if (ctx.aviso) ctx.aviso.mostrar(msg, 2);
      console.info('[Orvalho VR] gatilho em "' + rotuloDe(it) + '": ' + msg.toLowerCase());
    }

    var focoLado = null;
    return {
      passo: function(dt, amb, st){
        if (sentadoEm) {   // empurrar o stick esquerdo levanta (depois de um instante, para não levantar com o stick ainda inclinado)
          tSentado += dt; var e = botoes.eixos('left');
          if (tSentado > ESPERA_LEVANTAR && Math.hypot(e.x, e.y) > 0.6) levantar(amb, st);
        }
        var algum = null, cabine = !!(ctx.elevador && ctx.elevador.dentro()), focoPainel = null;
        LADOS.forEach(function(lado){
          var L = lasers[lado], p = maos.ponta(lado);
          if (ctx.teste || !p.ok) { L.laser.visible = false; L.ponto.visible = false; L.alvo = null; return; }
          L.laser.visible = true;
          if (cabine) {   // na cabine: só o painel do elevador
            var h = ctx.elevador.testar(p), alvoP = h && h.botao != null ? { it: { id: 'painel-' + h.botao, painel: true, botao: h.botao, rotulo: h.rotulo }, d: h.d, x: h.x, y: h.y, z: h.z } : null;
            if (alvoP && (!L.alvo || L.alvo.it.id !== alvoP.it.id)) { botoes.vibrar(lado, 0.25, 20); focoLado = lado; }
            L.alvo = alvoP;
            L.laser.scale.set(1, 1, h ? h.d : LASER_CURTO);
            L.mat.opacity = alvoP ? 0.85 : 0.35; L.mat.color.setHex(alvoP ? FOLHA : AGUA);
            L.ponto.visible = !!h; if (h) L.ponto.position.set(h.x, h.y, h.z);
            if (alvoP && (focoPainel === null || lado === focoLado)) focoPainel = alvoP.it.botao;
            if (alvoP && botoes.botao(lado, 'gatilho').apertou) { botoes.vibrar(lado, 0.6, 50); ctx.elevador.escolher(alvoP.it.botao); }
            return;
          }
          var alvo = procurar(amb, st, p);
          if (alvo && (!L.alvo || L.alvo.it !== alvo.it)) { botoes.vibrar(lado, 0.25, 20); focoLado = lado; }
          L.alvo = alvo;
          L.laser.scale.set(1, 1, alvo ? alvo.d : LASER_CURTO);
          L.mat.opacity = alvo ? 0.85 : 0.35; L.mat.color.setHex(alvo ? FOLHA : AGUA);
          L.ponto.visible = !!alvo; if (alvo) L.ponto.position.set(alvo.x, alvo.y, alvo.z);
          if (alvo && (!algum || lado === focoLado)) algum = alvo;
          if (alvo && botoes.botao(lado, 'gatilho').apertou) executar(alvo, amb, st, lado);
        });
        if (ctx.elevador) ctx.elevador.focar(focoPainel);
        anel.visible = rotulo.visible = !!algum;
        if (algum) {
          camera.getWorldPosition(cab);
          var r = RAIO_ALVO[tipoDe(algum.it)] * 0.6;
          anel.position.set(algum.x, algum.y, algum.z); anel.scale.setScalar(r / 0.13); anel.lookAt(cab);
          rotulo.position.set(algum.x, algum.y + r + 0.12, algum.z); rotulo.lookAt(cab);
          desenharRotulo(rotuloDe(algum.it));
        }
      },
      estado: function(){
        var f = function(l){ var a = lasers[l].alvo; return a ? { id: a.it.id, tipo: a.it.painel ? 'painel' : tipoDe(a.it), rotulo: rotuloDe(a.it), d: +a.d.toFixed(2) } : null; };
        return { esquerda: f('left'), direita: f('right'), sentado: sentadoEm ? (sentadoEm.id || true) : null, rotulo: rotulo.visible ? textoRotulo : '' };
      },
      sentado: function(){ return sentadoEm; },
      dispose: function(){
        LADOS.forEach(function(l){ var L = lasers[l]; if (L.laser.parent) L.laser.parent.remove(L.laser); cena.remove(L.ponto); });
        cena.remove(anel); cena.remove(rotulo); descartar.forEach(function(o){ o.dispose(); });
        if (sentadoEm) { rig.assento(0); rig.fixar(false); ctx.loc.travar(false); }
        if (tirarB) { tirarB(); tirarB = null; }
      }
    };
  };
})(window.Orvalho);
