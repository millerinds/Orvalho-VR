# Estado e pendências do modo VR

Situação: **prova de conceito fechada.** Locomoção, laser, sentar e troca Lab → Hall foram aprovados no Quest 3S. O desempenho do Hall ficou estacionado de propósito; tudo o que falta está listado abaixo.

## Feito, por etapa

| Etapa | Situação | Testado no Quest |
|---|---|---|
| 1. Sessão e câmera (entrada, reference space, rig, colisão pela cabeça, 72 Hz, framebuffer, foveação, medidor, log, sair com B segurado) | feita | sim |
| Ferramentas de medição (página `/t`, modo teste, bipes, giro automático, baterias, `medicoes:vr`, `medir:vr`, visibilidade por geometria) | feitas | sim (exceto as baterias Hall) |
| Otimizações do Hall (células com recorte, portas juntas, vidros numa passada, contornos até 10 m, zonas por geometria com visibilidade parcial, distância de 25 m) | feitas | sim, menos a tabela de zonas nova |
| 2a. Andar suave, correr, giro por passos e suave, vinheta | feita | sim |
| 2b. Pulo (A) | feita | sim |
| 2c. Teleporte (arco, validação, paradas na escada) | feita | o teleporte sim; as paradas da escada, não |
| 2d. Postura em pé ou sentado, recentralizar (do sistema) | feita | parcialmente |
| 3a. Mãos de gelatina nos controles | feita | sim |
| 4a. Laser, alvos, gatilho, sentar e levantar, troca Lab → Hall | feita | sim |
| Atalhos Y (suave/teleporte), X (vinheta) e clique do stick direito (giro) | feitos | Y e clique sim; o X é novo |
| 5b. Elevador em VR (09/11/2026): chamar, entrar, painel em mundo, viagem com véu, Lab ↔ Hall pelo elevador, 1º andar | feita (`src/xr/elevador.js`, `testes/vr-elevador.js`) | **não** (só no emulador) |

## Falta fazer
1. **Painéis em mundo (etapa 5).** É um kit de painel em canvas 2D com o visual Aero (borda grossa, sombra dura, brilho de gota), clicável pelo laser. Hoje equipamentos, pessoas e elevador só mostram um aviso ("… EM VR: NA ETAPA 5"). Ordem combinada:
   1. painéis dos equipamentos;
   2. ~~elevador~~: feito em 09/11/2026 (veja a tabela acima). O painel do elevador é próprio (`src/xr/elevador.js`); quando o kit de painel existir, vale migrar;
   3. diálogo com NPC (painel ao lado da pessoa, sem enquadrar a câmera);
   4. provador em VR: um 2º boneco num palco na cena principal (a vitrine usa outro `WebGLRenderer`, que não aparece no headset). O grip gira o boneco. As miniaturas SVG precisam das cores aplicadas no lugar de `var(--c1)`.
2. **Tronco e "ocultar corpo" (etapa 3b).** Ainda falta decidir:
   - a escala (~1,6× para a cabeça bater com os olhos) e a largura do tronco em relação ao colisor;
   - se a opção "ocultar corpo" vem ligada por padrão.
   - **Acessórios:** há 16 de cabeça (fone, orelhinhas, antenas, capacete, óculos escuros, florzinha, laço, tiara, cone, boné, exclamação, interrogação, auréola, gorro de Natal, chapéu de mago, monóculo), 2 de corpo (gravata, gravata borboleta) e nenhum de braço. Em VR, os de cabeça ficam ocultos **por desenho** (a cabeça não é desenhada); os de corpo **faltam fazer** (esperam o tronco). As mãos já recebem a cor e o tipo de braço do provador.
3. **Painel de opções (etapa 6)**, em `orvalho-vr`:
   - movimento, giro, vinheta, postura, altura dos olhos sentado, velocidades, pulo, mão dominante e ocultar corpo;
   - botões "Recentralizar" e "Sair do VR";
   - ele substitui os atalhos temporários (Y, X, clique do stick direito).
4. **Caminho Hall → Lab.** Em VR, ida e volta são pelo elevador ("Lab IA" no painel, sem pavimento). No desktop, só existe Lab → Hall (a porta do Lab). O Hall não tem caminho de volta ao Lab nem no desktop: a ligação pelo elevador foi removida, e o trajeto real até o Lab não foi documentado. Precisa de referência (planta ou fotos) antes de modelar.
5. **Desempenho (estacionado; veja `GUIA-DE-MODELAGEM-E-OTIMIZACAO.md`):**
   - compartilhar materiais iguais da estrutura (estimativa de −130 a −160 draws nas piores vistas);
   - decidir a distância do térreo visto do 1º andar (as mesas somem ao olhar o Hall da Incubadora; opções medidas em `MEDICOES-RESUMO.md`);
   - piores vistas atuais (Quest): escada 315° (48 fps), Incubadora 315° (51), ACIOC 135° (53);
   - LOD e recorte por sala: só se ainda faltar.
6. **Opções que existem só pela URL:** altura dos olhos sentado (fixa em 1,60 m), velocidade do giro suave e velocidades de andar.

## Falta testar
- **No Quest:**
  - o elevador inteiro: legibilidade do painel, tamanho dos botões com o laser real, conforto do véu na viagem e ao entrar/sair, se a parede direita é fácil de achar ao entrar na cabine;
  - a tabela de zonas nova (visibilidade parcial): confirmar que nada "pula";
  - as paradas da escada no teleporte (subir e descer);
  - o atalho X da vinheta e o véu preto;
  - a postura sentado numa cadeira de verdade;
  - as baterias Hall;
  - os pontos ainda não medidos (Hall · palco, 1º andar · vão, Administrativo, corredor da Incubadora);
  - a bateria Lab depois do alívio do instrumento (os passos `lab` e `lab-mudo` devem ficar parecidos);
  - a caminhada ACIOC → Incubadora → escada marcando com A os "pulos".
- **No PC:** a suíte completa rodou no fechamento (GPU, um teste por vez). Tudo passou, exceto a falha intermitente conhecida do Hall com o Esguio (abaixo). O Hall leva ~10 min por corpo.

## Bugs e falhas conhecidas
- **Falha intermitente no teste do Hall** (`testes/navegacao.js --ambiente=hall-inovale`). Já apareceu como:
  - "vidro do 1º andar permaneceu sólido fora da porta" (z ≈ 14,4);
  - "bolha NÃO apareceu" na porta do elevador.
  - **Pista para o vidro:** o teste anda a partir de x = 39, que fica dentro do vão da porta do estúdio de podcast (x 38,1–39,1). Se a porta abre a tempo, o corpo passa. A correção provável é mudar o ponto do teste para um trecho sem porta (x ≈ 35). Não foi feita.
  - A da bolha ainda não tem pista. Não repetir o teste até passar: investigar.
- **Detalhe menor:** indo do ACIOC para a Incubadora, às vezes "uma parte branca some". Provavelmente um bloco de móveis cortado pela zona ou pela distância. Revisar depois da tabela de zonas nova.
- O teste do Hall é lento: ~10 min por corpo com GPU, e muito mais por software.

## O que só se confirma no Quest
- Conforto: velocidades, vinheta, giro, pulo, véu e o abaixar da vista ao sentar.
- A posição e o tamanho das mãos (no emulador, o raio coincide com o controle; no Quest pode haver um ângulo entre a empunhadura e o raio) e a sensação da mira.
- Legibilidade do medidor, do rótulo do laser e dos avisos.
- fps: o emulador só dá draws e triângulos.
- Se o som dos bipes toca durante a sessão (a vibração avisa de qualquer jeito).
- Se o botão ☰ esquerdo chega ao WebXR (não está mapeado).
