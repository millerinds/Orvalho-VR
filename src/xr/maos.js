/* Mãos em VR (etapa 3a): o braço de gelatina do próprio boneco em cada controle. Usa a mesma geometria e os mesmos materiais
   dos braços do jogador (criarBoneco: cor, tipo de braço do provador e contorno), então muda junto quando o provador muda.
   Em tamanho de mão (TAMANHO m de comprimento), preso à pose do targetRaySpace de cada controle (lida com frame.getPose), com a
   PONTA do braço na origem do raio: é dali que sai o laser (raio.js). O corpo do braço fica para trás, sobre o controle.
   Sem modelos de controle (o XRControllerModelFactory baixaria modelos de um CDN e é ES module na r149).
   API: O.xr.criarMaos(ctx) → { passo(), ponta(lado) → { ok, pos: V3, dir: V3 }, grupo(lado), dispose() }
   ctx: { renderer, rig, botoes, player, cena, oculto } (oculto: modo teste, sem mãos nem laser) */
(function(O){
  O.xr = O.xr || {};
  var TAMANHO = 0.30;   // m, da ponta ao "ombro" do gomo (o braço normal do boneco tem 0,86 u)

  O.xr.criarMaos = function(ctx){
    var renderer = ctx.renderer, rig = ctx.rig, botoes = ctx.botoes, player = ctx.player, cena = ctx.cena;
    var LADOS = ['left', 'right'], maos = {}, mPose = new THREE.Matrix4();
    var fonteBraco = { left: player.armL.children[0], right: player.armR.children[0] };   // a malha do braço (filho do pivô)

    LADOS.forEach(function(lado){
      var grupo = new THREE.Group(); grupo.name = 'xr-mao-' + lado; grupo.matrixAutoUpdate = false; grupo.visible = false;
      var src = fonteBraco[lado], contornoSrc = src.children[0];
      var braco = new THREE.Mesh(src.geometry, src.material); braco.name = 'xr-braco';
      var contorno = contornoSrc ? new THREE.Mesh(contornoSrc.geometry, contornoSrc.material) : null;
      if (contorno) { contorno.name = 'xr-braco-contorno'; braco.add(contorno); }
      braco.rotation.x = Math.PI / 2;            // o braço do boneco desce em −y; aqui aponta para −z (a frente do raio)
      grupo.add(braco); cena.add(grupo);
      maos[lado] = { grupo: grupo, braco: braco, contorno: contorno, src: src, contornoSrc: contornoSrc, geo: null,
        ponta: { ok: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1) } };
    });
    /* escala e posição: a ponta (o ponto mais baixo da geometria) fica na origem do raio */
    function ajustar(m){
      var g = m.src.geometry; if (m.geo === g) return;
      m.geo = g; m.braco.geometry = g; if (m.contorno && m.contornoSrc) m.contorno.geometry = m.contornoSrc.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      var comp = -g.boundingBox.min.y, s = TAMANHO / 0.86;   // a mesma escala para os três tipos: curto e bolinha ficam menores, como no boneco
      m.braco.scale.set(s, s, s * 0.88);
      m.braco.position.set(0, 0, comp * s);   // depois da rotação, a ponta (y = −comp) cai em z = 0
    }
    var q = new THREE.Quaternion(), sc = new THREE.Vector3();
    return {
      passo: function(){
        var frame = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
        rig.rig.updateMatrixWorld(true);
        LADOS.forEach(function(lado){
          var m = maos[lado], f = botoes.fonte(lado), pose = f && frame && ref && f.targetRaySpace ? frame.getPose(f.targetRaySpace, ref) : null;
          m.ponta.ok = !!pose; m.grupo.visible = !!pose && !ctx.oculto;
          if (!pose) return;
          ajustar(m);
          mPose.fromArray(pose.transform.matrix);
          m.grupo.matrix.multiplyMatrices(rig.rig.matrixWorld, mPose); m.grupo.matrixWorldNeedsUpdate = true;
          m.grupo.matrix.decompose(m.ponta.pos, q, sc);
          m.ponta.dir.set(0, 0, -1).applyQuaternion(q);
        });
      },
      ponta: function(lado){ return maos[lado].ponta; },
      grupo: function(lado){ return maos[lado].grupo; },
      dispose: function(){ LADOS.forEach(function(lado){ var g = maos[lado].grupo; if (g.parent) g.parent.remove(g); }); }   // geometria e materiais são do boneco
    };
  };
})(window.Orvalho);
