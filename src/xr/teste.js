/* Modo de medição do VR (?vr-teste=<id>; a página /t do `npm run servir:https` abre cada teste com os parâmetros certos).
   Sem prints: durante a sessão, os números vão por POST para o servidor local, que acrescenta uma linha por registro em
   testes/medicoes-vr/<data>.jsonl (endpoint de desenvolvimento, só no servir:https; ver testes/servir-https.js).
   - Aquecimento: os primeiros AQUECIMENTO s são descartados da varredura (compilação de shaders, texturas, JIT). Ao acabar: 1 bipe.
   - Giro automático (?vr-giro, padrão 12°/s; 0 desliga): depois do aquecimento, o rig gira em torno da cabeça a velocidade
     constante por uma volta (30 s a 12°/s), sem mudar a posição. Assim todos os testes têm o mesmo padrão. Quem testa fica parado
     olhando para a frente (pode fechar os olhos). Sem giro, a volta acaba quando os 8 setores tiverem quadros suficientes.
     Ao acabar a volta: 2 bipes.
   - Bipes: WebAudio, criado no toque em "Entrar em VR" (prepararAudio, chamado por sessao.js dentro do gesto), mais um pulso
     háptico por bipe nos dois controles (se o som estiver baixo).
   - Varredura por direção: depois do aquecimento, cada quadro entra num de 8 setores de yaw da cabeça (45° cada, centrados em
     0° = +z/S, 90° = +x/L, 180° = N, 270° = O). Por setor: quadros, fps médio, pior quadro, draws e triângulos (média e
     máximo), CPU de atualização e de render, GPU (se houver). A tabela vai a cada ENVIO s e ao fim da volta.
   - Marca: botão A (controle direito) ou qualquer gatilho registra os mesmos dados naquele instante (último ~1 s).
   - Bateria (?vr-bateria=<id>, listas em src/xr/pontos.js): vários testes numa sessão só. Cada passo troca os parâmetros
     (opcoes.definirTeste), leva o jogador ao ponto com um véu (fade), aquece (AQUEC_BATERIA s a partir do 2º passo: os shaders
     já estão compilados), dá a volta e grava como um teste normal (mesmo id, registros iguais aos de um teste avulso, com o
     campo "bateria" no início). No fim: 3 bipes e a sessão termina sozinha. O framebuffer não muda numa sessão: uma bateria
     por ambiente.
   Registros (campo "tipo"): inicio · resumo (a cada 10 s, últimos 10 s) · setores · marca · fim. Todos levam teste, ponto,
   parâmetros, framebuffer real, Hz ativo, posição e yaw da cabeça.
   Fora do servir:https (site publicado, `npm run servir`) o envio falha uma vez, avisa no log e para de tentar.
   API: O.xr.teste = { ativo(), prepararAudio(), iniciar(ctx) → { passo(dt), dispose() } | null, ultimo(), registros(), eventos() }
   ctx (de sessao.js): { medidor, sessao, ambiente(), girar(rad), irPara(ponto), pronto(), reaplicar(), vibrar(forca, ms), veu, sair() } */
(function(O){
  O.xr = O.xr || {};
  /* O.config.testeVR = { aquecimento, aquecBateria, pausa, envio } encurta os tempos (só no teste automático, testes/vr.js) */
  var CFG = (O.config && O.config.testeVR) || {};
  var AQUECIMENTO = CFG.aquecimento != null ? CFG.aquecimento : 20, AQUEC_BATERIA = CFG.aquecBateria != null ? CFG.aquecBateria : 10;
  var PICO_MS = 25, PAUSA = CFG.pausa != null ? CFG.pausa : 1.2, ENVIO = CFG.envio || 10, ENDPOINT = '/__orvalho/medicoes', NSET = 8, MIN_QUADROS = 60;
  var ultimo = null, enviados = [], eventos = [], audio = null;

  function ativo(){ return !!(O.xr.opcoes && O.xr.opcoes.teste()); }

  /* precisa vir de um gesto (o toque em "Entrar em VR"): sem isso o navegador deixa o áudio suspenso */
  function prepararAudio(){
    try {
      if (!audio) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
      if (audio && audio.resume) audio.resume();
    } catch (e) { audio = null; }
  }
  function bipes(n, vibrar){
    eventos.push({ tipo: 'bipes', n: n, quando: performance.now() });
    if (vibrar) for (var k = 0; k < n; k++) setTimeout(function(){ vibrar(0.6, 90); }, k * 300);
    if (!audio) return;
    try {
      var t = audio.currentTime + 0.03;
      for (var i = 0; i < n; i++) {
        var osc = audio.createOscillator(), g = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = 880;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.012);
        g.gain.setValueAtTime(0.3, t + 0.13); g.gain.linearRampToValueAtTime(0, t + 0.17);
        osc.connect(g); g.connect(audio.destination); osc.start(t); osc.stop(t + 0.2);
        t += 0.3;
      }
    } catch (e) {}
  }

  /* um teste (avulso ou um passo de bateria). cfg = { aquecimento, bipeVolta, bateria: { id, passo, de } | null } */
  function instancia(ctx, cfg){
    var med = ctx.medidor, sessao = ctx.sessao, id = O.xr.opcoes.teste();
    var pt = O.xr.pontos && O.xr.pontos.atual();
    var AQ = cfg.aquecimento, giro = O.xr.opcoes.ler().giroTeste || 0;   // °/s
    var idSessao = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var t0 = performance.now(), ultimoEnvio = t0, nMarcas = 0, falhou = false, okEnvios = 0;
    var aquecido = false, girado = 0, volta = false, avisoEm = 0;
    var setores = [], recentes = [], botoesAntes = {}, picos = [], nPicos = 0;   // picos: quadros acima de PICO_MS nos últimos ENVIO s
    function zerarSetores(){ setores = []; for (var i = 0; i < NSET; i++) setores.push({ n: 0, somaDt: 0, piorDt: 0, somaCalls: 0, maxCalls: 0, somaTris: 0, maxTris: 0, somaUpd: 0, somaRen: 0, somaGpu: 0, nGpu: 0 }); }
    zerarSetores();

    function seg(){ return (performance.now() - t0) / 1000; }
    function setorDe(yaw){ return Math.floor(((yaw + 22.5) % 360 + 360) % 360 / (360 / NSET)); }
    function r1(v){ return v == null ? null : +v.toFixed(1); }
    function base(tipo){
      var c = med.cabeca();
      return { tipo: tipo, teste: id, sessao: idSessao, t: +seg().toFixed(1), quando: new Date().toISOString(), ponto: pt ? pt.id : null,
        ambiente: ctx.ambiente(), parametros: med.parametros(), fbReal: med.framebuffer(), hzAtivo: med.hzAtivo(),
        pos: { x: c.x, y: c.y, z: c.z }, yaw: c.yaw, rumo: O.xr.rumoTexto(c.yaw), zona: med.zona() };
    }
    /* resumo de uma lista de amostras de quadro */
    function resumir(lista){
      if (!lista.length) return null;
      var sd = 0, pd = 0, sc = 0, mc = 0, st = 0, mt = 0, su = 0, sr = 0, sg = 0, ng = 0;
      lista.forEach(function(a){ sd += a.dt; if (a.dt > pd) pd = a.dt; sc += a.calls; if (a.calls > mc) mc = a.calls; st += a.tris; if (a.tris > mt) mt = a.tris;
        su += a.atualizacao; sr += a.render; if (a.gpu != null) { sg += a.gpu; ng++; } });
      var n = lista.length;
      return { quadros: n, fps: r1(1000 / (sd / n)), ms: r1(sd / n), piorMs: r1(pd), fpsPior: r1(1000 / pd), draws: Math.round(sc / n), drawsMax: mc,
        tris: Math.round(st / n), trisMax: mt, cpuAtualizacao: +(su / n).toFixed(2), cpuRender: +(sr / n).toFixed(2), gpu: ng ? +(sg / ng).toFixed(2) : null };
    }
    function tabela(){
      return setores.map(function(s, i){
        var yaw = i * 360 / NSET;
        var linha = { setor: i, yaw: yaw, rumo: O.xr.rumoTexto(yaw), quadros: s.n };
        if (!s.n) return linha;
        linha.fps = r1(1000 / (s.somaDt / s.n)); linha.piorMs = r1(s.piorDt); linha.fpsPior = r1(1000 / s.piorDt);
        linha.draws = Math.round(s.somaCalls / s.n); linha.drawsMax = s.maxCalls; linha.tris = Math.round(s.somaTris / s.n); linha.trisMax = s.maxTris;
        linha.cpuAtualizacao = +(s.somaUpd / s.n).toFixed(2); linha.cpuRender = +(s.somaRen / s.n).toFixed(2); linha.gpu = s.nGpu ? +(s.somaGpu / s.nGpu).toFixed(2) : null;
        return linha;
      });
    }
    function enviar(reg){
      if (O.xr.evento) O.xr.evento('envio');
      ultimo = reg; enviados.push(reg); if (enviados.length > 50) enviados.shift();
      if (falhou) return;
      /* fora do quadro do XR (02/11): o JSON e o fetch rodam numa tarefa à parte, depois que o quadro foi entregue */
      setTimeout(function(){ postar(reg); }, 0);
    }
    function postar(reg){
      if (falhou) return;
      var corpo = JSON.stringify(reg);
      if (corpo.length > 30000) { console.warn('[Orvalho VR] registro de medição grande demais (' + corpo.length + ' bytes), não enviado'); return; }
      try {
        fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: true, cache: 'no-store' }).then(function(r){
          if (!r.ok) throw new Error('HTTP ' + r.status);
          okEnvios++;
        }).catch(function(e){
          if (falhou) return; falhou = true;
          console.warn('[Orvalho VR] medições não enviadas (' + (e && e.message || e) + '): o envio só existe no npm run servir:https; os dados ficam só no log');
        });
      } catch (e) { falhou = true; }
    }

    med.aoQuadro(function(a){
      var c = med.cabeca();
      a.t = seg(); a.yaw = c.yaw;
      recentes.push(a); while (recentes.length && a.t - recentes[0].t > ENVIO) recentes.shift();
      if (a.dt > PICO_MS) {   // quadro lento: quando foi (s desde o início do teste) e o que o instrumento fez nos 3 últimos quadros
        nPicos++; picos.push({ t: +a.t.toFixed(2), ms: +a.dt.toFixed(1), ev: a.eventos || [] });
        while (picos.length > 60 || (picos.length && a.t - picos[0].t > ENVIO)) picos.shift();
      }
      if (a.t < AQ) return;
      var s = setores[setorDe(c.yaw)];
      s.n++; s.somaDt += a.dt; if (a.dt > s.piorDt) s.piorDt = a.dt;
      s.somaCalls += a.calls; if (a.calls > s.maxCalls) s.maxCalls = a.calls; s.somaTris += a.tris; if (a.tris > s.maxTris) s.maxTris = a.tris;
      s.somaUpd += a.atualizacao; s.somaRen += a.render; if (a.gpu != null) { s.somaGpu += a.gpu; s.nGpu++; }
    });

    var ini = base('inicio');
    ini.aquecimento = AQ; ini.navegador = O.xr.log ? O.xr.log.diagnostico().navegador : navigator.userAgent.slice(0, 80);
    ini.gpuDisponivel = med.gpuDisponivel(); ini.gpuMotivo = med.gpuDisponivel() ? null : med.gpuMotivo();
    ini.suportadas = sessao.supportedFrameRates ? Array.prototype.slice.call(sessao.supportedFrameRates) : null;
    ini.giroAuto = giro;
    if (cfg.bateria) ini.bateria = cfg.bateria;
    enviar(ini);
    console.info('[Orvalho VR] teste "' + id + '"' + (cfg.bateria ? ' (bateria ' + cfg.bateria.id + ', ' + cfg.bateria.passo + '/' + cfg.bateria.de + ')' : '') + ': aquecimento de ' + AQ + ' s; '
      + (giro ? 'depois o jogo gira sozinho ' + giro + '°/s (fique parado olhando para a frente)' : 'depois gire a cabeça devagar 360° (~30 s)') + '. A ou gatilho = marca');

    function registroResumo(tipo){
      var r = base(tipo), res = resumir(recentes);
      r.aquecendo = seg() < AQ; r.medidas = res;
      r.picos = picos.slice(); r.picosTotal = nPicos;
      return r;
    }
    function registroSetores(tipo){
      var r = base(tipo), cob = setores.filter(function(s){ return s.n > 0; }).length;
      r.setoresCobertos = cob; r.setores = tabela();
      return r;
    }
    /* A (botão 4 do controle direito no mapeamento xr-standard) ou gatilho (botão 0 de qualquer controle): borda de subida */
    function vigiarBotoes(){
      var fontes = sessao.inputSources || [], apertou = false;
      for (var i = 0; i < fontes.length; i++) {
        var f = fontes[i], bs = f.gamepad && f.gamepad.buttons; if (!bs) continue;
        var lado = f.handedness || String(i);
        var agora = !!(bs[0] && bs[0].pressed) || (lado === 'right' && !!(bs[4] && bs[4].pressed));
        if (agora && !botoesAntes[lado]) apertou = true;
        botoesAntes[lado] = agora;
      }
      if (!apertou) return;
      nMarcas++;
      var r = base('marca'), um = recentes.filter(function(a){ return seg() - a.t <= 1; });
      r.marca = nMarcas; r.medidas = resumir(um); r.aquecendo = seg() < AQ;
      enviar(r);
      med.aviso('MARCA ' + nMarcas + ' REGISTRADA', 2.5);
      console.info('[Orvalho VR] marca ' + nMarcas + ' · ' + (r.medidas ? r.medidas.fps + ' fps, ' + r.medidas.draws + ' draw' : '') + ' · yaw ' + Math.round(r.yaw) + '° ' + r.rumo);
    }
    /* fim do aquecimento, giro automático e fim da volta. Devolve true no quadro em que a volta acaba. */
    function volta_(dt){
      var s = seg();
      if (!aquecido) {
        if (s < AQ) return false;
        aquecido = true; bipes(1, ctx.vibrar);
        med.aviso(giro ? 'GIRANDO · FIQUE PARADO' : 'GIRE DEVAGAR 360°', 3);
        console.info('[Orvalho VR] aquecimento concluído · ' + (giro ? 'giro automático ' + giro + '°/s' : 'gire a cabeça 360°'));
      }
      if (volta) return false;
      if (giro) {
        var da = Math.min(giro * dt, 360 - girado);
        if (da > 0) { ctx.girar(da * Math.PI / 180); girado += da; }
        if (performance.now() - avisoEm > 1000 && girado < 360) { avisoEm = performance.now(); med.aviso('GIRO ' + Math.round(girado) + '/360°', 1.5); }
        if (girado < 360 - 1e-6) return false;
      } else if (!setores.every(function(x){ return x.n >= MIN_QUADROS; })) return false;
      volta = true;
      enviar(registroSetores('setores'));   // a tabela completa, no instante em que a volta acaba
      return true;
    }

    return {
      /* devolve 'volta' no quadro em que a volta termina */
      passo: function(dt){
        vigiarBotoes();
        var acabou = volta_(dt || 0), agora = performance.now();
        if (acabou) {
          console.info('[Orvalho VR] volta completa · teste "' + id + '"');
          if (cfg.bipeVolta) { bipes(2, ctx.vibrar); med.aviso('VOLTA COMPLETA · SEGURE B PARA SAIR', 6); }
        }
        if (agora - ultimoEnvio >= ENVIO * 1000) {
          ultimoEnvio = agora;
          enviar(registroResumo('resumo'));
          if (seg() >= AQ) {
            var rs = registroSetores('setores'); enviar(rs);
            if (!giro || volta) med.aviso('SETORES ' + rs.setoresCobertos + '/8 · ENVIOS ' + okEnvios + (falhou ? ' (FALHOU)' : ''), 3);
          } else med.aviso('AQUECENDO ' + Math.ceil(AQ - seg()) + ' S · ENVIOS ' + okEnvios + (falhou ? ' (FALHOU)' : ''), 3);
        }
        return acabou ? 'volta' : null;
      },
      /* fim do teste: manda a tabela final (keepalive deixa o POST terminar mesmo saindo da página) */
      dispose: function(){
        var r = registroSetores('fim'); r.resumoFinal = resumir(recentes); r.marcas = nMarcas; r.picos = picos.slice(); r.picosTotal = nPicos; enviar(r);
        med.aoQuadro(null);
      },
      setores: tabela,
      id: function(){ return id; },
      girado: function(){ return girado; }
    };
  }

  /* bateria: os passos do ambiente em que a sessão começou, um depois do outro */
  function bateria(ctx, b){
    var amb = ctx.ambiente(), passos = b.passos.filter(function(p){ return p.amb === amb; });
    if (passos.length < b.passos.length) console.warn('[Orvalho VR] bateria "' + b.id + '": ' + (b.passos.length - passos.length) + ' passo(s) de outro ambiente ignorado(s); a sessão está em ' + amb);
    if (!passos.length) { console.warn('[Orvalho VR] bateria "' + b.id + '" sem passos neste ambiente'); return null; }
    var k = -1, inst = null, espera = 0, fim = false, pendente = 0;
    function comecar(i){
      k = i; var p = passos[i];
      O.xr.opcoes.definirTeste(p.id, p.params); ctx.reaplicar();
      var mover = function(){
        ctx.irPara(O.xr.pontos.definir(p.ponto));   // sempre recentraliza no ponto e no rumo dele: todos os passos começam iguais
        pendente = 2;   // o teste começa depois que a cabeça chegou e a zona foi recalculada (o "inicio" sai com o ponto certo)
      };
      if (i === 0) mover(); else ctx.veu.cobrir(0.35, mover);
    }
    function criar(){
      var i = k, p = passos[i];
      inst = instancia(ctx, { aquecimento: i === 0 ? AQUECIMENTO : AQUEC_BATERIA, bipeVolta: false, bateria: { id: b.id, passo: i + 1, de: passos.length } });
      ctx.medidor.aviso('BATERIA ' + (i + 1) + '/' + passos.length + ' · ' + p.id.toUpperCase(), 4);
    }
    comecar(0);
    return {
      passo: function(dt){
        if (pendente) {   // 2: esperando a pose; 1: a cabeça já está no ponto, falta um desenho para a zona
          if (pendente === 2 && ctx.pronto()) pendente = 1;
          else if (pendente === 1) { pendente = 0; criar(); }
          return;
        }
        if (inst) {
          if (inst.passo(dt) !== 'volta') return;
          inst.dispose(); inst = null;
          if (k + 1 < passos.length) { bipes(2, ctx.vibrar); espera = PAUSA; return; }
          fim = true; bipes(3, ctx.vibrar); ctx.medidor.aviso('BATERIA CONCLUÍDA · SAINDO', 5);
          console.info('[Orvalho VR] bateria "' + b.id + '" concluída (' + passos.length + ' testes); a sessão termina sozinha');
          setTimeout(ctx.sair, 2500);   // tempo para os 3 bipes e o último POST
        } else if (!fim && espera > 0) { espera -= dt; if (espera <= 0) comecar(k + 1); }
      },
      dispose: function(){ if (inst) { inst.dispose(); inst = null; } },
      passoAtual: function(){ return k; }
    };
  }

  function iniciar(ctx){
    if (!ativo()) return null;
    var idB = O.xr.opcoes.bateria();
    if (idB) {
      var b = O.xr.pontos && O.xr.pontos.bateria(idB);
      if (b) return bateria(ctx, b);
      console.warn('[Orvalho VR] bateria desconhecida "' + idB + '"; segue como teste avulso');
    }
    return instancia(ctx, { aquecimento: AQUECIMENTO, bipeVolta: true, bateria: null });
  }

  O.xr.teste = {
    ativo: ativo,
    prepararAudio: prepararAudio,
    iniciar: iniciar,
    ultimo: function(){ return ultimo; },
    registros: function(){ return enviados.slice(); },
    eventos: function(){ return eventos.slice(); }
  };
})(window.Orvalho);
