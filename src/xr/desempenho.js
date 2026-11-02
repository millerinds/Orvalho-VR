/* Medidor de desempenho do VR: painel pequeno preso à vista (canto inferior esquerdo), redesenhado 2× por segundo.
   No topo, fixo: id do teste (?vr-teste), ponto (?vr-ponto), parâmetros ativos (fb, fov, contorno, zonas, dist) e a posição (x, z)
   e a direção (yaw em graus, 0 = +z/sul, 90 = +x/leste) da cabeça. Embaixo: fps reais da sessão, tempo de quadro (média e pior),
   quadros acima do orçamento, tempo de CPU do quadro separado em ATUALIZAÇÃO do jogo (passo, colisão, portas, NPCs, otimizações)
   e RENDER (renderer.render: os dois olhos), GPU se o navegador expuser EXT_disjoint_timer_query_webgl2 (o WebXR não informa
   o tempo de GPU), draw calls e triângulos dos dois olhos, framebuffer e foveação. O próprio painel custa 2 draw calls (1 por olho).
   No console sai um resumo a cada 10 s; sem chrome://inspect, ele aparece no log do VR (?vr-log=1, src/xr/log.js).
   API: O.xr.criarMedidor(ctx) → { quadroInicio(), antesRender(), quadroFim(), visivel(v), amostra(), rotulo(), cabeca(),
        aoQuadro(fn), aviso(texto, seg), gpuDisponivel(), dispose() } */
(function(O){
  O.xr = O.xr || {};
  var RUMOS = ['S', 'SE', 'L', 'NE', 'N', 'NO', 'O', 'SO'];   // yaw 0 = +z (sul na planta), 90 = +x (leste)
  /* eventos do próprio instrumento por quadro (redesenho do medidor e do log, POST da medição, linha no console), para saber
     se os quadros lentos coincidem com eles. O custo de um redesenho aparece no envio da textura, no render do quadro seguinte,
     e o dt desse render só é medido no outro: por isso cada quadro leva os eventos dos 3 últimos. */
  var evQuadros = [[], [], []];
  O.xr.evento = function(nome){ var a = evQuadros[2]; if (a.indexOf(nome) < 0) a.push(nome); };
  function eventosRecentes(){ var r = []; evQuadros.forEach(function(q){ q.forEach(function(n){ if (r.indexOf(n) < 0) r.push(n); }); }); return r; }
  O.xr.rumoTexto = function(graus){ return RUMOS[Math.floor(((graus + 22.5) % 360 + 360) % 360 / 45)]; };

  O.xr.criarMedidor = function(ctx){
    var renderer = ctx.renderer, camera = ctx.camera, info = renderer.info;
    /* instrumento leve (02/11): o desenho é feito em 512×384 "lógicos" num canvas de 75% (384×288), sem mipmaps, no máximo
       1× por segundo e só se o texto mudou. Os quadros lentos de 25 ms sumiram no Quest sem o medidor e o log (lab-mudo). */
    var W = 512, H = 384, TOPO = 96, ESC = 0.75, chaveVista = '';
    var cv = document.createElement('canvas'); cv.width = Math.round(W * ESC); cv.height = Math.round(H * ESC);
    var g = cv.getContext('2d');
    g.setTransform(ESC, 0, 0, ESC, 0, 0);
    var tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    var geo = new THREE.PlaneGeometry(0.24, 0.24 * H / W);
    var mesh = new THREE.Mesh(geo, mat); mesh.name = 'xr-medidor';
    /* 70 cm à frente, abaixo e à esquerda do centro da vista, inclinado para os olhos */
    mesh.position.set(-0.13, -0.16, -0.7); mesh.rotation.set(0.22, 0.18, 0); mesh.renderOrder = 999; mesh.frustumCulled = false;
    camera.add(mesh);

    var janela = [], tAnt = 0, tIni = 0, tRen = 0, cpu = [], upd = [], ren = [], gpu = [], ultimo = 0, logEm = 0, dados = null, ouvinte = null;
    var tipoEspaco = ctx.tipoEspaco || '?', avisoTxt = null, avisoAte = 0, ultimoDt = 0, ultimoGpu = null;
    var pos = new THREE.Vector3(), dir = new THREE.Vector3();

    /* tempo de GPU: só com EXT_disjoint_timer_query_webgl2 (consulta assíncrona: o resultado chega alguns quadros depois) */
    var gl = renderer.getContext(), extT = null, consultaAtiva = null, pendentes = [], gpuMotivo = null;
    try { extT = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (e) { extT = null; }
    if (!extT) gpuMotivo = 'EXT_disjoint_timer_query_webgl2 indisponível neste navegador';
    function gpuInicio(){
      if (!extT || consultaAtiva || pendentes.length > 6) return;
      try { consultaAtiva = gl.createQuery(); gl.beginQuery(extT.TIME_ELAPSED_EXT, consultaAtiva); } catch (e) { extT = null; gpuMotivo = 'falha na consulta de tempo: ' + (e && e.message); consultaAtiva = null; }
    }
    function gpuFim(){
      if (!extT) return;
      if (consultaAtiva) { try { gl.endQuery(extT.TIME_ELAPSED_EXT); pendentes.push(consultaAtiva); } catch (e) {} consultaAtiva = null; }
      while (pendentes.length) {
        var q = pendentes[0], pronto = false;
        try { pronto = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); } catch (e) { pronto = true; }
        if (!pronto) break;
        var desviou = false; try { desviou = gl.getParameter(extT.GPU_DISJOINT_EXT); } catch (e) {}
        if (!desviou) { var ns = gl.getQueryParameter(q, gl.QUERY_RESULT); ultimoGpu = ns / 1e6; gpu.push(ultimoGpu); if (gpu.length > 90) gpu.shift(); }
        gl.deleteQuery(q); pendentes.shift();
      }
    }

    /* taxa realmente ativa (session.frameRate); sem ela, assume 72 só para o orçamento e mostra '?' */
    function ativoHz(){
      var s = renderer.xr.getSession && renderer.xr.getSession();
      return (s && s.frameRate) || null;
    }
    function alvoHz(){ return ativoHz() || 72; }
    function framebuffer(){
      var s = renderer.xr.getSession && renderer.xr.getSession();
      var bl = s && s.renderState && s.renderState.baseLayer;
      if (bl && bl.framebufferWidth) return bl.framebufferWidth + '×' + bl.framebufferHeight;
      /* projeção por XRWebGLBinding (camadas, o caso do Quest Browser na r149): o alvo de render da sessão tem o tamanho da textura.
         Lido depois do desenho; se não der, fica 'camadas'. */
      var rt = renderer.getRenderTarget && renderer.getRenderTarget();
      if (rt && rt.width) return rt.width + '×' + rt.height;
      return 'camadas';
    }
    function media(a){ if (!a.length) return null; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return +(s / a.length).toFixed(2); }
    /* cabeça no mundo: posição e yaw em graus (0 = +z, 90 = +x), no mesmo padrão do rumo do boneco */
    function cabeca(){
      camera.getWorldPosition(pos); camera.getWorldDirection(dir);
      var yaw = Math.atan2(dir.x, dir.z) * 180 / Math.PI; yaw = (yaw + 360) % 360;
      return { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), yaw: +yaw.toFixed(1) };
    }
    function parametros(){
      var op = O.xr.opcoes.ler();
      return { fb: ctx.escalaFb, fbAuto: !!ctx.fbAuto, fov: renderer.xr.getFoveation ? renderer.xr.getFoveation() : op.foveacao,
        contorno: op.contorno, zonas: op.zonas, dist: op.dist, hz: op.hz };
    }
    function calcular(){
      var n = janela.length; if (n < 2) return null;
      var soma = 0, pior = 0, acima = 0, alvo = alvoHz(), orc = 1000 / alvo * 1.1;
      for (var i = 0; i < n; i++) { soma += janela[i]; if (janela[i] > pior) pior = janela[i]; if (janela[i] > orc) acima++; }
      return {
        fps: +(1000 / (soma / n)).toFixed(1), ms: +(soma / n).toFixed(1), pior: +pior.toFixed(1), acima: acima, quadros: n,
        cpu: +(media(cpu) || 0).toFixed(1), cpuAtualizacao: +(media(upd) || 0).toFixed(1), cpuRender: +(media(ren) || 0).toFixed(1),
        gpu: gpu.length ? +media(gpu).toFixed(1) : null, gpuMotivo: gpu.length ? null : (gpuMotivo || 'aguardando a consulta de tempo'),
        alvo: alvo, hzAtivo: ativoHz(), hzPedido: ctx.hz ? ctx.hz.pedido : null, escalaFb: ctx.escalaFb,
        calls: info.render.calls, tris: info.render.triangles, fb: framebuffer(),
        foveacao: renderer.xr.getFoveation ? renderer.xr.getFoveation() : null, espaco: tipoEspaco
      };
    }
    /* zona de visibilidade da cabeça (Hall), para saber em que zona cada medida foi feita */
    function zona(){ var c = O.jogo.vr.contexto(), a = c && c.amb; return a && a.zonaVR ? a.zonaVR() : null; }
    /* linhas fixas do topo (também no painel do log) */
    function rotulo(){
      var p = parametros(), c = cabeca(), pt = O.xr.pontos && O.xr.pontos.atual(), id = O.xr.opcoes.teste();
      return [
        'TESTE ' + (id || '—') + ' · PONTO ' + (pt ? pt.id : '—'),
        'FB ×' + p.fb + (p.fbAuto ? 'A' : '') + ' FOV ' + p.fov + ' C' + (p.contorno || '∞') + ' Z' + (p.zonas ? 1 : 0) + ' D' + (p.dist || '∞'),
        'X ' + c.x.toFixed(1) + ' Z ' + c.z.toFixed(1) + ' · YAW ' + Math.round(c.yaw) + '° ' + O.xr.rumoTexto(c.yaw) + (zona() ? ' · ' + zona().toUpperCase() : '')
      ];
    }
    function rr(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function desenhar(d){
      /* só redesenha (e reenvia a textura) se algo visível mudou */
      var aviso = avisoTxt && performance.now() < avisoAte ? avisoTxt : '';
      var chave = d ? [Math.round(d.fps), d.hzAtivo, d.ms, d.pior, d.acima, d.gpu, d.cpu, d.cpuAtualizacao, d.cpuRender, d.calls, Math.round(d.tris / 1000), d.fb, aviso].join('|') + rotulo().join('|') : 'nada';
      if (chave === chaveVista) return false;
      chaveVista = chave;
      g.clearRect(0, 0, W, H);
      /* card de borda grossa com sombra dura e brilho de gota (tokens do REGRAS) */
      rr(14, 14, W - 28, H - 28, 30); g.fillStyle = '#0b3a6e'; g.fill();
      rr(6, 6, W - 28, H - 28, 30);
      var bg = g.createLinearGradient(0, 6, 0, H - 22); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d6f0ff');
      g.fillStyle = bg; g.fill(); g.lineWidth = 6; g.strokeStyle = '#0b3a6e'; g.stroke();
      rr(16, 12, W - 48, (H - 28) * 0.3, 24);
      var gl2 = g.createLinearGradient(0, 12, 0, 12 + (H - 28) * 0.3); gl2.addColorStop(0, 'rgba(255,255,255,.9)'); gl2.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl2; g.fill();
      /* topo fixo: teste, ponto, parâmetros, cabeça */
      g.textBaseline = 'alphabetic'; g.fillStyle = '#0b3a6e'; g.font = '700 21px "JetBrains Mono", monospace';
      rotulo().forEach(function(l, i){ g.fillText(l, 32, 40 + i * 25); });
      g.fillStyle = 'rgba(11,58,110,.3)'; g.fillRect(30, TOPO + 4, W - 80, 2);
      var y0 = TOPO;
      if (!d) { g.fillStyle = '#3c5d7a'; g.font = '700 30px "JetBrains Mono", monospace'; g.fillText('MEDINDO…', 40, y0 + 60); tx.needsUpdate = true; return; }
      var bom = d.fps >= d.alvo * 0.97, cor = bom ? '#3b8f17' : (d.fps >= d.alvo * 0.85 ? '#c46a00' : '#e2506a');
      g.fillStyle = cor; g.font = '900 72px Nunito, "Arial Rounded MT Bold", sans-serif';
      g.fillText(String(Math.round(d.fps)), 36, y0 + 82);
      var wn = g.measureText(String(Math.round(d.fps))).width;
      g.fillStyle = '#3c5d7a'; g.font = '700 23px "JetBrains Mono", monospace';
      g.fillText('FPS · ATIVO ' + (d.hzAtivo || '?') + ' HZ', 46 + wn, y0 + 50);
      g.fillText(d.ms + ' MS · PIOR ' + d.pior, 46 + wn, y0 + 80);
      g.fillStyle = '#0c2c4a'; g.font = '700 22px "JetBrains Mono", monospace';
      g.fillText('LENTOS ' + d.acima + '/' + d.quadros + '  GPU ' + (d.gpu == null ? '—' : d.gpu + ' MS'), 36, y0 + 122);
      g.fillText('CPU ' + d.cpu + ' = ATUAL ' + d.cpuAtualizacao + ' + REND ' + d.cpuRender, 36, y0 + 154);
      g.fillText('DRAW ' + d.calls + '  TRI ' + (d.tris / 1000).toFixed(0) + 'K', 36, y0 + 186);
      g.fillText('FB ' + d.fb + '  ' + String(d.espaco).toUpperCase(), 36, y0 + 218);
      g.fillStyle = avisoTxt && performance.now() < avisoAte ? '#3b8f17' : '#3c5d7a'; g.font = '700 19px "JetBrains Mono", monospace';
      g.fillText(avisoTxt && performance.now() < avisoAte ? avisoTxt : 'PEDIDO ' + (d.hzPedido ? d.hzPedido + ' HZ' : 'PADRÃO'), 36, y0 + 250);
      tx.needsUpdate = true;
    }
    desenhar(null);

    return {
      quadroInicio: function(){
        var agora = performance.now();
        ultimoDt = tAnt ? agora - tAnt : 0;
        if (tAnt) { janela.push(ultimoDt); if (janela.length > 90) janela.shift(); }
        tAnt = agora; tIni = agora; tRen = 0;
        evQuadros.shift(); evQuadros.push([]);
      },
      /* logo antes do renderer.render: separa a atualização do jogo do envio do desenho */
      antesRender: function(){ tRen = performance.now(); gpuInicio(); },
      quadroFim: function(){
        var agora = performance.now(), tr = tRen || agora;
        gpuFim();
        var a = tr - tIni, b = agora - tr;
        cpu.push(agora - tIni); upd.push(a); ren.push(b);
        if (cpu.length > 90) { cpu.shift(); upd.shift(); ren.shift(); }
        if (ouvinte && ultimoDt) ouvinte({ dt: ultimoDt, atualizacao: a, render: b, gpu: ultimoGpu, calls: info.render.calls, tris: info.render.triangles, eventos: ultimoDt > 25 ? eventosRecentes() : null });
        if (agora - ultimo > 1000) {
          ultimo = agora; dados = calcular();
          if (dados && O.xr.log) O.xr.log.medidas(dados);   // o log/diagnóstico mostra as mesmas medidas (também fora do VR)
          if (mesh.visible && desenhar(dados) !== false) O.xr.evento('medidor');
          if (dados && agora - logEm > 10000) {
            logEm = agora; O.xr.evento('console');
            console.info('[Orvalho VR] ' + dados.fps + ' fps (ativo ' + (dados.hzAtivo || '?') + ' Hz, pedido ' + (dados.hzPedido || 'padrão') + ') · ' + dados.ms + ' ms, pior ' + dados.pior + ' · CPU ' + dados.cpu + ' ms (atualização ' + dados.cpuAtualizacao + ', render ' + dados.cpuRender + ') · GPU ' + (dados.gpu == null ? '—' : dados.gpu + ' ms') + ' · ' + dados.calls + ' draw calls · ' + dados.tris + ' tri · FB ×' + dados.escalaFb + ' ' + dados.fb + ' · foveação ' + dados.foveacao);
          }
        }
      },
      visivel: function(v){ mesh.visible = !!v; },
      amostra: function(){ return dados || calcular(); },
      rotulo: rotulo,
      cabeca: cabeca,
      zona: zona,
      parametros: parametros,
      framebuffer: framebuffer,
      hzAtivo: ativoHz,
      /* cada quadro: { dt, atualizacao, render, gpu, calls, tris } (src/xr/teste.js agrupa por direção) */
      aoQuadro: function(fn){ ouvinte = fn; },
      aviso: function(t, seg){ avisoTxt = t; avisoAte = performance.now() + (seg || 2) * 1000; ultimo = 0; },
      gpuDisponivel: function(){ return !!extT; },
      gpuMotivo: function(){ return gpu.length ? null : gpuMotivo; },
      dispose: function(){
        camera.remove(mesh); geo.dispose(); mat.dispose(); tx.dispose();
        pendentes.forEach(function(q){ try { gl.deleteQuery(q); } catch (e) {} }); pendentes = [];
        if (consultaAtiva) { try { gl.endQuery(extT.TIME_ELAPSED_EXT); gl.deleteQuery(consultaAtiva); } catch (e) {} consultaAtiva = null; }
      }
    };
  };
})(window.Orvalho);
