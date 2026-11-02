/* Monta um ambiente a partir da planta (dados em ambientes/<id>/<id>.js): piso, forro, paredes com vãos,
   móveis instanciados, sombras, colisão, céu e paisagem. Outro ambiente = outro arquivo de dados, o mesmo montador.
   Convenção: 1 unidade = 1 metro; x vai da parede oeste (0) à leste (largura); z da parede norte (0) à sul (fundo). */
(function(O){
  var G = O.gelatina, F = O.formas, MV = O.moveis;

  O.montarAmbiente = function(def){
    var S = def.sala, W = S.largura, D = S.fundo, H = S.pe, T = 0.12;
    var grupo = new THREE.Group(); grupo.name = def.id;
    var col = O.criarColisao();
    var lixo = { geo: [], mat: [], tex: [] };
    var animados = [];
    var lin = G.lin;

    /* ---------- zonas de visibilidade do VR (def.zonasVR; só o Hall tem): cada zona é um conjunto de retângulos num pavimento
       (piso 0 = térreo, 1 = 1º andar) e diz quais outras zonas se veem dela. Móveis, portas, marcadores e pessoas guardam a
       zona onde estão; em VR, os das zonas que não se veem da zona da cabeça ficam ocultos (visibilidadeVR). Piso, paredes e
       vidros nunca somem. Fora de qualquer zona, ou numa zona "todas" (a escada, que liga os pavimentos), tudo aparece e o limite
       de distância não vale. piso: null = vale nos dois pavimentos. grupo: zonas do mesmo grupo (ex.: o café e o resto do
       térreo) se veem sempre e contam como "a zona da cabeça" para a distância máxima (um ambiente aberto não corta a si mesmo).
       Visibilidade parcial: em ve[zona], { zona: 'salas', em: [[x0, z0, x1, z1], …] } mostra só os blocos de móveis daquela zona
       cujo centro cai num dos retângulos (os poucos que a geometria diz que se veem), em vez da zona inteira; o mesmo para pessoas e
       marcadores (também entram na análise). As portas de uma zona parcial continuam aparecendo (a análise as trata como abertas). ---------- */
    var ZV = def.zonasVR || null, VE = {}, TODAS = {}, GRUPO = {};
    if (ZV) ZV.zonas.forEach(function(zn){ VE[zn.id] = {}; VE[zn.id][zn.id] = true;
      (ZV.ve[zn.id] || []).forEach(function(o){ if (typeof o === 'string') VE[zn.id][o] = true; else VE[zn.id][o.zona] = o.em; });
      if (zn.todas) TODAS[zn.id] = true; GRUPO[zn.id] = zn.grupo || zn.id; });
    /* a zona "zona" é visível de ve (tabela da zona da cabeça) no ponto (x, z)? true = inteira; lista = só dentro dos retângulos */
    function veEm(ve, zona, x, z){
      var v = ve[zona]; if (v === true) return true; if (!v) return false;
      for (var i = 0; i < v.length; i++) { var r = v[i]; if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true; }
      return false;
    }
    if (ZV) ZV.zonas.forEach(function(a){ ZV.zonas.forEach(function(b){ if (GRUPO[a.id] === GRUPO[b.id]) VE[a.id][b.id] = true; }); });
    function zonaEm(x, z, yPiso){
      if (!ZV) return null;
      var andar = yPiso > 3 ? 1 : 0;
      for (var i = 0; i < ZV.zonas.length; i++) { var zn = ZV.zonas[i]; if (zn.piso != null && zn.piso !== andar) continue;
        for (var j = 0; j < zn.r.length; j++) { var r = zn.r[j]; if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return zn.id; } }
      return null;
    }

    function guarda(o){ if (o.isMaterial) lixo.mat.push(o); else if (o.isTexture) lixo.tex.push(o); else lixo.geo.push(o); return o; }
    function std(hex, o){ var m = new THREE.MeshStandardMaterial({ color: lin(hex), roughness: 0.62, metalness: 0 }); if (o) m.setValues(o); return guarda(m); }
    /* peça avulsa de gelatina (para molduras e detalhes que não se repetem) */
    var palCache = {};
    function pal(n){ return palCache[n] || (palCache[n] = G.paleta(MV.PAL[n])); }
    function gel(geo, nome, esp){
      geo.computeBoundingBox();
      var bb = geo.boundingBox, m = guarda(G.jelly({ top: bb.max.y - (bb.max.y - bb.min.y) * 0.35, bot: bb.min.y }));
      var mesh = new THREE.Mesh(guarda(geo), m), om = null;
      if (esp) { om = guarda(G.outline(mesh, esp)); }
      G.pintar(m, pal(nome), om);
      mesh.userData.lote = nome + '|' + (esp || 0);
      return mesh;
    }

    /* ---------- luz: quente e suave, vinda das janelas ---------- */
    var L = def.luz || {};
    grupo.add(new THREE.HemisphereLight(lin(L.ceu || '#e6f5ff'), lin(L.chao || '#f4e7d2'), L.hemi != null ? L.hemi : 0.75));
    var sol = new THREE.DirectionalLight(lin(L.sol || '#fff1dc'), L.solForca != null ? L.solForca : 0.55);
    var sp0 = L.solPos || [-4, 5, D * 0.4];
    sol.position.set(sp0[0], sp0[1], sp0[2]); sol.target.position.set(W / 2, 0, D / 2); grupo.add(sol, sol.target);

    /* ---------- piso e forro ---------- */
    var placa = S.placa || 0.6, placaForro = S.placaForro || 0.6;
    var piso = new THREE.Mesh(guarda(new THREE.PlaneGeometry(W, D)), std(S.pisoTinta || '#ffffff', { map: guarda(F.piso([W / placa, D / placa], S.pisoCores)), roughness: S.pisoRugosidade || 0.3 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(W / 2, 0, D / 2); grupo.add(piso);
    var forro = new THREE.Mesh(guarda(new THREE.PlaneGeometry(W, D)), std(S.corForro || '#ffffff', { map: guarda(F.forro([W / placaForro, D / placaForro])), roughness: 0.9 }));
    forro.rotation.x = Math.PI / 2; forro.position.set(W / 2, H, D / 2); grupo.add(forro);
    /* luminárias quadradas de LED: todas num InstancedMesh; "y" opcional (forro baixo sob o mezanino) */
    var lumMat = guarda(new THREE.MeshBasicMaterial({ color: lin('#f4fbff') })), lumGeo = guarda(new THREE.PlaneGeometry(0.56, 0.56));
    lumGeo.rotateX(Math.PI / 2);
    var lums = def.luminarias || [];
    if (lums.length) {
      var li = new THREE.InstancedMesh(lumGeo, lumMat, lums.length), lq = new THREE.Quaternion(), l1 = new THREE.Vector3(1, 1, 1), lm = new THREE.Matrix4();
      lums.forEach(function(p, i){ li.setMatrixAt(i, lm.compose(new THREE.Vector3(p.x, (p.y || H) - 0.004, p.z), lq, l1)); });
      li.frustumCulled = false; grupo.add(li);
    }

    /* ---------- paredes com vãos ---------- */
    var CORES = def.cores || {};
    var vidroMat = guarda(new THREE.MeshPhysicalMaterial({ color: lin('#e8f7ff'), transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, side: THREE.DoubleSide }));
    var peliculaTex = {};
    /* converte (u ao longo da parede, v altura, w para dentro da sala) em mundo, conforme o lado */
    function lado(p){
      switch (p.lado) {
        case 'norte': return { L: W, pos: function(u, v, w){ return new THREE.Vector3(u, v, w); }, rot: 0 };
        case 'sul':   return { L: W, pos: function(u, v, w){ return new THREE.Vector3(W - u, v, D - w); }, rot: Math.PI };
        case 'oeste': return { L: D, pos: function(u, v, w){ return new THREE.Vector3(w, v, D - u); }, rot: Math.PI / 2 };
        case 'leste': return { L: D, pos: function(u, v, w){ return new THREE.Vector3(W - w, v, u); }, rot: -Math.PI / 2 };
      }
    }
    /* para os lados sul e oeste o u cresce "ao contrário"; os dados usam sempre a coordenada do mundo (x ou z) */
    function uDe(p, c, Lw){ return (p.lado === 'sul' || p.lado === 'oeste') ? Lw - c : c; }

    (def.paredes || []).forEach(function(p){
      var Ld = lado(p), Lw = Ld.L, mat = std(CORES[p.cor] || '#f3f7fa', { roughness: 0.85 });
      /* "altura": a parede termina antes do forro (ex.: parede do palco sob a laje da ala leste do 1º andar) */
      var Hp = p.altura || H;
      /* revestimento "madeira" (porcelanato): a textura repete a cada ~2,4 m na horizontal e 1,2 m na vertical */
      if (p.textura === 'madeira') mat.map = guarda(F.madeira([Lw / 3.6, Hp / 1.2]));
      function bloco(u0, u1, v0, v1){
        v1 = Math.min(v1, Hp);
        if (u1 - u0 < 0.005 || v1 - v0 < 0.005) return;
        var m = new THREE.Mesh(guarda(new THREE.BoxGeometry(u1 - u0, v1 - v0, T)), mat);
        m.position.copy(Ld.pos((u0 + u1) / 2, (v0 + v1) / 2, -T / 2)); m.rotation.y = Ld.rot; grupo.add(m);
      }
      var vaos = (p.vaos || []).map(function(v){
        var a = uDe(p, v.de, Lw), b = uDe(p, v.ate, Lw);
        return Object.assign({}, v, { u0: Math.min(a, b), u1: Math.max(a, b), _p: p });
      }).sort(function(a, b){ return a.u0 - b.u0; });
      var u = 0;
      vaos.forEach(function(v){
        bloco(u, v.u0, 0, Hp);
        bloco(v.u0, v.u1, 0, v.base || 0);
        bloco(v.u0, v.u1, v.topo, H);
        abertura(p, Ld, v);
        u = v.u1;
      });
      bloco(u, Lw, 0, Hp);
      /* rodapé discreto, só onde a parede chega ao chão (some nas portas e no vidro até o piso) */
      if (p.rodape !== false) {
        var rodMat = std(CORES.rodape || '#d7e0e8'), ini = 0, trechos = [];
        vaos.forEach(function(v){ if (!v.base) { trechos.push([ini, v.u0 - 0.045]); ini = v.u1 + 0.045; } });
        trechos.push([ini, Lw]);
        trechos.forEach(function(r){
          if (r[1] - r[0] < 0.02) return;
          var rod = new THREE.Mesh(guarda(new THREE.BoxGeometry(r[1] - r[0], 0.07, 0.012)), rodMat);
          rod.position.copy(Ld.pos((r[0] + r[1]) / 2, 0.035, 0.006)); rod.rotation.y = Ld.rot; grupo.add(rod);
        });
      }
      /* a parede colide inteira, menos nos vãos do tipo "abertura" (passagem para um anexo navegável);
         "soTerreo": acima dela há piso navegável (ala leste do 1º andar), então a colisão vale só no térreo */
      if (p.soTerreo) col.nivel([-1, 2]);
      var ini2 = 0;
      vaos.filter(function(v){ return v.tipo === 'abertura'; }).forEach(function(v){
        if (v.u0 > ini2) { var a1 = Ld.pos(ini2, 0, 0), b1 = Ld.pos(v.u0, 0, 0); col.segmento(a1.x, a1.z, b1.x, b1.z); }
        ini2 = v.u1;
      });
      var a = Ld.pos(ini2, 0, 0), b = Ld.pos(Lw, 0, 0);
      col.segmento(a.x, a.z, b.x, b.z);
      col.nivel(null);
    });

    /* moldura arredondada em volta de um vão + o que vai dentro (vidro, película, porta) */
    function abertura(p, Ld, v){
      var w = v.u1 - v.u0, h = v.topo - (v.base || 0), cu = (v.u0 + v.u1) / 2, cv = (v.base || 0) + h / 2, fr = 0.045;
      function poe(mesh, u, vv, ww){ mesh.position.copy(Ld.pos(u, vv, ww)); mesh.rotation.y = Ld.rot; grupo.add(mesh); return mesh; }
      if (v.tipo === 'fachada') { fachada(Ld, v, w, h, cu, cv, poe); return; }
      if (v.tipo === 'elevador') { elevador(Ld, v, w, cu, poe); return; }
      if (v.tipo === 'passagem') { passagem(p, Ld, v, w, cu, poe); return; }
      if (v.tipo === 'abertura') { // só a moldura: o vão leva a um anexo navegável
        var hpa = v.altura || 2.4;
        poe(gel(F.caixa(0.1, hpa + 0.1, 0.18, 0.02), 'branco', 0.008), v.u0 - 0.05, (hpa + 0.1) / 2, 0); poe(gel(F.caixa(0.1, hpa + 0.1, 0.18, 0.02), 'branco', 0.008), v.u1 + 0.05, (hpa + 0.1) / 2, 0);
        poe(gel(F.caixa(w + 0.2, 0.1, 0.18, 0.02), 'branco', 0.008), cu, hpa + 0.05, 0);
        return;
      }
      var corMold = v.tipo === 'porta' ? (v.cor || 'branco') : 'metal';
      poe(gel(F.caixa(w + fr * 2, fr, 0.08, 0.018), corMold, 0.008), cu, v.topo + fr / 2, -0.02);
      if (v.base) poe(gel(F.caixa(w + fr * 2, fr, 0.14, 0.018), corMold, 0.008), cu, v.base - fr / 2, 0);
      poe(gel(F.caixa(fr, h, 0.08, 0.018), corMold, 0.008), v.u0 - fr / 2, cv, -0.02);
      poe(gel(F.caixa(fr, h, 0.08, 0.018), corMold, 0.008), v.u1 + fr / 2, cv, -0.02);
      if (v.tipo === 'porta') {
        /* folha branca com maçaneta e bandeira de vidro em cima */
        var hp = v.altura || 2.1;
        if (v.arte) { // folha impressa (arte da foto): material liso com a textura, moldura de gelatina por fora
          var fa = new THREE.Mesh(guarda(new THREE.BoxGeometry(w - 0.02, hp - 0.01, 0.04)), std('#ffffff', { map: artePor(v.arte), roughness: 0.55 }));
          poe(fa, cu, hp / 2, -0.03);
        } else poe(gel(F.caixa(w - 0.02, hp - 0.01, 0.045, 0.012), v.cor || 'branco', 0.01), cu, hp / 2, -0.03);
        if (v.faixa) poe(gel(F.caixa(w * 0.18, hp * 0.8, 0.05, 0.01), v.faixa, 0.006), cu + w * 0.3, hp * 0.45, -0.01); // faixa colorida (porta do elevador)
        else poe(gel(F.caixa(0.14, 0.022, 0.03, 0.01), 'metal', 0.006), v.u1 - 0.14, 1.02, 0.01);
        poe(gel(F.caixa(w, 0.04, 0.07, 0.015), v.cor || 'branco', 0.008), cu, hp + 0.02, -0.03);
        if (v.topo - hp > 0.12) { var tr = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, v.topo - hp - 0.04)), vidroMat); poe(tr, cu, (hp + 0.04 + v.topo) / 2, -0.04); }
        return;
      }
      var vidro = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, h)), vidroMat); vidro.renderOrder = 2; poe(vidro, cu, cv, -0.03);
      if (v.tipo === 'vidro-pelicula') {
        var key = w.toFixed(2) + 'x' + h.toFixed(2);
        var tx = peliculaTex[key] || (peliculaTex[key] = guarda(F.pelicula(w, h)));
        var pm = guarda(new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        var pel = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, h)), pm); pel.renderOrder = 3; poe(pel, cu, cv, -0.025);
      }
      if (v.cortina) { // cortina de rolo recolhida: só o tubo no alto
        poe(gel(F.caixa(w - 0.04, 0.11, 0.11, 0.05), 'branco', 0.008), cu, v.topo - 0.08, 0.08);
      }
    }

    var _artes = {};
    function artePor(nome){ _artes = _artes || {}; return _artes[nome] || (_artes[nome] = guarda(F.arte(nome))); }
    /* elevador (C04, C07): moldura branca larga e brilhante, folhas pretas impressas, painel de inox com botões */
    function elevador(Ld, v, w, cu, poe){
      var hp = v.altura || 2.2, m = 0.34;
      poe(gel(F.caixa(m, hp + 0.3, 0.12, 0.03), 'branco', 0.01), v.u0 - m / 2, (hp + 0.3) / 2, 0.02);
      poe(gel(F.caixa(m, hp + 0.3, 0.12, 0.03), 'branco', 0.01), v.u1 + m / 2, (hp + 0.3) / 2, 0.02);
      poe(gel(F.caixa(w + m * 2, 0.3, 0.12, 0.03), 'branco', 0.01), cu, hp + 0.15, 0.02);
      if (!v.animado) { var fol = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, hp, 0.03)), std('#ffffff', { map: artePor('elevador'), roughness: 0.35, metalness: 0.2 })); poe(fol, cu, hp / 2, -0.02); }
      var lado = v.painel === 'direita' ? v.u1 + m + 0.08 : v.u0 - m - 0.08;
      poe(gel(F.caixa(0.12, 0.5, 0.03, 0.01), 'inox', 0.004), lado, 1.15, 0.01);
      poe(new THREE.Mesh(guarda(new THREE.SphereGeometry(0.018, 8, 6)), guarda(new THREE.MeshBasicMaterial({ color: lin('#5ff0ff') }))), lado, 1.22, 0.03); // botão aceso
    }
    /* passagem sem porta com um nicho atrás da parede (banheiros, acesso às salas): só o que se vê da porta */
    function passagem(p, Ld, v, w, cu, poe){
      var hp = v.altura || 2.2, nf = (v.nicho && v.nicho.fundo) || 1.2, nm = std(v.nicho && v.nicho.cor || '#efefec', { roughness: 0.85, side: THREE.DoubleSide });
      if (v.nicho && v.nicho.textura === 'madeira') nm.map = guarda(F.madeira([nf / 3.6, hp / 1.2]));
      poe(gel(F.caixa(0.08, hp + 0.08, 0.16, 0.02), 'branco', 0.008), v.u0 - 0.04, (hp + 0.08) / 2, 0.0);
      poe(gel(F.caixa(0.08, hp + 0.08, 0.16, 0.02), 'branco', 0.008), v.u1 + 0.04, (hp + 0.08) / 2, 0.0);
      poe(gel(F.caixa(w + 0.16, 0.08, 0.16, 0.02), 'branco', 0.008), cu, hp + 0.04, 0.0);
      function plano(pw, ph, u, vv, ww, ry, rx, mat){ var m2 = new THREE.Mesh(guarda(new THREE.PlaneGeometry(pw, ph)), mat || nm); m2.position.copy(Ld.pos(u, vv, ww)); m2.rotation.set(rx || 0, Ld.rot + (ry || 0), 0, 'YXZ'); grupo.add(m2); }
      plano(w, nf, cu, 0.002, -T - nf / 2, 0, -Math.PI / 2, std(v.nicho && v.nicho.piso || '#b9b2a8', { roughness: 0.4 }));
      plano(w, nf, cu, hp, -T - nf / 2, 0, Math.PI / 2);
      plano(nf, hp, v.u0, hp / 2, -T - nf / 2, Math.PI / 2); plano(nf, hp, v.u1, hp / 2, -T - nf / 2, -Math.PI / 2);
      plano(w, hp, cu, hp / 2, -T - nf, 0);
      if (v.nicho && v.nicho.arte) { var dm = std('#ffffff', { map: artePor(v.nicho.arte), roughness: 0.6 }); plano(Math.min(0.85, w - 0.2), 2.05, cu + (v.nicho.desloca || 0), 1.03, -T - nf + 0.02, 0, 0, dm); }
      (v.nicho && v.nicho.portas || []).forEach(function(pd){ plano(pd.largura || 0.8, 2.05, cu + pd.desloca, 1.03, -T - nf + 0.02, 0, 0, std('#ffffff', { map: artePor(pd.arte), roughness: 0.6 })); });
      if (v.nicho && v.nicho.mesa) { var mm = gel(F.caixa(1.0, 0.85, 0.6, 0.03), 'grafite', 0.008); poe(mm, cu, 0.425, -T - nf + 0.5); var mt = gel(F.caixa(0.9, 0.12, 0.5, 0.03), 'branco', 0.008); poe(mt, cu, 0.93, -T - nf + 0.5); }
    }
    /* fachada de vidro (hall): vidro inteiro com montantes a cada "modulo", travessas, faixa fosca com triângulos,
       persianas de rolo e portas de vidro com puxadores. Os caixilhos viram uma geometria só (uma chamada de desenho). */
    var caixilhoMat = null;
    function fachada(Ld, v, w, h, cu, cv, poe){
      var b = v.base || 0, mod = v.modulo || 1.35, geos = [];
      caixilhoMat = caixilhoMat || std('#dfe5ea', { roughness: 0.35, metalness: 0.35 });
      var vidro = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, h)), vidroMat); vidro.renderOrder = 2; poe(vidro, cu, cv, -0.03);
      function barra(u, vv, bw, bh, ww){ var g = new THREE.BoxGeometry(bw, bh, 0.07), q = Ld.pos(u, vv, ww == null ? -0.03 : ww); g.rotateY(Ld.rot); g.translate(q.x, q.y, q.z); geos.push(g); }
      var n = Math.max(1, Math.round(w / mod)), step = w / n;
      for (var i = 0; i <= n; i++) barra(v.u0 + i * step, cv, (i === 0 || i === n) ? 0.08 : 0.05, h);
      barra(cu, b + 0.03, w, 0.06); barra(cu, v.topo - 0.03, w, 0.06);
      (v.travessas || []).forEach(function(y){ if (y > b + 0.1 && y < v.topo - 0.1) barra(cu, y, w, 0.05); });
      /* portas de vidro (coordenadas do mundo, como os vãos): marco e puxadores altos */
      var portas = (v.portas || []).map(function(pt){ var a = uDe(v._p, pt[0], Ld.L), c = uDe(v._p, pt[1], Ld.L); return [Math.min(a, c), Math.max(a, c), pt[2] || 2.4]; });
      portas.forEach(function(pt){
        barra(pt[0], pt[2] / 2, 0.07, pt[2], 0.02); barra(pt[1], pt[2] / 2, 0.07, pt[2], 0.02); barra((pt[0] + pt[1]) / 2, pt[2], pt[1] - pt[0], 0.07, 0.02);
        var mid = (pt[0] + pt[1]) / 2; barra(mid - 0.08, 1.1, 0.03, 1.3, 0.06); barra(mid + 0.08, 1.1, 0.03, 1.3, 0.06);
      });
      var mesh = new THREE.Mesh(guarda(F.mesclar(geos)), caixilhoMat); grupo.add(mesh);
      /* faixa fosca, menos onde há porta */
      if (v.faixa) {
        var cortes = [[v.u0, v.u1]];
        portas.forEach(function(pt){ cortes = cortes.reduce(function(acc, r){ if (pt[1] <= r[0] || pt[0] >= r[1]) acc.push(r); else { if (pt[0] > r[0]) acc.push([r[0], pt[0]]); if (pt[1] < r[1]) acc.push([pt[1], r[1]]); } return acc; }, []); });
        cortes.forEach(function(r){
          var fw = r[1] - r[0]; if (fw < 0.2) return;
          var fm = guarda(new THREE.MeshBasicMaterial({ map: guarda(F.faixaFosca(fw)), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
          var fp = new THREE.Mesh(guarda(new THREE.PlaneGeometry(fw, v.faixa[1] - v.faixa[0])), fm); fp.renderOrder = 3; poe(fp, (r[0] + r[1]) / 2, (v.faixa[0] + v.faixa[1]) / 2, -0.02);
        });
      }
      /* persianas de rolo (meio abaixadas, como nas fotos) */
      if (v.persianas) {
        var pm = guarda(new THREE.MeshStandardMaterial({ color: lin('#7f868e'), roughness: 0.9, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
        v.persianas.forEach(function(ps){ var pp = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w - 0.1, ps[1] - ps[0])), pm); poe(pp, cu, (ps[0] + ps[1]) / 2, 0.06); });
      }
    }

    /* ---------- 1º andar: lajes de mezanino (faixa cor de areia, forro embaixo, piso em cima) ---------- */
    var MZ = def.mezaninos || [], NIVM = !!def.niveis;
    function mzEm(x, z, folga){
      folga = folga || 0;
      for (var i = 0; i < MZ.length; i++) { var r = MZ[i].r; if (x > r[0] + folga && x < r[2] - folga && z > r[1] + folga && z < r[3] - folga) return MZ[i]; }
      return null;
    }
    if (MZ.length) {
      var lajeMat = std(CORES.laje || '#cbbfa9', { roughness: 0.8 });
      var forroBaixo = std(S.corForro || '#ffffff', { map: guarda(F.forro([1, 1])), roughness: 0.9 }), pisoAlto = std(S.pisoTinta || '#ffffff', { map: guarda(F.piso([1, 1], S.pisoCores)), roughness: 0.35 });
      var bandas = [], tampos = [], tubosG = [];
      MZ.forEach(function(m){
        var r = m.r, w = r[2] - r[0], d = r[3] - r[1], e = m.espessura || 1.0;
        var laje = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, e, d)), lajeMat); laje.position.set(r[0] + w / 2, m.piso - e / 2, r[1] + d / 2); grupo.add(laje);
        var fg = guarda(new THREE.PlaneGeometry(w, d)), fu = fg.attributes.uv;
        for (var i = 0; i < fu.count; i++) fu.setXY(i, fu.getX(i) * w / placaForro, fu.getY(i) * d / placaForro);
        var fb = new THREE.Mesh(fg, forroBaixo); fb.rotation.x = Math.PI / 2; fb.position.set(r[0] + w / 2, m.piso - e - 0.003, r[1] + d / 2); grupo.add(fb);
        var pg = guarda(new THREE.PlaneGeometry(w, d)), pu = pg.attributes.uv;
        for (i = 0; i < pu.count; i++) pu.setXY(i, pu.getX(i) * w / placa, pu.getY(i) * d / placa);
        var pa = new THREE.Mesh(pg, pisoAlto); pa.rotation.x = -Math.PI / 2; pa.position.set(r[0] + w / 2, m.piso + 0.003, r[1] + d / 2); grupo.add(pa);
        /* guarda-corpo onde a borda dá para o vazio (calculado: sem dado repetido na planta) */
        [[r[0], r[1], r[2], r[1], 0, -1], [r[2], r[1], r[2], r[3], 1, 0], [r[0], r[3], r[2], r[3], 0, 1], [r[0], r[1], r[0], r[3], -1, 0]].forEach(function(E){
          var ax = E[0], az = E[1], bx = E[2], bz = E[3], nx = E[4], nz = E[5], Lr = Math.hypot(bx - ax, bz - az), passo = 0.25, run = null, runs = [];
          for (var s = passo / 2; s < Lr; s += passo) {
            var qx = ax + (bx - ax) * s / Lr + nx * 0.05, qz = az + (bz - az) * s / Lr + nz * 0.05;
            var livre = qx > 0.02 && qx < W - 0.02 && qz > 0.02 && qz < D - 0.02 && !mzEm(qx, qz)
              && !(m.aberturas || []).some(function(ab){ return qx >= ab[0] && qx <= ab[1]; }); // vão do guarda-corpo (chegada da escada)
            if (livre) { if (!run) run = { s0: s - passo / 2 }; run.s1 = Math.min(Lr, s + passo / 2); } else if (run) { runs.push(run); run = null; }
          }
          if (run) runs.push(run);
          runs.forEach(function(rn){
            var l = rn.s1 - rn.s0, cx = ax + (bx - ax) * (rn.s0 + l / 2) / Lr - nx * 0.075, cz = az + (bz - az) * (rn.s0 + l / 2) / Lr - nz * 0.075, aoLongoX = nz !== 0;
            function caixaG(bw, bh, bd, y, off){ var g = new THREE.BoxGeometry(aoLongoX ? bw : bd, bh, aoLongoX ? bd : bw); g.translate(cx - nx * (off || 0), y, cz - nz * (off || 0)); return g; }
            bandas.push(caixaG(l, 1.0, 0.15, m.piso + 0.5));
            tampos.push(caixaG(l + 0.1, 0.05, 0.32, m.piso + 1.025, 0.05));
            /* colisão = a própria mureta: linha na face do tampo de granito voltada para o piso (0,285 m da borda) e
               tampões nas pontas, até a borda da laje. Vale só no pavimento da laje (o térreo passa por baixo). */
            var dIn = 0.075 + 0.05 + 0.16, ux = (bx - ax) / Lr, uz = (bz - az) / Lr;
            var p0x = ax + ux * rn.s0, p0z = az + uz * rn.s0, p1x = ax + ux * rn.s1, p1z = az + uz * rn.s1;
            col.nivel(NIVM ? [m.piso - 1.2, 99] : null);
            col.segmento(p0x - nx * dIn, p0z - nz * dIn, p1x - nx * dIn, p1z - nz * dIn);
            col.segmento(p0x, p0z, p0x - nx * dIn, p0z - nz * dIn); col.segmento(p1x, p1z, p1x - nx * dIn, p1z - nz * dIn);
            col.nivel(null);
            var t = new THREE.CylinderGeometry(0.025, 0.025, l, 10); if (aoLongoX) t.rotateZ(Math.PI / 2); else t.rotateX(Math.PI / 2); t.translate(cx, m.piso + 1.14, cz); tubosG.push(t);
            for (var k = 0; k <= Math.floor(l / 1.5); k++) { var u = rn.s0 + Math.min(l, k * 1.5), px = ax + (bx - ax) * u / Lr - nx * 0.075, pz = az + (bz - az) * u / Lr - nz * 0.075, pt = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6); pt.translate(px, m.piso + 1.09, pz); tubosG.push(pt); }
          });
        });
      });
      if (bandas.length) {
        grupo.add(new THREE.Mesh(guarda(F.mesclar(bandas)), lajeMat));
        grupo.add(new THREE.Mesh(guarda(F.mesclar(tampos)), std('#e2ddd5', { roughness: 0.4 })));
        grupo.add(new THREE.Mesh(guarda(F.mesclar(tubosG)), std('#eef3f7', { roughness: 0.2, metalness: 0.8 })));
      }
    }

    /* ---------- pilares redondos (colidem e barram a câmera) ---------- */
    var PL = def.pilares || [];
    if (PL.length) {
      var pgs = PL.map(function(p){ var g = F.cilindro(p.d / 2, p.ate || H, 0.02, 28); g.translate(p.x, 0, p.z); col.bloqueiaCamera(p.x, p.z, p.d / 2); return g; });
      grupo.add(new THREE.Mesh(guarda(F.mesclar(pgs)), std(CORES.pilar || '#c4b8a3', { roughness: 0.55 })));
    }

    var NIV = def.niveis, TERREO = NIV ? [-1, 2] : null, escadasNav = [];
    col.nivel(TERREO); // daqui em diante (blocos, escadas, painéis, móveis): térreo

    /* ---------- blocos simples: palco, marquise, degraus... (gelatina com contorno ou material liso) ---------- */
    (def.blocos || []).forEach(function(b){
      var r = b.r, w = r[2] - r[0], d = r[3] - r[1], h = b.y1 - b.y0, mesh;
      if (b.gel) mesh = gel(F.caixa(w, h, d, b.raio != null ? b.raio : 0.03), b.gel, b.esp != null ? b.esp : 0.012);
      else mesh = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, h, d)), std(b.cor || '#cccccc', { roughness: b.rugosidade || 0.7 }));
      mesh.position.set(r[0] + w / 2, b.y0 + h / 2, r[1] + d / 2); grupo.add(mesh);
      if (b.colide) col.caixa(r[0], r[1], r[2], r[3]);
    });

    /* ---------- escadas: lances com patamar; degraus de granito, longarina fechada do lado do salão,
       guarda-corpo de inox (corrimão + 2 barras horizontais em montantes) e corrimão de parede ---------- */
    (def.escadas || []).forEach(function(e){
      var lances = e.lances || [{ a0: e.z0, a1: e.z1, h0: 0, h1: e.altura }], sobeZ = e.eixo !== 'x';
      var b0 = sobeZ ? e.x0 : e.z0, b1 = sobeZ ? e.x1 : e.z1, larg = b1 - b0, bSalao = e.ladoSalao === 'max' ? b1 : b0, bParede = e.ladoSalao === 'max' ? b0 : b1;
      var degraus = [], fech = [], inox = [];
      function P(a, y, b){ return sobeZ ? new THREE.Vector3(b, y, a) : new THREE.Vector3(a, y, b); }
      function caixa3(ga, gy, gb, ca, cy, cb){ var g = new THREE.BoxGeometry(sobeZ ? gb : ga, gy, sobeZ ? ga : gb); g.translate(sobeZ ? cb : ca, cy, sobeZ ? ca : cb); return g; }
      function corrimao(p0, p1, r){ inox.push(F.tubo([p0, p1], r || 0.024, 2)); }
      lances.forEach(function(L, li){
        var n = Math.max(1, Math.round((L.h1 - L.h0) / 0.175)), run = (L.a1 - L.a0) / n, dh = (L.h1 - L.h0) / n;
        for (var i = 0; i < n; i++) {
          var top = L.h0 + (i + 1) * dh;
          degraus.push(caixa3(run + 0.025, 0.04, larg, L.a0 + (i + 0.5) * run, top - 0.02, (b0 + b1) / 2));                 // pisada de granito
          fech.push(caixa3(0.02, dh, larg, L.a0 + i * run + 0.01, top - dh / 2, (b0 + b1) / 2));                          // espelho
        }
        /* longarina: chapa inclinada fechando o lado do salão (a faixa clara da H07) */
        var comp = Math.hypot(L.a1 - L.a0, L.h1 - L.h0), ang = Math.atan2(L.h1 - L.h0, L.a1 - L.a0);
        var lg = new THREE.BoxGeometry(0.12, 0.42, comp + 0.1); lg.rotateX(-ang); if (!sobeZ) lg.rotateY(Math.PI / 2);
        var mid = P((L.a0 + L.a1) / 2, (L.h0 + L.h1) / 2 - 0.12, bSalao); lg.translate(mid.x, mid.y, mid.z); fech.push(lg);
        /* guarda-corpo do lado do salão: montantes a cada ~1,1 m, corrimão a 0,95 m e duas barras horizontais */
        var nm = Math.max(2, Math.round(comp / 1.1));
        for (var k = 0; k <= nm; k++) { var t = k / nm, pa = L.a0 + (L.a1 - L.a0) * t, py = L.h0 + (L.h1 - L.h0) * t, ps = new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8); var pp = P(pa, py + 0.475, bSalao + (bSalao === b0 ? 0.06 : -0.06)); ps.translate(pp.x, pp.y, pp.z); inox.push(ps); }
        var off = bSalao + (bSalao === b0 ? 0.06 : -0.06);
        corrimao(P(L.a0, L.h0 + 0.95, off), P(L.a1, L.h1 + 0.95, off), 0.025);
        [0.35, 0.65].forEach(function(y){ corrimao(P(L.a0, L.h0 + y, off), P(L.a1, L.h1 + y, off), 0.012); });
        /* corrimão de parede, em suportes */
        var offP = bParede + (bParede === b0 ? 0.07 : -0.07);
        corrimao(P(L.a0, L.h0 + 0.9, offP), P(L.a1, L.h1 + 0.9, offP), 0.02);
        for (k = 0; k <= 2; k++) { var t2 = k / 2, sp2 = new THREE.CylinderGeometry(0.01, 0.01, 0.07, 6); sp2.rotateZ(Math.PI / 2); if (sobeZ) {} else sp2.rotateY(Math.PI / 2); var q2 = P(L.a0 + (L.a1 - L.a0) * t2, L.h0 + (L.h1 - L.h0) * t2 + 0.9, bParede + (bParede === b0 ? 0.035 : -0.035)); sp2.translate(q2.x, q2.y, q2.z); inox.push(sp2); }
        /* patamar até o próximo lance */
        var prox = lances[li + 1];
        if (prox && prox.a0 > L.a1 + 0.01) {
          degraus.push(caixa3(prox.a0 - L.a1, 0.12, larg, (L.a1 + prox.a0) / 2, L.h1 - 0.06, (b0 + b1) / 2));
          fech.push(caixa3(prox.a0 - L.a1, 0.3, 0.12, (L.a1 + prox.a0) / 2, L.h1 - 0.27, bSalao));
          corrimao(P(L.a1, L.h1 + 0.95, off), P(prox.a0, L.h1 + 0.95, off), 0.025);
          [0.35, 0.65].forEach(function(y){ corrimao(P(L.a1, L.h1 + y, off), P(prox.a0, L.h1 + y, off), 0.012); });
        }
      });
      /* colisor = pegada de todos os lances (com patamares) */
      var amin = Math.min.apply(null, lances.map(function(L){ return L.a0; })), amax = Math.max.apply(null, lances.map(function(L){ return L.a1; }));
      if (e.navegavel) {
        /* navegável: guarda-corpos dos dois lados valem em todas as alturas; no térreo, a escada só se entra pelo pé */
        var topo = e.topo || amax;
        col.nivel(null);
        if (sobeZ) { col.segmento(b0, amin, b0, topo); col.segmento(b1, amin, b1, topo); } else { col.segmento(amin, b0, topo, b0); col.segmento(amin, b1, topo, b1); }
        col.nivel(TERREO);
        if (sobeZ) col.segmento(b0, topo, b1, topo); else col.segmento(topo, b0, topo, b1);
        escadasNav.push({ sobeZ: sobeZ, b0: b0, b1: b1, amin: amin, topo: topo, lances: lances, alturaTopo: lances[lances.length - 1].h1 });
        if (topo > amax) degraus.push(caixa3(topo - amax, 0.2, larg, (amax + topo) / 2, lances[lances.length - 1].h1 - 0.1, (b0 + b1) / 2));
      } else if (e.colide !== false) { if (sobeZ) col.caixa(b0, amin, b1, amax); else col.caixa(amin, b0, amax, b1); }
      grupo.add(new THREE.Mesh(guarda(F.mesclar(degraus)), std(e.cor || '#d6d0c6', { roughness: 0.35 })));
      grupo.add(new THREE.Mesh(guarda(F.mesclar(fech)), std(e.corLateral || '#cfc6b7', { roughness: 0.7 })));
      grupo.add(new THREE.Mesh(guarda(F.mesclar(inox)), std('#e9eef2', { roughness: 0.18, metalness: 0.85 })));
    });

    /* ---------- painéis verticais: vidros das salas do 1º andar, divisórias ----------
       tipo: (vidro) · 'parede' (lisa ou textura 'madeira') · 'escuro' (vidro fumê opaco) ·
       'janelas' (parede com peitoril, faixa de janelas com caixilho e persianas de rolo) */
    var persianaMat = null;
    (def.paineis || []).forEach(function(p){
      var ax = p.a[0], az = p.a[1], bx = p.b[0], bz = p.b[1], Lp = Math.hypot(bx - ax, bz - az), h = p.y1 - p.y0, ang = Math.atan2(-(bz - az), bx - ax);
      var cx = (ax + bx) / 2, cz = (az + bz) / 2, mat;
      function plano(pw, ph, yc, m, ro){ var pl2 = new THREE.Mesh(guarda(new THREE.PlaneGeometry(pw, ph)), m); pl2.rotation.y = ang; pl2.position.set(cx, yc, cz); pl2.renderOrder = ro || 0; grupo.add(pl2); return pl2; }
      if (p.y0 < 0.5) col.segmento(ax, az, bx, bz); // divisória que chega ao chão também colide
      if (p.tipo === 'parede' || p.tipo === 'janelas') {
        mat = std(p.cor || '#eef2f5', { roughness: 0.85, side: THREE.DoubleSide });
        if (p.textura === 'madeira') mat.map = guarda(F.madeira([Lp / 3.6, h / 1.2]));
        if (p.tipo === 'parede') {
          if (p.esp) { var bx = new THREE.Mesh(guarda(new THREE.BoxGeometry(Lp, h, p.esp)), mat); bx.rotation.y = ang; bx.position.set(cx, p.y0 + h / 2, cz); grupo.add(bx); }
          else plano(Lp, h, p.y0 + h / 2, mat);
          return;
        }
        /* janelas: parede abaixo do peitoril e acima da verga; vidro, caixilho e persianas no meio */
        var pe0 = p.y0 + (p.peitoril || 0.95), ve = p.y0 + (p.verga || 2.75), hv = ve - pe0;
        plano(Lp, pe0 - p.y0, (p.y0 + pe0) / 2, mat); plano(Lp, p.y1 - ve, (ve + p.y1) / 2, mat);
        plano(Lp, hv, (pe0 + ve) / 2, vidroMat, 2);
        var gj = [], nj = Math.max(1, Math.round(Lp / (p.modulo || 1.4)));
        for (var j = 0; j <= nj; j++) { var gq = new THREE.BoxGeometry(0.06, hv, 0.08); gq.translate(-Lp / 2 + j * Lp / nj, (pe0 + ve) / 2 - p.y0 - h / 2, 0); gj.push(gq); }
        [pe0, ve, pe0 + hv * 0.62].forEach(function(y){ var gq = new THREE.BoxGeometry(Lp, 0.05, 0.09); gq.translate(0, y - p.y0 - h / 2, 0); gj.push(gq); });
        var jm = new THREE.Mesh(guarda(F.mesclar(gj)), caixilhoMat || (caixilhoMat = std('#dfe5ea', { roughness: 0.35, metalness: 0.35 }))); jm.rotation.y = ang; jm.position.set(cx, p.y0 + h / 2, cz); grupo.add(jm);
        if (p.persiana !== 0) { // rolos meio abaixados, cada módulo numa altura (como nas fotos)
          persianaMat = persianaMat || std('#c9c7c0', { roughness: 0.95, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
          var gp = [];
          for (j = 0; j < nj; j++) { var fr = (p.persiana || 0.45) * (0.75 + 0.5 * ((j * 7) % 5) / 4), hp2 = Math.min(hv - 0.05, hv * fr); var gq2 = new THREE.PlaneGeometry(Lp / nj - 0.08, hp2); gq2.translate(-Lp / 2 + (j + 0.5) * Lp / nj, ve - hp2 / 2 - p.y0 - h / 2, 0.06); gp.push(gq2);
            var tb = new THREE.BoxGeometry(Lp / nj - 0.06, 0.08, 0.08); tb.translate(-Lp / 2 + (j + 0.5) * Lp / nj, ve - 0.04 - p.y0 - h / 2, 0.07); gp.push(tb); }
          var pm2 = new THREE.Mesh(guarda(F.mesclar(gp)), persianaMat); pm2.rotation.y = ang; pm2.position.set(cx, p.y0 + h / 2, cz); grupo.add(pm2);
        }
        return;
      }
      mat = p.tipo === 'escuro' ? std('#27313b', { roughness: 0.12, metalness: 0.55, side: THREE.DoubleSide }) : vidroMat;
      /* o vidro fixo não cobre o vão das portas: entre portas vai até o alto; sobre cada porta, só a bandeira acima dela */
      var vaos = (p.portas || []).map(function(pt){ return [pt[0], pt[1], pt[2] || 2.1]; }).sort(function(a, b){ return a[0] - b[0]; });
      function trecho(s0, s1, yb, yt){ if (s1 - s0 < 0.005 || yt - yb < 0.005) return; var gp = new THREE.Mesh(guarda(new THREE.PlaneGeometry(s1 - s0, yt - yb)), mat); gp.rotation.y = ang; gp.position.set(cx, (yb + yt) / 2, cz); gp.translateX((s0 + s1) / 2 - Lp / 2); gp.renderOrder = 2; grupo.add(gp); }
      var ini = 0; vaos.forEach(function(v){ trecho(ini, v[0], p.y0, p.y1); trecho(v[0], v[1], p.y0 + v[2], p.y1); ini = v[1]; }); trecho(ini, Lp, p.y0, p.y1);
      var pl = { position: new THREE.Vector3(cx, p.y0 + h / 2, cz) };
      var gs = [], n = Math.max(1, Math.round(Lp / (p.modulo || 1.5)));
      function noVao(sx, y){ return vaos.some(function(v){ return sx > v[0] - 0.01 && sx < v[1] + 0.01 && (y == null || y < v[2]); }); }
      /* montantes: nenhum dentro do vão de uma porta (era a "barra no meio da porta"); o marco da porta é desenhado à parte */
      for (var i = 0; i <= n; i++) { var sxm = i * Lp / n; if (noVao(sxm)) continue; var g = new THREE.BoxGeometry(0.05, h, 0.06); g.translate(-Lp / 2 + sxm, 0, 0); gs.push(g); }
      /* travessas: as que passam abaixo da altura da porta (trilho do piso) são cortadas no vão */
      [0.03, h - 0.03].concat(p.travessas || []).forEach(function(y){
        var rs = [[0, Lp]]; vaos.forEach(function(v){ if (y >= v[2]) return; rs = rs.reduce(function(acc, r){ if (v[1] <= r[0] || v[0] >= r[1]) acc.push(r); else { if (v[0] > r[0]) acc.push([r[0], v[0]]); if (v[1] < r[1]) acc.push([v[1], r[1]]); } return acc; }, []); });
        rs.forEach(function(r){ if (r[1] - r[0] < 0.01) return; var g = new THREE.BoxGeometry(r[1] - r[0], 0.05, 0.06); g.translate((r[0] + r[1]) / 2 - Lp / 2, y - h / 2, 0); gs.push(g); });
      });
      (p.portas || []).forEach(function(pt){ // portas de vidro: marco e dois puxadores altos (C12)
        var s0 = -Lp / 2 + pt[0], s1 = -Lp / 2 + pt[1], mid2 = (s0 + s1) / 2, hp = pt[2] || 2.1;
        [s0, s1].forEach(function(sx){ var g = new THREE.BoxGeometry(0.06, hp, 0.07); g.translate(sx, hp / 2 - h / 2, 0); gs.push(g); });
        var gt = new THREE.BoxGeometry(s1 - s0, 0.06, 0.07); gt.translate(mid2, hp - h / 2, 0); gs.push(gt);
        if (pt[3] !== 'vao') [-0.07, 0.07].forEach(function(d){ var hd = new THREE.CylinderGeometry(0.014, 0.014, 1.2, 8); hd.translate(mid2 + d, 1.05 - h / 2, 0.06); gs.push(hd); var hd2 = hd.clone(); hd2.translate(0, 0, -0.12); gs.push(hd2); });
      });
      var fm = new THREE.Mesh(guarda(F.mesclar(gs)), caixilhoMat || (caixilhoMat = std('#dfe5ea', { roughness: 0.35, metalness: 0.35 })));
      fm.rotation.y = ang; fm.position.copy(pl.position); grupo.add(fm);
      (p.faixas || []).forEach(function(fx){ // faixas adesivas (Nexo, triângulos, grafismo do coworking, vidro jateado), recortadas nas portas
        var x0 = fx.de || 0, x1 = fx.ate || Lp, cortes = [[x0 + (fx.de == null ? 0.04 : 0), x1 - (fx.ate == null ? 0.04 : 0)]];
        vaos.forEach(function(v){ if (fx.y0 >= p.y0 + v[2]) return; cortes = cortes.reduce(function(acc, r){ if (v[1] <= r[0] || v[0] >= r[1]) acc.push(r); else { if (v[0] > r[0]) acc.push([r[0], v[0]]); if (v[1] < r[1]) acc.push([v[1], r[1]]); } return acc; }, []); });
        cortes.forEach(function(r){
          var fw = r[1] - r[0]; if (fw < 0.05) return;
          var tx = fx.arte === 'fosca' ? guarda(F.faixaFosca(fw)) : artePor(fx.arte);
          var fp = new THREE.Mesh(guarda(new THREE.PlaneGeometry(fw, fx.y1 - fx.y0)), guarda(new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
          fp.rotation.y = ang; fp.position.set(cx, fx.y0 + (fx.y1 - fx.y0) / 2, cz); fp.translateX((r[0] + r[1]) / 2 - Lp / 2); fp.translateZ(fx.lado === 'tras' ? -0.012 : 0.012); fp.renderOrder = 3; grupo.add(fp);
        });
      });
      if (p.persianas) { // persianas de rolo atrás de um vidro (fachada da ala leste)
        persianaMat = persianaMat || std('#c9c7c0', { roughness: 0.95, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
        p.persianas.forEach(function(ps){ var pp = plano(Lp - 0.1, ps[1] - ps[0], (ps[0] + ps[1]) / 2, persianaMat); pp.translateZ(p.ladoPersiana === 'frente' ? 0.07 : -0.07); });
      }
    });

    /* ---------- forros fora do retângulo do hall (ex.: ala leste do 1º andar) ---------- */
    (def.forros || []).forEach(function(f){
      var r = f.r, w = r[2] - r[0], d = r[3] - r[1], fg = guarda(new THREE.PlaneGeometry(w, d)), fu = fg.attributes.uv;
      for (var i = 0; i < fu.count; i++) fu.setXY(i, fu.getX(i) * w / placaForro, fu.getY(i) * d / placaForro);
      var fm = new THREE.Mesh(fg, std(S.corForro || '#ffffff', { map: guarda(F.forro([1, 1])), roughness: 0.9 })); fm.rotation.x = Math.PI / 2; fm.position.set(r[0] + w / 2, f.y || H, r[1] + d / 2); grupo.add(fm);
    });

    /* ---------- portas de abrir: giram para dentro quando o boneco se aproxima (o vão é sempre passável;
       a folha aberta encosta onde um segmento de colisão fixo a representa) ---------- */
    var portasA = [];
    (def.portasAnimadas || []).forEach(function(pd){
      var dx = pd.b[0] - pd.a[0], dz = pd.b[1] - pd.a[1], L2 = Math.hypot(dx, dz), y0 = pd.y || 0, hp = pd.altura || 2.1;
      var piv = new THREE.Group(); piv.position.set(pd.a[0], y0, pd.a[1]); piv.rotation.y = Math.atan2(-dz, dx); piv.userData.porta = pd.id || true;
      var folha;
      if (pd.arte) folha = new THREE.Mesh(guarda(new THREE.BoxGeometry(L2 - 0.03, hp - 0.02, 0.035)), std('#ffffff', { map: artePor(pd.arte), roughness: 0.5 }));
      else folha = new THREE.Mesh(guarda(new THREE.BoxGeometry(L2 - 0.03, hp - 0.02, 0.012)), guarda(new THREE.MeshPhysicalMaterial({ color: lin('#e8f7ff'), transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false })));
      folha.position.set(L2 / 2, hp / 2, 0); folha.renderOrder = 2; piv.add(folha);
      /* caixilho, dobradiças e puxador usam o mesmo alumínio: viram UMA malha filha do pivô (antes eram até 7 malhas por porta,
         7 draw calls por olho; agora 1). A folha (vidro ou arte) continua separada, porque o material é outro. */
      var cxm = caixilhoMat || (caixilhoMat = std('#dfe5ea', { roughness: 0.35, metalness: 0.35 })), pecas = [];
      function peca(geo, x, y){ geo.translate(x, y, 0); pecas.push(geo); }
      if (!pd.arte) { // folha de vidro: caixilho de alumínio em volta e duas dobradiças
        [hp - 0.0425, 0.0225].forEach(function(yy){ peca(new THREE.BoxGeometry(L2 - 0.03, 0.045, 0.03), L2 / 2, yy); });
        [0.03, L2 - 0.03].forEach(function(xx){ peca(new THREE.BoxGeometry(0.04, hp - 0.02, 0.03), xx, hp / 2); });
        [0.35, hp - 0.35].forEach(function(yy){ peca(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), 0.01, yy); });
      }
      peca(new THREE.BoxGeometry(0.03, 0.9, 0.09), L2 - 0.12, 1.05);   // puxador
      var ferragem = new THREE.Mesh(guarda(F.mesclar(pecas)), cxm); ferragem.name = 'porta-ferragem'; piv.add(ferragem);
      grupo.add(piv);
      var sentido = pd.abre === 'direita' ? -1 : 1, oa = pd.a, open = { x: pd.a[0] + (-dz / L2) * sentido * L2, z: pd.a[1] + (dx / L2) * sentido * L2 };
      /* a colisão acompanha a folha: fechada, o vão é sólido; aberta, a folha encostada é que colide */
      col.nivel(NIV ? (y0 > 3 ? [3, 99] : [-1, 2]) : null);
      var segAberta = col.segmento(oa[0], oa[1], open.x, open.z), segFechada = col.segmento(pd.a[0], pd.a[1], pd.b[0], pd.b[1]);
      col.nivel(null); segAberta.off = true;
      /* zonas dos dois lados da porta: ela aparece se qualquer uma for visível */
      var pmx = (pd.a[0] + pd.b[0]) / 2, pmz = (pd.a[1] + pd.b[1]) / 2, pnx = -dz / L2 * 0.6, pnz = dx / L2 * 0.6, zonasPorta = [];
      [zonaEm(pmx + pnx, pmz + pnz, y0), zonaEm(pmx - pnx, pmz - pnz, y0)].forEach(function(z){ if (z && zonasPorta.indexOf(z) < 0) zonasPorta.push(z); });
      portasA.push({ id: pd.id, piv: piv, base: piv.rotation.y, sentido: sentido, ang: 0, cx: pmx, cz: pmz, y: y0, segAberta: segAberta, segFechada: segFechada, zonas: zonasPorta });
    });
    if (portasA.length) animados.push(function(t, cam, jog){
      if (!jog) return;
      portasA.forEach(function(pa){
        var perto = Math.abs((jog.y || 0) - pa.y) < 1.2 && Math.hypot(jog.x - pa.cx, jog.z - pa.cz) < 1.7;
        pa.ang += ((perto ? 1 : 0) - pa.ang) * 0.12;
        pa.segFechada.off = pa.ang > 0.55; pa.segAberta.off = pa.ang < 0.35;
        pa.piv.rotation.y = pa.base - pa.sentido * pa.ang * Math.PI / 2; // girar em -y leva a folha para o lado de dentro (normal à esquerda)
      });
    });

    /* ---------- luzes pequenas: LEDs de status (pulsam devagar) e faixas de luz indireta ---------- */
    var leds = [];
    (def.leds || []).forEach(function(l, i){
      var tam = l.tam || [0.02, 0.02, 0.01], base = lin(l.cor || '#5ff0ff'), mt = guarda(new THREE.MeshBasicMaterial({ color: base.clone() }));
      var lm = new THREE.Mesh(guarda(new THREE.BoxGeometry(tam[0], tam[1], tam[2])), mt); lm.position.set(l.p[0], l.p[1], l.p[2]); grupo.add(lm);
      if (l.pulso) leds.push({ m: mt, base: base, per: l.pulso, fase: l.fase != null ? l.fase : i * 0.7 });
    });
    if (leds.length) animados.push(function(t){ leds.forEach(function(L){ L.m.color.copy(L.base).multiplyScalar(0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / L.per + L.fase))); }); });

    /* ---------- placas de sinalização (textos legíveis nas fotos) ---------- */
    (def.placas || []).forEach(function(pl2){
      var m3 = new THREE.Mesh(guarda(new THREE.PlaneGeometry(pl2.w, pl2.h)), std('#ffffff', { map: artePor(pl2.arte), roughness: 0.6, side: THREE.DoubleSide, transparent: !!pl2.transparente }));
      m3.position.set(pl2.x, pl2.y, pl2.z); m3.rotation.y = pl2.rot || 0; grupo.add(m3);
      if (pl2.moldura) { var mb = new THREE.Mesh(guarda(new THREE.BoxGeometry(pl2.w + 0.04, pl2.h + 0.04, 0.03)), std(pl2.moldura, { roughness: 0.5 })); mb.position.copy(m3.position); mb.rotation.y = m3.rotation.y; mb.translateZ(-0.02); grupo.add(mb); }
    });

    /* ---------- obstáculos explícitos (cada um cobre algo visível: ex. um bloco de fileiras de cadeiras) ---------- */
    (def.obstaculos || []).forEach(function(o){ col.caixa(o.caixa[0], o.caixa[1], o.caixa[2], o.caixa[3]); });

    /* ---------- móveis: um InstancedMesh por peça de cada tipo ---------- */
    var porTipo = {};
    (def.moveis || []).forEach(function(it){ (porTipo[it.tipo] = porTipo[it.tipo] || []).push(it); });
    var sombras = [], assentos = [], tmpM = new THREE.Matrix4(), celulasVR = [];
    function matrizItem(it){ return MV.M(it.x, it.y || 0, it.z, 0, it.rot || 0, 0); }
    /* lado da célula de recorte dos móveis (m); O.config.celulaMoveis troca o valor para medições */
    var CELULA = (O.config && O.config.celulaMoveis) || 8;
    /* a célula também respeita a zona de visibilidade do VR: cada bloco pertence a uma zona só */
    function celulas(itens){
      var mapa = {};
      itens.forEach(function(it){
        var zn = zonaEm(it.x, it.z, it.y || 0), k = zn + '|' + Math.floor(it.x / CELULA) + ',' + Math.floor(it.z / CELULA) + ',' + ((it.y || 0) > 3 ? 1 : 0);
        if (!mapa[k]) { mapa[k] = []; mapa[k].zona = zn; }
        mapa[k].push(it);
      });
      return Object.keys(mapa).map(function(k){ return mapa[k]; });
    }
    function involucro(geo){
      var g = new THREE.BufferGeometry();
      g.setIndex(geo.index);
      Object.keys(geo.attributes).forEach(function(k){ g.setAttribute(k, geo.attributes[k]); });
      geo.groups.forEach(function(gr){ g.addGroup(gr.start, gr.count, gr.materialIndex); });
      return g;
    }
    function esferaDasInstancias(base, mesh, folga){
      var cx = new THREE.Box3(), m = new THREE.Matrix4(), c = new THREE.Vector3(), r;
      for (var k = 0; k < mesh.count; k++) {
        mesh.getMatrixAt(k, m); c.copy(base.center).applyMatrix4(m); r = base.radius * m.getMaxScaleOnAxis() + folga;
        cx.expandByPoint(c.clone().addScalar(-r)); cx.expandByPoint(c.clone().addScalar(r));
      }
      return cx.getBoundingSphere(new THREE.Sphere());
    }
    Object.keys(porTipo).forEach(function(tipo){
      var TP = MV.TIPOS[tipo]; if (!TP) { console.warn('[Orvalho] tipo de móvel desconhecido:', tipo); return; }
      var itens = porTipo[tipo];
      /* agrupa as peças do tipo por paleta + faixa de contorno + dupla face: menos chamadas de desenho, mesmos triângulos */
      var grupos = {};
      function faixaEsp(e){ return !e ? 0 : e >= 0.011 ? 0.012 : e >= 0.007 ? 0.008 : 0.005; }
      TP.partes().forEach(function(pt){
        var chave = pt.pal + '|' + faixaEsp(pt.esp) + '|' + (pt.duplo ? 1 : 0);
        var gr = grupos[chave] || (grupos[chave] = { pal: pt.pal, esp: faixaEsp(pt.esp), duplo: pt.duplo, geos: [] });
        pt.ms.forEach(function(ml){ gr.geos.push(pt.geo.clone().applyMatrix4(ml)); });
        guarda(pt.geo);
      });
      Object.keys(grupos).forEach(function(chave){
        var gr = grupos[chave], geo = guarda(F.mesclar(gr.geos)), mat;
        var plano = MV.BRILHO[gr.pal] || (MV.TEXTURAS && MV.TEXTURAS[gr.pal]);
        if (plano) { // peça acesa ou impressa (tela, LED, logotipo, painel): sem luz e sem contorno
          mat = MV.TEXTURAS && MV.TEXTURAS[gr.pal] ? guarda(new THREE.MeshBasicMaterial({ map: texDe(gr.pal), side: THREE.DoubleSide }))
            : gr.pal === 'tela' ? guarda(new THREE.MeshBasicMaterial({ map: telaTex() })) : guarda(new THREE.MeshBasicMaterial({ color: lin('#5ff0ff') }));
        } else {
          geo.computeBoundingBox();
          var bb = geo.boundingBox;
          mat = guarda(G.jelly({ top: bb.max.y - (bb.max.y - bb.min.y) * 0.35, bot: bb.min.y }));
          if (gr.duplo) mat.side = THREE.DoubleSide; // folhas: planos finos vistos dos dois lados
        }
        /* células: as instâncias do tipo são divididas em blocos de CELULA m por pavimento. Cada bloco é uma InstancedMesh com a
           esfera das SUAS instâncias, para o recorte pela câmera funcionar (a r149 recortaria pela esfera da geometria na origem,
           por isso antes o recorte ficava desligado e o mapa inteiro de móveis era desenhado em todo quadro). A geometria de cada
           bloco é um invólucro que compartilha atributos e índice com `geo`: na GPU continua um buffer só. A imagem não muda. */
        geo.computeBoundingSphere();
        celulas(itens).forEach(function(cel){
          var g = guarda(involucro(geo)), m1 = new THREE.InstancedMesh(g, mat, cel.length), om1 = null;
          cel.forEach(function(it, k){ m1.setMatrixAt(k, matrizItem(it)); });
          m1.instanceMatrix.needsUpdate = true;
          g.boundingSphere = esferaDasInstancias(geo.boundingSphere, m1, 0.05);   // folga para o contorno empurrado pela normal
          m1.frustumCulled = true;   // a r149 cria toda InstancedMesh com frustumCulled = false
          if (!plano) {
            if (gr.esp) { om1 = guarda(G.outline(m1, gr.esp)); m1.children[0].frustumCulled = true; }
            G.pintar(mat, pal(gr.pal), om1);
          }
          celulasVR.push({ mesh: m1, casca: om1 ? m1.children[0] : null, esfera: g.boundingSphere, zona: cel.zona });
          m1.name = tipo; grupo.add(m1);
        });
      });
      itens.forEach(function(it){
        col.nivel(NIV && (it.nivel === 'superior' || (it.y || 0) > 3) ? [3, 99] : TERREO);
        var c = it.colisao !== undefined ? it.colisao : TP.colisao, rot = it.rot || 0, sw = Math.abs(Math.sin(rot)) > 0.5; // o item pode trocar a colisão do tipo
        if (c && c.caixa) { var hw = (sw ? c.caixa[1] : c.caixa[0]) / 2, hd = (sw ? c.caixa[0] : c.caixa[1]) / 2; col.caixa(it.x - hw, it.z - hd, it.x + hw, it.z + hd, TP.alto || it.alto); }
        if (c && c.circulo) col.circulo(it.x, it.z, c.circulo);
        /* assentos do tipo (ex.: cadeiras dos arcos) viram pontos "Sentar"; "saida" é onde o boneco fica ao levantar */
        (TP.assentos || []).forEach(function(a, ai){
          var cs = Math.cos(rot), sn = Math.sin(rot), wx = function(lx, lz){ return it.x + lx * cs + lz * sn; }, wz = function(lx, lz){ return it.z - lx * sn + lz * cs; };
          assentos.push({ id: (it.id || it.tipo) + '-assento-' + ai, x: wx(a.x, a.z), y: it.y || 0, z: wz(a.x, a.z), rumo: (a.rot || 0) + rot, altura: a.altura || 0.45,
            saida: { x: wx(a.saida[0], a.saida[1]), z: wz(a.saida[0], a.saida[1]) } });
        });
        var ys = it.y || 0, noPiso = ys < 0.01 || (it.nivel === 'superior' && NIV && NIV.superior && Math.abs(ys - NIV.superior.piso) < 0.01);
        if (TP.sombra && noPiso) sombras.push({ x: it.x, y: ys, z: it.z, w: sw ? TP.sombra[1] : TP.sombra[0], d: sw ? TP.sombra[0] : TP.sombra[1] });
      });
    });
    col.nivel(null);
    var _tela = null, _tex = {};
    function telaTex(){ return _tela || (_tela = guarda(F.tela())); }
    function texDe(nome){ _tex = _tex || {}; return _tex[nome] || (_tex[nome] = guarda(MV.TEXTURAS[nome]())); }

    /* sombras macias pintadas no chão (sem sombra em tempo real) */
    if (sombras.length) {
      var sg = guarda(new THREE.PlaneGeometry(1, 1)); sg.rotateX(-Math.PI / 2);
      var sm = guarda(new THREE.MeshBasicMaterial({ map: guarda(F.sombra()), transparent: true, depthWrite: false, opacity: 0.85 }));
      var si = new THREE.InstancedMesh(sg, sm, sombras.length);
      sombras.forEach(function(s, i){ si.setMatrixAt(i, tmpM.compose(new THREE.Vector3(s.x, (s.y || 0) + 0.006, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, 1, s.d))); });
      si.renderOrder = -1; si.frustumCulled = false; grupo.add(si);
    }

    /* ---------- tubos (eletrodutos pretos das fotos) ---------- */
    (def.tubos || []).forEach(function(t){
      var pts = t.pontos.map(function(p){ return new THREE.Vector3(p[0], p[1], p[2]); });
      grupo.add(gel(F.tubo(pts, t.raio || 0.018, 8 * pts.length), t.pal || 'grafite', 0.006));
      if (t.caixa) { var cx = gel(F.caixa(0.09, 0.12, 0.05, 0.015), 'grafite', 0.006); cx.position.copy(pts[t.caixa === 'fim' ? pts.length - 1 : 0]); grupo.add(cx); }
    });

    /* ---------- lá fora: céu Aero, sacada, paisagem e nuvens; corredor atrás do vidro ---------- */
    var X = def.exterior || {};
    var ceu = F.ceu(Math.max(90, W * 2.2)); guarda(ceu.geometry); guarda(ceu.material); ceu.position.set(W / 2, 0, D / 2); ceu.renderOrder = -10; grupo.add(ceu);
    if (X.terreno) { // chão lá fora (térreo): estacionamento, calçada e grama ao redor
      var tr = new THREE.Mesh(guarda(new THREE.PlaneGeometry(400, 400)), std(X.terreno.cor || '#b9c4b0', { roughness: 0.95 }));
      tr.rotation.x = -Math.PI / 2; tr.position.set(W / 2, -0.03, D / 2); grupo.add(tr);
      if (X.terreno.calcada) { var cl = new THREE.Mesh(guarda(new THREE.PlaneGeometry(W + 8, X.terreno.calcada)), std('#dfe3e6', { roughness: 0.9 })); cl.rotation.x = -Math.PI / 2; cl.position.set(W / 2, -0.02, -X.terreno.calcada / 2 - T); grupo.add(cl); }
    }
    if (X.sacada) {
      var s = X.sacada;
      var laje = new THREE.Mesh(guarda(new THREE.BoxGeometry(s.fundo, 0.2, D + 0.4)), std('#e9eff4', { roughness: 0.7 }));
      laje.position.set(-s.fundo / 2 - T, -0.1, D / 2); grupo.add(laje);
      var xg = -T - s.fundo + 0.06;
      for (var zp = 0.1; zp <= D; zp += 0.95) { var po = gel(F.cilindro(0.025, 1.05, 0.01, 12), 'branco', 0.006); po.position.set(xg, 0, zp); grupo.add(po); }
      var corr = gel(F.caixa(0.07, 0.05, D + 0.2, 0.024), 'branco', 0.008); corr.position.set(xg, 1.07, D / 2); grupo.add(corr);
      var gv = new THREE.Mesh(guarda(new THREE.PlaneGeometry(D, 0.9)), vidroMat); gv.rotation.y = Math.PI / 2; gv.position.set(xg, 0.55, D / 2); grupo.add(gv);
    }
    /* colinas verdes lá embaixo, com o degradê de folha do REGRAS */
    (X.colinas || []).forEach(function(c){
      var geo = guarda(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2));
      var pos = geo.attributes.position, cols = [], top = new THREE.Color('#c3f08a'), bot = new THREE.Color('#2e7a12');
      for (var i = 0; i < pos.count; i++) { var cc = bot.clone().lerp(top, Math.pow(pos.getY(i), 0.7)).convertSRGBToLinear(); cols.push(cc.r, cc.g, cc.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      var hm = new THREE.Mesh(geo, guarda(new THREE.MeshLambertMaterial({ vertexColors: true })));
      hm.scale.set(c.r, c.h, c.r * (c.achata || 1)); hm.position.set(c.x, c.y, c.z); grupo.add(hm);
    });
    /* nuvens: bolhas brancas agrupadas, andando devagar */
    var nuvemMat = guarda(new THREE.MeshLambertMaterial({ color: lin('#ffffff'), emissive: lin('#dceeff'), emissiveIntensity: 0.55 }));
    var bolaGeo = guarda(new THREE.SphereGeometry(1, 20, 14));
    (X.nuvens || []).forEach(function(n, idx){
      var g = new THREE.Group();
      g.add(new THREE.Mesh(guarda(F.mesclar([[0, 0, 0, 1.5], [1.6, -0.2, 0.2, 1.1], [-1.5, -0.3, -0.1, 1.0], [0.6, 0.7, 0, 1.0]].map(function(b){
        return bolaGeo.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Quaternion(), new THREE.Vector3(b[3], b[3], b[3])));
      }))), nuvemMat)); // uma malha por nuvem
      g.scale.setScalar(n.s || 2); g.position.set(n.x, n.y, n.z); grupo.add(g);
      animados.push(function(t){ g.position.z = n.z + Math.sin(t * 0.02 + idx) * 3; });
    });
    if (X.corredor) {
      var c = X.corredor;
      var cp = new THREE.Mesh(guarda(new THREE.PlaneGeometry(c.fundo, D + 6)), std('#eef3f7', { roughness: 0.4 }));
      cp.rotation.x = -Math.PI / 2; cp.position.set(W + T + c.fundo / 2, 0, D / 2); grupo.add(cp);
      var cw = new THREE.Mesh(guarda(new THREE.PlaneGeometry(D + 6, H)), std('#f4f8fb', { roughness: 0.9 }));
      cw.rotation.y = -Math.PI / 2; cw.position.set(W + T + c.fundo, H / 2, D / 2); grupo.add(cw);
      var cf = new THREE.Mesh(guarda(new THREE.PlaneGeometry(c.fundo, D + 6)), std('#f6f9fb', { roughness: 0.9 }));
      cf.rotation.x = Math.PI / 2; cf.position.set(W + T + c.fundo / 2, H, D / 2); grupo.add(cf);
      [0.6, 2.4, 4.2].forEach(function(z){ var l = new THREE.Mesh(lumGeo, lumMat); l.rotation.x = Math.PI / 2; l.position.set(W + T + c.fundo / 2, H - 0.004, z); grupo.add(l); });
    }

    /* ---------- bolhas subindo devagar dentro da sala (ambiente vivo do Aero) ---------- */
    var nb = O.still ? 0 : (def.bolhas || 0);
    if (nb) {
      /* sprite de bolha igual ao bokeh do site (brilho em cima, aro claro), sempre de frente para a câmera */
      var bm = guarda(new THREE.SpriteMaterial({ map: guarda(F.bolha()), transparent: true, depthWrite: false, opacity: 0.9 }));
      var seeds = [];
      for (var b = 0; b < nb; b++) {
        var sp = new THREE.Sprite(bm); grupo.add(sp);
        seeds.push({ sp: sp, x: 0.4 + Math.random() * (W - 0.8), z: 0.4 + Math.random() * (D - 0.8), r: 0.05 + Math.random() * 0.07, v: 0.07 + Math.random() * 0.09, o: Math.random() * 10 });
      }
      animados.push(function(t, cam){
        seeds.forEach(function(s){
          var y = ((t * s.v + s.o) % (H - 0.3)) + 0.15;
          s.sp.position.set(s.x + Math.sin(t * 0.7 + s.o) * 0.12, y, s.z + Math.cos(t * 0.5 + s.o) * 0.1);
          var fade = Math.min(1, (H - 0.2 - y) / 0.5, y / 0.4);
          if (cam) fade *= Math.min(1, Math.max(0, (s.sp.position.distanceTo(cam) - 0.6) / 0.8)); // some perto da câmera
          s.sp.scale.setScalar(s.r * Math.max(0.001, fade));
        });
      });
    }

    col.nivel(null);

    /* ---------- anexos: trechos navegáveis além de uma parede (ex.: corredor ao lado da Nexo), com piso, forro e paredes ---------- */
    var ANX = def.anexos || [];
    /* "y": anexo num pavimento superior (ex.: nichos dos banheiros do 1º andar). Lá o piso já existe (laje), então não se
       desenha outro por cima, e as paredes só colidem naquele pavimento. No térreo, idem: só colidem no térreo. */
    ANX.forEach(function(a){
      var r = a.r, w = r[2] - r[0], d = r[3] - r[1], pe = a.pe || 3.0, y0 = a.y || 0, mp = std(a.cor || '#ffffff', { roughness: 0.85, side: THREE.DoubleSide });
      if (a.textura === 'madeira') mp.map = guarda(F.madeira([Math.max(w, d) / 3.6, pe / 1.2]));
      col.nivel(NIV ? (y0 > 3 ? [3, 99] : [-1, 2]) : null);
      if (!y0) {
        var pg = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, d)), std(S.pisoTinta || '#ffffff', { map: guarda(F.piso([w / placa, d / placa], S.pisoCores)), roughness: S.pisoRugosidade || 0.3 }));
        pg.rotation.x = -Math.PI / 2; pg.position.set(r[0] + w / 2, 0.001, r[1] + d / 2); grupo.add(pg);
      }
      var fg = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, d)), std(S.corForro || '#ffffff', { map: guarda(F.forro([w / placaForro, d / placaForro])), roughness: 0.9 }));
      fg.rotation.x = Math.PI / 2; fg.position.set(r[0] + w / 2, y0 + pe, r[1] + d / 2); grupo.add(fg);
      function paredeA(ax, az, bx, bz){ var L2 = Math.hypot(bx - ax, bz - az), m2 = new THREE.Mesh(guarda(new THREE.PlaneGeometry(L2, pe)), mp); m2.position.set((ax + bx) / 2, y0 + pe / 2, (az + bz) / 2); m2.rotation.y = Math.atan2(-(bz - az), bx - ax); grupo.add(m2); col.segmento(ax, az, bx, bz); }
      paredeA(r[0], r[1], r[0], r[3]); paredeA(r[2], r[1], r[2], r[3]);
      if (!a.fundoVidro) paredeA(r[0], r[3], r[2], r[3]);
      else { // fundo de vidro com porta (fechada): caixilho e puxadores
        var vf = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, pe)), vidroMat); vf.position.set(r[0] + w / 2, pe / 2, r[3]); vf.renderOrder = 2; grupo.add(vf); col.segmento(r[0], r[3], r[2], r[3]);
        var cg = [];
        [[r[0], pe], [r[2], pe], [r[0] + w / 2, pe]].forEach(function(q){ var g = new THREE.BoxGeometry(0.06, q[1], 0.07); g.translate(q[0], q[1] / 2, r[3]); cg.push(g); });
        [0.03, 2.15, pe - 0.03].forEach(function(y){ var g = new THREE.BoxGeometry(w, 0.06, 0.07); g.translate(r[0] + w / 2, y, r[3]); cg.push(g); });
        [-0.08, 0.08].forEach(function(dx){ var g = new THREE.CylinderGeometry(0.014, 0.014, 1.2, 8); g.translate(r[0] + w / 2 + dx, 1.05, r[3] - 0.06); cg.push(g); });
        grupo.add(new THREE.Mesh(guarda(F.mesclar(cg)), caixilhoMat || (caixilhoMat = std('#dfe5ea', { roughness: 0.35, metalness: 0.35 }))));
      }
      (a.portas || []).forEach(function(pt){ // portas nas paredes laterais (x = r[0] ou r[2]) ou no fundo (z = r[3], de/ate em x), com arte
        var wl = pt.ate - pt.de, fl;
        if (pt.lado === 'fundo') { fl = new THREE.Mesh(guarda(new THREE.BoxGeometry(wl, 2.1, 0.04)), std('#ffffff', { map: artePor(pt.arte || 'veneziana'), roughness: 0.55 })); fl.position.set((pt.de + pt.ate) / 2, y0 + 1.05, r[3] - 0.03); }
        else { fl = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.04, 2.1, wl)), std('#ffffff', { map: artePor(pt.arte || 'veneziana'), roughness: 0.55 })); fl.position.set(pt.lado === 'x1' ? r[2] - 0.03 : r[0] + 0.03, y0 + 1.05, (pt.de + pt.ate) / 2); }
        grupo.add(fl);
        /* batente branco completo em volta da folha (verga + dois montantes), como nas portas do hall */
        var fundo = pt.lado === 'fundo', bt = gel(F.caixa(fundo ? wl + 0.12 : 0.06, 0.06, fundo ? 0.06 : wl + 0.12, 0.01), 'branco', 0.006);
        bt.position.set(fl.position.x, y0 + 2.13, fl.position.z); grupo.add(bt);
        [-1, 1].forEach(function(sg){ var mt = gel(F.caixa(fundo ? 0.06 : 0.06, 2.16, 0.06, 0.01), 'branco', 0.006);
          mt.position.set(fl.position.x + (fundo ? sg * (wl / 2 + 0.03) : 0), y0 + 1.08, fl.position.z + (fundo ? 0 : sg * (wl / 2 + 0.03))); grupo.add(mt); });
        if (pt.placa) { var pq = new THREE.Mesh(guarda(new THREE.PlaneGeometry(pt.placa.w || 0.5, pt.placa.h || 0.16)), std('#ffffff', { map: artePor(pt.placa.arte), roughness: 0.6 }));
          pq.position.set(fl.position.x, y0 + 2.32, fl.position.z + (fundo ? -0.025 : 0)); if (!fundo) pq.rotation.y = pt.lado === 'x1' ? -Math.PI / 2 : Math.PI / 2; else pq.rotation.y = Math.PI; grupo.add(pq); }
      });
      col.nivel(null);
    });
    var FT = (def.forros || []).filter(function(f){ return f.teto; });   // forros de sala (ex.: podcast) que a câmera respeita
    var ANX0 = ANX.filter(function(a){ return !a.y; });   // anexos do térreo (os do 1º andar ficam dentro da área superior)

    /* ---------- elevador: folhas que abrem e cabine em cada parada (controle em O.elevador) ---------- */
    var elev = def.elevador && O.elevador && O.elevador.criar3D ? O.elevador.criar3D(def.elevador, { grupo: grupo, std: std, guarda: guarda, lin: lin }) : null;
    if (elev) { var tElev = null; animados.push(function(t){ var dt = tElev == null ? 0.016 : Math.min(0.05, Math.max(0, t - tElev)); tElev = t; elev.atualizar(dt); }); }

    /* ---------- pessoas do espaço: mesmo sistema de corpo/acessórios do avatar ---------- */
    var npcs = O.criarNPCs && def.npcs && def.npcs.length ? O.criarNPCs(def.npcs) : null;
    if (npcs) { grupo.add(npcs.grupo); npcs.grupo.children.forEach(function(n){ n.userData.npc = true; }); animados.push(function(t, cam){ npcs.atualizar(t, 0.016, cam); }); }

    /* ---------- 1º andar navegável: colisores próprios (guarda-corpo, vidros das salas) ---------- */
    if (NIV && NIV.superior) {
      col.nivel([3, 99]);
      (NIV.superior.segmentos || []).forEach(function(sg){ col.segmento(sg[0], sg[1], sg[2], sg[3]); });
      col.nivel(null);
    }
    function dentroR(r, x, z){ return x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]; }
    /* altura do piso para quem está em (x, z) com o piso atual em y: escada (rampa suave sob os degraus), 1º andar, térreo, anexos.
       null = não há piso (ex.: sair do mezanino pelo vão). */
    function alturaPiso(x, z, y){
      for (var i = 0; i < escadasNav.length; i++) {
        var e = escadasNav[i], a = e.sobeZ ? z : x, b = e.sobeZ ? x : z;
        if (b >= e.b0 && b <= e.b1 && a >= e.amin && a <= e.topo) {
          for (var k = 0; k < e.lances.length; k++) { var L = e.lances[k]; if (a <= L.a1) return a < L.a0 ? L.h0 : L.h0 + (L.h1 - L.h0) * (a - L.a0) / (L.a1 - L.a0); }
          return e.alturaTopo;
        }
      }
      if (NIV && NIV.superior && y > 3) return NIV.superior.areas.some(function(r){ return dentroR(r, x, z); }) ? NIV.superior.piso : null;
      var noHall = x >= 0 && x <= W && z >= 0 && z <= D;
      var noAnexo = ANX0.some(function(a){ return dentroR(a.r, x, z); });
      return noHall || noAnexo ? 0 : null;
    }

    /* paradas da escada navegável sob (x, z) (ou a até 0,6 m das pontas): pé, patamares e topo, no eixo da escada, cada uma com a
       cota do piso. Usado pelo teleporte do VR, que gruda o alvo na parada mais próxima (locomocao.js). null = não é escada. */
    function paradasEscada(x, z){
      for (var i = 0; i < escadasNav.length; i++) {
        var e = escadasNav[i], a = e.sobeZ ? z : x, b = e.sobeZ ? x : z;
        if (b < e.b0 || b > e.b1 || a < e.amin - 0.6 || a > e.topo + 0.6) continue;
        var bm = (e.b0 + e.b1) / 2, L = e.lances, out = [];
        var ponto = function(aa, h, tipo){ return e.sobeZ ? { x: bm, z: aa, y: h, tipo: tipo } : { x: aa, z: bm, y: h, tipo: tipo }; };
        out.push(ponto(L[0].a0 - 0.5, L[0].h0, 'pe'));
        for (var k = 0; k < L.length - 1; k++) if (L[k + 1].a0 > L[k].a1 + 0.01) out.push(ponto((L[k].a1 + L[k + 1].a0) / 2, L[k].h1, 'patamar'));
        out.push(ponto(e.topo + 0.5, e.alturaTopo, 'topo'));
        return out;
      }
      return null;
    }

    /* agrupa as peças avulsas de gelatina (molduras, portas, longarinas...) numa malha por paleta e espessura de contorno */
    var lotes = {};
    grupo.children.slice().forEach(function(m){
      if (!m.isMesh || !m.userData.lote || m.isInstancedMesh) return;
      m.updateMatrix();
      var l = lotes[m.userData.lote] || (lotes[m.userData.lote] = { nome: m.userData.lote.split('|')[0], esp: +m.userData.lote.split('|')[1], geos: [] });
      l.geos.push(m.geometry.clone().applyMatrix4(m.matrix));
      grupo.remove(m);
    });
    Object.keys(lotes).forEach(function(k){
      var l = lotes[k], geo = guarda(F.mesclar(l.geos)); geo.computeBoundingBox();
      var mt = guarda(G.jelly({ top: Math.min(2.2, geo.boundingBox.max.y), bot: Math.max(0, geo.boundingBox.min.y) })), mesh = new THREE.Mesh(geo, mt), om = null;
      if (l.esp) om = guarda(G.outline(mesh, l.esp));
      G.pintar(mt, pal(l.nome), om); grupo.add(mesh);
    });

    /* agrupa malhas avulsas que usam o mesmo material (blocos de parede, rodapés, vidros, nichos...) numa só */
    var porMat = {};
    grupo.children.slice().forEach(function(m){
      if (!m.isMesh || m.isInstancedMesh || m.children.length || !m.geometry.index && !m.geometry.attributes.position) return;
      if (m.material === ceu.material) return;
      var k = m.material.uuid + '|' + m.renderOrder;
      (porMat[k] = porMat[k] || []).push(m);
    });
    Object.keys(porMat).forEach(function(k){
      var ms = porMat[k]; if (ms.length < 2) return;
      var geos = ms.map(function(m){ m.updateMatrix(); var g = m.geometry.clone(); if (!g.index) g = g.toNonIndexed(); return g.applyMatrix4(m.matrix); });
      ms.forEach(function(m){ grupo.remove(m); });
      var mm = new THREE.Mesh(guarda(F.mesclar(geos)), ms[0].material); mm.renderOrder = ms[0].renderOrder; grupo.add(mm);
    });

    var zonaCabeca = null;
    var interativosAmb = (def.interativos || []);   // os mesmos objetos que a interação recebe (ela marca it._mesh)
    return {
      def: def, grupo: grupo, colisao: col,
      /* interativos da planta + um "Sentar" por assento */
      interativos: (def.interativos || []).concat(assentos.map(function(a){ return { id: a.id, x: a.x, y: (a.y || 0) + 0.85, piso: a.y || 0, z: a.z, raio: 1.6, rotulo: 'Sentar', assento: a }; })),
      assentos: assentos,
      entrada: def.entrada,
      /* teto em cada ponto: sob o mezanino é o forro baixo; no vazio, o forro alto (a câmera usa para não atravessar a laje) */
      limites: { x0: Math.min(0, ANX.reduce(function(v, a){ return Math.min(v, a.r[0]); }, 0)), z0: Math.min(0, ANX.reduce(function(v, a){ return Math.min(v, a.r[1]); }, 0)),
        x1: Math.max(W, ANX.reduce(function(v, a){ return Math.max(v, a.r[2]); }, W), (NIV && NIV.superior ? NIV.superior.areas : []).reduce(function(v, r){ return Math.max(v, r[2]); }, W)),
        z1: Math.max(D, ANX.reduce(function(v, a){ return Math.max(v, a.r[3]); }, D)), h: H,
        /* teto: sob o mezanino, o forro baixo; acima dele (quem está no 1º andar), o forro alto; nos anexos, o forro deles */
        tetoEm: function(x, z, y){
          for (var i = 0; i < ANX.length; i++) { var ya = ANX[i].y || 0; if (y > ya - 0.6 && y < ya + 2 && dentroR(ANX[i].r, x, z)) return ya + (ANX[i].pe || 3.0); }
          for (var fi = 0; fi < FT.length; fi++) if (y > 3 && FT[fi].y > y && dentroR(FT[fi].r, x, z)) return FT[fi].y;
          var m = mzEm(x, z, -0.25); return m && !(y > m.piso - 0.3) ? m.piso - (m.espessura || 1.0) : H;
        },
        pisoEm: function(x, z, y){ var m = mzEm(x, z, -0.1); return m && y > m.piso - 0.3 ? m.piso : 0; },
        /* usado pela malha de navegação do térreo; o piso superior é consultado por alturaPiso/areas. */
        dentroDaSala: function(x, z){ return (x >= 0 && x <= W && z >= 0 && z <= D) || ANX0.some(function(a){ return dentroR(a.r, x, z); }); },
        nav: (NIV && NIV.superior ? NIV.superior.areas : []).reduce(function(n, r){ return { x0: Math.min(n.x0, r[0]), z0: Math.min(n.z0, r[1]), x1: Math.max(n.x1, r[2]), z1: Math.max(n.z1, r[3]) }; }, ANX.reduce(function(n, a){ return { x0: Math.min(n.x0, a.r[0]), z0: Math.min(n.z0, a.r[1]), x1: Math.max(n.x1, a.r[2]), z1: Math.max(n.z1, a.r[3]) }; }, { x0: 0, z0: 0, x1: W, z1: D })) },
      alturaPiso: alturaPiso,
      paradasEscada: paradasEscada,
      elevador: elev,
      /* para planejar rotas nos testes: roda fn como se todas as portas estivessem abertas (elas abrem ao chegar perto) */
      comPortasAbertas: function(fn){ var est = portasA.map(function(p){ return [p.segFechada.off, p.segAberta.off]; }); portasA.forEach(function(p){ p.segFechada.off = true; p.segAberta.off = false; });
        try { return fn(); } finally { portasA.forEach(function(p, i){ p.segFechada.off = est[i][0]; p.segAberta.off = est[i][1]; }); } },
      /* estado das portas que abrem (testes e depuração): ângulo 0 = fechada, 1 = aberta */
      portas: function(){ return portasA.map(function(p){ return { id: p.id, x: p.cx, z: p.cz, y: p.y, aberta: +p.ang.toFixed(3), solida: !p.segFechada.off }; }); },
      temNiveis: !!NIV,
      /* modo VR (src/xr/sessao.js): otimizações que só valem no headset, porque mudam um pouco o visual.
         - vidros transparentes de dupla face numa passada só (forceSinglePass, existe na r149): metade das chamadas desses vidros;
         - a cada quadro, visibilidadeVR: contornos dos móveis só até `contorno` m da cabeça; móveis, portas, marcadores e pessoas
           das zonas que não se veem da zona da cabeça ficam ocultos (`zonas`); blocos de móveis de outras zonas além de `dist` m também.
         modoVR(false) desfaz tudo (sair do VR). */
      modoVR: function(on){
        grupo.traverse(function(o){ if (!o.material) return; [].concat(o.material).forEach(function(m){
          if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = !!on; }); });
        if (!on) {
          celulasVR.forEach(function(c){ c.mesh.visible = true; if (c.casca) c.casca.visible = true; });
          portasA.forEach(function(p){ p.piv.visible = true; });
          if (npcs) npcs.grupo.children.forEach(function(n){ n.visible = true; });
          zonaCabeca = null;
        }
      },
      contornosAte: function(pos, dist){ this.visibilidadeVR(pos, { contorno: dist, zonas: false, dist: 0 }); },
      visibilidadeVR: function(pos, op){
        var zc = ZV && pos ? zonaEm(pos.x, pos.z, pos.y - 1.5) : null, todas = zc == null || !!TODAS[zc];
        var ve = !todas && op.zonas ? VE[zc] : null, dist = todas && ZV ? 0 : op.dist, i, c, d;
        zonaCabeca = zc;
        for (i = 0; i < celulasVR.length; i++) { c = celulasVR[i];
          d = pos ? pos.distanceTo(c.esfera.center) - c.esfera.radius : 0;
          /* a distância máxima vale para os móveis das OUTRAS zonas: na zona da cabeça nada some (no térreo, que é uma zona só,
             a plateia vista do café continua inteira) */
          c.mesh.visible = (!ve || c.zona == null || veEm(ve, c.zona, c.esfera.center.x, c.esfera.center.z)) && (!dist || (zc != null && c.zona != null && GRUPO[c.zona] === GRUPO[zc]) || d <= dist);
          if (c.casca) c.casca.visible = !op.contorno || d <= op.contorno; }
        for (i = 0; i < portasA.length; i++) { var pa = portasA[i];
          pa.piv.visible = !ve || !pa.zonas.length || pa.zonas.some(function(z){ return !!ve[z]; }); }   // portas: a zona aparece de algum jeito (parcial também); a análise não as cobre
        if (npcs) npcs.grupo.children.forEach(function(n){
          if (n.userData.zonaVR === undefined) n.userData.zonaVR = zonaEm(n.position.x, n.position.z, n.position.y);
          n.visible = !ve || n.userData.zonaVR == null || veEm(ve, n.userData.zonaVR, n.position.x, n.position.z); });
        /* marcadores: a interação recalcula a visibilidade (por piso) a cada quadro antes do desenho; aqui só se esconde */
        if (ve) interativosAmb.forEach(function(it){
          if (!it._mesh) return;
          if (it.zonaVR === undefined) it.zonaVR = zonaEm(it.x, it.z, it.piso != null ? it.piso : (it.y > 3 ? 4.2 : 0));
          if (it.zonaVR != null && !veEm(ve, it.zonaVR, it.x, it.z)) it._mesh.visible = false; });
      },
      /* zona da cabeça no último quadro de VR (null fora de zona ou sem zonas) e consulta para testes/medições */
      zonaVR: function(){ return zonaCabeca; },
      zonaEm: zonaEm,
      zonasVR: ZV,
      atualizar: function(t, camPos, jogador){ for (var i = 0; i < animados.length; i++) animados[i](t, camPos, jogador); },
      dispose: function(){
        if (npcs) npcs.dispose();
        lixo.geo.forEach(function(g){ g.dispose(); }); lixo.mat.forEach(function(m){ m.dispose(); }); lixo.tex.forEach(function(t){ t.dispose(); });
      }
    };
  };
})(window.Orvalho);
