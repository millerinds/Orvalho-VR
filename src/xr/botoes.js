/* Botões dos controles em VR (mapeamento xr-standard do WebXR, o do Quest Touch):
     0 gatilho · 1 grip · 3 clique do thumbstick · 4 A (direito) / X (esquerdo) · 5 B (direito) / Y (esquerdo).
   ler() uma vez por quadro guarda o estado; botao(lado, nome) devolve { pressionado, apertou, soltou, seg, segAoSoltar } daquele
   quadro (apertou/soltou = borda; seg = há quanto tempo está apertado; segAoSoltar = quanto tempo ficou apertado, no quadro em
   que soltou). Um botão que já estava apertado quando a leitura começou
   não conta como "apertou" até ser solto e apertado de novo.
   vibrar(lado, força 0–1, ms): pulso háptico (gamepad.hapticActuators[0].pulse, que o Quest Browser expõe); lado null = os dois.

   Também o anel de "segurar": criarAnel(camera) → { progresso(p) (p < 0 esconde; 0–1 enche), dispose() }. Fica preso à vista,
   um pouco abaixo do centro, com borda grossa e brilho de gota (tokens do REGRAS). O preenchimento é a mesma RingGeometry com
   drawRange: 1 draw call por olho, e nenhuma quando escondido.
   API: O.xr.criarBotoes(sessao) → { ler(dt), botao(lado, nome), vibrar(lado, forca, ms), eixos(lado), fonte(lado) } ·
        O.xr.criarAnel(camera, rotulo) · O.xr.criarAviso(camera) */
(function(O){
  O.xr = O.xr || {};
  var INDICE = { gatilho: 0, grip: 1, stick: 3, a: 4, x: 4, b: 5, y: 5 };

  O.xr.criarBotoes = function(sessao){
    var est = {}, primeira = {};   // est[lado][nome] = { pressionado, apertou, soltou, seg }
    var VAZIO = { pressionado: false, apertou: false, soltou: false, seg: 0 };
    function fonte(lado){
      var fs = sessao.inputSources || [];
      for (var i = 0; i < fs.length; i++) if (fs[i].handedness === lado && fs[i].gamepad) return fs[i];
      return null;
    }
    function ler(dt){
      ['left', 'right'].forEach(function(lado){
        var f = fonte(lado), bs = f && f.gamepad.buttons, e = est[lado] || (est[lado] = {});
        Object.keys(INDICE).forEach(function(nome){
          var b = bs && bs[INDICE[nome]], agora = !!(b && b.pressed), s = e[nome];
          if (!s) {   // primeira leitura deste botão: o que já estava apertado não vira borda
            s = e[nome] = { pressionado: agora, apertou: false, soltou: false, seg: 0, travado: agora };
            return;
          }
          s.apertou = agora && !s.pressionado && !s.travado;
          s.soltou = !agora && s.pressionado && !s.travado;
          if (s.soltou) s.segAoSoltar = s.seg;   // por quanto tempo ficou apertado (toque curto × segurar)
          if (!agora) s.travado = false;
          s.seg = agora ? (s.apertou ? 0 : s.seg + dt) : 0;
          s.pressionado = agora;
        });
      });
    }
    function botao(lado, nome){ var e = est[lado], s = e && e[nome]; return s && !s.travado ? s : VAZIO; }
    function vibrar(lado, forca, ms){
      ['left', 'right'].forEach(function(l){
        if (lado && l !== lado) return;
        var f = fonte(l), h = f && f.gamepad.hapticActuators && f.gamepad.hapticActuators[0];
        try { if (h && h.pulse) h.pulse(forca, ms); } catch (e) {}
      });
    }
    /* thumbstick (xr-standard: eixos 2 e 3; y negativo = para a frente). Sem controle, zero. */
    var EIXO0 = { x: 0, y: 0 };
    function eixos(lado){
      var f = fonte(lado), a = f && f.gamepad.axes; if (!a || a.length < 2) return EIXO0;
      var i = a.length >= 4 ? 2 : 0;
      return { x: +a[i] || 0, y: +a[i + 1] || 0 };
    }
    return { ler: ler, botao: botao, vibrar: vibrar, eixos: eixos, fonte: fonte };
  };

  /* aviso curto preso à vista (atalhos: "MOVIMENTO: TELEPORTE"). Pílula com borda grossa e brilho de gota; redesenha só ao
     trocar o texto. API: O.xr.criarAviso(camera) → { mostrar(texto, seg), passo(dt), texto(), dispose() } */
  O.xr.criarAviso = function(camera){
    var W = 512, H = 96, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
    tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    var geo = new THREE.PlaneGeometry(0.22, 0.22 * H / W), mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'xr-aviso'; mesh.position.set(0, 0.11, -0.6); mesh.renderOrder = 1005; mesh.frustumCulled = false; mesh.visible = false;
    camera.add(mesh);
    var resta = 0, atual = '';
    function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function desenhar(t){
      g.clearRect(0, 0, W, H);
      rr(10, 10, W - 16, H - 16, 36); g.fillStyle = '#0b3a6e'; g.fill();                 // sombra dura
      rr(4, 4, W - 16, H - 16, 36);
      var bg = g.createLinearGradient(0, 4, 0, H - 12); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d6f0ff');
      g.fillStyle = bg; g.fill(); g.lineWidth = 5; g.strokeStyle = '#0b3a6e'; g.stroke();
      rr(14, 8, W - 36, (H - 16) * 0.42, 26); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();   // brilho de gota
      g.fillStyle = '#0c2c4a'; g.font = '800 34px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, (W - 12) / 2, (H - 12) / 2 + 2);
      tx.needsUpdate = true;
    }
    return {
      mostrar: function(t, seg){ if (t !== atual) { atual = t; desenhar(t); } resta = seg || 1.6; mesh.visible = true; },
      passo: function(dt){ if (resta > 0) { resta -= dt; if (resta <= 0) mesh.visible = false; } },
      texto: function(){ return mesh.visible ? atual : ''; },
      dispose: function(){ camera.remove(mesh); geo.dispose(); mat.dispose(); tx.dispose(); }
    };
  };

  O.xr.criarAnel = function(camera, rotulo){
    var grupo = new THREE.Group(); grupo.name = 'xr-anel';
    grupo.position.set(0, -0.06, -0.55); grupo.visible = false;
    var SEG = 64, R0 = 0.030, R1 = 0.046;
    function mat(cor, op){ return new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op == null ? 1 : op, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); }
    var geos = [], mats = [];
    function malha(geo, m, ordem){ var me = new THREE.Mesh(geo, m); me.renderOrder = ordem; me.frustumCulled = false; geos.push(geo); mats.push(m); grupo.add(me); return me; }
    malha(new THREE.RingGeometry(R0 - 0.006, R1 + 0.006, SEG), mat(0x0b3a6e), 1000);               // borda grossa (--edge)
    malha(new THREE.RingGeometry(R0, R1, SEG), mat(0xeefaff, 0.92), 1001);                        // trilho claro
    /* preenchimento: começa no topo e enche no sentido horário (comprimento negativo; DoubleSide mostra as faces invertidas) */
    var geoP = new THREE.RingGeometry(R0, R1, SEG, 1, Math.PI / 2, -Math.PI * 2);
    var cheio = malha(geoP, mat(0x71c935), 1002);                                                  // --leaf
    var brilho = malha(new THREE.RingGeometry(R0 + 0.002, R1 - 0.002, SEG, 1, Math.PI * 0.15, Math.PI * 0.7), mat(0xffffff, 0.55), 1003);   // brilho de gota em cima
    brilho.position.z = 0.0005;
    /* rótulo opcional embaixo do anel */
    var tx = null;
    if (rotulo) {
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
      var g = cv.getContext('2d');
      g.font = '800 46px Nunito, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#0b3a6e'; g.lineJoin = 'round'; g.strokeText(rotulo, 256, 50);
      g.fillStyle = '#ffffff'; g.fillText(rotulo, 256, 50);
      tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
      var mr = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      var r = malha(new THREE.PlaneGeometry(0.16, 0.03), mr, 1004); r.position.y = -0.068;
    }
    camera.add(grupo);
    var ultimo = -1;
    return {
      progresso: function(p){
        if (p == null || p < 0) { grupo.visible = false; ultimo = -1; return; }
        p = Math.min(1, p); grupo.visible = true;
        var n = Math.round(p * SEG);
        if (n !== ultimo) { geoP.setDrawRange(0, n * 6); ultimo = n; }   // RingGeometry: 6 índices por segmento, em ordem de ângulo
        cheio.visible = n > 0;
      },
      visivel: function(){ return grupo.visible; },
      dispose: function(){
        camera.remove(grupo); geos.forEach(function(x){ x.dispose(); }); mats.forEach(function(x){ x.dispose(); }); if (tx) tx.dispose();
      }
    };
  };
})(window.Orvalho);
