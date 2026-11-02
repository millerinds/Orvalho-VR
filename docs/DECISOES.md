# Decisões técnicas

Registro das escolhas feitas na primeira versão jogável (30/10/2026), com o motivo de cada uma. Complementa o `REGRAS-orvalho.md`, que continua valendo para estética e modelagem.

## Tecnologia

- **three.js r149, mantido.** Os shaders da gelatina usam chunks dessa versão (o REGRAS pede para não trocar sem avisar). O arquivo foi baixado para `vendor/` (o mesmo `three.min.js` UMD do CDN). Assim o jogo funciona offline e já fica pronto para a CSP do Flask.
- **Scripts clássicos, sem bundler.** Cada arquivo de `src/` se pendura em `window.Orvalho`. Com isso o jogo abre por `file://` com duplo clique, cada bloco fica num arquivo próprio (que é o que a CSP do Flask vai pedir) e não há ferramenta de build para manter. Isso segue a divisão em módulos proposta no `historico/2-...txt`. A diferença é que os módulos são arquivos separados, e não blocos dentro de um HTML único, porque o projeto vai crescer para vários ambientes.
- **Nenhum addon do three.** Na r149 os addons só existem como ES module (`examples/js` saiu na r148), e misturá-los com o build UMD criaria duas cópias do THREE. Câmera, colisão e caixa arredondada foram escritas à mão. Se um dia for preciso o GLTFLoader, a saída é trocar para o build de módulos **da mesma r149**.
- **Nenhuma dependência nova.** O projeto só usa three e Google Fonts.

## Boneco: uma implementação só

- `criarBoneco()` (em `src/boneco/boneco.js`) é o antigo miolo do `Doll()` do kit. O código de modelagem, acessórios e materiais foi **extraído do kit sem reescrever**. Saíram renderer, câmera, `requestAnimationFrame` e listeners.
- **`root` × `fig`:** o mundo mexe no `root` (lugar, direção e escala de 1,70/2,15); o boneco se anima no `fig`, exatamente como antes.
- A **vitrine** (`Doll()` em `vitrine.js`) mantém a API do kit e é usada pelo avatar da moldura e pelo palco do provador. O **jogo** usa o mesmo `criarBoneco()`. A configuração é uma só (`O.avatar`, no `localStorage`).
- Os lerps do kit eram por quadro (calibrados a 60 fps). Agora são corrigidos pelo `dt`, então o resultado é igual a 60 fps e estável em telas de 120 Hz.
- **Teste de fidelidade:** renderizamos o kit original e o código novo lado a lado, com 4 configurações e movimento reduzido (pose congelada). O resultado foi visualmente idêntico.
- **Novo no boneco:**
  - **andar:** pulinhos de gelatina proporcionais à velocidade, achatar ao tocar o chão, inclinar para a frente, braços alternados, rolar nas curvas e balançar ao parar;
  - **aperto:** perto de móveis os braços encostam no corpo;
  - **olhar em 3D:** `olharPara(ponto)` usa os mesmos limites do kit.

## Mundo

- **Escala:** 1 unidade = 1 metro. **v2: o personagem mede 1,30 m** (escala 1,30 / 2,15 ≈ 0,605). Só a escala do `root` mudou: proporções, materiais, acessórios e animações são os mesmos, e o provador e o avatar continuam do tamanho de antes. Tudo que depende do tamanho sai da mesma constante em `jogo.js`: o colisor, a passada dos pulinhos, o aperto dos braços e a altura e distância da câmera. A v1 tinha 1,70 m e não circulava entre as bancadas.
- **Colisão 2D no chão:** o boneco é um círculo cujo raio é **medido no corpo escolhido** (o maior raio do perfil do tronco × escala × 0,96): Jujuba 0,33 m, Gota 0,37 m, Esguio 0,26 m. O raio é recalculado ao trocar de corpo no provador. Os móveis são caixas e círculos conferidos contra a geometria visível (diferença máxima de 2,3 cm); as paredes são segmentos. Os braços não colidem: passam por baixo do tampo e encolhem quando aperta. O boneco escorrega ao encostar, porque o empurrão é sempre na direção normal da superfície.
- **Planta v2:** corredores principais com 1,40 m livres no ponto mais estreito. As cadeiras ficam encaixadas sob as mesas e há um corredor de fundo atrás das cadeiras 2 e 3 (ver `MEDIDAS-lab-ia.md`).
- **Câmera:** fica em 3ª pessoa, a 2,9 m (v2), e mede no chão até onde pode recuar sem atravessar parede. Sem espaço atrás, ela sobe um pouco (casa de bonecas) e abre o campo de visão. Andando, ela escorrega sozinha para o lado mais livre, a não ser que a pessoa esteja girando. Nunca passa do forro nem sai do retângulo da sala.
- **Móveis:** um `InstancedMesh` por peça de cada tipo. Os materiais são gelatina com contorno escuro (casca invertida), em 13 paletas fixas. As formas são só arredondadas (`O.formas.caixa` gera canto redondo com normais suaves, para o contorno não rasgar).
- **Sem sombra em tempo real nem pós-processamento:** as sombras são pintadas no chão (a mesma textura do palco do provador). É mais barato, fica com mais cara de Aero e evita o visual neon.
- **Luz:** o mesmo estúdio PMREM do kit, um pouco mais quente, mais a luz de céu (hemisfério) e uma luz quente vinda das janelas. Sem tone mapping, como no kit.
- **Recorte de visibilidade:** o r149 testa o `InstancedMesh` pela esfera da geometria, não das instâncias. Por isso o recorte (`frustumCulled`) está desligado nos instanciados.

## Testes

- `npm install` e depois `npm run teste:navegacao`. Há também as variantes `:gota` e `:esguio`. O teste usa só o `playwright-core`, como dependência de desenvolvimento; o jogo continua sem dependências.
- O teste sobe um servidor próprio, abre o jogo num Chromium com GPU e faz quatro verificações:
  1. audita os colisores contra a geometria visível;
  2. mede a largura livre dos corredores;
  3. calcula a cobertura do piso, com uma busca na grade de 5 cm;
  4. **dirige o boneco com W/A/S/D de verdade**, relativos à câmera, por 9 trechos que passam pela sala inteira, interagindo com os 5 equipamentos.
- Ele falha se o boneco ficar parado mais de 2,5 s, se atravessar algo ou se aparecer erro no console. O relatório vai para `testes/relatorio-navegacao-<corpo>.json`.

## Hall do Inovale (Fase B)

- **Mesmo motor.** O `sala.js` ganhou recursos opcionais, que o Lab não usa e por isso continua idêntico:
  - lajes de mezanino, com guarda-corpo calculado nas bordas voltadas para o vazio;
  - pilares, que colidem e barram a câmera;
  - blocos, escadas, painéis verticais, fachada com caixilhos, faixa e persianas;
  - paredes com textura;
  - obstáculos explícitos e colisão por item.
- **Câmera por ambiente** (`camera` na planta): olhar para cima, distância e teto em cada ponto (`limites.tetoEm`). Móveis com `alto: true` também barram a câmera.
- **Troca de ambiente:** `O.jogo.irPara(id)` mantém o mesmo boneco, mostra o véu enquanto a cena monta e usa `chegadas[de]` da planta. Hoje ela só é chamada pelas ligações provisórias.
- **Marcas:** só a INOVALE, desenhada de forma aproximada até receber o arquivo oficial. As de terceiros ficam genéricas até haver autorização.

## Hall: Fases C/D

- **Planta de outro pavimento:** do PDF do ático só se usa a estrutura que se repete nos andares (prédio de 44 m, pilares a cada 8 m, núcleo de circulação), e só quando as fotos corroboram. Ver `hall/CORRECOES-FASE-CD.md`.
- **Motor** (tudo opcional, o Lab não muda):
  - tipos de vão `elevador` e `passagem` (com nicho);
  - portas com `arte` impressa;
  - painéis de vidro com `faixas` e `portas`;
  - escada em `lances` com patamar;
  - `placas`;
  - piso com `pisoCores`/`pisoTinta`, `corForro`;
  - folhas de dupla face (`duplo`);
  - `assentos` nos tipos de móvel, que viram "Sentar".
- **Menos chamadas de desenho:** peças de um tipo agrupadas por paleta (faixas de espessura de contorno), peças avulsas de gelatina agrupadas e malhas de mesmo material mescladas no fim da montagem. O efeito vale também para o Lab.
- **Sentar:** `boneco.sentar(true|false)` é uma pose animada (sem pernas: recosta, achata levemente, braços pousados). O jogo põe o boneco no assento e, ao levantar, leva-o ao ponto de saída e resolve a colisão.

## Para os próximos ambientes

- O ambiente é dado (`ambientes/<id>/<id>.js`) e o montador é um só (`sala.js`).
- `jogo.js` já descarta o ambiente anterior e monta o novo (`carregarAmbiente`). Falta:
  1. uma "saída" na planta (porta → ambiente de destino + ponto de chegada);
  2. o véu de transição ao atravessar;
  3. paredes com porta aberta (hoje a parede inteira colide).

## Hall: continuidade v2 (Codex)

- **Cafeteria:** D01/D03/D04 prevalecem sobre a composição anterior. Balcão, porta de serviço, geladeiras e estante seguem a parede interna e o fechamento oeste envidraçado; não há pavimento separado sobre as mesas.
- **Nexo:** D02/D05/D06 fixam a frente em z ≈ 14,94, junto ao acesso das salas 1–3, e confirmam o corredor x = 31,5–33,5 até z = 20. Ambientes fechados não foram inventados.
- **Níveis:** `alturaPiso(x,z,yAtual)` é a fonte de verdade para a cota navegável. Fora de um piso válido retorna `null`; o jogo rejeita o passo e evita quedas.
- **Escada:** os degraus permanecem visuais, mas a navegação usa dois planos inclinados e um patamar. Isso preserva a leitura arquitetônica sem fazer o colisor circular engasgar em cada espelho.
- **Primeiro andar:** somente o corredor documentado z = 12–13,6 está liberado. A cota é +4,2 m; guarda-corpo, vidro e abertura de chegada são segmentos de colisão exclusivos desse nível.
- **Persistência compatível:** o save agora grava `y`. Saves antigos sem altura continuam válidos e recebem a cota calculada no carregamento.
- **Planta versionada:** v0/v1 ficam como histórico; a fonte atual é `hall/planta-hall-v2.json`, gerada por `hall/gerar-planta-v2.py` junto do SVG. O PNG é derivado do SVG.

## 30/10/2026 · Revisão do 1º andar pelas fotos (Claude)

- As fotos 16.32.03 (X46) e 16.32.04 (X47) prevalecem sobre a leitura anterior. A Incubadora fica numa ala leste, sobre o palco, e o ACIOC Hub tem a frente de vidro na borda da laje, sobre o café. A largura da ala leste (11 m) é estimada e conflita com os 44 m do PDF do ático. Fica pendente de planta.
- Salas sem foto do interior (as três entre o núcleo e o Administrativo) ficam fechadas, com fachada de vidro jateado ou fumê. As salas das empresas são vistas pelo vidro, mas não se entra nelas.
- Keila fica no posto, atrás do balcão, sobre um estrado escondido. O atendimento ("E · Conversar") é feito na frente do balcão. NPCs usam `alvo` separado do ponto de interação.
- Portas que abrem sozinhas ao chegar perto, em vez de portas sempre abertas: mantêm as artes das fotos visíveis (porta do Administrativo, portas pretas da Incubadora) sem bloquear a passagem.
- Logotipos de terceiros (ACIOC, empresas, parceiros) aparecem como composições genéricas, com nome e cores. Textos institucionais legíveis nas fotos foram reproduzidos: porta do Administrativo, banner da Incubadora, faixa da Rede Catarinense de Centros de Inovação.

## 31/10/2026 · Correções do 1º andar após teste do usuário

- Paredes do térreo que existem também acima da laje não podem subir até o forro nem colidir em todos os pavimentos (`altura` + `soTerreo`). Era a causa da parede que bloqueava o Administrativo e cortava o ACIOC.
- A Incubadora não identifica empresas, porque elas mudam a cada ciclo. Só sinalização institucional genérica.
- Salas informadas pelo usuário sem foto do interior (podcast e servidor) ficam fechadas, com a fachada vista nas fotos.
- Banheiros do 1º andar são nichos navegáveis (anexos), no mesmo padrão do térreo, e não textura na parede.
- Peças móveis (folhas do elevador) nunca ficam no mesmo plano da parede, da verga ou da moldura.

## 31/10/2026 · 2ª rodada de correções do 1º andar

- Administrativo, na ordem de quem entra: sala de projetos, área de reuniões e sala de Dagliê e Danimara. Ampliado para 13 m de frente (adaptação de circulação, como no Lab).
- Nenhuma sala fica isolada por parede inventada. As salas documentadas têm portas que abrem.
- Escadas de emergência sem foto interna: a porta abre para uma antecâmara curta, fechada por uma segunda porta corta-fogo. Os lances não foram modelados.
- A colisão das portas acompanha o estado da folha.

## 31/10/2026 · Pulo, mureta, portas de vidro e duas salas

- O pulo usa a mesma colisão horizontal e o mesmo piso por pavimento. Não existe movimento vertical paralelo; a altura é moderada (cerca de 0,42 m) e não há pulo duplo.
- Colisores de guarda-corpo saem da geometria visível, nunca de linhas soltas na planta.
- O vidro fixo nunca cobre o vão de uma porta que abre.
- Os interiores da sala de reuniões com servidor e do estúdio de podcast seguem a descrição do usuário. Os painéis de interação são demonstrativos e não têm especificações técnicas.

## 31/10/2026 · Ajustes finos do 1º andar

- Paredes compartilhadas por ambientes com acabamentos diferentes têm espessura. Elementos de parede (painéis acústicos) nunca encostam no plano da parede.
- O vão de uma porta só contém a folha: montantes, trilhos e vidros fixos são cortados nele.
- A largura do estúdio de podcast foi reduzida para 3,8 m, conforme o usuário; o espaço liberado ficou com a sala de reuniões com servidor.


## 31/10/2026 · Modo VR (WebXR), etapa 1: sessão e câmera

- **Mesma r149, sem addons.** O `VRButton`, o `XRControllerModelFactory` e o `HTMLMesh` da r149 só existem como ES module (misturar com o UMD criaria dois THREE). O botão é próprio; os controles serão os braços de gelatina; os painéis em mundo serão canvas próprios. O `XRControllerModelFactory` também baixaria modelos de um CDN em tempo de execução.
- **Escala 1:1 (decisão do usuário, opção A).** Olhos na altura real; o corpo do boneco em VR será escalado para a altura de quem joga (etapa 3) e o colisor continua o derivado do corpo. Portas (2,10 m), escada (espelho 17,5 cm, piso 30 cm, 1,25 m de largura), mesas (0,72–0,75 m) e balcões (~1,0 m) já estão em medida real. Pontos a decidir no aparelho: NPCs continuam com 1,30 m; o tronco escalado (~1,6×) fica mais largo que o colisor.
- **Laço:** `renderer.setAnimationLoop` no lugar de `requestAnimationFrame`. No desktop é o mesmo laço; numa sessão o three usa o da sessão. Em VR o desenho nunca para (imagem congelada no headset enjoa).
- **Reference space:** a r149 pede um tipo só no `setSession` e falha se não existir; o tipo é escolhido antes (local-floor → bounded-floor → local). Em `local` o rig sobe 1,6 m de olhos estimados.
- **Rig:** a câmera é filha de `xr-rig`; o three escreve a pose da cabeça em `camera.position/quaternion` relativa ao rig. Movimento e giro mexem só no rig.
- **Colisão pela cabeça real:** o ponto da cabeça passa por `alturaPiso` e `colisao.resolver` com o raio do corpo, como o boneco no desktop; o rig recua o que foi recusado. Andar fisicamente sobe a escada e não atravessa paredes, vidros nem guarda-corpos. `y` continua persistido.
- **DOM em VR:** o Quest não tem DOM overlay em sessão imersiva; `body.em-vr` esconde HUD, bolha, painel e elevador. A UI será recriada em mundo (etapas 5–6).
- **Medidor:** painel preso à vista com fps, tempo de quadro, CPU, draw calls, framebuffer e foveação, para medir cedo o custo real no Quest (a r149 não tem multiview: cada draw call é feita duas vezes).
- **Testes:** o `iwer` (Meta) entra só como devDependency (`npm run teste:vr`); nada dele vai para o site.

## 02/11/2026 · VR: saída pelo B, modo teste mais fácil e prioridade para andar e interagir

- **Prioridade:** a otimização do Hall está estacionada. As medições do Quest mostraram que zonas + distância ajudam (+7 a +16 fps nas piores vistas), mas nenhuma chega a 72. O foco agora é andar e interagir; as pendências de desempenho estão registradas em `continuidade/VR-WEBXR.md`.
- **Sair do VR segurando B por 1,5 s**, com anel de progresso e vibração. Os dois grips não saem mais.
  - B curto (soltar antes de 0,5 s) mantém a função aprovada: fechar, levantar, provador.
  - Soltar entre 0,5 e 1,5 s não faz nada, para que desistir de sair nunca dispare a ação curta.
- **Modo teste (só com `?vr-teste`):**
  - bipes: 1 no fim do aquecimento, 2 no fim da volta, 3 no fim da bateria;
  - giro automático de 12°/s em torno da cabeça, para que todos os testes tenham o mesmo padrão;
  - baterias por ambiente, já que o framebuffer só muda ao entrar na sessão.
  - O formato das medições não mudou: os registros e o endpoint são os mesmos, e o `inicio` só ganhou os campos `giroAuto` e `bateria`.
- **Pontos, variações e baterias num lugar só** (`src/xr/pontos.js`). A página `/t` lê de lá.

## 02/11/2026 · VR: locomoção (etapas 2a–2d)

- **Movimento pelo rig, colisão pela cabeça.** Andar, teleporte e giro só movem o rig. A colisão da cabeça, a mesma do andar físico e do desktop (colisor do corpo, filtrado pela cota; `alturaPiso` com `null` no vazio), decide o que vale. Não há física paralela.
- **Padrões:**
  - andar suave a 1,5 m/s e correr a 2,5 m/s (clique do stick esquerdo enquanto empurra);
  - giro por passos de 30° em torno da cabeça;
  - vinheta fraca;
  - em pé;
  - pulo ligado.
  - Atalhos temporários: Y (suave/teleporte) e clique do stick direito (passos/suave), salvos em `orvalho-vr`; nada é salvo no modo teste.
- **Teleporte conservador:** o arco não atravessa parede, vidro, guarda-corpo, pilar nem porta fechada, e só pousa até 1 m acima ou abaixo da cota atual. Não se troca de andar pelo vão; a escada se sobe em pulos.
- **Pulo:** o topo da cabeça fica limitado a 2,10 m acima do piso (altura das portas), porque a colisão é só em x/z. É a regra simples para não atravessar vergas.
- **Framebuffer ×1,2 em qualquer ambiente no jogo normal**; o automático por ambiente fica só no modo teste.
- **Quadros lentos:** registrados com os eventos do instrumento antes de mexer nele. A decisão sai da bateria Lab com o passo `lab-mudo`.

## 02/11/2026 · VR: instrumento leve, zonas por geometria, escada no teleporte, mãos e raio

- **Instrumento:** o medidor e o painel de log redesenham pouco (1×/s e só se algo mudou; o log só com mensagem nova ou a cada 5 s), em canvas de 75% e sem mipmaps. O POST sai do quadro. Na bateria Lab do Quest, sem os dois painéis, os quadros > 25 ms foram de 4–6/min para 0.
- **Zonas por geometria, não por regra manual.** A tabela `ve` do Hall é gerada por `testes/visibilidade-zonas-vr.js` (item buffer na GPU). Zona com menos de 30% dos itens vistos entra só com esses itens (visibilidade parcial). Subzonas do mesmo `grupo` (café e resto do térreo) não se cortam pela distância. Refazer a análise a cada mudança de planta.
- **Escada no teleporte:** o alvo gruda nas paradas (pé, patamar, topo). Sobe e desce em 2 teleportes. É a única exceção ao limite de 1 m de desnível.
- **Mãos = braços do próprio boneco** (mesma geometria e materiais, em tamanho de mão de 0,30 m), sem modelos de controle. O laser sai da ponta.
- **Alvos maiores que o visual** (tolerância angular), alcance de 4,5 m, nunca através de parede ou vidro.
- **Sentar em VR:** trava a posição (rig fixo, sem colisão). Na postura "em pé", baixa a vista até 0,72 m acima do assento; na postura "sentado", só trava. Levanta com B curto ou com o stick.
- **Troca de ambiente em VR** sem sair da sessão (`O.jogo.vr.irPara`). Hoje só existe a ligação Lab → Hall.
- **Mesas da Incubadora que somem:** medidas, não aplicadas. A recomendação é compartilhar os materiais da estrutura e depois aumentar a distância só para o térreo visto do 1º andar.
