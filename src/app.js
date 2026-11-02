/* Fluxo de telas: tela inicial → provador → jogo (e de volta).
   Uma configuração só de avatar (O.avatar, no localStorage): o provador grava, a moldura da tela inicial e o jogo leem. */
(function(O){
  var inicio = document.getElementById('inicio'), jogoEl = document.getElementById('jogo'), veu = document.getElementById('veu');
  var btnEntrar = document.getElementById('btn-entrar'), btnCont = document.getElementById('btn-continuar'), btnPers = document.getElementById('btn-personalizar');

  /* ---------- avatar da moldura (o mesmo do kit) ---------- */
  var btn = document.getElementById('avatar-btn');
  var win = btn.querySelector('.av-win'), avCanvas = win.querySelector('canvas'), avImg = win.querySelector('img');
  var avBox = document.getElementById('avatar');
  var saved = O.avatar.load();
  avBox.setAttribute('data-shape', saved.shape);
  var avatar = O.Doll(avCanvas, { cam: [0, 1.6, 5.35], target: [0, 1.3, 0], raiseBox: win, reach: 260, fit: true });
  if (avatar) {
    avCanvas.hidden = false; avImg.hidden = true;
    avatar.set(saved, true); avatar.start();
    btn.addEventListener('pointerenter', avatar.hover);
  }

  /* ---------- lápis: só o formato da janela (do kit) ---------- */
  var penBtn = document.getElementById('shape-btn'), pop = document.getElementById('shape-pop');
  var shapeOpts = [].slice.call(pop.querySelectorAll('.shape-opt'));
  function markShape(){ shapeOpts.forEach(function(o){ o.setAttribute('aria-checked', o.getAttribute('data-shape') === saved.shape ? 'true' : 'false'); }); }
  function togglePop(open){ pop.hidden = !open; penBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  markShape();
  penBtn.addEventListener('click', function(e){ e.stopPropagation(); togglePop(pop.hidden); });
  shapeOpts.forEach(function(o){
    o.addEventListener('click', function(){
      saved = O.avatar.load(); saved.shape = o.getAttribute('data-shape'); avBox.setAttribute('data-shape', saved.shape); markShape(); O.avatar.store(saved);
    });
  });
  pop.addEventListener('click', function(e){ e.stopPropagation(); });
  document.addEventListener('click', function(){ togglePop(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !pop.hidden) { togglePop(false); penBtn.focus(); } });

  /* ---------- provador ---------- */
  function abrirProvador(modo){
    togglePop(false);
    if (modo === 'inicio') btn.setAttribute('aria-expanded', 'true');
    O.provador.abrir({ modo: modo, aoFechar: function(acao, cfg){
      btn.setAttribute('aria-expanded', 'false');
      if (modo === 'jogo') { O.jogo.retomar(acao === 'cancelar' ? null : cfg); return; }
      saved = cfg; if (avatar) avatar.set(saved);
      atualizarBotoes();
      if (acao === 'entrar') entrar(false);
    } });
  }
  btn.addEventListener('click', function(){ abrirProvador('inicio'); });
  btnPers.addEventListener('click', function(){ abrirProvador('inicio'); });

  /* ---------- entrar e sair do mundo ---------- */
  function atualizarBotoes(){
    btnCont.hidden = !O.jogo.temSalvo();
    /* primeira visita: "Entrar" passa antes pelo provador */
    btnEntrar.querySelector('span').textContent = O.avatar.exists() ? 'Entrar no Orvalho' : 'Criar avatar e entrar';
  }
  /* o.imediato: monta o jogo já, sem esperar o véu ser pintado (entrada direta em VR: a sessão imersiva pode pausar o
     requestAnimationFrame da janela). Devolve false se precisou abrir o provador antes. */
  function entrar(continuar, o){
    if (!O.avatar.exists()) { abrirProvador('inicio'); return false; }
    veu.hidden = false; veu.classList.remove('some');
    if (avatar) avatar.stop();
    function montar(){
      inicio.hidden = true; jogoEl.hidden = false; document.body.classList.add('em-jogo');
      O.jogo.entrar({ cfg: O.avatar.load(), continuar: continuar, aoPronto: esconderVeu });
    }
    if (o && o.imediato) montar();
    /* espera o véu cobrir a tela antes de montar a sala (a montagem trava a página por um instante) */
    else requestAnimationFrame(function(){ requestAnimationFrame(montar); });
    return true;
  }
  function esconderVeu(){ veu.classList.add('some'); setTimeout(function(){ veu.hidden = true; }, 520); }
  function voltarInicio(){
    O.jogo.sair();
    jogoEl.hidden = true; inicio.hidden = false; document.body.classList.remove('em-jogo');
    saved = O.avatar.load(); avBox.setAttribute('data-shape', saved.shape); markShape();
    if (avatar) { avatar.set(saved, true); avatar.start(); }
    atualizarBotoes(); btnCont.hidden ? btnEntrar.focus() : btnCont.focus();
  }
  btnEntrar.addEventListener('click', function(){ entrar(false); });
  btnCont.addEventListener('click', function(){ entrar(true); });

  function provadorNoJogo(){ if (O.jogo.ativo() && !O.provador.aberto()) { O.jogo.pausar(); abrirProvador('jogo'); } }
  document.getElementById('hud-prov').addEventListener('click', provadorNoJogo);
  document.getElementById('hud-casa').addEventListener('click', voltarInicio);
  document.addEventListener('keydown', function(e){
    if ((e.key === 'p' || e.key === 'P') && O.jogo.ativo() && !O.jogo.painelAberto() && !e.ctrlKey && !e.metaKey) provadorNoJogo();
  });

  atualizarBotoes();
  O.app = { entrar: entrar, voltarInicio: voltarInicio, abrirProvador: abrirProvador, esconderVeu: esconderVeu };
})(window.Orvalho);
