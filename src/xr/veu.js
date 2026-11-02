/* Véu do VR: escurece a vista (preto, como a vinheta) e clareia de novo (fade), para mudar o jogador de lugar sem corte seco. É uma esfera pequena
   presa à câmera, vista por dentro, desenhada por cima de tudo. Escondida, não custa nada.
   Serve à bateria de medições (trocar de ponto), ao teleporte, ao sentar e levantar e à troca de ambiente.
   API: O.xr.criarVeu(camera) → { passo(dt), cobrir(seg, aoCobrir) (escurece, chama aoCobrir e clareia), ativo(), dispose() } */
(function(O){
  O.xr = O.xr || {};
  O.xr.criarVeu = function(camera){
    var geo = new THREE.SphereGeometry(0.3, 16, 8);
    var mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false });
    var esfera = new THREE.Mesh(geo, mat); esfera.name = 'xr-veu'; esfera.renderOrder = 2000; esfera.frustumCulled = false; esfera.visible = false;
    camera.add(esfera);
    var fase = 0, t = 0, dur = 0.3, cb = null;   // 0 parado · 1 escurecendo · 2 coberto (1 quadro) · 3 clareando
    return {
      passo: function(dt){
        if (!fase) return;
        t += dt;
        if (fase === 1) { mat.opacity = Math.min(1, t / dur); if (t >= dur) { fase = 2; t = 0; } }
        else if (fase === 2) { var f = cb; cb = null; if (f) f(); fase = 3; t = 0; }
        else if (fase === 3) { mat.opacity = Math.max(0, 1 - t / dur); if (t >= dur) { fase = 0; esfera.visible = false; } }
      },
      cobrir: function(seg, aoCobrir){ dur = seg || 0.3; cb = aoCobrir || null; fase = 1; t = 0; mat.opacity = 0; esfera.visible = true; },
      ativo: function(){ return fase !== 0; },
      dispose: function(){ camera.remove(esfera); geo.dispose(); mat.dispose(); }
    };
  };
})(window.Orvalho);
