# Guia de modelagem e otimização para VR

Regras para modelar o resto do prédio (outros andares, salas, áreas externas) sem estourar o Meta Quest 3S. Tudo aqui vem do que foi medido no aparelho com o Hall e o Lab. Os números de referência estão em `MEDICOES-RESUMO.md`.

## 1. O que limita o Quest neste projeto

- **O limite são as chamadas de desenho (draws), não os pixels.** No pior ponto do Hall, o framebuffer ×1,0 e o ×1,2 deram o mesmo fps. O tempo de CPU para enviar o desenho cresce cerca de **1 ms a cada 100 draws** (dois olhos).
- **A three.js r149 não tem multiview.** Cada draw é feito duas vezes, uma por olho. Todas as contagens deste guia são dos dois olhos.
- O navegador do Quest **não informa o tempo de GPU** (não expõe `EXT_disjoint_timer_query_webgl2`). A única medida confiável é fps × draws.
- No Lab (pequeno), o limite foi a GPU. Ali o framebuffer ×1,5 só ficou viável com foveação 1 (a foveação 0 dava 48–55 fps).

### Orçamento (72 Hz, framebuffer ×1,2, foveação 1)

Relação medida no Quest entre draws (dois olhos) e fps:

| Draws na vista | fps típico |
|---|---|
| até ~200 | 72 (sem quedas) |
| 400–600 | 60–68 |
| 750–950 | 51–57 |
| acima de 1.000 | 41–47 |

**Regra prática para um ambiente novo:**
- mire em **até ~500 draws na pior direção** de cada ponto onde se fica parado, e em **até ~1,2 M triângulos**;
- acima de ~800 draws já se sente queda; acima de ~1.000, o fps fica abaixo de 50.

Referência: o Lab tem ~160 draws e ~300–400 K triângulos, e roda a 71–72 fps com framebuffer ×1,5.

## 2. Regras de modelagem (o que já funciona e deve ser seguido)

1. **Instanciar tudo o que se repete.** Cada tipo de móvel vira uma `InstancedMesh` por peça (`sala.js`). Nunca criar uma `Mesh` por cadeira.
2. **Dividir as instâncias em células com recorte.**
   - As instâncias de cada tipo são divididas em células de 8 m por pavimento e por zona.
   - Cada célula tem uma geometria-invólucro (atributos compartilhados) com a `boundingSphere` das próprias instâncias.
   - **Atenção:** a r149 cria toda `InstancedMesh` com `frustumCulled = false`. O código liga o recorte de propósito, e qualquer `InstancedMesh` nova precisa da mesma coisa.
   - Células menores (6 m) dão menos triângulos e mais draws; maiores (10 m), o contrário. 8 m foi o equilíbrio (`O.config.celulaMoveis` muda para medir).
3. **Contornos (casca escura) só perto.** Em VR, o contorno dos móveis só é desenhado até 10 m da cabeça (`?vr-contorno`). Longe, ele quase não se vê e custa um draw por célula.
4. **Vidros de dupla face numa passada só.** Em VR, `forceSinglePass` nos materiais transparentes `DoubleSide` corta pela metade os draws dos vidros.
5. **Peças pequenas da mesma coisa viram uma malha só.** Exemplo: caixilho, dobradiças e puxador de cada porta que abre viraram uma malha (`porta-ferragem`), o que reduziu os draws das portas de 176 para 68 no ACIOC. A folha continua separada porque gira.
6. **Mesclar malhas estáticas do mesmo material.** O `sala.js` já mescla as peças avulsas por material no fim da montagem. Isso só funciona se as peças **compartilharem o mesmo objeto de material**. Ver "não aplicado" abaixo.
7. **Zonas de visibilidade calculadas por geometria, não por regra manual** (seção 3).
8. **Distância máxima para móveis de outras zonas** (`?vr-dist`, padrão 25 m). Não vale para a zona em que a cabeça está, nem para zonas do mesmo grupo.
9. **Piso, paredes e vidros nunca somem.** Só móveis, portas, marcadores e pessoas entram nas zonas e na distância. Assim não há buracos na arquitetura.

## 3. Zonas de visibilidade (como fazer para um ambiente novo)

As zonas ficam em `zonasVR`, na planta do ambiente (veja `ambientes/hall-inovale/hall-inovale.js`). O motor está em `src/mundo/sala.js` (`visibilidadeVR`).

1. **Defina as zonas** como retângulos por pavimento: `{ id, piso: 0 | 1 | null, r: [[x0, z0, x1, z1], …] }`.
   - Use `grupo` para partes de um mesmo espaço aberto (no Hall, `cafe` e `hall` estão no grupo `terreo`). Zonas do mesmo grupo se veem sempre e não se cortam pela distância.
   - Use `todas: true` para lugares que veem tudo e mudam de pavimento (a escada).
   - A ordem importa: vale a primeira zona que contém o ponto.
2. **Calcule a tabela `ve` com a ferramenta:** `GPU=1 node testes/visibilidade-zonas-vr.js`.
   - Ela amostra posições caminháveis de cada zona (grade de 1 m; `PASSO_HALL` para zonas grandes), com a cabeça a 1,3 e 1,9 m.
   - De cada posição, renderiza as 6 direções de um cubo com um "item buffer": cada bloco de móveis, pessoa e marcador numa cor própria; estrutura opaca em preto (oclui); vidros ocultos (não ocluem); portas ocultas (contadas como abertas, o caso conservador).
   - Antes de começar, uma calibração confere que as cores-id voltam intactas.
   - Ela imprime o que cada zona vê e a **tabela `ve` sugerida**, para colar na planta.
3. **Visibilidade parcial.** Quando menos de 30% dos itens de uma zona são vistos (`INTEIRA=0.3`), a sugestão lista só esses itens: `{ zona: 'salas', em: [[x0, z0, x1, z1], …] }`, um retângulo de ±0,75 m em volta de cada bloco. Isso evita desenhar uma sala inteira por causa de um painel visto de raspão pelo vidro.
   - **Exemplo real:** do térreo se vê um painel acústico das salas do 1º andar pelo vidro. A zona inteira custava +100 a +270 draws no térreo; a parcial, quase nada.
   - Portas de uma zona parcial continuam aparecendo, porque a ferramenta não as analisa.
4. **Refaça a análise sempre que a planta mudar.** Os retângulos da visibilidade parcial dependem da posição dos blocos.
5. **Confira os "pulos":** `DIST=25 GPU=1 node testes/pulos-zonas-vr.js` mostra o que aparece ou some ao atravessar cada porta e passagem.

**Armadilhas encontradas ao escrever a ferramenta** (para quem for alterá-la):
- o material preto de oclusão precisa ter o mesmo `side` do material original, senão paredes de dupla face ficam transparentes vistas por trás;
- é preciso desligar o `instanceColor`, que multiplica a cor-id;
- é preciso chamar `amb.modoVR(false)` **antes** da troca de materiais, porque ele torna as cascas de contorno visíveis de novo;
- é preciso gravar a cor-id direto em `color.r/g/b`, porque `setHex` e `setRGB` passam pela conversão sRGB → linear.

## 4. Cuidados de projeto

- **Vistas abertas através de vidro são o pior caso.** No Hall, as piores vistas são do 1º andar olhando o térreo pelo vidro (ACIOC → corredor, Incubadora → Hall, patamar da escada). Elas veem o salão quase inteiro. Para um andar novo com fachada de vidro voltada para um vão, conte com isso:
  - menos móveis distintos na área vista;
  - ou paredes e divisórias opacas onde a arquitetura permitir;
  - ou aceite o limite de distância.
- **Paredes opacas são as melhores amigas das zonas.** Da Incubadora, que tem vidro para todos os lados, as zonas não reduzem nada.
- **Um ambiente por vez.** Lab e Hall são ambientes separados: trocar descarta o anterior. O Hall inteiro (térreo e 1º andar) fica carregado ao mesmo tempo.
  - **Para outros andares, carregue por andar** (ou por bloco), em vez de um prédio único. Em VR, a troca de ambiente já funciona dentro da sessão (`O.jogo.vr.irPara`), com a vista escura (~2 s medidos no Quest, do Lab para o Hall).
- **Pessoas (NPCs) são caras:** ~43 draws cada (corpo, cabeça, olhos e acessórios em gelatina, com contorno). Ponha pessoas onde elas fazem sentido e deixe que as zonas as escondam.
- **Estrutura com material próprio por peça** é hoje o maior bloco de draws que sobrou (~300 draws nas vistas largas do Hall), porque cada `std()` cria um material novo e a mescla não junta nada. Num ambiente novo, **reutilize o mesmo objeto de material** para pisos, paredes e molduras iguais desde o começo.

## 5. O que foi estimado ou tentado e NÃO foi aplicado

| Ideia | Situação | Números |
|---|---|---|
| **Compartilhar materiais iguais da estrutura** (para a mescla juntar as malhas) | estimado, não aplicado | ACIOC 135°: estrutura + vidros de 434 → ~278 draws; Incubadora 315°: 394 → ~258; café 0°: 282 → ~190. É a maior economia que sobrou. |
| **LOD dos móveis** (menos segmentos ao longe) | não aplicado, a pedido | Só reduz triângulos (o limite são draws). Os tipos mais pesados (bancada do ACIOC, cadeira da plateia, mesa das empresas, ilha do ACIOC, mesa do café) têm 110–145 K triângulos cada no Hall inteiro. |
| **Recorte por sala (portais)** | não aplicado | Exige definir portais na planta. Na prática, as zonas por geometria fazem parte do serviço. |
| **Distância maior para o térreo visto do 1º andar** (as mesas somem ao olhar o Hall da Incubadora) | medido, decisão pendente | Incubadora 315°: 946 draws com 25 m, 1.112 com 40 m, 1.208 sem limite. A recomendação é compartilhar os materiais primeiro e depois liberar a distância só para o térreo visto do 1º andar. |
| **"Gelatina leve"** (material mais barato longe) | não tentado | Só se a GPU virar o limite. |

## 6. Como medir um ambiente novo

1. **No PC:** `PONTOS=<ids> VARRER=1 GPU=1 npm run medir:vr` dá draws e triângulos por categoria (móveis, portas, vidros, pinos, contornos, estrutura, outros), por zona, nas 8 direções. Os números de draws do emulador batem com o Quest (±5%). O fps do emulador não vale.
2. **Pontos novos:** acrescente em `src/xr/pontos.js` (`LISTA`). A página `/t` passa a ter o botão sozinha.
3. **No Quest:** rode a bateria do ambiente na página `/t` (veja `COMO-TESTAR-NO-QUEST.md`) e leia com `npm run medicoes:vr`.
4. **Compare com o orçamento** da seção 1. Se uma direção passar de ~800 draws:
   - zonas e distância primeiro;
   - depois juntar materiais;
   - por último, mexer no conteúdo.
