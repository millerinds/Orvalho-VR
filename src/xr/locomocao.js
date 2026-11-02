/* Locomoção em VR (etapa 2). Roda a cada quadro, antes de rig.passo: move e gira o rig; a colisão da cabeça (rig.js), a
   mesma do andar físico, decide o que vale (paredes, vidros, guarda-corpos, vazio, escada com cota).
   Controles (mapeamento aprovado):
   - stick esquerdo, modo "suave": anda na direção da cabeça (frente/trás/lados), velocidade proporcional à inclinação, até
     opcoes.vel (1,5 m/s). Clique do stick enquanto empurra: corre (opcoes.velCorrer, 2,5 m/s) até o stick voltar ao centro.
   - stick esquerdo, modo "teleporte": empurrar para a frente mostra o arco (da mão esquerda); soltar teleporta, se o alvo
     for válido (verde). Válido = chão do mesmo pavimento ou da escada (até 1 m acima ou abaixo da cota atual), com folga
     para o corpo e sem parede, vidro, guarda-corpo ou pilar no caminho do arco. Inválido = coral, e soltar não faz nada.
   - stick direito: giro por passos (opcoes.giroPasso, 30°; repete só depois de voltar ao centro) ou suave (giroVel, 90°/s),
     sempre em torno da cabeça.
   - A: pulo (só do chão; ~0,42 m; o topo da cabeça não passa do forro nem de 2,10 m acima do piso, a altura das portas).
     No modo teste, A é a marca e o pulo fica desligado. opcoes.pulo = false desliga.
   - Atalhos até existir o painel de opções: Y alterna suave/teleporte; clique do stick direito alterna giro por passos/suave;
     X alterna a vinheta desligada → fraca → forte (o X do mapeamento aprovado é "Fechar", que em VR ainda não tem uso).
     Salvos em orvalho-vr (no modo teste, só nesta carga).
   - Vinheta de conforto (opcoes.vinheta 0/1/2): escurece a periferia enquanto anda, gira suave ou pula. No giro por passos e
     parado, some (não desenha nada).
   - Postura "sentado": eleva a vista até OLHOS_SENTADO acima do piso, medindo a cabeça rastreada ~1 s depois de entrar e a
     cada recentralização do sistema (segurar o botão Meta). "Em pé" usa a altura real.
   API: O.xr.criarLocomocao(ctx) → { passo(dt, amb, st, raio), medirPostura(), reler(), travar(v), opcoes(), estado(), dispose() }
   ctx: { renderer, camera, rig, botoes, veu, aviso, teste: bool } */
(function(O){
  O.xr = O.xr || {};
  var MORTA = 0.15, GIRO_LIGA = 0.7, GIRO_REARMA = 0.3, MIRA_LIGA = 0.6, MIRA_SOLTA = 0.3;
  var GRAV = 15, PULO = 0.42, VPULO = Math.sqrt(2 * GRAV * PULO), PORTA = 2.10, TOPO_CABECA = 0.11;
  var OLHOS_SENTADO = 1.60, TELE_V0 = 8, TELE_G = 9.8, TELE_PASSO = 0.03, TELE_N = 70, TELE_DESNIVEL = 1.0;
  var VERDE = 0x71c935, CORAL = 0xff8a5b, AGUA = 0x5fe0ff;

  O.xr.criarLocomocao = function(ctx){
    var rig = ctx.rig, camera = ctx.camera, botoes = ctx.botoes, renderer = ctx.renderer;
    var op = O.xr.opcoes.ler();
    var correndo = false, giroArmado = true, velAtual = 0, giroAtivo = 0, travado = false;   // travado: sentado num assento (raio.js)
    var pulo = { fase: 0, jy: 0, vy: 0 };
    var postura = { medirEm: 1.0, amostras: [], elev: 0 };
    var mira = { ativa: false, valida: false, x: 0, y: 0, z: 0, pts: [] };
    var descartar = [];
    function guarda(o){ descartar.push(o); return o; }

    /* ---------- vinheta: plano grande preso à vista, transparente no centro ---------- */
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); gr.addColorStop(0.31, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');   // preta (02/11)
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    var txV = guarda(new THREE.CanvasTexture(cv)); txV.generateMipmaps = false; txV.minFilter = THREE.LinearFilter;
    var matV = guarda(new THREE.MeshBasicMaterial({ map: txV, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
    /* 2,4 m a 0,3 m da vista: cobre ±76°. Fraca: claro até ~30° e escuro a partir de ~50°; forte: escala 0,63 (~20° / ~37°) */
    var vinheta = new THREE.Mesh(guarda(new THREE.PlaneGeometry(2.4, 2.4)), matV);
    vinheta.name = 'xr-vinheta'; vinheta.position.z = -0.3; vinheta.renderOrder = 990; vinheta.frustumCulled = false; vinheta.visible = false;
    camera.add(vinheta);

    /* ---------- teleporte: bolinhas do arco (1 draw) e alvo no chão ---------- */
    var matPt = guarda(new THREE.MeshBasicMaterial({ color: AGUA, transparent: true, opacity: 0.9, toneMapped: false }));
    var pontos = new THREE.InstancedMesh(guarda(new THREE.SphereGeometry(0.02, 8, 6)), matPt, TELE_N);
    pontos.name = 'xr-arco'; pontos.frustumCulled = false; pontos.visible = false; pontos.count = 0;
    var matAlvo = guarda(new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    var matMiolo = guarda(new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    var alvo = new THREE.Group(); alvo.name = 'xr-alvo'; alvo.visible = false;
    var anelA = new THREE.Mesh(guarda(new THREE.RingGeometry(0.24, 0.31, 40)), matAlvo); anelA.rotation.x = -Math.PI / 2;
    var miolo = new THREE.Mesh(guarda(new THREE.CircleGeometry(0.24, 40)), matMiolo); miolo.rotation.x = -Math.PI / 2;
    alvo.add(anelA, miolo);
    var cena = rig.rig.parent; cena.add(pontos); cena.add(alvo);
    var mtx = new THREE.Matrix4(), mPose = new THREE.Matrix4(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(), q3 = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1);

    function aviso(t){ if (ctx.aviso) ctx.aviso.mostrar(t, 1.6); }
    function textoGiro(){ return op.giroTipo === 'suave' ? 'GIRO: SUAVE' : 'GIRO: POR PASSOS ' + op.giroPasso + '°'; }
    function textoVinheta(){ return 'VINHETA: ' + ['DESLIGADA', 'FRACA', 'FORTE'][op.vinheta]; }
    function textoMov(){ return op.mov === 'teleporte' ? 'MOVIMENTO: TELEPORTE' : 'MOVIMENTO: ANDAR SUAVE'; }
    function alterar(p, texto){ op = O.xr.opcoes.alterar(p); aviso(texto()); botoes.vibrar(null, 0.3, 40); console.info('[Orvalho VR] ' + texto().toLowerCase()); }

    /* ---------- pose da mão (targetRaySpace) no mundo ---------- */
    function poseMao(lado){
      var f = botoes.fonte(lado), frame = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
      if (!f || !frame || !ref || !f.targetRaySpace) return false;
      var pose = frame.getPose(f.targetRaySpace, ref); if (!pose) return false;
      rig.rig.updateMatrixWorld(true);
      mPose.fromArray(pose.transform.matrix);
      mtx.multiplyMatrices(rig.rig.matrixWorld, mPose);
      mtx.decompose(o3, q3, s3);
      d3.set(0, 0, -1).applyQuaternion(q3);
      return true;
    }
    /* arco parabólico da mão esquerda: devolve o alvo (válido ou não) e os pontos do caminho */
    function calcularArco(amb, st, raio){
      mira.pts.length = 0; mira.valida = false;
      if (!poseMao('left')) { mira.alvo = false; return; }
      var x = o3.x, y = o3.y, z = o3.z, vx = d3.x * TELE_V0, vy = d3.y * TELE_V0, vz = d3.z * TELE_V0;
      mira.pts.push(x, y, z);
      for (var i = 1; i < TELE_N; i++) {
        var nx = x + vx * TELE_PASSO, nz = z + vz * TELE_PASSO, ny = y + vy * TELE_PASSO; vy -= TELE_G * TELE_PASSO;
        /* parede, vidro, guarda-corpo ou pilar do pavimento atual no caminho (no chão, em x/z) */
        var hx = nx - x, hz = nz - z, len = Math.hypot(hx, hz);
        if (len > 1e-6) {
          var t = amb.colisao.raio(x, z, hx / len, hz / len, st.y);
          if (t < len) { var k = t / len; mira.pts.push(x + hx * k, y + (ny - y) * k, z + hz * k); fixarAlvo(x + hx * k, null, z + hz * k, false); return; }
        }
        var piso = amb.alturaPiso ? amb.alturaPiso(nx, nz, ny) : 0;
        if (piso != null && ny <= piso) {   // pousou: interpola o ponto do chão
          var a = (y - piso) / Math.max(1e-6, y - ny), px = x + (nx - x) * a, pz = z + (nz - z) * a;
          var py = amb.alturaPiso ? amb.alturaPiso(px, pz, piso) : piso;   // na rampa, o piso do ponto de pouso (não o da amostra)
          if (py == null) py = piso;
          mira.pts.push(px, py, pz);
          /* escada: o alvo gruda na parada (pé, patamar, topo) mais próxima do pouso, menos a parada em que a pessoa já está.
             Assim se desce e sobe em 2 teleportes; o desnível maior que 1 m é aceito porque o caminho pela escada é contínuo. */
          var pe = amb.paradasEscada ? amb.paradasEscada(px, pz) : null;
          if (pe) {
            var melhor = null, md = Infinity;
            pe.forEach(function(q){
              if (Math.hypot(q.x - st.x, q.z - st.z) < 1.0 && Math.abs(q.y - st.y) < 0.5) return;   // já está aqui
              var dq = Math.hypot(q.x - px, q.z - pz); if (dq < md) { md = dq; melhor = q; }
            });
            if (melhor) {
              var hq = amb.alturaPiso(melhor.x, melhor.z, melhor.y), cq = { x: melhor.x, z: melhor.z };
              amb.colisao.resolver(cq, raio, melhor.y);
              mira.escada = melhor.tipo;
              fixarAlvo(melhor.x, melhor.y, melhor.z, hq != null && Math.abs(hq - melhor.y) < 0.05 && Math.hypot(cq.x - melhor.x, cq.z - melhor.z) < 0.05);
              return;
            }
          }
          mira.escada = null;
          var valido = Math.abs(py - st.y) <= TELE_DESNIVEL;
          if (valido) { var c = { x: px, z: pz }; amb.colisao.resolver(c, raio, py); valido = Math.hypot(c.x - px, c.z - pz) < 0.05; }
          fixarAlvo(px, py, pz, valido); return;
        }
        if (piso == null && ny < st.y - 6) break;   // caiu no vazio, longe de qualquer piso
        x = nx; y = ny; z = nz; mira.pts.push(x, y, z);
      }
      fixarAlvo(x, null, z, false); mira.alvo = false;
    }
    function fixarAlvo(x, piso, z, valido){ mira.alvo = piso != null; mira.valida = valido; mira.x = x; mira.y = piso; mira.z = z; }
    var mi = new THREE.Matrix4();
    function desenharArco(){
      var n = Math.min(TELE_N, mira.pts.length / 3);
      for (var i = 0; i < n; i++) { mi.makeTranslation(mira.pts[i * 3], mira.pts[i * 3 + 1], mira.pts[i * 3 + 2]); pontos.setMatrixAt(i, mi); }
      pontos.count = n; pontos.instanceMatrix.needsUpdate = true; pontos.visible = n > 0;
      matPt.color.setHex(mira.valida ? AGUA : CORAL);
      alvo.visible = !!mira.alvo;
      if (mira.alvo) { alvo.position.set(mira.x, mira.y + 0.02, mira.z); matAlvo.color.setHex(mira.valida ? VERDE : CORAL); matMiolo.color.setHex(mira.valida ? VERDE : CORAL); }
    }
    function esconderMira(){ mira.ativa = false; pontos.visible = false; alvo.visible = false; }
    function teleportar(st){
      var x = mira.x, y = mira.y, z = mira.z;
      console.info('[Orvalho VR] teleporte → (' + x.toFixed(2) + ', ' + y.toFixed(2) + ', ' + z.toFixed(2) + ')');
      var ir = function(){ rig.levarCabecaA(x, z); st.x = x; st.z = z; st.y = y; pulo.fase = 0; pulo.jy = 0; pulo.vy = 0; rig.salto(0); };
      if (ctx.veu) ctx.veu.cobrir(0.1, ir); else ir();
    }

    /* ---------- postura ---------- */
    function aplicarPostura(){
      postura.elev = op.postura === 'sentado' && postura.altura ? Math.max(0, OLHOS_SENTADO - postura.altura) : 0;
      rig.elevar(postura.elev);
    }

    return {
      reler: function(){ op = O.xr.opcoes.ler(); aplicarPostura(); },
      travar: function(v){ travado = !!v; },
      opcoes: function(){ return op; },
      /* mede de novo a altura da cabeça para a postura "sentado" (entrada e recentralização) */
      medirPostura: function(){ postura.medirEm = 0.6; postura.amostras = []; },
      passo: function(dt, amb, st, raio){
        /* postura: média da altura rastreada por ~0,4 s, depois de um tempo para a pessoa se acomodar */
        if (postura.medirEm != null && rig.pronto()) {
          postura.medirEm -= dt;
          if (postura.medirEm <= 0) {
            postura.amostras.push(rig.alturaRastreada());
            if (postura.amostras.length >= 24) {
              postura.altura = postura.amostras.reduce(function(a, b){ return a + b; }, 0) / postura.amostras.length;
              postura.medirEm = null; aplicarPostura();
              if (op.postura === 'sentado') console.info('[Orvalho VR] postura sentado: cabeça a ' + postura.altura.toFixed(2) + ' m, vista elevada ' + postura.elev.toFixed(2) + ' m');
            }
          }
        }
        /* atalhos */
        if (botoes.botao('left', 'y').apertou) { alterar({ mov: op.mov === 'teleporte' ? 'suave' : 'teleporte' }, textoMov); esconderMira(); }
        if (botoes.botao('right', 'stick').apertou) alterar({ giroTipo: op.giroTipo === 'suave' ? 'passos' : 'suave' }, textoGiro);
        if (botoes.botao('left', 'x').apertou) alterar({ vinheta: (op.vinheta + 1) % 3 }, textoVinheta);   // desligada → fraca → forte

        /* stick esquerdo (sentado num assento: não anda nem teleporta; o raio.js levanta ao empurrar) */
        var e = botoes.eixos('left'), m = Math.hypot(e.x, e.y);
        velAtual = 0;
        if (travado) { correndo = false; if (mira.ativa) esconderMira(); }
        else if (op.mov === 'suave') {
          if (m < MORTA) correndo = false;
          else {
            if (botoes.botao('left', 'stick').apertou) correndo = true;
            var k = Math.min(1, (m - MORTA) / (1 - MORTA)), v = (correndo ? op.velCorrer : op.vel) * k;
            var a = rig.rumo(), fx = Math.sin(a), fz = Math.cos(a), rx = -Math.cos(a), rz = Math.sin(a);
            var ux = (fx * -e.y + rx * e.x) / m, uz = (fz * -e.y + rz * e.x) / m;
            rig.deslocar(ux * v * dt, uz * v * dt);
            velAtual = v;
          }
        } else {
          correndo = false;
          if (!mira.ativa && -e.y > MIRA_LIGA) mira.ativa = true;
          if (mira.ativa) {
            if (m < MIRA_SOLTA) { var ok = mira.valida && mira.alvo; esconderMira(); if (ok) teleportar(st); }
            else { calcularArco(amb, st, raio); desenharArco(); }
          }
        }

        /* stick direito: giro em torno da cabeça (direita = sentido horário visto de cima) */
        var d = botoes.eixos('right'); giroAtivo = 0;
        if (op.giroTipo === 'suave') {
          if (Math.abs(d.x) > MORTA) { var kg = (Math.abs(d.x) - MORTA) / (1 - MORTA); rig.girar(-Math.sign(d.x) * kg * op.giroVel * Math.PI / 180 * dt); giroAtivo = kg; }
        } else {
          if (giroArmado && Math.abs(d.x) > GIRO_LIGA) { rig.girar(-Math.sign(d.x) * op.giroPasso * Math.PI / 180); giroArmado = false; }
          else if (!giroArmado && Math.abs(d.x) < GIRO_REARMA) giroArmado = true;
        }

        /* pulo (A), só do chão e fora do modo teste */
        if (pulo.fase === 0 && op.pulo && !ctx.teste && !travado && botoes.botao('right', 'a').apertou) {
          var chao = amb.alturaPiso ? amb.alturaPiso(st.x, st.z, st.y) : 0;
          if (chao != null && Math.abs(st.y - chao) < 0.05) { pulo.fase = 2; pulo.vy = VPULO; }
        }
        if (pulo.fase === 2) {
          var teto = Math.min(amb.limites && amb.limites.tetoEm ? amb.limites.tetoEm(st.x, st.z, st.y) : 99, st.y + PORTA);
          var max = Math.max(0, teto - (st.y + rig.olhosNoRig() + TOPO_CABECA));
          pulo.jy += pulo.vy * dt - 0.5 * GRAV * dt * dt; pulo.vy -= GRAV * dt;   // trajetória exata: a mesma altura a 30 ou a 72 fps
          if (pulo.jy > max) { pulo.jy = max; if (pulo.vy > 0) pulo.vy = 0; }
          if (pulo.jy <= 0) { pulo.jy = 0; pulo.vy = 0; pulo.fase = 0; }
          rig.salto(pulo.jy);
        }

        /* vinheta: andar, giro suave e pulo */
        var alvoV = op.vinheta > 0 && (velAtual > 0.05 || giroAtivo > 0.05 || pulo.fase === 2) ? 1 : 0;
        vinheta.scale.setScalar(op.vinheta === 2 ? 0.63 : 1);
        matV.opacity += (alvoV - matV.opacity) * (1 - Math.exp(-dt * (alvoV ? 14 : 7)));
        if (matV.opacity < 0.01 && !alvoV) matV.opacity = 0;
        vinheta.visible = matV.opacity > 0;
      },
      estado: function(){
        return { mov: op.mov, giroTipo: op.giroTipo, giroPasso: op.giroPasso, correndo: correndo, vel: velAtual, vinheta: vinheta.visible ? +matV.opacity.toFixed(2) : 0,
          pulo: { fase: pulo.fase, jy: +pulo.jy.toFixed(3) }, postura: { tipo: op.postura, altura: postura.altura || null, elev: postura.elev },
          mira: { ativa: mira.ativa, alvo: !!mira.alvo, valida: mira.valida, escada: mira.escada || null, x: mira.x, y: mira.y, z: mira.z, pontos: mira.pts.length / 3 } };
      },
      dispose: function(){
        camera.remove(vinheta); if (pontos.parent) pontos.parent.remove(pontos); if (alvo.parent) alvo.parent.remove(alvo);
        pontos.dispose && pontos.dispose(); descartar.forEach(function(x){ x.dispose(); });
        rig.salto(0); rig.elevar(0);
      }
    };
  };
})(window.Orvalho);
