# Arquitetura técnica

## Execução

O projeto é uma aplicação estática sem bundler. `index.html` carrega three.js r149 e scripts clássicos que registram APIs em `window.Orvalho`. Funciona por `file://`; para desenvolvimento e testes, prefira um servidor HTTP local.

## Camadas

- `src/orvalho.js`: namespace e registro de ambientes.
- `src/boneco/`: paleta, material gelatina, modelo, animações e vitrines do Avatar Kit.
- `src/ui/provador.js`: personalização e persistência `orvalho-avatar-*`.
- `src/mundo/formas.js`: geometrias, texturas em canvas e artes de portas/placas.
- `src/mundo/moveis.js` e `ambientes/hall-inovale/moveis-hall.js`: catálogo de tipos, peças e colisores.
- `src/mundo/sala.js`: transforma a planta em cena, colisão, pisos, mezanino, anexos, escadas e limites de câmera.
- `src/mundo/colisao.js`: caixas, círculos e segmentos em x/z, cada qual opcionalmente associado a uma faixa de altura.
- `src/mundo/jogo.js`: estado do jogador, teclado, mudança de ambiente, assentos e persistência.
- `src/mundo/camera.js`: câmera em terceira pessoa com recuo contra obstáculos e teto variável.
- `src/mundo/interacao.js`: foco, bolha de interação e painel.
- `ambientes/<id>/`: planta e conteúdo de cada ambiente.

## Sistema de níveis

O jogador guarda `{x, y, z}`. `y` é a cota do piso, não a animação interna do boneco.

1. `jogo.js` calcula a tentativa de movimento em x/z.
2. `amb.alturaPiso(x, z, yAtual)` devolve 0, a rampa da escada, 4,2 ou `null` se não houver piso naquela altura.
3. A colisão é resolvida usando a cota retornada; colisores fora daquela faixa não interferem.
4. O `root` do boneco acompanha suavemente a cota.
5. A câmera soma sua altura ao piso atual e consulta `tetoEm(x,z,y)`.
6. O autosave registra `y`; saves antigos sem `y` continuam no térreo.

No Hall, `niveis.superior` define todo o piso acessível do primeiro andar e seus segmentos sólidos. A escada usa 24 degraus visuais sobre uma rampa de navegação suave; isso evita prender o colisor circular em cada espelho. Móveis com `nivel: 'superior'` recebem colisores filtrados por altura.

## Guarda-corpos e prevenção de quedas

O guarda-corpo visual é derivado das bordas do mezanino. A abertura da escada é declarada em `mezaninos[].aberturas`. Os segmentos de colisão do primeiro andar ficam em `niveis.superior.segmentos`. Além da barreira, `alturaPiso` retorna `null` fora da área superior, impedindo a entrada no vazio.

## Anexos

`anexos` estende o espaço navegável além do retângulo principal. Cada anexo cria piso, forro, paredes, portas fechadas e, opcionalmente, vidro no fundo. No térreo ele modela separadamente os banheiros e o acesso às salas à esquerda da Nexo.

`src/mundo/npcs.js` instancia pessoas com o mesmo kit de corpo, olhos, cores e acessórios do avatar. `src/mundo/elevador.js` controla a cabine e delega a mudança de cota ao jogo, sem descarregar a cena nem trocar de ambiente. `src/mundo/interacao.js` filtra marcadores pelo pavimento atual.

## Movimento vertical e pulo

`st.y` é a cota do piso, vinda de `alturaPiso`. `st.jy` é a altura do pulo acima dele e `st.vy`, a velocidade vertical. O `root` fica em `st.y + st.jy`.

- **Início:** o pulo só começa do chão (fase 0) e fora de transição de piso, painel, assento ou elevador.
- **Ar:** a gravidade age e o teto vem de `limites.tetoEm`, incluindo forros de sala com `teto: true`. A colisão continua em x/z na faixa do pavimento.
- **Save:** só `st.y` é salvo, nunca `jy`.
- **Gelatina:** a deformação é feita só na escala do `root` (mola amortecida), sem tocar no kit.
- **Câmera:** recebe `y = st.y + 0,45 × jy`.

## Recursos da planta usados no 1º andar

- **Paredes do hall:**
  - `altura` faz a parede terminar antes do forro (a parede do palco vai só até a laje da ala leste);
  - `soTerreo` limita a colisão ao térreo.
- **`paineis`:**
  - tipos `parede` (com `textura: 'madeira'`), `escuro` (vidro fumê opaco) e `janelas` (peitoril, faixa de vidro com caixilho e persianas de rolo em alturas variadas);
  - painéis de vidro aceitam `persianas`, faixas parciais (`de`/`ate`) e portas marcadas como `'vao'` (marco sem puxador, para portas que abrem).
- **`forros`:** forros fora do retângulo do hall (faixa z 15–20, ala leste e nichos dos banheiros).
- **Guarda-corpo do mezanino:** a colisão é gerada da geometria (face do tampo voltada para o piso e tampões nas pontas), no pavimento da laje.
- **Painel `parede` com `esp`:** é uma caixa com espessura, para paredes compartilhadas em que cada face pertence a um ambiente.
- **Painéis com portas:** os montantes não caem no vão e as travessas abaixo da altura da porta são cortadas.
- **Pivô das portas:** tem `userData.porta`, usado pelos testes para separar a folha do resto da geometria.
- **Painéis com portas (recorte):** o vidro e as faixas são recortados no vão. A folha de vidro (caixilho, dobradiças e puxador) gira inteira no pivô.
- **`leds`:** pequenas luzes MeshBasic; `pulso` (s) anima o brilho.
- **`forros` com `teto: true`:** limitam a câmera e o pulo.
- **Colisão das portas:** acompanha o estado. Fechadas, o vão é sólido; abertas, colide a folha encostada (`colisao.segmento` devolve o segmento e `off` o desliga).
- **Estado das portas:** `amb.portas()` informa o estado; `amb.comPortasAbertas(fn)` serve ao planejador dos testes.
- **`portasAnimadas`:**
  - `a` é a dobradiça e `b` a ponta da folha; a folha gira para o lado esquerdo de a→b, ou o direito com `abre: 'direita'`;
  - abrem a menos de 1,7 m do boneco, no mesmo pavimento;
  - o vão é sempre passável, e a posição aberta tem um segmento de colisão fixo;
  - `amb.atualizar(t, camPos, jogador)` recebe o jogador para isso.
- **`elevador`:**
  - `O.elevador.criar3D` monta folhas e cabine em cada parada; `amb.elevador.porta(piso, aberta)` anima as folhas;
  - o vão do térreo usa `animado: true` para não desenhar a folha fixa;
  - `jogo.abrirElevador` não para mais o loop: só trava o controle (`travado`), para as portas aparecerem abrindo e fechando.
- **Interativos de pessoas:**
  - `npc` e `alvo: [x, y, z]`: (x, z) é o ponto de atendimento, usado no alcance; `alvo` é a cabeça da pessoa, usada para a frente, a bolha e o olhar;
  - ao abrir, `jogo` vira o boneco para a pessoa e usa `cameraConversa`, que respeita paredes com `colisao.raio`; ao fechar, `cam3.continuarDe` retoma sem salto;
  - o painel ganha a classe `conversa` (diálogo na base da tela).
- **Anexos com `y`:**
  - criam nichos ou corredores num pavimento superior, sem piso próprio (a laje já existe) e com paredes que colidem só naquele pavimento;
  - as portas podem ficar no fundo (`lado: 'fundo'`, de/ate em x);
  - anexos do térreo colidem só no térreo.
- **Sombras:** móveis com `nivel: 'superior'` apoiados no piso do 1º andar também recebem sombra.
- **Câmera:** os limites incluem as áreas do 1º andar, por isso a câmera não é travada em x = 44 na ala leste.

## Descarte e desempenho

Geometrias, materiais e texturas criados por um ambiente são guardados e descartados na troca. Móveis repetidos usam `InstancedMesh`; peças compatíveis são mescladas. Não há sombras em tempo real nem pós-processamento.

As instâncias de cada tipo de móvel são divididas em **células de 8 m por pavimento** (`celulas`, `involucro` e `esferaDasInstancias` em `sala.js`). Cada célula é uma `InstancedMesh` com geometria-invólucro: os atributos e o índice são compartilhados, mas a `boundingSphere` é das instâncias da célula. Assim o recorte pela câmera funciona. **A r149 cria toda `InstancedMesh` com `frustumCulled = false`**, por isso o valor é ligado explicitamente na célula e no contorno. `O.config.celulaMoveis` troca o lado da célula (medições).

Em VR, `amb.modoVR(true)` põe os vidros transparentes de dupla face em uma passada (`forceSinglePass`). A cada quadro, `amb.visibilidadeVR(cabeça, { contorno, zonas, dist })` (chamada por `sessao.js` antes do `renderer.render`) esconde os contornos das células distantes e, no Hall, aplica as **zonas de visibilidade** (`def.zonasVR`): cada célula de móveis pertence a uma zona (a chave da célula inclui a zona), assim como as portas que abrem (zonas dos dois lados), os marcadores (`it._mesh`) e as pessoas (`userData.npc`). Some o que está em zona que não se vê da zona da cabeça, e os blocos de móveis de outras zonas além de `dist` m. Zona com `todas: true` (a escada) mostra tudo e sem limite de distância; `piso: null` vale nos dois pavimentos. Zonas com o mesmo `grupo` (o café e o resto do térreo) se veem sempre e contam como a zona da cabeça para a distância. Em `ve`, `{ zona, em: [[x0, z0, x1, z1], …] }` é visibilidade parcial: só os blocos de móveis, pessoas e marcadores daquela zona com centro nos retângulos (as portas aparecem se a zona aparece de algum jeito). A tabela do Hall é gerada por `testes/visibilidade-zonas-vr.js` (02/11). Piso, paredes e vidros nunca somem. `modoVR(false)` desfaz tudo. `contornosAte` continua existindo como atalho.

`amb.paradasEscada(x, z)` devolve o pé, os patamares e o topo da escada navegável sob (x, z), com a cota (teleporte do VR).

As peças de alumínio de cada porta que abre (caixilho, dobradiças, puxador) são uma malha só (`porta-ferragem`), filha do pivô.

## Compatibilidade a preservar

- three.js deve permanecer na r149 enquanto os shaders atuais forem usados.
- O mundo mexe no `player.root`; animações do avatar mexem no grupo interno.
- O Lab não declara níveis, então mantém o comportamento de piso único.
- Não introduzir bundler ou módulos sem rever o suporte a `file://` e a CSP futura.
