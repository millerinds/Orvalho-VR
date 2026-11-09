/* Elevador interno do Hall: portas que abrem de verdade, cabine visível, seleção de pavimento e viagem no mesmo ambiente.
   Só térreo e 1º andar estão habilitados; os demais botões permanecem informativos.
   criar3D(cfg, ctx): monta folhas e cabine em cada parada (cfg.paradas) e devolve { porta(piso, aberta), atualizar(dt) }.
   abrir(atual, h): painel; h = { portas(piso, aberta), mover(piso), fim() } — a cena continua desenhando por trás. */
(function(O){
  var camada, estado, botoes, visor, aberto = false, timers = [];

  O.elevador = {
    criar3D: function(cfg, ctx){
      var F = O.formas, w = cfg.largura || 1.1, hp = cfg.altura || 2.2, fundo = cfg.fundo || 1.4, paradas = [];
      var inox = ctx.std('#cfd8de', { roughness: 0.22, metalness: 0.85 }), pisoC = ctx.std('#3a3d42', { roughness: 0.35 });
      var luz = ctx.guarda(new THREE.MeshBasicMaterial({ color: ctx.lin('#f4fbff') })), btn = ctx.guarda(new THREE.MeshBasicMaterial({ color: ctx.lin('#5ff0ff') }));
      /* cada folha leva metade da arte "A INOVAÇÃO ABRE PORTAS" (C04, C07, E11) */
      function folhaMat(lado){
        var tx = ctx.guarda(F.arte('elevador')); tx.repeat.set(0.5, 1); tx.offset.set(lado ? 0.5 : 0, 0);
        return ctx.std('#ffffff', { map: tx, roughness: 0.35, metalness: 0.2 });
      }
      /* folhas um pouco mais baixas que o vão e recuadas 4,5 cm atrás do plano da parede: nenhuma face coincide com a parede,
         a verga ou a moldura (era a causa da cintilação nos cantos). Ao abrir, entram no vão da parede, atrás do revestimento. */
      var mats = [folhaMat(0), folhaMat(1)], geoF = ctx.guarda(new THREE.BoxGeometry(w / 2 - 0.004, hp - 0.012, 0.03));
      (cfg.paradas || []).forEach(function(pa){
        var g = new THREE.Group(); g.position.set(cfg.x, pa.y, pa.z); ctx.grupo.add(g);
        /* folhas: deslizam para os lados, para dentro do vão */
        /* quem olha a porta está do lado de z menor, virado para +z: a esquerda dele é +x. A folha em +x (fd) leva a metade
           esquerda da arte e a folha em -x (fe), a direita — com isso a composição fecha na ordem original. */
        var fe = new THREE.Mesh(geoF, mats[1]), fd = new THREE.Mesh(geoF, mats[0]);
        fe.position.set(-w / 4, (hp - 0.012) / 2, 0.06); fd.position.set(w / 4, (hp - 0.012) / 2, 0.06); g.add(fe, fd);
        /* cabine: inox escovado, piso escuro, luz no teto, corrimão e painel de botões */
        var cab = [];
        function caixa(bw, bh, bd, x, y, z, m){ var mm = new THREE.Mesh(ctx.guarda(new THREE.BoxGeometry(bw, bh, bd)), m); mm.position.set(x, y, z); g.add(mm); return mm; }
        caixa(w + 0.3, hp + 0.25, 0.04, 0, (hp + 0.25) / 2, fundo + 0.11, inox);
        caixa(0.04, hp + 0.25, fundo, -w / 2 - 0.15, (hp + 0.25) / 2, 0.11 + fundo / 2, inox);
        caixa(0.04, hp + 0.25, fundo, w / 2 + 0.15, (hp + 0.25) / 2, 0.11 + fundo / 2, inox);
        caixa(w + 0.3, 0.04, fundo, 0, 0.01, 0.11 + fundo / 2, pisoC);
        caixa(w + 0.3, 0.04, fundo, 0, hp + 0.25, 0.11 + fundo / 2, inox);
        caixa(w * 0.6, 0.02, fundo * 0.55, 0, hp + 0.22, 0.11 + fundo / 2, luz);
        caixa(w + 0.1, 0.035, 0.035, 0, 0.92, fundo + 0.04, inox);
        caixa(0.03, 0.42, 0.14, w / 2 + 0.12, 1.15, 0.5, inox);
        [0, 1, 2, 3].forEach(function(k){ var b = new THREE.Mesh(ctx.guarda(new THREE.SphereGeometry(0.014, 8, 6)), k === pa.piso ? btn : inox); b.position.set(w / 2 + 0.1, 1.0 + k * 0.08, 0.5); g.add(b); });
        paradas.push({ piso: pa.piso, g: g, fe: fe, fd: fd, alvo: 0, a: 0 });
      });
      return {
        porta: function(piso, aberta){ paradas.forEach(function(p){ if (p.piso === piso) p.alvo = aberta ? 1 : 0; }); },
        /* para testes: posição x (mundo) de cada folha e qual metade da arte ela mostra (offset 0 = metade esquerda) */
        folhas: function(piso){ var p = paradas.filter(function(q){ return q.piso === piso; })[0]; if (!p) return []; return [p.fe, p.fd].map(function(f){ var v = new THREE.Vector3(); f.getWorldPosition(v); return { x: +v.x.toFixed(3), metade: f.material.map.offset.x ? 'direita' : 'esquerda' }; }); },
        aberta: function(piso){ var p = paradas.filter(function(q){ return q.piso === piso; })[0]; return p ? p.a : 0; },
        atualizar: function(dt){
          paradas.forEach(function(p){
            var k = 1 - Math.exp(-(dt || 0.016) * 5);
            p.a += (p.alvo - p.a) * k; if (Math.abs(p.alvo - p.a) < 0.002) p.a = p.alvo;
            var s = p.a * w * 0.47;
            p.fe.position.x = -w / 4 - s; p.fd.position.x = w / 4 + s;
          });
        }
      };
    },

    abrir: function(atual, h){
      monta(); limpar(); aberto = true; camada.hidden = false;
      estado.textContent = 'Portas abrindo…'; mostrarVisor(atual, '');
      h.portas(atual, true);
      timers.push(setTimeout(function(){ if (aberto) estado.textContent = 'Portas abertas — entre e escolha o andar.'; }, 650));
      botoes.forEach(function(bt){ bt.disabled = +bt.dataset.piso === atual; bt.classList.toggle('atual', +bt.dataset.piso === atual); });
      function sair(){ if (!aberto) return; aberto = false; camada.hidden = true; limpar(); h.fim(); }
      camada.querySelector('.elevador-fechar').onclick = function(){ h.portas(atual, false); sair(); };
      botoes.forEach(function(bt){
        bt.onclick = function(){
          if (bt.disabled || !aberto) return;
          botoes.forEach(function(b){ b.disabled = true; });
          timers = timers.concat(O.elevador.viajar(atual, +bt.dataset.piso, {
            portas: h.portas, mover: h.mover, fim: sair,
            texto: function(t){ estado.textContent = t; }, visor: mostrarVisor }));
        };
      });
    },
    aberto: function(){ return aberto; },

    /* a viagem, igual no painel do desktop e no painel em mundo do VR (src/xr/elevador.js): portas fecham, visor e texto,
       mover, portas do destino abrem, fim. Pavimentos: 0 (térreo), 1 (1º andar) e, só no VR, 'lab' (Lab IA, sem pavimento
       atribuído: ligação provisória). h = { portas(piso, aberta), mover(destino), fim(), texto(t), visor(piso, sentido) }.
       Devolve os timers (para cancelar). */
    viajar: function(atual, destino, h){
      var ts = [], sentido = typeof atual === 'number' && typeof destino === 'number' ? (destino > atual ? 'sobe' : 'desce') : '';
      h.texto('Portas fechando…'); h.portas(atual, false);
      ts.push(setTimeout(function(){ h.texto('Em viagem para o ' + O.elevador.nome(destino) + '…'); h.visor(atual, sentido); }, 650));
      ts.push(setTimeout(function(){ h.visor(destino, sentido); }, 1250));
      ts.push(setTimeout(function(){ h.mover(destino); h.portas(destino, true); h.visor(destino, ''); h.texto('Chegamos. Portas abrindo…'); }, 1650));
      ts.push(setTimeout(function(){ h.fim(); }, 2100));
      return ts;
    },
    nome: function(piso){ return piso === 'lab' ? 'Lab IA' : piso ? '1º andar' : 'térreo'; }
  };

  function limpar(){ timers.forEach(clearTimeout); timers = []; }
  function mostrarVisor(piso, sentido){ visor.querySelector('b').textContent = piso ? '1' : 'T'; visor.className = 'elevador-visor' + (sentido ? ' ' + sentido : ''); }
  function monta(){
    if (camada) return;
    camada = document.createElement('div'); camada.className = 'elevador-ui'; camada.hidden = true;
    camada.innerHTML = '<section class="elevador-cabine" role="dialog" aria-modal="true" aria-labelledby="elevador-titulo">' +
      '<button class="elevador-fechar" type="button" aria-label="Sair do elevador">×</button>' +
      '<div class="elevador-visor" aria-hidden="true"><i></i><b>T</b></div>' +
      '<p class="kicker">Elevador</p><h2 id="elevador-titulo">Escolha o andar</h2>' +
      '<p class="elevador-estado" aria-live="polite">Portas abertas.</p><div class="elevador-andares">' +
      '<button type="button" data-piso="0"><b>T</b><span>Térreo</span></button>' +
      '<button type="button" data-piso="1"><b>1</b><span>1º andar</span></button>' +
      '<button type="button" disabled><b>2</b><span>Indisponível</span></button>' +
      '<button type="button" disabled><b>3</b><span>Indisponível</span></button>' +
      '</div><p class="elevador-nota">Os pavimentos superiores ainda não estão disponíveis nesta versão.</p></section>';
    document.getElementById('jogo').appendChild(camada);
    estado = camada.querySelector('.elevador-estado'); botoes = camada.querySelectorAll('[data-piso]'); visor = camada.querySelector('.elevador-visor');
  }
})(window.Orvalho);
