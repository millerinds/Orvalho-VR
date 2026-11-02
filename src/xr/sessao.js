/* Sessão WebXR (immersive-vr). Padrão WebXR: vale para o Quest 3S (Meta Quest Browser) e qualquer headset com navegador compatível.
   - Detecção: navigator.xr.isSessionSupported('immersive-vr'). Sem suporte, os botões ficam ocultos e o site segue igual.
     No Quest Browser o botão da tela inicial ganha destaque (o navegador só abre a sessão com um gesto: não dá para entrar sozinho).
   - Entrada: a sessão é pedida dentro do clique; na tela inicial o jogo é montado na hora (sem esperar o véu).
   - Reference space: a r149 pede um único tipo no setSession e falha se ele não existir, então o tipo é escolhido antes,
     na ordem local-floor → bounded-floor → local. Em 'local' (origem nos olhos) o rig sobe uma altura de olhos estimada.
   - "Se arruma": body.em-vr esconde HUD e DOM; teclado, mouse e câmera em 3ª pessoa param (O.jogo.vr). Ao sair, tudo volta.
   - Sair: segurar B (controle direito) por 1,5 s; o anel enche e o controle vibra ao completar. B rápido = ação curta (aoBCurto).
   API: O.xr.sessao = { suportado(), ativa(), entrar(), sair(), tipo(), hz(), medidor(), painelLog(), teste(), anel(), aoBCurto(fn) } */
(function(O){
  O.xr = O.xr || {};
  var TIPOS = ['local-floor', 'bounded-floor', 'local'];
  var OLHOS_LOCAL = 1.6;   // m: altura de olhos assumida quando o aparelho não informa o chão ('local')
  var btnInicio = document.getElementById('btn-vr'), btnHud = document.getElementById('hud-vr');
  var quest = /OculusBrowser/i.test(navigator.userAgent);
  var suportado = false, sessao = null, iniciando = false, tipo = null, rig = null, medidor = null, espaco = null, painelLog = null, teste = null;
  var botoes = null, anel = null, veu = null, aviso = null, loc = null, maos = null, raioXR = null;
  /* B (controle direito): segurar SAIR_B s sai do VR; um toque curto (soltar antes de B_CURTO s) faz a ação curta aprovada
     (fechar o que estiver aberto, levantar, abrir o provador). Soltar entre B_CURTO e SAIR_B não faz nada (desistiu de sair).
     O anel aparece depois de ANEL_DESDE s, para o toque curto não piscar nada. O botão "Sair do VR" definitivo vem nas opções. */
  var SAIR_B = 1.5, B_CURTO = 0.5, ANEL_DESDE = 0.25, bSaindo = false, acoesB = [];
  var hz = { pedido: null, ativo: null, suportadas: null };

  function mostrar(){
    btnInicio.hidden = !suportado; btnHud.hidden = !suportado;
    document.body.classList.toggle('vr-destaque', suportado && quest);
  }
  function detectar(){
    if (!navigator.xr || !navigator.xr.isSessionSupported) return;   // sem WebXR (ou sem HTTPS): nada muda
    navigator.xr.isSessionSupported('immersive-vr').then(function(ok){ suportado = !!ok; mostrar(); }, function(){});
  }
  if (navigator.xr && navigator.xr.addEventListener) navigator.xr.addEventListener('devicechange', detectar);
  detectar();

  function entrar(){
    if (!suportado || sessao || iniciando) return;
    if (O.provador.aberto() || (O.elevador && O.elevador.aberto())) return;
    var pedido;
    /* pedido síncrono, ainda dentro do gesto do usuário */
    try { pedido = navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); }
    catch (e) { falha(e); return; }
    iniciando = true;
    if (O.xr.teste && O.xr.teste.ativo()) O.xr.teste.prepararAudio();   // bipes do modo teste: o áudio só começa dentro de um gesto
    if (!O.jogo.ativo()) {
      /* tela inicial: monta o jogo agora (primeira visita ainda passa pelo provador, em 2D) */
      if (!O.app.entrar(O.jogo.temSalvo(), { imediato: true })) {
        pedido.then(function(s){ s.end(); }, function(){}); iniciando = false; return;
      }
    }
    pedido.then(iniciarSessao, falha);
  }

  function escolherEspaco(s, i){
    if (i >= TIPOS.length) return Promise.reject(new Error('nenhum reference space disponível'));
    return s.requestReferenceSpace(TIPOS[i]).then(function(){ return TIPOS[i]; }, function(){ return escolherEspaco(s, i + 1); });
  }

  function iniciarSessao(s){
    var ctx = O.jogo.vr.contexto();
    if (!ctx) { s.end(); falha(new Error('jogo não iniciado')); return; }
    return escolherEspaco(s, 0).then(function(t){
      tipo = t;
      var r = ctx.renderer, op = O.xr.opcoes.ler(), fb = O.xr.opcoes.escalaPara(ctx.amb && ctx.amb.def.id);
      r.xr.setReferenceSpaceType(tipo);
      r.xr.setFramebufferScaleFactor(fb.valor);   // só vale antes do setSession: fica a do ambiente em que a sessão começou
      rig = O.xr.criarRig(ctx.camera);
      rig.alturaExtra(tipo === 'local' ? OLHOS_LOCAL : 0);
      ctx.scene.add(rig.rig);
      ctx.camera.position.set(0, 0, 0); ctx.camera.quaternion.identity(); ctx.camera.scale.set(1, 1, 1);
      rig.rig.add(ctx.camera);
      return r.xr.setSession(s).then(function(){
        sessao = s; iniciando = false;
        r.xr.setFoveation(op.foveacao);
        aplicarHz(s, op.hz);
        medidor = O.xr.criarMedidor({ renderer: r, camera: ctx.camera, tipoEspaco: tipo, hz: hz, escalaFb: fb.valor, fbAuto: fb.auto });
        medidor.visivel(op.medidor);
        if (op.log && O.xr.log) painelLog = O.xr.log.criarPainel(ctx.camera);   // ?vr-log=1: erros e medidas dentro do VR
        botoes = O.xr.criarBotoes(s);
        anel = O.xr.criarAnel(ctx.camera, 'SEGURE B · SAIR DO VR');
        veu = O.xr.criarVeu(ctx.camera);
        aviso = O.xr.criarAviso(ctx.camera);
        var modoTeste = !!(O.xr.teste && O.xr.teste.ativo());
        loc = O.xr.criarLocomocao({ renderer: r, camera: ctx.camera, rig: rig, botoes: botoes, veu: veu, aviso: aviso, teste: modoTeste });
        maos = O.xr.criarMaos({ renderer: r, rig: rig, botoes: botoes, player: ctx.player, cena: ctx.scene, oculto: modoTeste });   // modo teste: sem mãos (medições comparáveis)
        raioXR = O.xr.criarRaio({ rig: rig, maos: maos, botoes: botoes, veu: veu, aviso: aviso, loc: loc, teste: modoTeste, cena: ctx.scene, camera: ctx.camera,
          raioCorpo: function(){ var c = O.jogo.vr.contexto(); return c ? c.raio : 0.33; } });
        bSaindo = false;
        if (O.xr.teste && O.xr.teste.ativo()) teste = O.xr.teste.iniciar({ medidor: medidor, sessao: s, veu: veu,   // ?vr-teste: medições por POST
          ambiente: function(){ var c = O.jogo.vr.contexto(); return c && c.amb ? c.amb.def.id : null; },
          girar: function(a){ if (rig) rig.girar(a); },
          irPara: irParaPonto,
          pronto: function(){ return !!(rig && rig.pronto()); },
          reaplicar: reaplicarOpcoes,
          vibrar: function(forca, ms){ if (botoes) botoes.vibrar(null, forca, ms); },
          sair: function(){ if (sessao === s) { try { s.end(); } catch (e) {} } } });
        espaco = r.xr.getReferenceSpace();
        if (espaco && espaco.addEventListener) espaco.addEventListener('reset', aoReset);   // recentrar do sistema
        s.addEventListener('end', encerrar);
        document.body.classList.add('em-vr');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        O.jogo.vr.ligar({
          passo: function(dt, amb, st, raio){
            ambQuadro = amb; medidor.quadroInicio();
            botoes.ler(dt); vigiarB(s);
            veu.passo(dt); aviso.passo(dt);
            if (teste) teste.passo(dt);
            loc.passo(dt, amb, st, raio);
            rig.passo(dt, amb, st, raio);
            maos.passo();
            raioXR.passo(dt, amb, st);
          },
          olho: rig.olho,
          /* depois do passo e das animações do ambiente: a cabeça já está no lugar deste quadro */
          antesDeDesenhar: function(){ otimizar(ambQuadro, ctx.camera); medidor.antesRender(); },
          depoisDeDesenhar: function(){ rig.poseRecebida(); medidor.quadroFim(); if (painelLog) painelLog.atualizar(); }
        });
        var pt = O.xr.pontos && O.xr.pontos.atual();
        console.info('[Orvalho VR] sessão iniciada · ' + (ctx.amb ? ctx.amb.def.id : '?') + (pt ? ' · ponto ' + pt.id : '') + ' · reference space ' + tipo + ' · framebuffer ×' + fb.valor + (fb.auto ? ' (auto)' : '') + ' · foveação ' + op.foveacao + ' · contornos até ' + (op.contorno || '∞') + ' m · zonas ' + (op.zonas ? 'sim' : 'não') + ' · móveis até ' + (op.dist || '∞') + ' m' + (teste ? ' · teste ' + O.xr.opcoes.teste() : ''));
        console.info('[Orvalho VR] para sair: segure B por ' + String(SAIR_B).replace('.', ',') + ' s (o anel enche). B rápido fecha o que estiver aberto');
        console.info('[Orvalho VR] controles: stick esq. anda (clique = correr) · stick dir. gira (clique = passos/suave) · A pula · Y suave/teleporte · X vinheta · gatilho seleciona com o laser · B rápido levanta/fecha · B segurado sai');
      });
    }).catch(function(e){ desmontar(ctx); try { s.end(); } catch (x) {} falha(e); });
  }
  function aoReset(){ if (rig) rig.centrar(); if (loc) loc.medirPostura(); }   // recentralizar do sistema (segurar o botão Meta)

  /* taxa de quadros: pede a suportada mais próxima de op.hz (0 = não pede). session.frameRate diz a que ficou ativa.
     Sem updateTargetFrameRate (navegador sem a extensão), vale a do navegador e o medidor mostra "padrão". */
  function aplicarHz(s, pedido){
    var lista = s.supportedFrameRates ? Array.prototype.slice.call(s.supportedFrameRates) : null;
    hz.pedido = pedido || null; hz.suportadas = lista; hz.ativo = s.frameRate || null;
    if (!pedido) return;
    if (!s.updateTargetFrameRate || !lista || !lista.length) {
      console.warn('[Orvalho VR] o navegador não permite escolher a taxa de quadros; fica a padrão (' + (s.frameRate || '?') + ' Hz)');
      return;
    }
    var alvo = lista.reduce(function(m, v){ return Math.abs(v - pedido) < Math.abs(m - pedido) ? v : m; }, lista[0]);
    s.updateTargetFrameRate(alvo).then(function(){
      hz.ativo = s.frameRate || alvo;
      console.info('[Orvalho VR] taxa pedida ' + pedido + ' Hz → ativa ' + hz.ativo + ' Hz · suportadas ' + lista.join('/'));
    }, function(e){ console.warn('[Orvalho VR] updateTargetFrameRate(' + alvo + ') falhou: ' + (e && e.message || e)); });
  }

  /* otimizações só do VR no ambiente atual (vidros numa passada; contornos só perto da cabeça; zonas e distância máxima dos
     móveis); trocou de ambiente, reaplica. As opções são lidas uma vez por sessão. */
  var ambVR = null, ambQuadro = null, cabeca = new THREE.Vector3(), opVR = null;
  function otimizar(amb, camera){
    if (amb !== ambVR) {
      if (ambVR && ambVR.modoVR) ambVR.modoVR(false);
      ambVR = amb; opVR = O.xr.opcoes.ler();
      if (amb && amb.modoVR) amb.modoVR(true);
    }
    if (!amb) return;
    camera.getWorldPosition(cabeca);
    if (amb.visibilidadeVR) amb.visibilidadeVR(cabeca, { contorno: opVR.contorno, zonas: opVR.zonas, dist: opVR.dist });
    else if (amb.contornosAte) amb.contornosAte(cabeca, opVR.contorno);
  }

  /* B do controle direito: toque curto → ação curta (ao soltar); segurado SAIR_B s → sai (anel enche, haptic ao completar).
     Depois de completar, soltar não dispara a ação curta. */
  function vigiarB(s){
    var b = botoes.botao('right', 'b');
    if (bSaindo) return;
    if (b.pressionado) {
      anel.progresso(b.seg < ANEL_DESDE ? -1 : (b.seg - ANEL_DESDE) / (SAIR_B - ANEL_DESDE));
      if (b.seg >= SAIR_B) {
        bSaindo = true; anel.progresso(1);
        botoes.vibrar('right', 1, 160);
        console.info('[Orvalho VR] saindo: B segurado');
        /* fora do quadro e depois do pulso: o 'end' pode ser despachado na hora e desmontar o rig no meio do passo */
        setTimeout(function(){ try { s.end(); } catch (e) {} }, 180);
      }
      return;
    }
    anel.progresso(-1);
    if (b.soltou && b.segAoSoltar < B_CURTO) acaoCurtaB();
  }
  /* ação curta do B: quem estiver aberto (painel, conversa, provador, assento) registra um tratador com aoBCurto(fn); o mais
     recente responde primeiro e devolve true se tratou. Nesta etapa ainda não há nada aberto em VR: só fica no log. */
  function acaoCurtaB(){
    for (var i = acoesB.length - 1; i >= 0; i--) { try { if (acoesB[i]()) return; } catch (e) { console.warn('[Orvalho VR] B:', e && e.message); } }
    console.info('[Orvalho VR] B: nada aberto para fechar (painéis, assento e provador em VR vêm nas próximas etapas)');
  }
  /* leva o jogador a um ponto (x, y, z, rumo) no ambiente atual: a cabeça é recentralizada lá no próximo quadro */
  function irParaPonto(p){
    var c = O.jogo.vr.contexto(); if (!c || !p || !rig) return;
    c.st.x = p.x; c.st.y = p.y; c.st.z = p.z; c.st.rumo = p.rumo;
    rig.centrar();
  }
  /* releitura das opções no meio da sessão (passo de bateria): zonas, distância, contornos e foveação. O framebuffer não muda. */
  function reaplicarOpcoes(){
    var c = O.jogo.vr.contexto(), op = O.xr.opcoes.ler();
    if (ambVR) opVR = op;
    if (c) c.renderer.xr.setFoveation(op.foveacao);
    if (medidor) medidor.visivel(op.medidor);
    if (painelLog) painelLog.visivel(op.log);
    if (loc) loc.reler();
  }

  /* fim da sessão (botão do sistema, sair, erro): restaura o modo desktop exatamente como estava */
  function encerrar(){
    var ctx = O.jogo.vr.contexto();
    if (espaco && espaco.removeEventListener) espaco.removeEventListener('reset', aoReset);
    espaco = null;
    desmontar(ctx);
    O.jogo.vr.desligar();
    document.body.classList.remove('em-vr');
    var veu = document.getElementById('veu'); if (!veu.hidden && !veu.classList.contains('some')) O.app.esconderVeu();
    sessao = null; iniciando = false;
    console.info('[Orvalho VR] sessão encerrada');
  }
  function desmontar(ctx){
    if (teste) { try { teste.dispose(); } catch (e) {} teste = null; }
    if (medidor) { medidor.dispose(); medidor = null; }
    if (ambVR && ambVR.modoVR) ambVR.modoVR(false);   // o desktop volta com o visual de sempre
    ambVR = null;
    if (painelLog) { painelLog.dispose(); painelLog = null; }
    if (raioXR) { raioXR.dispose(); raioXR = null; }
    if (maos) { maos.dispose(); maos = null; }
    if (loc) { loc.dispose(); loc = null; }
    if (aviso) { aviso.dispose(); aviso = null; }
    if (anel) { anel.dispose(); anel = null; }
    if (veu) { veu.dispose(); veu = null; }
    botoes = null;
    if (ctx && ctx.camera.parent) ctx.camera.parent.remove(ctx.camera);   // a câmera volta a ser solta (3ª pessoa)
    if (ctx) ctx.camera.scale.set(1, 1, 1);
    if (rig) { rig.dispose(); rig = null; }
  }
  function falha(e){
    iniciando = false;
    console.warn('[Orvalho VR] não foi possível iniciar a sessão:', e && e.message ? e.message : e);
  }

  if (btnInicio) btnInicio.addEventListener('click', entrar);
  if (btnHud) btnHud.addEventListener('click', entrar);

  O.xr.sessao = {
    suportado: function(){ return suportado; },
    ativa: function(){ return !!sessao; },
    entrar: entrar,
    sair: function(){ if (sessao) sessao.end(); },
    tipo: function(){ return tipo; },
    hz: function(){ return { pedido: hz.pedido, ativo: sessao ? (sessao.frameRate || hz.ativo) : hz.ativo, suportadas: hz.suportadas }; },
    medidor: function(){ return medidor; },
    painelLog: function(){ return painelLog; },
    teste: function(){ return teste; },
    anel: function(){ return anel; },
    locomocao: function(){ return loc; },
    maos: function(){ return maos; },
    raio: function(){ return raioXR; },
    aviso: function(){ return aviso; },
    /* ação curta do B: fn() devolve true se tratou (ex.: fechou um painel). Devolve a função que remove o tratador. */
    aoBCurto: function(fn){ acoesB.push(fn); return function(){ var i = acoesB.indexOf(fn); if (i >= 0) acoesB.splice(i, 1); }; }
  };
})(window.Orvalho);
