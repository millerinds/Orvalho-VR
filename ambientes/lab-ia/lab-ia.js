/* Laboratório de IA: planta em metros.
   Eixos: x vai da parede das janelas (oeste, x = 0) até a parede da porta e do corredor (leste);
          z vai da parede azul (norte, z = 0) até a parede cinza (sul).
   Duas medidas convivem aqui:
   · real: estimativa tirada do rabisco (6 × 3 m, 3 m de pé-direito), das fotos e da planta v0 (docs/historico/2-...txt).
           Ainda é chute: ninguém mediu com trena (ver "pendencias").
   · jogo: a versão discretamente ampliada que o motor usa, para o boneco (1,70 m, tronco de 0,89 m) circular em 3ª pessoa.
   O motor só lê os campos de cima (sala, paredes, moveis...); os campos "real" ficam como registro. */
Orvalho.ambientes.registrar({
  id: 'lab-ia',
  nome: 'Laboratório de IA',

  medidas: {
    real: { largura: 6.0, fundo: 3.0, pe: 3.0, porta: 0.9, corredorFileiras: 1.04, folgaCadeiraMesa: 0.45, atrasCadeiras: 0.53, zonaPorta: 1.55, zonaJanela: 1.35 },
    jogo: { largura: 7.2, fundo: 4.8, pe: 3.0, porta: 1.0, corredorFileiras: 1.93, folgaCadeiraMesa: 1.40, atrasCadeiras: 1.02, zonaPorta: 2.10, zonaJanela: 1.80 },
    /* v2 (personagem de 1,30 m): corredores principais com ~1,40 m livres. As cadeiras ficam encaixadas sob a mesa,
       como numa sala arrumada; o puff foi para o canto do fundo; abriu-se um corredor atrás das cadeiras 2 e 3
       (na sala real não passa ninguém ali) para chegar à frente dos monitores, que viram para as cadeiras. */
    ampliacao: 'Sala +20% no comprimento e +60% na largura (3,0 → 4,8 m); móveis no tamanho real. Corredor principal 1,40 m livre no ponto mais estreito (real 0,45), corredor de fundo 1,02 m (real: sem passagem), zona da janela 1,80 m, zona da porta 2,10 m.',
    pendencias: [
      'Piso: "3 pisos e meio" na parede da porta com piso de ~0,59 m (2 folhas A4 deitadas) dá ~2,1 m, mas o rabisco diz 3 m. Confirmar com trena.',
      'Porta: largura (0,90 é padrão) e para que lado abre.',
      'Altura dos vidros (~2,60 m) e divisões das janelas, arredondadas a partir das marcas roxas.'
    ]
  },

  sala: { largura: 7.2, fundo: 4.8, pe: 3.0 },
  cores: { azul: '#5a84c0', branca: '#e9f0f5', cinza: '#dce4ea', rodape: '#c3cfda' },
  luz: { hemi: 0.66, solForca: 0.5 },
  luminarias: [{ x: 1.8, z: 1.9 }, { x: 3.6, z: 1.6 }, { x: 5.4, z: 1.9 }, { x: 1.8, z: 4.0 }, { x: 3.6, z: 4.2 }, { x: 5.4, z: 4.0 }],
  bolhas: 14,

  /* vãos: de/ate na coordenada do mundo ao longo da parede (z nas paredes oeste/leste, x nas norte/sul) */
  paredes: [
    { lado: 'norte', cor: 'azul' },
    { lado: 'sul', cor: 'cinza' },
    { lado: 'oeste', cor: 'branca', vaos: [
      { tipo: 'janela', de: 0.12, ate: 1.72, base: 0.45, topo: 2.6, cortina: true, real: { de: 0, ate: 1.12 } },
      { tipo: 'janela', de: 1.82, ate: 3.36, base: 0.45, topo: 2.6, cortina: true, real: { de: 1.12, ate: 2.15 } },
      { tipo: 'porta-vidro', de: 3.46, ate: 4.68, base: 0, topo: 2.6, cortina: true, real: { de: 2.15, ate: 3.0 } }
    ] },
    { lado: 'leste', cor: 'branca', vaos: [
      { tipo: 'porta', de: 0.25, ate: 1.25, base: 0, topo: 2.6, altura: 2.1, real: { de: 0.15, ate: 1.05 } },
      { tipo: 'vidro-pelicula', de: 1.4, ate: 3.0, base: 0, topo: 2.6, real: { de: 1.07, ate: 2.08 } },
      { tipo: 'vidro-pelicula', de: 3.1, ate: 4.68, base: 0, topo: 2.6, real: { de: 2.08, ate: 3.0 } }
    ] }
  ],

  /* x, z = centro do item no jogo; rot = giro (frente do móvel = +z); y = altura da base (itens em cima da mesa: 0,75).
     O robô, o suporte de TV com volante e a maleta ficaram de fora (decisão registrada em docs/historico/1-...txt). */
  moveis: [
    { id: 'recarga',   tipo: 'recarga',  x: 2.62, z: 0.40,             real: { x: 2.28, z: 0.39 } },
    { id: 'mesa-1',    tipo: 'mesa',     x: 4.30, z: 0.42,             real: { x: 3.72, z: 0.40 } },
    { id: 'monitor-1', tipo: 'monitor',  x: 4.40, z: 0.34, y: 0.75 },
    { id: 'gabinete',  tipo: 'gabinete', x: 3.72, z: 0.36, y: 0.75 },
    { id: 'cadeira-1', tipo: 'cadeira',  x: 4.30, z: 0.89, rot: Math.PI, real: { x: 3.81, z: 0.95 } }, // encaixada sob a mesa
    { id: 'lixeira',   tipo: 'lixeira',  x: 5.42, z: 0.30,             real: { x: 4.71, z: 0.31 } },
    { id: 'quadro',    tipo: 'quadro',   x: 6.55, z: 0.06, y: 1.70,    real: { x: 5.30, y: 1.70 } },
    { id: 'ar',        tipo: 'ar',       x: 2.90, z: 0.11, y: 2.62,    real: { x: 2.60, y: 2.62 } },
    { id: 'mesa-2',    tipo: 'mesa',     x: 2.60, z: 2.95,             real: { x: 2.11, z: 1.93 } },
    { id: 'mesa-3',    tipo: 'mesa',     x: 4.22, z: 2.95,             real: { x: 3.68, z: 1.93 } },
    { id: 'monitor-2', tipo: 'monitor',  x: 2.80, z: 2.87, y: 0.75 },
    { id: 'monitor-3', tipo: 'monitor',  x: 4.30, z: 2.87, y: 0.75 },
    { id: 'notebook-2', tipo: 'notebook', x: 2.12, z: 3.02, y: 0.75 },
    { id: 'notebook-3', tipo: 'notebook', x: 4.72, z: 3.04, y: 0.75, rot: -0.25 },
    { id: 'cadeira-2', tipo: 'cadeira',  x: 2.60, z: 3.47, rot: Math.PI, real: { x: 2.13, z: 2.47 } }, // encaixada
    { id: 'cadeira-3', tipo: 'cadeira',  x: 4.22, z: 3.47, rot: Math.PI, real: { x: 3.81, z: 2.47 } }, // encaixada
    { id: 'armario',   tipo: 'armario',  x: 0.95, z: 4.555, rot: Math.PI, real: { x: 0.74, z: 2.67 } },
    { id: 'puff',      tipo: 'puff',     x: 6.62, z: 4.20,             real: { x: 5.40, z: 2.50 } }, // no canto do fundo
    { id: 'poste',     tipo: 'poste',    x: 1.88, z: 2.72, y: 0.75,    real: { x: 1.42, z: 1.70 } },
    { id: 'planta',    tipo: 'planta',   x: -0.75, z: 4.05 },
    { id: 'arvore-1',  tipo: 'arvore',   x: -6, z: -1.5, y: -3.6 },
    { id: 'arvore-2',  tipo: 'arvore',   x: -9, z: 4.5, y: -3.2 },
    { id: 'arvore-3',  tipo: 'arvore',   x: -5.5, z: 8, y: -4 }
  ],

  /* eletrodutos pretos das fotos: dois descendo pela parede azul até as tomadas e um correndo baixo na parede cinza */
  tubos: [
    { pontos: [[5.78, 3.0, 0.03], [5.78, 0.42, 0.03]], caixa: 'fim' },
    { pontos: [[6.02, 3.0, 0.03], [6.02, 0.42, 0.03]], caixa: 'fim' },
    { pontos: [[0.05, 0.42, 4.77], [1.6, 0.42, 4.77]] }
  ],

  exterior: {
    sacada: { fundo: 1.5 },
    corredor: { fundo: 2.6 },
    colinas: [
      { x: -60, y: -26, z: -12, r: 38, h: 24 }, { x: -80, y: -30, z: 28, r: 46, h: 33, achata: 0.8 },
      { x: -42, y: -22, z: 20, r: 22, h: 15 }, { x: -90, y: -24, z: -45, r: 50, h: 30 }
    ],
    nuvens: [{ x: -40, y: 16, z: -12, s: 3 }, { x: -55, y: 22, z: 14, s: 4 }, { x: -35, y: 12, z: 24, s: 2.4 }, { x: -60, y: 30, z: -30, s: 5 }]
  },

  /* chegada: alguns passos depois da porta, de frente para a sala (camYaw: câmera na diagonal, onde há espaço atrás) */
  entrada: { x: 5.6, z: 1.95, rumo: -Math.PI / 2 - 0.1, camYaw: 0.5 },

  /* voltando do hall pela ligação provisória: logo depois da porta */
  chegadas: { 'hall-inovale': { x: 6.3, z: 0.95, rumo: -Math.PI / 2 - 0.3, camYaw: 0.9 } },

  /* equipamentos interativos: ponto do aviso (x, y, z), raio de alcance e qual conteúdo abrir */
  interativos: [
    { id: 'monitor-1', x: 4.40, y: 1.10, z: 0.31, raio: 1.55, rotulo: 'Ver projeto', conteudo: 'monitor-1' },
    { id: 'monitor-2', x: 2.80, y: 1.10, z: 2.84, raio: 1.6, rotulo: 'Ver projeto', conteudo: 'monitor-2' },
    { id: 'monitor-3', x: 4.30, y: 1.10, z: 2.84, raio: 1.6, rotulo: 'Ver projeto', conteudo: 'monitor-3' },
    { id: 'recarga',   x: 2.62, y: 1.15, z: 0.40, raio: 1.4, rotulo: 'O que é isto?', conteudo: 'recarga' },
    { id: 'porta',     x: 7.12, y: 1.3, z: 0.70, raio: 1.3, rotulo: 'Corredor', conteudo: 'porta',
      acao: { ambiente: 'hall-inovale', rotulo: 'Ir ao elevador (Hall do Inovale)' } }
  ]
});
