/* Hall do Polo Inovale: planta em metros (v2, continuidade Codex).
   Origem: docs/hall/planta-hall-v2.json. Fontes: 32 fotos (H01–H32), 21 fotos C01–C21,
   6 fotos D01–D06 e a planta do ático (PDF).
   Eixos: x vai da parede do café (0) à parede do palco (44); z vai da fachada de vidro (0) à parede interna de "madeira" (15).
   1º andar (y = 4,2): faixa interna z 11,7–20 e ala leste x 44–55 sobre o palco (X47, estimada; conflita com os 44 m do PDF do ático).
   Confirmado pelo PDF (estrutura repetida em todos os andares) e corroborado pelas fotos: prédio de 44 m, pilares a cada 8 m
   (x ≈ 2, 10, 18, 26, 34, 42) com uma fileira a 12 m da fachada (borda do mezanino), núcleo de circulação em x ≈ 9,9–26,2.
   O resto é estimado pelas fotos. Proporções reais; só a plateia e o café foram ajustados para a circulação do boneco. */
(function(){
  var PI = Math.PI;
  var moveis = [];
  function add(tipo, x, z, extra){ var it = { tipo: tipo, x: x, z: z }; for (var k in extra || {}) it[k] = extra[k]; moveis.push(it); return it; }

  /* ---------- cafeteria Pin (D01, D03, D04, C20, C21): balcão na parede interna, não na ponta oeste ---------- */
  add('balcao-cafe', 4.3, 14.05, { id: 'balcao-cafe', rot: PI });
  add('estante-cafe', 0.28, 12.75, { rot: PI / 2 });                           // estante no canto junto ao vidro
  add('freezer', 8.0, 13.35, { rot: PI });                                     // junto à porta de serviço e ao pilar
  [4.1, 6.7, 9.3].forEach(function(z, r){                                      // ~12 mesas (H26, H30), linhas levemente desencontradas
    [3.3, 6.1, 8.9, 11.7].forEach(function(x, k){ add('mesa-cafe', x + (r === 1 ? 0.5 : 0), z, { rot: (r % 2) * PI / 4 + k * 0.37 + r * 0.9 }); });
  });
  add('bancada-alta', 9.25, 1.85, { id: 'bancada-alta' });

  /* ---------- entrada: floreiras em fila, banco, palmeira e arco A na parede branca da entrada (H29, C01) ---------- */
  add('floreira', 17.9, 1.35, { rot: PI / 2 });
  add('floreira', 17.9, 2.65, { rot: PI / 2 });
  add('banco-branco', 19.4, 1.65, { rot: PI / 2 });
  add('palmeira', 20.45, 0.55);
  add('arco-a', 22.4, 1.75, { id: 'arco-a' });

  /* ---------- recepção e arco B ---------- */
  add('recepcao', 18.65, 9.7, { id: 'recepcao' });
  add('planta-mesa', 16.0, 8.55, { y: 1.24 }); add('planta-mesa', 20.9, 8.55, { y: 1.24 });
  add('arco-b', 24.5, 10.55, { id: 'arco-b', rot: -PI / 2 });                 // aberto para o hall, cadeiras viradas para a parede interna (C02, C09)

  /* ---------- núcleo de circulação na parede interna (C03, C04, C06, C07) ---------- */
  add('freezer', 10.5, 14.62, { rot: PI });                                    // carrinho com freezer, junto à veneziana
  add('lixeiras-pedal', 11.75, 14.74, { rot: PI });                            // junto à porta da escada (C07), diante da veneziana: o vão da escada fica livre
  add('extintor', 11.25, 14.97, { y: 0.85, rot: PI }); add('extintor', 19.95, 14.97, { y: 0.85, rot: PI });
  add('quadro-vidro', 18.2, 14.97, { y: 1.55, rot: PI });
  add('banco-baixo', 18.2, 14.73, { rot: PI });

  /* ---------- estar sob o mezanino (C10, C11) ---------- */
  add('tapete', 27.9, 13.5);
  add('poltrona-branca', 27.0, 13.4, { rot: PI - 0.35 }); add('poltrona-branca', 28.8, 13.45, { rot: PI + 0.35 });
  add('mesinha', 27.9, 13.55);
  add('hidrante', 30.95, 14.97, { y: 0.7, rot: PI }); add('extintor', 31.28, 14.97, { y: 0.85, rot: PI });
  add('lixeira', 33.72, 14.65, { rot: PI });                                    // D05: junto à passagem dos banheiros

  /* ---------- área de eventos (plateia ajustada para circular) ---------- */
  [29.9, 33.55, 37.2].forEach(function(x){ add('banco-fachada', x, 0.55); });
  for (var f = 0; f < 9; f++) for (var c = 0; c < 6; c++) {
    add('cadeira-plateia', 29.4 + f * 0.9, 2.35 + c * 0.58, { rot: PI / 2 });
    add('cadeira-plateia', 29.4 + f * 0.9, 7.25 + c * 0.58, { rot: PI / 2 });
  }
  add('telao', 42.27, 6.25, { id: 'telao', y: 0.6, rot: -PI / 2 });
  add('caixa-som', 38.6, 2.15); add('caixa-som', 38.6, 10.35);
  add('palmeira', 43.3, 0.75); add('palmeira', 40.3, 10.75);                  // vasos junto ao palco (C12, C13)

  /* ---------- acesso às salas, balcões e sala Nexo (C12, C13, C15, C16) ---------- */
  add('balcao-banquetas', 39.0, 13.3, { rot: PI });
  add('balcao-info', 37.85, 12.2, { rot: PI });
  add('mesa-reuniao', 36.0, 16.45);                                            // só o interior documentado pelas fotos, atrás do vidro
  add('ar', 37.6, 17.75, { y: 2.6, rot: PI });
  add('maquete', 32.5, 17.1, { colisao:false });                                // expositor visto dentro da passagem E03; base estreita não fecha a rota

  /* ---------- 1º andar (E06–E45, X46, X47) ----------
     Faixa interna (z 11,7–20), de oeste para leste: ACIOC Hub sobre o café; núcleo (escada de emergência, elevador, banheiros,
     segunda escada de emergência); sala do servidor; sala de podcast; Administrativo em frente à chegada da escada.
     Ala leste sobre o palco (x 44–55): corredor com poltronas e Incubadora Joaçaba (X47). */
  function alto(tipo, x, z, extra){ extra = extra || {}; extra.y = extra.y == null ? 4.2 : extra.y; extra.nivel = 'superior'; return add(tipo, x, z, extra); }

  /* ACIOC Hub (E12–E16, X46): parede escura atrás da porta, bancadas nas paredes, duas ilhas e parede branca com o logotipo */
  alto('totem-acioc', 8.75, 12.85, { rot: PI / 2 });
  alto('bancada-acioc', 0.74, 13.6, { rot: PI / 2 }); alto('bancada-acioc', 0.74, 16.5, { rot: PI / 2 });
  alto('bancada-acioc', 2.3, 19.31, { rot: PI }); alto('bancada-acioc', 5.2, 19.31, { rot: PI });
  alto('bancada-acioc', 9.915, 16.6, { rot: -PI / 2 });
  alto('ilha-acioc', 3.4, 16.0, { rot: PI / 2 }); alto('ilha-acioc', 6.6, 16.0, { rot: PI / 2 });

  /* núcleo, lado do corredor (E09–E11, E17, E18): portas, extintores, poltronas vermelhas, hidrante, portal do elevador e nichos dos banheiros */
  alto('portal-elevador', 14.6, 14.6, { rot: PI });
  [11.4, 29.75].forEach(function(x){ alto('moldura-porta', x, 14.6, { rot: PI }); });                     // venezianas (shafts)
  [12.5, 30.85].forEach(function(x){ alto('moldura-porta-larga', x, 14.6, { rot: PI }); });               // escadas de emergência
  alto('nicho-banheiro', 24.0, 14.6, { rot: PI }); alto('nicho-banheiro-pcd', 26.5, 14.6, { rot: PI });
  alto('extintor', 13.45, 14.6, { y: 5.05, rot: PI }); alto('extintor', 28.95, 14.6, { y: 5.05, rot: PI });
  alto('hidrante', 28.2, 14.6, { y: 4.9, rot: PI });
  alto('poltrona-vermelha', 16.6, 14.12, { rot: PI }); alto('poltrona-vermelha', 17.45, 14.12, { rot: PI });
  /* sala de reuniões com o servidor (x 32,0–38,0): mesa redonda no centro, TV no meio da parede esquerda (divisória com o
     podcast, para quem entra), armário no canto direito do fundo com o cubo do servidor no alto, e o armário baixo e comprido
     encostado no vidro, à direita da porta, do fim do vão até a parede lateral */
  alto('mesa-redonda', 35.0, 17.5);
  alto('tv-parede', 37.95, 17.3, { rot: -PI / 2, y: 4.2 });
  alto('armario-alto', 32.55, 19.6, { rot: PI });
  alto('servidor-cubo', 32.45, 19.55, { y: 6.75, rot: PI });   // frente (frisos, LEDs) virada para a sala
  alto('armario-baixo-longo', 34.35, 14.825);

  /* estúdio de podcast compacto (x 38,0–41,8, 3,8 m): painéis acústicos pretos e cinza só nas faces internas, TV no centro
     do fundo, mesa de 1,2 × 1,6 com 4 cadeiras e 4 microfones */
  alto('painel-acustico-2', 38.55, 19.9, { rot: PI }); alto('painel-acustico-2', 41.25, 19.9, { rot: PI });
  alto('painel-acustico', 41.8, 15.75, { rot: -PI / 2 }); alto('painel-acustico', 41.8, 18.4, { rot: -PI / 2 });
  alto('painel-acustico', 38.05, 17.2, { rot: PI / 2 }); alto('painel-acustico-2', 38.05, 19.0, { rot: PI / 2 });
  alto('tv-parede', 39.9, 19.9, { rot: PI });
  alto('mesa-podcast-compacta', 39.9, 17.4);

  /* frente do Administrativo (E06, E07): banner da Incubadora e poltrona encostados no vidro */
  alto('banner-ideia', 43.55, 14.35, { rot: PI }); alto('poltrona-cinza', 44.4, 14.1, { rot: PI, id: 'poltrona-adm' });

  /* Administrativo (E19–E30), na ordem de quem entra: de frente, a sala de projetos envidraçada (posto branco e cadeira, E21);
     depois, a área de reuniões com a mesa de nogueira junto às janelas e o armário com impressora (E22–E25, E30); ao fundo,
     a sala de Dagliê e Danimara (E23, E26–E29): Dagliê logo na entrada, Danimara mais para dentro, armários atrás delas.
     Adaptação de jogo: 13 m de frente e passagens de 1,0 m ou mais entre móveis, para circular com os três corpos. */
  alto('mesa-branca-pc', 43.0, 19.575, { rot: PI }); alto('cadeira', 43.0, 18.85);
  alto('mesa-branca', 42.125, 17.6, { rot: PI / 2 }); alto('cadeira', 42.85, 17.6, { rot: -PI / 2 });
  alto('mesa-compartilhada', 47.4, 17.9);
  alto('bancada-cafe', 50.15, 17.9, { rot: -PI / 2 });      // bancada de café contínua no vidro da sala de Dagliê e Danimara
  alto('balcao-impressora', 47.4, 14.83);                   // impressora: parede esquerda da área de reuniões, de frente para a mesa
  alto('ar', 47.4, 14.75, { y: 6.75 });
  alto('mesa-branca-pc', 51.9, 15.65, { rot: PI / 2 }); alto('cadeira', 52.6, 15.65, { rot: -PI / 2 });
  alto('mesa-branca', 52.4, 18.75, { rot: PI / 2 }); alto('cadeira', 53.1, 18.75, { rot: -PI / 2 });   // Danimara: mais ao fundo, passagem livre
  alto('armario-alto', 54.71, 15.4, { rot: -PI / 2 }); alto('armario-alto', 54.71, 16.5, { rot: -PI / 2 }); alto('armario-alto', 54.71, 17.6, { rot: -PI / 2 });

  /* corredor da ala leste (E31, E32, E44, E45): fileira de poltronas de costas para o guarda-corpo */
  for (var pi = 0; pi < 9; pi++) alto('poltrona-cinza', 44.67, 1.5 + pi * 0.8, { rot: PI / 2, id: 'poltrona-incubadora-' + (pi + 1) });

  /* Incubadora Joaçaba (E31–E45): ao entrar pela porta sul (103), o quadro e as lixeiras na parede cinza (E36) e a mesa verde com
     TV junto ao vidro (E33, E36); no meio, o par de mesas azul e verde (E34) e a mesa branca (E35); o canto de ripas (E33, E34, E41)
     separa a parte norte (101), que tem a outra porta para o corredor; salas de incubação envidraçadas junto às janelas (E37–E43),
     todas com porta de vidro que abre */
  alto('lixeiras-pedal', 49.8, 11.5);                       // lixeiras junto à salinha de vidro (o canto agora é a salinha)
  alto('mesa-empresa', 47.6, 14.015, { rot: PI });           // salinha atrás da divisória de vidro: posto de trabalho
  alto('mesa-verde-tv', 46.95, 8.9, { rot: PI / 2 });
  alto('ilha-incubadora', 49.4, 8.6);
  alto('mesa-branca-4', 49.4, 5.4);
  alto('ripas-canto', 48.2, 3.565);
  alto('mesa-empresa', 49.0, 0.645);
  [1.65, 4.45, 7.35, 10.25, 13.15].forEach(function(z){ alto('mesa-empresa', 54.37, z, { rot: -PI / 2 }); });

  /* ---------- lá fora: árvores na calçada ---------- */
  [[4, -7], [15, -9], [26, -7.5], [37, -8.5]].forEach(function(p){ add('arvore', p[0], p[1], { y: 0 }); });

  Orvalho.ambientes.registrar({
    id: 'hall-inovale',
    nome: 'Hall do Polo Inovale',
    medidas: {
      confirmadas: { comprimentoPredio: 44, profundidadePredio: 20, malhaPilares: '8 m (x ≈ 2, 10, 18, 26, 34, 42)', filaPilaresMezanino: '12 m da fachada', nucleo: 'x ≈ 9,85–26,17 (2 escadas + banheiros)', fonte: 'PDF Planta baixa – Ático (estrutura) + fotos' },
      estimadas: { profundidadeHall: 15, peDireitoVazio: 8.0, pisoMezanino: 4.2, forroSobMezanino: 3.2, placaPiso: 0.9 },
      adaptacoes: 'Plateia em 2 blocos com corredor central de 1,40 m. Mesas do café a ~2,8 m entre centros. Escada representada por rampa de colisão sob 24 degraus visuais.'
    },

    sala: { largura: 44, fundo: 15, pe: 8.0, placa: 0.9, corForro: '#e2e1dc', pisoRugosidade: 0.42, pisoTinta: '#aaa398',
      pisoCores: { a: '#cbc5bb', b: '#bfb8ad', brilho: 'rgba(255,255,255,.10)', rejunte: '#9b9489', rejunteLargura: 3, manchas: true } },
    cores: { branca: '#cfccc6', preta: '#1d1e21', madeira: '#ffffff', laje: '#b9ad98', pilar: '#b8ad9b', rodape: '#8f8070' },
    luz: { hemi: 0.55, solForca: 0.45, solPos: [22, 16, -14], ceu: '#dbe8f2', chao: '#cdbfa8' },
    camera: { pitchMin: -0.45, olharCima: 4, dist: 3.6, distMax: 6.5 },
    bolhas: 12,

    paredes: [
      { lado: 'norte', cor: 'branca', rodape: false, vaos: [
        { tipo: 'fachada', de: 0.0, ate: 16.6, base: 0, topo: 7.95, modulo: 1.4, travessas: [2.6, 4.4, 6.2], faixa: [0.95, 1.55], persianas: [[4.5, 7.8]], portas: [[13.0, 16.5, 2.4]] },
        { tipo: 'fachada', de: 16.6, ate: 24.0, base: 3.4, topo: 7.95, modulo: 1.4, travessas: [4.4, 6.2], persianas: [[4.5, 7.8]] },
        { tipo: 'fachada', de: 24.0, ate: 44.0, base: 0, topo: 7.95, modulo: 1.4, travessas: [2.6, 4.4, 6.2], faixa: [0.95, 1.55], persianas: [[4.5, 7.8], [2.65, 3.6]] }
      ] },
      /* fundo da área de mesas: vidro contínuo e porta de saída junto à estante (D01, D03) */
      { lado: 'oeste', cor: 'branca', rodape: false, vaos: [
        { tipo: 'fachada', de: 0.0, ate: 15.0, base: 0, topo: 7.95, modulo: 1.3, travessas: [2.6, 4.4, 6.2], faixa: [0.95, 1.55], persianas: [[4.5, 7.8]], portas: [[9.6, 11.4, 2.4]] }
      ] },
      /* parede do palco: termina na laje da ala leste do 1º andar (X47); acima dela há piso, então só colide no térreo */
      { lado: 'leste', cor: 'madeira', textura: 'madeira', altura: 3.2, soTerreo: true, vaos: [
        { tipo: 'porta', de: 9.0, ate: 9.9, base: 0, topo: 2.1, altura: 2.1 }                                     // porta sob a escada (H14)
      ] },
      /* parede interna sob o mezanino, do café para o palco (C03, C04, C06, C07, C10, C11, C12, C13) */
      { lado: 'sul', cor: 'madeira', textura: 'madeira', altura: 3.2, soTerreo: true, vaos: [
        { tipo: 'porta', de: 8.7, ate: 9.6, base: 0, topo: 2.1, altura: 2.1 },                                   // serviço da cafeteria entre balcão e pilar (D04)
        { tipo: 'porta', de: 11.35, ate: 12.15, base: 0, topo: 2.1, altura: 2.1, arte: 'veneziana' },
        { tipo: 'abertura', de: 12.25, ate: 13.25, base: 0, topo: 2.1, altura: 2.1 },                              // escada de emergência: porta que abre (portasAnimadas)
        { tipo: 'elevador', de: 14.05, ate: 15.15, base: 0, topo: 2.2, altura: 2.2, animado: true },              // "A INOVAÇÃO ABRE PORTAS"
        { tipo: 'abertura', de: 20.4, ate: 24.2, base: 0, topo: 2.4, altura: 2.35 },                              // distribuição real dos banheiros (E01)
        { tipo: 'porta', de: 28.6, ate: 29.5, base: 0, topo: 2.1, altura: 2.1, arte: 'restrito' },
        { tipo: 'porta', de: 29.7, ate: 30.6, base: 0, topo: 2.1, altura: 2.1, arte: 'restrito' },
        { tipo: 'abertura', de: 31.5, ate: 33.5, base: 0, topo: 2.4, altura: 2.35 },                              // acesso às salas à esquerda da Nexo (E02–E04)
        { tipo: 'abertura', de: 34.0, ate: 38.2, base: 0, topo: 3.15, altura: 3.1 },                              // frente envidraçada da Nexo, alinhada à parede
        { tipo: 'porta', de: 40.9, ate: 41.8, base: 0, topo: 2.1, altura: 2.1 }
      ] }
    ],

    /* D01–D04 corrigem a leitura anterior: não há um pavimento separado projetado sobre as mesas do café. */
    /* faixa interna (z 11,7–20) e ala leste sobre o palco (x 44–55, X47). Sem guarda-corpo onde o vidro do ACIOC
       chega à borda da laje (X46) e na chegada da escada. */
    mezaninos: [{ r: [0, 11.7, 44, 20], piso: 4.2, espessura: 1.0, aberturas: [[0, 10.5], [42.25, 44.0]] },
                { r: [44, 0, 55, 20], piso: 4.2, espessura: 1.0 }],
    /* malha do PDF (8 m) na fileira da borda do mezanino; na fachada só o pilar visível na H24 */
    pilares: [2.02, 10.06, 18.04, 26.03, 34.06, 42.04].map(function(x){ return { x: x, z: 12, d: 0.6 }; }).concat([{ x: 10.06, z: 0.7, d: 0.6 },
      { x: 44.62, z: 0.7, d: 0.5 },      // fim do corredor da Incubadora, junto à fachada (E44, E45)
      { x: 53.9, z: 19.62, d: 0.5 }]),   // dentro da sala de Dagliê e Danimara, junto às janelas (E26)
    blocos: [
      { r: [12.4, 0, 18, 3.0], y0: 3.2, y1: 3.45, cor: '#c2b6a2' },                                         // marquise interna da entrada
      { r: [39, 2.5, 42.5, 10], y0: 0, y1: 0.6, cor: '#1f2125', rugosidade: 0.95, colide: true },            // palco
      { r: [38.6, 4.6, 39, 7.9], y0: 0, y1: 0.3, cor: '#1f2125', rugosidade: 0.95, colide: true },           // degrau
      { r: [15.9, 8.86, 18.5, 9.9], y0: 0, y1: 0.45, cor: '#8e9196' },                                       // estrado atrás do balcão (posto da Keila)
      { r: [44.12, 0, 55, 0.12], y0: 0, y1: 3.2, cor: '#d9d6d0' },                                            // térreo sob a ala leste (fechado, sem referência)
      { r: [54.88, 0, 55, 20], y0: 0, y1: 3.2, cor: '#d9d6d0' },
      { r: [34.0, 15.0, 38.2, 18.4], y0: 0, y1: 0.04, cor: '#aaa398' },                                      // piso visível da Nexo
      { r: [34.0, 15.0, 38.2, 18.4], y0: 3.1, y1: 3.2, cor: '#e2e1dc' }                                     // forro visível da Nexo
    ],
    /* escada aberta junto à parede do palco: 2 lances de 12 degraus com patamar, sobe do lado da fachada para o lado interno (H04, H07, H14) */
    escadas: [{ x0: 42.6, x1: 43.85, ladoSalao: 'min', navegavel: true, topo: 12.45,
      lances: [{ a0: 3.4, a1: 7.0, h0: 0, h1: 2.1 }, { a0: 8.2, a1: 11.8, h0: 2.1, h1: 4.2 }] }],
    obstaculos: [
      { caixa: [29.1, 2.05, 36.9, 5.55], motivo: 'bloco de cadeiras (lado da fachada)' },
      { caixa: [29.1, 6.95, 36.9, 10.45], motivo: 'bloco de cadeiras (lado interno)' }
    ],
    paineis: [
      /* ===== 1º andar ===== */
      /* ACIOC Hub: vidro na borda da laje com o grafismo verde no centro da fachada (X46), parede de vidro com porta no fim do corredor (E12) */
      /* desenhado de leste para oeste para o adesivo ficar legível do hall (X46) e espelhado por dentro (E15) */
      { a: [10.5, 11.78], b: [0.15, 11.78], y0: 4.2, y1: 8, modulo: 1.3, travessas: [2.4], faixas: [{ y0: 4.45, y1: 6.25, de: 1.8, ate: 8.9, arte: 'acioc-vidro' }] },
      { a: [10.5, 11.78], b: [10.5, 14.6], y0: 4.2, y1: 8, modulo: 1.4, portas: [[0.42, 1.42, 2.3, 'vao']], travessas: [2.35] },
      { a: [10.5, 14.6], b: [10.5, 19.9], y0: 4.2, y1: 8, tipo: 'parede', cor: '#efefec' },
      { a: [0.15, 15.0], b: [0.15, 19.9], y0: 4.2, y1: 8, tipo: 'janelas', cor: '#e9e7e2', persiana: 0.5 },
      { a: [0.15, 19.9], b: [10.5, 19.9], y0: 4.2, y1: 8, tipo: 'janelas', cor: '#e9e7e2', persiana: 0.45 },
      /* núcleo: porcelanato "madeira" no lado do corredor, com os vãos das duas escadas de emergência, do elevador e dos dois nichos de banheiro */
      { a: [10.5, 14.6], b: [12.0, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [12.0, 14.6], b: [13.0, 14.6], y0: 6.35, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [13.0, 14.6], b: [14.05, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [14.05, 14.6], b: [15.15, 14.6], y0: 6.4, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [15.15, 14.6], b: [23.1, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [23.1, 14.6], b: [24.9, 14.6], y0: 6.6, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [24.9, 14.6], b: [25.7, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [25.7, 14.6], b: [27.3, 14.6], y0: 6.6, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [27.3, 14.6], b: [30.35, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [30.35, 14.6], b: [31.35, 14.6], y0: 6.35, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      { a: [31.35, 14.6], b: [32.0, 14.6], y0: 4.2, y1: 8, tipo: 'parede', textura: 'madeira', cor: '#ffffff' },
      /* sala do servidor (vidro jateado + porta lisa, E08, E09) e sala de podcast (porta de círculos + vidro fumê, E07, E08):
         o interior não foi fotografado, então as duas ficam fechadas */
      { a: [32.0, 14.6], b: [37.8, 14.6], y0: 4.2, y1: 8, modulo: 1.2, portas: [[4.8, 5.8, 2.1, 'vao']], travessas: [2.35], faixas: [{ y0: 4.25, y1: 6.5, arte: 'jateado' }] },
      { a: [37.8, 14.6], b: [38.1, 14.6], y0: 4.2, y1: 8, tipo: 'parede', cor: '#f0f0ee' },
      /* podcast: vidro transparente com caixilhos — o interior aparece do corredor */
      { a: [38.1, 14.6], b: [41.8, 14.6], y0: 4.2, y1: 8, modulo: 1.25, portas: [[0, 1.0, 2.1, 'vao']], travessas: [2.35] },
      { a: [32.0, 14.6], b: [32.0, 19.9], y0: 4.2, y1: 8, tipo: 'parede', cor: '#e7e4de' },
      /* divisória reuniões | podcast com 10 cm de espessura: cada face pertence ao seu ambiente */
      { a: [38.0, 14.6], b: [38.0, 19.9], y0: 4.2, y1: 7.1, tipo: 'parede', cor: '#e7e4de', esp: 0.1 },
      { a: [38.0, 14.6], b: [38.0, 19.9], y0: 7.1, y1: 8, tipo: 'parede', cor: '#e7e4de' },
      { a: [10.5, 19.9], b: [41.8, 19.9], y0: 4.2, y1: 8, tipo: 'parede', cor: '#e7e4de' },
      /* Administrativo (E06, E07, E19–E30): frente de vidro com faixa de triângulos e a porta adesivada no canto oeste;
         sala de projetos envidraçada de frente para a entrada; divisória da sala de Dagliê e Danimara ao fundo */
      { a: [41.8, 14.6], b: [41.8, 19.9], y0: 4.2, y1: 8, tipo: 'parede', cor: '#efefec' },
      { a: [41.8, 14.6], b: [46.5, 14.6], y0: 4.2, y1: 8, modulo: 1.2, portas: [[0.2, 1.2, 2.3, 'vao']], travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.7, arte: 'fosca' }] },
      { a: [46.5, 14.6], b: [55, 14.6], y0: 4.2, y1: 8, tipo: 'parede', cor: '#efefec' },
      { a: [41.8, 16.4], b: [44.8, 16.4], y0: 4.2, y1: 8, modulo: 1.0, portas: [[1.7, 2.7, 2.2, 'vao']], travessas: [2.35], faixas: [{ y0: 5.0, y1: 5.6, arte: 'fosca' }] },
      { a: [44.8, 16.4], b: [44.8, 19.9], y0: 4.2, y1: 8, modulo: 1.2, travessas: [2.35], faixas: [{ y0: 5.0, y1: 5.6, arte: 'fosca' }] },
      { a: [50.4, 14.6], b: [50.4, 19.9], y0: 4.2, y1: 8, modulo: 1.3, portas: [[0.25, 1.25, 2.2, 'vao']], travessas: [2.35], faixas: [{ y0: 5.0, y1: 5.6, arte: 'fosca' }] },
      { a: [41.8, 19.9], b: [54.95, 19.9], y0: 4.2, y1: 8, tipo: 'janelas', cor: '#e9e7e2', persiana: 0.55 },
      /* ala leste: fachada norte com persianas (E44), janelas a leste (E37, E38) */
      { a: [44.12, 0.06], b: [55, 0.06], y0: 4.2, y1: 8, modulo: 1.4, travessas: [1.3, 2.6], persianas: [[5.7, 7.95]] },
      { a: [54.95, 0.06], b: [54.95, 19.9], y0: 4.2, y1: 8, tipo: 'janelas', cor: '#e9e7e2', persiana: 0.5 },
      /* Incubadora (E31, E32, E36, E45, X47): vidro com cartazes e duas portas pretas que abrem (101 ao norte, 103 ao sul);
         parede cinza junto à porta sul com quadro e lixeiras (E36). A parte norte (101) é contínua com o coworking. */
      { a: [46.5, 0.06], b: [46.5, 11.6], y0: 4.2, y1: 8, modulo: 1.15, portas: [[1.54, 2.54, 2.3, 'vao'], [10.54, 11.54, 2.3, 'vao']], travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.65, arte: 'fosca' }] },
      /* trecho junto à porta 103: divisória de vidro (antes parede cinza), com a salinha atrás dela */
      { a: [46.5, 11.6], b: [46.5, 14.6], y0: 4.2, y1: 8, modulo: 1.0, travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.65, arte: 'fosca' }] },
      { a: [46.5, 11.75], b: [49.2, 11.75], y0: 4.2, y1: 8, modulo: 1.1, portas: [[1.6, 2.6, 2.2, 'vao']], travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.65, arte: 'fosca' }] },
      { a: [49.2, 11.75], b: [49.2, 14.6], y0: 4.2, y1: 8, modulo: 1.0, travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.65, arte: 'fosca' }] },
      /* salas de incubação envidraçadas ao longo das janelas, cada uma com porta de vidro (E37–E43) */
      { a: [51.6, 0.06], b: [51.6, 14.6], y0: 4.2, y1: 8, modulo: 1.45, portas: [[1.79, 2.79, 2.2, 'vao'], [4.69, 5.69, 2.2, 'vao'], [7.59, 8.59, 2.2, 'vao'], [10.49, 11.49, 2.2, 'vao'], [11.94, 12.94, 2.2, 'vao']], travessas: [2.35], faixas: [{ y0: 4.95, y1: 5.65, arte: 'fosca' }] },
      { a: [51.6, 3.0], b: [54.95, 3.0], y0: 4.2, y1: 8, modulo: 1.2 }, { a: [51.6, 5.9], b: [54.95, 5.9], y0: 4.2, y1: 8, modulo: 1.2 },
      { a: [51.6, 8.8], b: [54.95, 8.8], y0: 4.2, y1: 8, modulo: 1.2 }, { a: [51.6, 11.7], b: [54.95, 11.7], y0: 4.2, y1: 8, modulo: 1.2 },
      /* Nexo encostada na parede do acesso às salas; o volume segue para dentro do prédio, não para o centro do hall. */
      { a: [34.0, 14.94], b: [38.2, 14.94], y0: 0, y1: 3.15, modulo: 1.05, portas: [[2.25, 4.05, 2.15]], faixas: [{ y0: 0.98, y1: 1.18, arte: 'nexo' }, { y0: 1.25, y1: 1.6, arte: 'fosca' }] },
      { a: [34.0, 14.94], b: [34.0, 18.4], y0: 0, y1: 3.15, modulo: 1.15, faixas: [{ y0: 1.25, y1: 1.6, arte: 'fosca' }] },
      { a: [38.2, 14.94], b: [38.2, 18.4], y0: 0, y1: 3.15, modulo: 1.15, faixas: [{ y0: 1.25, y1: 1.6, arte: 'fosca' }] },
      { a: [34.0, 18.4], b: [38.2, 18.4], y0: 0, y1: 3.15, modulo: 1.05 }
    ],
    anexos: [
      { r: [20.4, 15.0, 24.2, 19.5], pe: 3.0, textura: 'madeira',
        portas: [{ lado:'x0',de:15.8,ate:16.7,arte:'banheiro-feminino' },{ lado:'x1',de:15.8,ate:16.7,arte:'banheiro-masculino' },{ lado:'x0',de:17.35,ate:18.25,arte:'banheiro-pcd' }] },
      { r: [31.5, 15.0, 33.5, 20.0], pe: 3.0, fundoVidro: true },
      /* escada de emergência do térreo: a porta abre para uma antecâmara curta, fechada por uma segunda porta corta-fogo;
         os lances internos não foram fotografados e não foram modelados */
      { r: [12.2, 15.0, 13.6, 16.4], pe: 2.6, cor: '#e7e6e2',
        portas: [{ lado:'fundo', de:12.45, ate:13.35, arte:'porta-lisa', placa:{ arte:'escada-emergencia', w:0.62, h:0.16 } }] },
      /* 1º andar: antecâmaras das duas escadas de emergência (mesmo critério) */
      { r: [11.95, 14.6, 13.5, 16.0], y: 4.2, pe: 2.6, cor: '#e7e6e2',
        portas: [{ lado:'fundo', de:12.3, ate:13.2, arte:'porta-lisa', placa:{ arte:'escada-emergencia', w:0.62, h:0.16 } }] },
      { r: [30.3, 14.6, 31.8, 16.0], y: 4.2, pe: 2.6, cor: '#e7e6e2',
        portas: [{ lado:'fundo', de:30.6, ate:31.5, arte:'porta-lisa', placa:{ arte:'escada-emergencia', w:0.62, h:0.16 } }] },
      /* 1º andar: entradas dos banheiros (E10, E18) — nichos de 1,2 m no revestimento madeira, com porta no fundo e na lateral */
      { r: [23.1, 14.6, 24.9, 15.8], y: 4.2, pe: 2.4, textura: 'madeira',
        portas: [{ lado:'fundo',de:23.2,ate:23.95,arte:'banheiro-feminino' },{ lado:'fundo',de:24.05,ate:24.8,arte:'veneziana' }] },
      { r: [25.7, 14.6, 27.3, 15.8], y: 4.2, pe: 2.4, textura: 'madeira',
        portas: [{ lado:'fundo',de:25.8,ate:26.7,arte:'banheiro-pcd' },{ lado:'x1',de:14.85,ate:15.6,arte:'veneziana' }] }
    ],
    /* 1º andar navegável: faixa interna + ala leste. Segmentos = guarda-corpos, vidros e paredes (as portas abertas ficam livres).
       Os nichos dos banheiros colidem pelas próprias paredes (anexos com y = 4,2). */
    niveis: { superior: { piso: 4.2, areas: [[0, 11.7, 44, 20.0], [44, 0.06, 55, 20.0]], segmentos: [
      [0,11.7,10.5,11.7],[0.15,11.7,0.15,20],[0,19.9,55,19.9],[54.95,0,54.95,20],[44,0.06,55,0.06],
      [10.5,11.7,10.5,12.2],[10.5,13.2,10.5,20],
      [10.5,14.6,12.0,14.6],[13.0,14.6,23.1,14.6],[24.9,14.6,25.7,14.6],[27.3,14.6,30.35,14.6],[31.35,14.6,36.8,14.6],[37.8,14.6,38.1,14.6],[39.1,14.6,41.8,14.6],[32.0,14.6,32.0,19.9],[37.95,14.6,37.95,19.9],[38.05,14.6,38.05,19.9],
      [41.8,14.6,41.8,20],[41.8,14.6,42.0,14.6],[43.0,14.6,55,14.6],
      [41.8,16.4,43.5,16.4],[44.5,16.4,44.8,16.4],[44.8,16.4,44.8,19.9],[50.4,14.6,50.4,14.85],[50.4,15.85,50.4,19.9],
      [46.5,0.06,46.5,1.6],[46.5,2.6,46.5,10.6],[46.5,11.6,46.5,14.6],[46.5,11.75,48.1,11.75],[49.1,11.75,49.2,11.75],[49.2,11.75,49.2,14.6],
      [51.6,0.06,51.6,1.85],[51.6,2.85,51.6,4.75],[51.6,5.75,51.6,7.65],[51.6,8.65,51.6,10.55],[51.6,11.55,51.6,12.0],[51.6,13.0,51.6,14.6],
      [51.6,3.0,54.95,3.0],[51.6,5.9,54.95,5.9],[51.6,8.8,54.95,8.8],[51.6,11.7,54.95,11.7]
    ] } },
    /* forro acima das salas do 1º andar fora do retângulo do hall */
    forros: [{ r: [0, 15, 44, 20], y: 8 }, { r: [44, 0, 55, 20], y: 8 },
             { r: [32.0, 14.6, 38.0, 19.9], y: 7.1, teto: true }, { r: [38.0, 14.6, 41.8, 19.9], y: 7.1, teto: true }],   // forro das duas salas a 2,9 m
    /* LEDs do servidor (pulsam devagar) e luz indireta do estúdio de podcast (faixas quentes no alto das paredes, "NO AR" vermelho) */
    leds: [
      { p: [32.62, 6.85, 19.248], cor: '#59f07a', pulso: 2.6 }, { p: [32.66, 6.85, 19.248], cor: '#59f07a', pulso: 3.4, fase: 1 }, { p: [32.70, 6.85, 19.248], cor: '#ffb84d', pulso: 5.0 },
      { p: [32.62, 6.80, 19.248], cor: '#5ff0ff', pulso: 1.8 }, { p: [32.66, 6.80, 19.248], cor: '#5ff0ff', pulso: 2.2, fase: 2 },
      { p: [32.45, 6.44, 19.25], tam: [0.5, 0.012, 0.01], cor: '#2e6bff' },
      { p: [39.9, 7.03, 19.83], tam: [3.6, 0.03, 0.04], cor: '#ffd9a8' }, { p: [41.73, 7.03, 17.25], tam: [0.04, 0.03, 5.1], cor: '#ffd9a8' },
      { p: [38.12, 7.03, 17.25], tam: [0.04, 0.03, 5.1], cor: '#ffd9a8' },
      { p: [39.9, 4.27, 19.83], tam: [3.6, 0.02, 0.03], cor: '#ff9a5c' },
      { p: [38.6, 6.7, 14.66], tam: [0.36, 0.12, 0.02], cor: '#ff3b30', pulso: 3.0 }
    ],
    /* zonas de visibilidade do VR (src/mundo/sala.js → visibilidadeVR; ?vr-zonas=0 desliga). Térreo e 1º andar são um ambiente só.
       "ve": o que se vê de cada zona. Na dúvida (vidro), a zona fica visível: só some o que está atrás de parede opaca.
       A primeira zona cujo retângulo contém o ponto vence (a ordem importa no 1º andar). */
    zonasVR: {
      zonas: [
        /* escada aberta junto ao palco (x 42,6–43,85; z 3,4–12,45), nos dois pavimentos: de lá se vê o térreo e a frente do
           Administrativo ao mesmo tempo, então tudo aparece e não há limite de distância (sem ela, chegar ao 1º andar fazia
           surgir os móveis do Administrativo e das salas a 2–4 m) */
        { id: 'escada', piso: null, todas: true, r: [[42.4, 3.0, 44.1, 12.45]] },
        /* térreo: o café (Cafeteria Pin e as mesas sob a laje do ACIOC, x < 14) é uma subzona só para quem está no 1º andar:
           no grupo "terreo", café e resto do salão se veem sempre e não se cortam pela distância */
        { id: 'cafe', piso: 0, grupo: 'terreo', r: [[-5, -5, 14, 25]] },
        { id: 'hall', piso: 0, grupo: 'terreo', r: [[-5, -5, 60, 25]] },                  // resto do térreo: vão de 8 m, tudo aberto
        { id: 'acioc', piso: 1, r: [[0, 11.7, 10.5, 20]] },
        { id: 'salas', piso: 1, r: [[32, 14.6, 41.8, 20]] },                              // servidor/reuniões e podcast
        { id: 'administrativo', piso: 1, r: [[41.8, 14.6, 55, 20]] },
        { id: 'incubadora', piso: 1, r: [[46.5, 0, 55, 14.6]] },                         // incubadora, salas de incubação e salinha
        { id: 'incubadora-corredor', piso: 1, r: [[44, 0, 46.5, 14.6]] },
        { id: 'corredor', piso: 1, r: [[0, 11.7, 44, 14.6], [10.5, 14.6, 32, 20]] }      // mezanino, núcleo (banheiros, escadas, elevador)
      ],
      /* "ve" calculado por geometria em 02/11 (testes/visibilidade-zonas-vr.js): de posições caminháveis de cada zona, em duas
         alturas de cabeça, renders das 6 direções com cada bloco de móveis, pessoa e marcador numa cor; estrutura opaca oclui,
         vidro não, portas contadas como abertas. Zona com ≥ 30% dos itens vistos entra inteira; abaixo disso, entram só os blocos
         vistos (retângulos de ±0,75 m em volta do centro de cada bloco; visibilidade parcial em sala.js). Do Administrativo não se
         veem a ACIOC, o café (Pin) nem as salas; das salas não se vê o café. Refazer a análise ao mudar a planta:
         GPU=1 node testes/visibilidade-zonas-vr.js (imprime a tabela sugerida). */
      ve: {
        escada: [],                                                                       // "todas": vê tudo
        cafe: ['acioc', { zona: 'administrativo', em: [[46.65, 14.05, 48.15, 15.55]] }, 'corredor', 'hall', { zona: 'incubadora', em: [[47.45, 2.75, 48.95, 4.25], [47.35, 2.45, 48.85, 3.95], [46.15, 8.55, 47.65, 10.05], [46.85, 12.95, 48.35, 14.45], [46.85, 13.25, 48.35, 14.75]] }, { zona: 'incubadora-corredor', em: [[45.05, 10.35, 46.55, 11.85]] }, { zona: 'salas', em: [[40.95, 15.05, 42.45, 16.55]] }],
        hall: ['acioc', { zona: 'administrativo', em: [[46.65, 14.05, 48.15, 15.55]] }, 'cafe', 'corredor', { zona: 'incubadora', em: [[46.15, 8.55, 47.65, 10.05], [47.45, 2.75, 48.95, 4.25], [47.35, 2.45, 48.85, 3.95], [46.85, 12.95, 48.35, 14.45], [46.85, 13.55, 48.35, 15.05], [46.85, 13.65, 48.35, 15.15], [46.85, 13.25, 48.35, 14.75]] }, 'incubadora-corredor', { zona: 'salas', em: [[40.95, 15.05, 42.45, 16.55]] }],
        corredor: ['acioc', 'administrativo', { zona: 'cafe', em: [[4.15, 4.65, 5.65, 6.15], [4.15, 4.75, 5.65, 6.25], [4.25, 4.55, 5.75, 6.05], [3.95, 8.55, 5.45, 10.05], [8.55, 0.95, 10.05, 2.45], [8.55, 1.45, 10.05, 2.95], [8.25, 1.45, 9.75, 2.95], [8.75, 1.45, 10.25, 2.95], [8.35, 0.95, 9.85, 2.45], [9.75, 4.65, 11.25, 6.15]] }, 'hall', 'incubadora', 'incubadora-corredor', 'salas'],
        acioc: ['cafe', 'corredor', 'hall', { zona: 'incubadora', em: [[47.45, 2.75, 48.95, 4.25], [53.55, 10.95, 55.05, 12.45], [53.35, 10.95, 54.85, 12.45], [53.85, 10.95, 55.35, 12.45], [46.85, 13.55, 48.35, 15.05], [50.75, 3.35, 52.25, 4.85], [47.75, 2.95, 49.25, 4.45], [48.65, 4.65, 50.15, 6.15], [48.75, 7.85, 50.25, 9.35], [46.15, 8.55, 47.65, 10.05]] }, { zona: 'incubadora-corredor', em: [[43.65, 13.35, 45.15, 14.85]] }, { zona: 'salas', em: [[33.55, 14.05, 35.05, 15.55]] }],
        salas: [{ zona: 'acioc', em: [[7.95, 12.15, 9.45, 13.65], [8.15, 12.15, 9.65, 13.65]] }, { zona: 'administrativo', em: [[41.35, 16.85, 42.85, 18.35]] }, { zona: 'corredor', em: [[42.75, 13.65, 44.25, 15.15], [41.75, 13.15, 43.25, 14.65]] }, { zona: 'hall', em: [[41.55, 5.55, 43.05, 7.05], [21.65, 0.95, 23.15, 2.45], [41.45, 5.55, 42.95, 7.05]] }, 'incubadora', 'incubadora-corredor'],
        administrativo: [{ zona: 'corredor', em: [[42.75, 13.65, 44.25, 15.15], [41.75, 13.15, 43.25, 14.65]] }, { zona: 'hall', em: [[42.55, 0.05, 44.05, 1.55], [42.55, -0.05, 44.05, 1.45], [41.55, 5.55, 43.05, 7.05], [34.65, -0.15, 36.15, 1.35], [34.65, -0.25, 36.15, 1.25], [21.65, 0.95, 23.15, 2.45], [37.85, 1.45, 39.35, 2.95], [33.55, 4.35, 35.05, 5.85], [29.15, -0.15, 30.65, 1.35], [29.15, -0.25, 30.65, 1.25], [29.55, 4.35, 31.05, 5.85]] }, 'incubadora', 'incubadora-corredor'],
        'incubadora-corredor': ['acioc', 'administrativo', 'cafe', 'corredor', 'hall', 'incubadora', 'salas'],
        incubadora: ['acioc', { zona: 'administrativo', em: [[46.65, 14.05, 48.15, 15.55], [42.85, 18.95, 44.35, 20.45], [42.15, 17.45, 43.65, 18.95], [42.15, 18.95, 43.65, 20.45], [42.05, 18.95, 43.55, 20.45], [41.35, 16.85, 42.85, 18.35], [42.25, 18.85, 43.75, 20.35], [42.05, 18.85, 43.55, 20.35], [41.35, 16.65, 42.85, 18.15], [46.65, 17.15, 48.15, 18.65], [41.95, 18.85, 43.45, 20.35]] }, 'cafe', 'corredor', 'hall', 'incubadora-corredor', 'salas']
      }
    },
    /* portas que abrem ao chegar perto: a = dobradiça, b = ponta da folha; abrem para dentro de cada sala */
    portasAnimadas: [
      { id: 'acioc', a: [10.5, 12.2], b: [10.5, 13.2], y: 4.2, altura: 2.3 },                                          // ACIOC Hub (vidro, E12)
      { id: 'administrativo', a: [42.0, 14.6], b: [43.0, 14.6], y: 4.2, altura: 2.3, arte: 'porta-administrativo' },   // Administrativo (E07, E08)
      { id: 'projetos', a: [43.5, 16.4], b: [44.5, 16.4], y: 4.2, altura: 2.2 },                                       // sala de projetos
      { id: 'sala-adm', a: [50.4, 14.85], b: [50.4, 15.85], y: 4.2, altura: 2.2, abre: 'direita' },                    // sala de Dagliê e Danimara
      { id: 'incubadora-101', a: [46.5, 1.6], b: [46.5, 2.6], y: 4.2, altura: 2.3, arte: 'porta-incubadora', abre: 'direita' }, // porta norte (X47, E45)
      { id: 'incubadora-103', a: [46.5, 11.6], b: [46.5, 10.6], y: 4.2, altura: 2.3, arte: 'porta-incubadora' },       // porta sul (E31, E36)
      { id: 'incubadora-salinha', a: [49.1, 11.75], b: [48.1, 11.75], y: 4.2, altura: 2.2, abre: 'direita' },          // salinha atrás da divisória
      /* salas de incubação: dobradiça do lado da divisória, a folha aberta encosta nela */
      { id: 'incubacao-1', a: [51.6, 2.85], b: [51.6, 1.85], y: 4.2, altura: 2.2 },
      { id: 'incubacao-2', a: [51.6, 5.75], b: [51.6, 4.75], y: 4.2, altura: 2.2 },
      { id: 'incubacao-3', a: [51.6, 8.65], b: [51.6, 7.65], y: 4.2, altura: 2.2 },
      { id: 'incubacao-4', a: [51.6, 11.55], b: [51.6, 10.55], y: 4.2, altura: 2.2 },
      { id: 'incubacao-5', a: [51.6, 13.0], b: [51.6, 12.0], y: 4.2, altura: 2.2 },
      { id: 'reunioes-servidor', a: [37.8, 14.6], b: [36.8, 14.6], y: 4.2, altura: 2.1, arte: 'porta-lisa', abre: 'direita' }, // reuniões/servidor: dobradiça junto à divisória
      { id: 'podcast', a: [38.1, 14.6], b: [39.1, 14.6], y: 4.2, altura: 2.1, arte: 'porta-circulos' },                   // estúdio de podcast (E08)
      /* escadas de emergência: abrem para a antecâmara */
      { id: 'emergencia-terreo', a: [12.25, 15.0], b: [13.25, 15.0], y: 0, altura: 2.1, arte: 'emergencia' },
      { id: 'emergencia-1-oeste', a: [12.0, 14.6], b: [13.0, 14.6], y: 4.2, altura: 2.1, arte: 'emergencia' },
      { id: 'emergencia-1-leste', a: [30.35, 14.6], b: [31.35, 14.6], y: 4.2, altura: 2.1, arte: 'emergencia' }
    ],
    elevador: { x: 14.6, largura: 1.1, altura: 2.2, fundo: 1.4, paradas: [{ piso: 0, y: 0, z: 15.0 }, { piso: 1, y: 4.2, z: 14.6 }] },
    placas: [
      { arte: 'salas', x: 32.5, y: 2.45, z: 14.96, w: 1.3, h: 0.24, rot: PI },
      { arte: 'incendio', x: 16.0, y: 1.65, z: 14.96, w: 0.5, h: 0.21, rot: PI },
      { arte: 'saida', x: 36.4, y: 2.4, z: 12.37, w: 0.36, h: 0.14, rot: PI },
      { arte: 'saida', x: 14.75, y: 2.62, z: 0.08, w: 0.36, h: 0.14 },
      /* ===== 1º andar ===== */
      { arte: 'rede-centros', x: 13.6, y: 3.7, z: 11.69, w: 5.0, h: 0.62, rot: PI, transparente: true },        // faixa na laje (X46)
      { arte: 'acioc-parede', x: 10.47, y: 6.0, z: 17.25, w: 4.4, h: 2.2, rot: -PI / 2 },                      // parede branca do ACIOC (E16)
      { arte: 'veneziana', x: 11.4, y: 5.25, z: 14.585, w: 0.8, h: 2.1, rot: PI }, { arte: 'veneziana', x: 29.75, y: 5.25, z: 14.585, w: 0.8, h: 2.1, rot: PI },
      { arte: 'saida', x: 12.5, y: 6.62, z: 14.58, w: 0.36, h: 0.14, rot: PI }, { arte: 'saida', x: 30.85, y: 6.62, z: 14.58, w: 0.36, h: 0.14, rot: PI },
      { arte: 'incendio', x: 15.75, y: 5.85, z: 14.585, w: 0.5, h: 0.21, rot: PI },
      { arte: 'podcast', x: 38.6, y: 6.55, z: 14.58, w: 0.62, h: 0.18, rot: PI },
      { arte: 'no-ar', x: 38.6, y: 6.7, z: 14.675, w: 0.36, h: 0.12, transparente: true },
      { arte: 'inovale-adm', x: 50.38, y: 5.95, z: 17.2, w: 0.7, h: 0.13, rot: -PI / 2 },
      { arte: 'projetos', x: 43.0, y: 6.55, z: 16.38, w: 0.7, h: 0.16, rot: PI },
      /* Incubadora: porta da sala 101, números das salas, cartazes do programa e o quadro da jornada */
      { arte: 'n101', x: 46.47, y: 6.75, z: 0.95, w: 0.36, h: 0.18, rot: -PI / 2 }, { arte: 'n102', x: 46.47, y: 6.75, z: 6.0, w: 0.36, h: 0.18, rot: -PI / 2 },
      { arte: 'n103', x: 46.47, y: 6.75, z: 10.0, w: 0.36, h: 0.18, rot: -PI / 2 },
      { arte: 'incubadas-verde', x: 46.47, y: 5.65, z: 3.6, w: 0.7, h: 1.75, rot: -PI / 2, transparente: true }, { arte: 'incubadas-verde', x: 46.47, y: 5.65, z: 4.4, w: 0.7, h: 1.75, rot: -PI / 2, transparente: true },
      { arte: 'incubadas-azul', x: 46.47, y: 5.65, z: 6.9, w: 0.7, h: 1.75, rot: -PI / 2, transparente: true }, { arte: 'incubadas-azul', x: 46.47, y: 5.65, z: 7.7, w: 0.7, h: 1.75, rot: -PI / 2, transparente: true },
      { arte: 'jornada', x: 47.35, y: 5.95, z: 11.73, w: 1.2, h: 0.6, rot: PI },                                   // quadro da jornada, agora na face da salinha
      /* salas de incubação: só a sinalização institucional (as empresas mudam a cada ciclo) */
      { arte: 'sala-incubacao', x: 51.57, y: 6.55, z: 1.25, w: 0.62, h: 0.16, rot: -PI / 2 }, { arte: 'sala-incubacao', x: 51.57, y: 6.55, z: 4.1, w: 0.62, h: 0.16, rot: -PI / 2 },
      { arte: 'sala-incubacao', x: 51.57, y: 6.55, z: 7.0, w: 0.62, h: 0.16, rot: -PI / 2 }, { arte: 'sala-incubacao', x: 51.57, y: 6.55, z: 9.9, w: 0.62, h: 0.16, rot: -PI / 2 },
      { arte: 'sala-incubacao', x: 51.57, y: 6.55, z: 13.6, w: 0.62, h: 0.16, rot: -PI / 2 }
    ],
    tubos: [{ pontos: [[20.25, 0.95, 14.95], [20.25, 3.2, 14.95]], raio: 0.025, pal: 'vermelho' }, { pontos: [[30.4, 1.6, 14.95], [30.4, 3.2, 14.95]], raio: 0.025, pal: 'vermelho' },
            { pontos: [[28.52, 5.6, 14.55], [28.52, 8.0, 14.55]], raio: 0.03, pal: 'vermelho' }],              // tubo do hidrante do 1º andar (E10)
    luminarias: (function(){
      var l = [], x, z;
      for (x = 6; x <= 41; x += 3) for (z = 1.5; z <= 10.5; z += 3) l.push({ x: x, z: z });
      [[1.5, 1.5], [4.5, 1.5], [1.5, 4.5], [4.5, 4.5]].forEach(function(p){ l.push({ x: p[0], z: p[1] }); });
      for (x = 1.5; x <= 42.5; x += 3) l.push({ x: x, z: 13.5, y: 3.2 });
      for (x = 1.5; x <= 42.5; x += 3) for (z = 13.0; z <= 19.0; z += 3) if (!(x > 32 && x < 41.8 && z > 14.6)) l.push({ x: x, z: z, y: 7.98 });
      for (x = 45.25; x <= 54.5; x += 3) for (z = 1.5; z <= 19.5; z += 3) l.push({ x: x, z: z, y: 7.98 });     // ala leste
      [[24.0, 15.2], [26.5, 15.2]].forEach(function(p){ l.push({ x: p[0], z: p[1], y: 6.6 }); });                // nichos dos banheiros
      [[35.0, 16.6], [35.0, 18.6], [39.9, 16.4], [39.9, 18.5]].forEach(function(p){ l.push({ x: p[0], z: p[1], y: 7.1 }); }); // reuniões e podcast
      [[12.9, 15.7, 2.6], [12.72, 15.3, 6.8], [31.05, 15.3, 6.8]].forEach(function(p){ l.push({ x: p[0], z: p[1], y: p[2] }); }); // antecâmaras
      [[1.8, 8], [3.6, 8], [1.8, 10.5], [3.6, 10.5]].forEach(function(p){ l.push({ x: p[0], z: p[1], y: 3.2 }); });
      return l;
    })(),
    moveis: moveis,

    /* Keila fica no posto de trabalho, atrás da parte baixa (laranja) do balcão, sobre um estrado escondido pelo balcão:
       assim o rosto aparece acima do tampo para quem chega. Dagliê e Danimara ficam sentadas na sala interna do Administrativo,
       de frente para a porta dela: Dagliê logo na entrada, Danimara mais para dentro. */
    npcs: [
      { nome:'Keila', x:17.3, y:0.45, z:9.2, rot:PI, cor:'violeta', olhos:'feliz', acessorio:'fone', corAcessorio:'lilas', acena:true },
      { nome:'Dagliê', x:52.6, y:4.2, z:15.65, rot:-PI / 2, cor:'rosa', olhos:'feliz', acessorio:'flor', corAcessorio:'sol', sentada:true },
      { nome:'Danimara', x:53.1, y:4.2, z:18.75, rot:-PI / 2, cor:'rosa-claro', olhos:'feliz', acessorio:'tiara', corAcessorio:'lilas', sentada:true, tatuagem:true }
    ],

    exterior: {
      terreno: { cor: '#a9b2a4', calcada: 4 },
      colinas: [{ x: 10, y: -20, z: -110, r: 70, h: 34 }, { x: 60, y: -24, z: -130, r: 80, h: 40 }, { x: -40, y: -22, z: -95, r: 55, h: 30 }],
      nuvens: [{ x: 0, y: 30, z: -70, s: 4 }, { x: 30, y: 38, z: -90, s: 5 }, { x: 55, y: 26, z: -60, s: 3 }]
    },

    entrada: { x: 14.75, z: 4.2, rumo: 0, camYaw: PI },
    chegadas: { 'lab-ia': { x: 14.6, z: 13.95, rumo: PI, camYaw: 1.3 } },

    interativos: [
      { id: 'recepcao', x: 20.4, y: 1.25, z: 7.95, raio: 1.9, rotulo: 'Recepção', conteudo: 'recepcao' },
      { id: 'totem', x: 22.63, y: 1.4, z: 8.4, raio: 1.6, rotulo: 'Totem de orientação', conteudo: 'totem' },
      { id: 'painel', x: 22.4, y: 1.4, z: 3.5, raio: 2.0, rotulo: 'Painel institucional', conteudo: 'painel' },
      { id: 'telao', x: 41.6, y: 2.2, z: 6.25, raio: 4.2, rotulo: 'Telão', conteudo: 'telao' },
      { id: 'expositores', x: 37.85, y: 1.1, z: 11.9, raio: 1.9, rotulo: 'Expositores', conteudo: 'expositores' },
      { id: 'nexo', x: 36.1, y: 1.3, z: 14.7, raio: 1.7, rotulo: 'Sala Nexo', conteudo: 'nexo' },
      { id: 'cafeteria', x: 4.3, y: 1.2, z: 13.25, raio: 2.4, rotulo: 'Cafeteria Pin', conteudo: 'cafeteria' },
      { id: 'escada', x: 43.2, y: 1.4, z: 3.1, raio: 1.9, rotulo: '1º andar', conteudo: 'escada' },
      /* pessoas: (x, z) é o ponto de atendimento, que o jogador alcança; "alvo" é onde a pessoa está (cabeça) */
      { id:'keila', x:17.3, y:1.2, z:7.75, piso:0, raio:1.35, rotulo:'Conversar', conteudo:'keila', npc:'Keila', alvo:[17.3, 1.5, 9.2] },
      { id: 'elevador-terreo', x: 14.6, y: 1.3, z: 14.7, piso:0, raio: 1.8, rotulo: 'Chamar elevador', conteudo: 'elevador', acao: { elevador:true, rotulo:'Entrar no elevador' } },
      { id:'elevador-primeiro', x:14.6, y:5.5, z:14.25, piso:4.2, raio:1.8, rotulo:'Chamar elevador', conteudo:'elevador', acao:{ elevador:true, rotulo:'Entrar no elevador' } },
      { id:'acioc', x:11.15, y:5.5, z:12.7, piso:4.2, raio:1.6, rotulo:'ACIOC Hub', conteudo:'acioc' },
      { id:'administrativo', x:42.5, y:5.5, z:13.95, piso:4.2, raio:1.5, rotulo:'Administrativo', conteudo:'administrativo' },
      { id:'incubadora', x:45.8, y:5.5, z:11.1, piso:4.2, raio:1.6, rotulo:'Incubadora Joaçaba', conteudo:'incubadora' },
      { id:'daglie', x:51.0, y:5.2, z:15.65, piso:4.2, raio:1.2, rotulo:'Conversar', conteudo:'daglie', npc:'Dagliê', alvo:[52.6, 5.5, 15.65] },
      { id:'danimara', x:51.45, y:5.2, z:18.75, piso:4.2, raio:1.2, rotulo:'Conversar', conteudo:'danimara', npc:'Danimara', alvo:[53.1, 5.5, 18.75] },
      { id:'salas-incubacao', x:51.4, y:5.6, z:8.8, piso:4.2, raio:1.6, rotulo:'Salas de incubação', conteudo:'salas-incubacao' },
      { id:'podcast', x:39.9, y:5.25, z:15.75, piso:4.2, raio:1.5, rotulo:'Conhecer o estúdio', conteudo:'podcast', alvo:[39.9, 5.0, 17.4] },
      { id:'servidor', x:33.15, y:6.2, z:18.75, piso:4.2, raio:1.5, rotulo:'Ver equipamento', conteudo:'servidor', alvo:[32.45, 6.75, 19.55] }
    ]
  });
})();
