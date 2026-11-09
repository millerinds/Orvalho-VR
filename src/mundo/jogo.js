/* Jogo: um renderer, uma cena, o ambiente atual, o boneco do jogador, a câmera em 3ª pessoa e a interação.
   API: O.jogo.entrar({ cfg, continuar, aoPronto }) · sair() · pausar() · retomar(cfg|null) · temSalvo() · ativo() · painelAberto() */
(function(O){
  /* Personagem: só a escala no mundo muda (o kit continua igual). O boneco mede 2,15 u no kit; 1 u = 1 m. */
  var ALTURA = 1.30, ESCALA = ALTURA / 2.15;     // ≈ 0,605
  var K = ESCALA / (1.70 / 2.15);                // quanto menor que a versão de 1,70 m (≈ 0,76)
  var ANDAR = 1.8, CORRER = 3.0;                 // m/s
  var RAIO = 0.33;                               // recalculado pelo corpo escolhido em raioDoCorpo()
  var BRACO = 0.30;                              // quanto os braços passam do tronco (≈ 0,64 m de meia largura na escala)
  var CHAVE = 'orvalho-jogo';

  var canvas = document.getElementById('jogo-canvas');
  var dica = document.getElementById('hud-dica'), hudSala = document.getElementById('hud-sala');
  var renderer = null, scene, camera, cam3, amb, player, inter, clock;
  var running = false, ativo = false, t = 0;
  /* modo VR (src/xr/): quando ligado, a cabeça rastreada move o jogador e a câmera em 3ª pessoa fica parada */
  var vr = null, vrOlho = new THREE.Vector3(), vrAntes = { x: 0, z: 0 };
  /* y é a altura do piso atual (0 no térreo, 4,2 m no 1º andar e valores intermediários na escada). */
  var st = { x: 0, y: 0, z: 0, rumo: 0, vx: 0, vz: 0, jy: 0, vy: 0 };
  /* pulo: jy = altura acima do piso (o piso continua vindo de alturaPiso), vy = velocidade vertical.
     A colisão é em x/z e vale em toda a altura do pavimento: no ar o boneco segue barrado por paredes, vidros e muretas. */
  var GRAV = 15, PULO = 0.42, VPULO = Math.sqrt(2 * GRAV * PULO), PREP = 0.09;
  var pulo = { fase: 0, t: 0, pouso: 0 }; // fase: 0 no chão · 1 agachando · 2 no ar
  var keys = {}, frente = new THREE.Vector3(), alvoOlhar = new THREE.Vector3();
  var salvoEm = 0, mexeu = false, dicaTimer = 0;

  function init(){
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { console.error('[Orvalho] WebGL indisponível', e); return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; // sem tone mapping, como o kit (com ACES as cores lavavam)
    renderer.xr.enabled = true;                   // só vale com sessão WebXR ativa (src/xr/); no desktop não muda nada
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.05, 240);
    scene.environment = O.estudio(renderer, { quente: true });
    var key = new THREE.DirectionalLight(0xffffff, 0.35); key.position.set(-2, 3.5, 4); scene.add(key);
    clock = new THREE.Clock();
    cam3 = O.criarCameraTerceira(camera, { altura: 1.30 * ALTURA / 1.70 + 0.05, dist: 2.9, distMin: 1.6, distMax: 4.4 });
    player = O.criarBoneco({ sombra: true, passo: 0.95 * K });
    player.root.scale.setScalar(ESCALA);
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
    ligarControles();
    return true;
  }
  function carregarAmbiente(id){
    if (amb && amb.def.id === id) return;
    if (amb) { scene.remove(amb.grupo); amb.dispose(); scene.remove(inter.grupo); inter.dispose(); }
    var def = O.ambientes.lista[id];
    amb = O.montarAmbiente(def); scene.add(amb.grupo);
    inter = O.criarInteracao({ camera: camera, canvas: canvas, itens: amb.interativos, conteudo: O.conteudo[id],
      aoAbrir: function(it){ keys = {}; if (it && it.npc && it.alvo) conversar(it); }, aoFechar: function(){ encerrarConversa(); },
      aoAcao: function(acao){
        if (acao && acao.ambiente) irPara(acao.ambiente);
        else if (acao && acao.elevador && O.elevador) abrirElevador();
      },
      aoAssento: function(a){ sentar(a); } });
    cam3.configurar(def.camera);   // cada ambiente diz quanto a câmera pode olhar para cima e se afastar
    scene.add(inter.grupo);
    hudSala.textContent = def.nome.replace('Laboratório', 'Lab');
    if (!player.root.parent) scene.add(player.root);
  }
  function size(){
    /* em VR o tamanho é o do headset: a página muda de layout ao entrar (body.em-vr) e o ResizeObserver chamaria setSize,
       que a r149 recusa com o aviso "Can't change size while VR device is presenting". Ao sair, desligar() chama size(). */
    if (renderer.xr && renderer.xr.isPresenting) return;
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  /* ---------- controles: WASD/setas relativo à câmera, arrastar para girar, roda para aproximar ---------- */
  var KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 't', ArrowDown: 't', KeyA: 'e', ArrowLeft: 'e', KeyD: 'd', ArrowRight: 'd', ShiftLeft: 'r', ShiftRight: 'r' };
  function ligarControles(){
    window.addEventListener('keydown', function(e){
      if (!ativo || !running || vr) return;
      if (travado) { if (KEYMAP[e.code]) e.preventDefault(); return; }
      if (inter && inter.aberto()) { if (e.key === 'Escape') { e.preventDefault(); inter.fechar(); } return; }
      if (sentado) { // sentado: E, Enter, Espaço, Esc ou qualquer tecla de andar levanta
        if (KEYMAP[e.code] || ['KeyE', 'Enter', 'Space', 'Escape'].indexOf(e.code) >= 0) { e.preventDefault(); levantar(); }
        return;
      }
      var k = KEYMAP[e.code];
      if (k) { keys[k] = true; e.preventDefault(); esconderDica(); }
      else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pular(); }
      else if (e.code === 'KeyE' || e.code === 'Enter') { if (inter.atual()) { e.preventDefault(); inter.abrir(); } }
    });
    window.addEventListener('keyup', function(e){ var k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener('blur', function(){ keys = {}; });
    var drag = null;
    canvas.addEventListener('pointerdown', function(e){ if (vr) return; drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('girando'); canvas.focus(); });
    canvas.addEventListener('pointermove', function(e){
      if (!drag || !running) return;
      cam3.girar(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; esconderDica();
    });
    function soltar(){ drag = null; canvas.classList.remove('girando'); }
    canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('wheel', function(e){ if (!running || vr) return; e.preventDefault(); cam3.zoom(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    document.addEventListener('visibilitychange', function(){
      if (!ativo || vr) return;   // em VR quem manda é a sessão (parar o desenho congela a imagem no headset)
      if (document.hidden) { if (running) { parar(); running = 'oculto'; } salvar(); }
      else if (running === 'oculto') { running = false; iniciar(); }
    });
    window.addEventListener('pagehide', function(){ if (ativo) salvar(); });
  }
  function esconderDica(){ if (!dica.classList.contains('some')) { clearTimeout(dicaTimer); dicaTimer = setTimeout(function(){ dica.classList.add('some'); }, 2500); } }

  /* ---------- passo do jogo ---------- */
  function angDif(a, b){ var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function passo(dt){
    /* entrada → direção no chão relativa à câmera */
    var ix = (keys.d ? 1 : 0) - (keys.e ? 1 : 0), iz = (keys.f ? 1 : 0) - (keys.t ? 1 : 0);
    cam3.frente(frente);
    var mx = frente.x * iz - frente.z * ix, mz = frente.z * iz + frente.x * ix, ml = Math.hypot(mx, mz);
    var vmax = keys.r ? CORRER : ANDAR;
    var tx = ml ? mx / ml * vmax : 0, tz = ml ? mz / ml * vmax : 0;
    var k = 1 - Math.exp(-dt * (ml ? 9 : 12));
    st.vx += (tx - st.vx) * k; st.vz += (tz - st.vz) * k;
    /* anda e resolve colisão (o boneco escorrega pelas bordas) */
    var p = { x: st.x + st.vx * dt, z: st.z + st.vz * dt };
    var piso = amb.alturaPiso ? amb.alturaPiso(p.x, p.z, st.y) : 0;
    /* null significa que não existe piso nesta altura (borda do mezanino/vazio). */
    if (piso == null) { p.x = st.x; p.z = st.z; piso = st.y; st.vx = st.vz = 0; }
    amb.colisao.resolver(p, RAIO, piso);
    var pisoResolvido = amb.alturaPiso ? amb.alturaPiso(p.x, p.z, piso) : 0;
    if (pisoResolvido == null) { p.x = st.x; p.z = st.z; pisoResolvido = st.y; st.vx = st.vz = 0; }
    var vReal = Math.hypot(p.x - st.x, p.z - st.z) / Math.max(dt, 1e-4);
    st.x = p.x; st.z = p.z;
    /* acompanha a rampa dos degraus sem saltos; ao parar, termina exatamente apoiado no piso. */
    st.y += (pisoResolvido - st.y) * (1 - Math.exp(-dt * 18));
    if (Math.abs(st.y - pisoResolvido) < 0.002) st.y = pisoResolvido;
    fisicaPulo(dt);
    /* vira para onde está andando */
    var rumoAntes = st.rumo, sp = Math.hypot(st.vx, st.vz);
    if (sp > 0.15) st.rumo += angDif(st.rumo, Math.atan2(st.vx, st.vz)) * (1 - Math.exp(-dt * 11));
    var curva = angDif(rumoAntes, st.rumo) / Math.max(dt, 1e-4);
    player.root.position.set(st.x, st.y + st.jy, st.z);
    player.root.rotation.y = st.rumo;
    player.andar(pulo.fase === 2 ? 0 : Math.min(sp, vReal + 0.3), curva);   // no ar, sem os pulinhos de andar
    /* apertado entre móveis: os braços encostam no corpo */
    var folga = amb.colisao.folga(st, st.y);
    player.apertar((RAIO + BRACO - folga) / BRACO);
    if (sp > 0.05) mexeu = true;
  }
  function loop(){
    if (!running) return;
    var dt = Math.min(clock.getDelta(), 0.05); t += dt;
    if (vr) {   // VR: a cabeça rastreada é o jogador (colisão e piso iguais aos do desktop); o boneco fica oculto nesta etapa
      vrAntes.x = st.x; vrAntes.z = st.z;
      vr.passo(dt, amb, st, RAIO);
      if (Math.hypot(st.x - vrAntes.x, st.z - vrAntes.z) > 0.01) mexeu = true;
      player.root.position.set(st.x, st.y, st.z); player.root.rotation.y = st.rumo; player.andar(0, 0);
    }
    else if (sentado || travado) { player.andar(0, 0); st.vx = st.vz = 0; }
    else if (!(inter && inter.aberto())) passo(dt);
    else { player.andar(0, 0); st.vx = st.vz = 0; fisicaPulo(dt); player.root.position.y = st.y + st.jy; } // painel aberto no ar: termina a queda
    player.root.updateMatrixWorld(true);
    var it = sentado || travado ? null : inter.atualizar(t, st, { x: Math.sin(st.rumo), z: Math.cos(st.rumo) });
    if (it) { var ao = it.alvo || [it.x, it.y, it.z]; alvoOlhar.set(ao[0], ao[1], ao[2]); player.olharPara(alvoOlhar); } else player.soltarOlhar();
    if (pulo.fase === 2) player.erguer(0.5, 0.5);   // bracinhos sobem no ar
    gelatinaPulo(dt);
    if (sentado) avisoLevantar();
    player.update(t, dt);
    /* a câmera sobe só metade do pulo (e com a suavização dela): acompanha sem solavanco */
    camAlvo.x = st.x; camAlvo.z = st.z; camAlvo.vx = st.vx; camAlvo.vz = st.vz; camAlvo.y = st.y + st.jy * 0.45;
    if (vr) vr.olho(vrOlho);   // posição da cabeça no mundo (a câmera em VR é filha do rig)
    else if (conversa) cameraConversa(dt); else cam3.atualizar(camAlvo, dt, amb.colisao, amb.limites);
    amb.atualizar(t, vr ? vrOlho : camera.position, st);
    if (vr && vr.antesDeDesenhar) vr.antesDeDesenhar(dt);
    renderer.render(scene, camera);
    if (vr && vr.depoisDeDesenhar) vr.depoisDeDesenhar(dt);
    if (mexeu && t - salvoEm > 1.5) salvar();
  }
  /* ---------- pulo ---------- */
  var camAlvo = { x: 0, y: 0, z: 0, vx: 0, vz: 0 }, E3 = new THREE.Vector3();
  function pular(){
    if (pulo.fase !== 0 || sentado || travado || conversa || (inter && inter.aberto())) return;   // só do chão: sem pulo duplo
    if (amb.alturaPiso && Math.abs(st.y - (amb.alturaPiso(st.x, st.z, st.y) || st.y)) > 0.05) return; // em transição de piso
    pulo.fase = 1; pulo.t = 0; mexeu = true;
  }
  function fisicaPulo(dt){
    if (pulo.fase === 1) { pulo.t += dt; if (pulo.t >= PREP) { pulo.fase = 2; st.vy = VPULO; } return; }
    if (pulo.fase !== 2) return;
    st.vy -= GRAV * dt; st.jy += st.vy * dt;
    /* teto: a cabeça (1,3 m) não passa do forro, da laje ou do teto dos nichos */
    var teto = amb.limites && amb.limites.tetoEm ? amb.limites.tetoEm(st.x, st.z, st.y) : 99, folgaTeto = teto - (st.y + ALTURA + 0.05);
    if (st.jy > folgaTeto) { st.jy = Math.max(0, folgaTeto); if (st.vy > 0) st.vy = 0; }
    if (st.jy <= 0) { st.jy = 0; st.vy = 0; pulo.fase = 0; pulo.pouso = 1; }   // pousou: a gelatina achata
  }
  /* gelatina: agacha antes, estica subindo, arredonda no alto, achata ao pousar e balança de volta (só a escala do mundo;
     o kit do avatar não muda) */
  var sqY = 0, sqV = 0;
  function gelatinaPulo(dt){
    var alvo = 0;
    if (pulo.fase === 1) alvo = -0.2;
    else if (pulo.fase === 2) alvo = Math.max(-0.05, Math.min(0.13, st.vy * 0.04));
    if (pulo.pouso) { sqV -= 3.2 * pulo.pouso; pulo.pouso = 0; }       // impacto: achata
    var mola = 170, amort = 11;                                        // mola amortecida: volta à forma com um balanço
    sqV += ((alvo - sqY) * mola - sqV * amort) * Math.min(dt, 0.033); sqY += sqV * Math.min(dt, 0.033);
    sqY = Math.max(-0.28, Math.min(0.2, sqY));
    var sy = 1 + sqY, sx = 1 / Math.sqrt(sy);                          // preserva o volume
    player.root.scale.set(ESCALA * sx, ESCALA * sy, ESCALA * sx);
  }
  function soltarPulo(){ st.jy = 0; st.vy = 0; pulo.fase = 0; sqY = 0; sqV = 0; player.root.scale.setScalar(ESCALA); }

  /* setAnimationLoop em vez de requestAnimationFrame: no desktop é o mesmo laço da janela; numa sessão WebXR o three
     passa a usar o laço da sessão (o requestAnimationFrame da janela não serve para o headset). */
  function iniciar(){ if (running) return; running = true; clock.getDelta(); renderer.setAnimationLoop(loop); }
  function parar(){
    keys = {};
    if (vr) return;   // em VR o desenho nunca para: a imagem congelada no headset enjoa (quem trava o controle é o próprio fluxo)
    running = false; renderer.setAnimationLoop(null);
  }

  /* colisor = tronco do corpo escolhido, na escala do mundo (Jujuba ≈ 0,33 m; Gota ≈ 0,37; Esguio ≈ 0,26) */
  function raioDoCorpo(){
    RAIO = +(player.raioTronco() * ESCALA * 0.96).toFixed(3);
    if (amb) { var p = { x: st.x, z: st.z }; amb.colisao.resolver(p, RAIO, st.y); st.x = p.x; st.z = p.z; }
  }

  /* ---------- sentar e levantar (assentos definidos no catálogo de móveis; reutilizável em bancos e sofás) ---------- */
  var sentado = null, camAntes = null, avisoEl = document.getElementById('aviso'), vTmp = new THREE.Vector3();
  function sentar(a){
    if (sentado) return;
    sentado = a; inter.limpar(); keys = {}; soltarPulo();
    st.x = a.x; st.z = a.z; st.rumo = a.rumo; st.vx = st.vz = 0;
    st.y = amb.alturaPiso ? (amb.alturaPiso(a.x, a.z, st.y) || 0) : 0;
    player.root.position.set(a.x, st.y + a.altura - 0.06, a.z); player.root.rotation.y = a.rumo;  // tronco apoiado no assento
    player.sentar(true);
    var c = cam3.estado; camAntes = { dist: c.dist, pitch: c.pitch };
    c.dist = Math.min(c.dist, 2.7); c.pitch = 0.38;
    c.yaw = Math.atan2(a.saida.x - a.x, a.saida.z - a.z);                                   // câmera do lado aberto do assento, olhando para o boneco
    avisoEl.querySelector('span').textContent = 'Levantar'; avisoEl.hidden = false;
  }
  function levantar(){
    if (!sentado) return;
    var a = sentado; sentado = null;
    player.sentar(false); player.root.position.y = st.y;
    /* sai pelo ponto de saída do assento; se estiver ocupado, a colisão empurra para o lugar livre mais perto */
    var p = { x: a.saida.x, z: a.saida.z }; amb.colisao.resolver(p, RAIO, st.y);
    st.x = p.x; st.z = p.z; st.rumo = Math.atan2(a.saida.x - a.x, a.saida.z - a.z);
    player.root.position.set(st.x, st.y, st.z); player.root.rotation.y = st.rumo;
    if (camAntes) { cam3.estado.dist = camAntes.dist; cam3.estado.pitch = camAntes.pitch; }
    avisoEl.hidden = true;
  }
  function avisoLevantar(){
    vTmp.set(st.x, 1.75, st.z).project(camera);
    var r = canvas.getBoundingClientRect();
    avisoEl.style.left = ((Math.max(-0.88, Math.min(0.88, vTmp.x)) + 1) / 2 * r.width) + 'px';
    avisoEl.style.top = ((1 - Math.max(-0.75, Math.min(0.82, vTmp.y))) / 2 * r.height) + 'px';
    avisoEl.style.visibility = 'visible';
  }

  /* põe o boneco num ponto { x, z, rumo, camYaw } (ou na posição salva) e a câmera atrás dele */
  function posicionar(ponto, salvo){
    soltarPulo();
    st.x = ponto.x; st.z = ponto.z; st.y = isFinite(ponto.y) ? ponto.y : 0; st.rumo = ponto.rumo || 0; st.vx = st.vz = 0;
    var p = { x: st.x, z: st.z }; amb.colisao.resolver(p, RAIO, st.y); st.x = p.x; st.z = p.z;
    var piso = amb.alturaPiso ? amb.alturaPiso(st.x, st.z, st.y) : 0; st.y = piso == null ? 0 : piso;
    cam3.atras(st.rumo);
    if (salvo) cam3.restaurar(salvo); else if (ponto.camYaw != null) cam3.restaurar({ yaw: ponto.camYaw });
    player.root.position.set(st.x, st.y, st.z); player.root.rotation.y = st.rumo;
  }
  /* troca de ambiente sem sair do jogo: o mesmo boneco (mesma configuração), véu enquanto a cena monta */
  var veu = document.getElementById('veu');
  function irPara(id){
    if (!O.ambientes.lista[id] || (amb && amb.def.id === id)) return;
    var de = amb ? amb.def.id : null, txt = veu.querySelector('p');
    if (inter) inter.fechar();
    if (sentado) levantar();
    txt.textContent = 'Indo para ' + O.ambientes.lista[id].nome + '…'; veu.hidden = false; veu.classList.remove('some');
    parar();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      carregarAmbiente(id);
      var def = amb.def, chegada = (def.chegadas && def.chegadas[de]) || def.entrada;
      posicionar(chegada, null);
      player.update(t, 0); cam3.atualizar(st, 0, amb.colisao, amb.limites);
      renderer.compile(scene, camera); renderer.render(scene, camera);
      salvar(); iniciar(); canvas.focus();
      veu.classList.add('some'); setTimeout(function(){ veu.hidden = true; txt.textContent = 'Entrando no Orvalho…'; }, 520);
    }); });
  }

  /* ---------- conversa com um NPC: o boneco se vira para a pessoa e a câmera enquadra os dois por cima do ombro ----------
     O ponto de atendimento (it.x, it.z) fica onde o jogador alcança; it.alvo é onde a pessoa está (ex.: atrás do balcão). */
  var conversa = null, camPos = new THREE.Vector3(), camOlhar = new THREE.Vector3(), olharS = new THREE.Vector3();
  function conversar(it){
    var a = it.alvo;
    st.rumo = Math.atan2(a[0] - st.x, a[2] - st.z); player.root.rotation.y = st.rumo;
    conversa = { alvo: new THREE.Vector3(a[0], a[1], a[2]) };
    olharS.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
  }
  function encerrarConversa(){ if (!conversa) return; conversa = null; cam3.continuarDe(camera.position); }
  function cameraConversa(dt){
    var a = conversa.alvo, dx = a.x - st.x, dz = a.z - st.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    /* atrás do jogador e para o lado, acima da cabeça dele: os dois rostos ficam separados na tela.
       A distância respeita paredes e vidros (nunca enquadra do outro lado de uma divisória). */
    var ox = -ux * 1.6 + uz * 1.15, oz = -uz * 1.6 - ux * 1.15, ol = Math.hypot(ox, oz);
    var livre = Math.max(0.5, amb.colisao.raio(st.x, st.z, ox / ol, oz / ol, st.y) - 0.25), f = Math.min(1, livre / ol);
    camPos.set(st.x + ox * f, st.y + 1.85, st.z + oz * f);
    camOlhar.set(a.x - ux * 0.25, a.y - 0.4, a.z - uz * 0.25);
    var k = 1 - Math.exp(-(dt || 0) * 6);
    camera.position.lerp(camPos, dt ? k : 1); olharS.lerp(camOlhar, dt ? k : 1);
    camera.lookAt(olharS);
  }

  /* deslocamento vertical no mesmo Hall: preserva aparência, câmera e estado do ambiente.
     A cena continua desenhando (portas abrindo e fechando); só o controle do boneco fica travado. */
  var travado = false, fecharPortas = 0;
  /* onde o jogador fica ao sair da cabine, diante das portas (o mesmo no desktop e no VR) */
  function saidaElevador(piso){ return piso ? { x: 14.6, y: 4.2, z: 13.15, rumo: Math.PI } : { x: 14.6, y: 0, z: 13.75, rumo: Math.PI }; }
  function abrirElevador(){
    if (!amb || amb.def.id !== 'hall-inovale' || travado) return;
    if (sentado) levantar();
    keys = {}; travado = true; if (!running) iniciar();
    var atual = st.y > 3 ? 1 : 0, el = amb.elevador;
    clearTimeout(fecharPortas);
    O.elevador.abrir(atual, {
      portas: function(piso, aberta){ if (el) el.porta(piso, aberta); },
      mover: function(piso){
        posicionar(saidaElevador(piso), null); cam3.restaurar({ yaw: Math.PI / 2 + 0.45, pitch: 0.18, dist: 3.2 }); // de lado, ao longo do corredor: vê o boneco e as portas player.update(t, 0); cam3.atualizar(st, 0, amb.colisao, amb.limites); salvar();
      },
      fim: function(){
        travado = false; keys = {}; canvas.focus();
        var piso = st.y > 3 ? 1 : 0;
        fecharPortas = setTimeout(function(){ if (el && !travado) el.porta(piso, false); }, 1800);
      }
    });
  }

  /* ---------- salvar a exploração (onde parou) ---------- */
  function salvar(){
    if (!amb) return;
    salvoEm = t; mexeu = false;
    var c = cam3.estado;
    if (sentado) { var sx = st.x, sz = st.z; st.x = sentado.saida.x; st.z = sentado.saida.z; }  // salva o lugar de pé, não o assento
    /* em VR, dentro da cabine do elevador (fora da colisão do Hall): salva o lugar diante das portas */
    var seguro = vr && vr.pontoSeguro ? vr.pontoSeguro() : null, guardado = null;
    if (seguro) { guardado = { x: st.x, y: st.y, z: st.z }; st.x = seguro.x; st.y = seguro.y; st.z = seguro.z; }
    try { localStorage.setItem(CHAVE, JSON.stringify({ amb: amb.def.id, x: +st.x.toFixed(3), y: +st.y.toFixed(3), z: +st.z.toFixed(3), rumo: +st.rumo.toFixed(3), yaw: +c.yaw.toFixed(3), pitch: +c.pitch.toFixed(3), dist: +c.dist.toFixed(2) })); } catch (e) {}
    if (sentado) { st.x = sx; st.z = sz; }
    if (guardado) { st.x = guardado.x; st.y = guardado.y; st.z = guardado.z; }
  }
  function lerSalvo(){
    try { var s = JSON.parse(localStorage.getItem(CHAVE)); if (s && O.ambientes.lista[s.amb] && isFinite(s.x) && isFinite(s.z)) return s; } catch (e) {}
    return null;
  }

  O.jogo = {
    entrar: function(o){
      if (!renderer && !init()) { alert('Seu navegador não conseguiu abrir o 3D (WebGL).'); return; }
      var salvo = o.continuar ? lerSalvo() : null;
      carregarAmbiente(salvo ? salvo.amb : (o.ambiente || 'lab-ia'));
      /* a aparência escolhida entra antes do primeiro quadro: nunca aparece o boneco padrão */
      player.set(o.cfg, true); raioDoCorpo();
      posicionar(salvo || amb.entrada, salvo);
      ativo = true; keys = {};
      dica.classList.remove('some'); clearTimeout(dicaTimer); dicaTimer = setTimeout(function(){ dica.classList.add('some'); }, 12000);
      size();
      player.update(t, 0); cam3.atualizar(st, 0, amb.colisao, amb.limites);
      renderer.compile(scene, camera);   // compila os shaders atrás do véu
      renderer.render(scene, camera);
      iniciar();
      canvas.focus();
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ if (o.aoPronto) o.aoPronto(); setTimeout(function(){ player.wave(1400); }, 500); }); });
    },
    sair: function(){ if (!ativo) return; if (sentado) levantar(); salvar(); parar(); ativo = false; if (inter) inter.fechar(); document.getElementById('aviso').hidden = true; },
    pausar: function(){ if (inter) inter.fechar(); parar(); },
    retomar: function(cfg){ if (!ativo) return; if (cfg) { player.set(cfg); raioDoCorpo(); } iniciar(); canvas.focus(); setTimeout(function(){ player.wave(1200); }, 250); },
    temSalvo: function(){ return !!lerSalvo(); },
    ativo: function(){ return ativo; },
    painelAberto: function(){ return !!(inter && inter.aberto()); },
    sentado: function(){ return !!sentado; },
    irPara: irPara,
    usarElevador: abrirElevador,
    ambienteAtual: function(){ return amb ? amb.def.id : null; },
    /* modo VR (src/xr/sessao.js): h = { passo(dt, amb, st, raio), olho(v3), antesDeDesenhar(dt)?, depoisDeDesenhar(dt)? }.
       Ligado: teclado, mouse e câmera em 3ª pessoa param, e o boneco do jogador some (o corpo em VR vem depois).
       Desligado: o boneco reaparece virado para onde a pessoa olhava, com a câmera atrás dele. */
    vr: {
      contexto: function(){ return renderer ? { renderer: renderer, scene: scene, camera: camera, st: st, amb: amb, player: player, raio: RAIO, altura: ALTURA } : null; },
      ligar: function(h){
        if (sentado) levantar();
        if (inter) inter.fechar();
        soltarPulo(); keys = {}; st.vx = st.vz = 0;
        vr = h; player.root.visible = false;
        if (!running) iniciar();
      },
      desligar: function(){
        if (!vr) return;
        vr = null; player.root.visible = true; keys = {};
        var p = { x: st.x, z: st.z }; amb.colisao.resolver(p, RAIO, st.y); st.x = p.x; st.z = p.z;
        player.root.position.set(st.x, st.y, st.z); player.root.rotation.y = st.rumo;
        camera.fov = 55; camera.updateProjectionMatrix(); size();   // a sessão troca a projeção da câmera
        cam3.restaurar({ yaw: st.rumo + Math.PI }); cam3.atualizar(st, 0, amb.colisao, amb.limites);
        salvar(); canvas.focus();
      },
      ativo: function(){ return !!vr; },
      saidaElevador: saidaElevador,
      /* troca de ambiente dentro da sessão (raio.js chama com a vista escura): sem parar() nem requestAnimationFrame duplo, que
         não rodam numa sessão imersiva. Monta o ambiente novo, põe o jogador na chegada e compila os shaders de uma vez. */
      irPara: function(id){
        if (!vr || !O.ambientes.lista[id] || (amb && amb.def.id === id)) return false;
        var de = amb ? amb.def.id : null;
        if (inter) inter.fechar();
        carregarAmbiente(id);
        var def = amb.def, chegada = (def.chegadas && def.chegadas[de]) || def.entrada;
        posicionar(chegada, null);
        player.root.visible = false;
        renderer.compile(scene, camera);
        salvar();
        console.info('[Orvalho VR] ambiente trocado: ' + de + ' → ' + id);
        return true;
      }
    },
    /* para testes e depuração */
    _debug: function(){ return { raio: RAIO, escala: ESCALA, st: st, cam: cam3 && cam3.estado, player: player, amb: amb, renderer: renderer, camera: camera, keys: keys, info: renderer && renderer.info }; }
  };
})(window.Orvalho);
