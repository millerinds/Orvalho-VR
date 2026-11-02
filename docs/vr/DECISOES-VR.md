# Decisões do modo VR e o porquê

## Base técnica
- **WebXR padrão (`immersive-vr`), alvo Meta Quest 3S**, mas sem nada exclusivo do Quest. Sem suporte a WebXR, os botões de VR nem aparecem e o site segue igual.
- **Mesma three.js r149, sem addons.**
  - Na r149, `VRButton`, `XRControllerModelFactory` e `HTMLMesh` só existem como ES module. Misturar com o build UMD do projeto criaria dois THREE.
  - Por isso o botão de entrar, as mãos e os painéis são próprios.
  - Os modelos de controle também baixariam arquivos de um CDN em tempo de execução.
- **Laço:** `renderer.setAnimationLoop` no lugar de `requestAnimationFrame`. No desktop é o mesmo laço; numa sessão, o three usa o laço da sessão. Em VR o desenho nunca para, porque imagem congelada no headset enjoa.
- **Reference space:** a r149 pede um tipo só no `setSession`, então o tipo é escolhido antes, na ordem `local-floor` → `bounded-floor` → `local`. Em `local`, o rig sobe uma altura de olhos estimada (1,6 m).
- **Sem DOM em VR:** o Quest não tem DOM overlay. `body.em-vr` esconde HUD e painéis; tudo em VR é desenhado em canvas e preso à vista ou ao mundo.

## Escala e corpo
- **Escala 1:1 (opção "A").** Mundo e olhos em tamanho real. O boneco do jogador continua com 1,30 m no desktop; em VR ele fica oculto, e o corpo visível (tronco, etapa 3b) será escalado para a altura de quem joga.
  - **Pendente:** a largura do tronco escalado (~1,6×) em relação ao colisor.
- **O colisor continua o derivado do corpo** escolhido no provador (Jujuba 0,33 m, Gota 0,37, Esguio 0,26).
- **Colisão pela cabeça real:** o ponto da cabeça passa pela mesma `alturaPiso` e pelo mesmo `colisao.resolver` do desktop, e o rig recua o que foi recusado. Andar fisicamente sobe a escada e não atravessa parede, vidro nem guarda-corpo.
- **Mãos = os braços de gelatina do próprio boneco** (mesma geometria e materiais: cor e tipo de braço do provador), em tamanho de mão (0,30 m). O laser sai da ponta.
- **Cabeça do jogador oculta em VR, de propósito.** Os acessórios de cabeça não aparecem; os de corpo esperam o tronco (3b).

## Desempenho
- **72 Hz** pedido por padrão (`?vr-hz`). O Quest aceita 72/80/90/120.
- **Framebuffer ×1,2 em qualquer ambiente no jogo normal.** O valor só muda ao entrar na sessão, e o Hall é o caso crítico. No modo teste, o automático é por ambiente (Lab ×1,5, Hall ×1,2). Teto ×1,5: o Quest não passa disso.
- **Foveação 1** (máxima): no Lab ela recuperou ~16 fps com framebuffer ×1,5.
- **Otimizações só em VR**, desfeitas ao sair: vidros numa passada, contornos até 10 m, zonas de visibilidade e distância de 25 m para móveis de outras zonas. As células com recorte valem também no desktop, e a imagem não muda.
- **Zonas calculadas por geometria**, com visibilidade parcial. Veja `GUIA-DE-MODELAGEM-E-OTIMIZACAO.md`.
- **Sem LOD de triângulos**, porque o limite medido são draws.
- **Instrumento leve:** o medidor e o painel de log redesenham pouco e o POST das medições sai do quadro, porque eles mesmos causavam quadros de 25 ms.

## Controles (mapeamento aprovado, Quest Touch)

| Botão | Ação |
|---|---|
| Gatilho | Selecionar com o laser daquela mão (sentar, ir para outro ambiente; equipamentos, pessoas e elevador mostram um aviso até os painéis existirem) |
| A | Pular (só do chão). No modo teste, A é a marca |
| B curto (soltar antes de 0,5 s) | Fechar o que estiver aberto ou levantar; com nada aberto, abriria o provador (ainda não existe em VR) |
| B segurado 1,5 s | **Sair do VR.** Um anel enche a partir de 0,25 s e o controle vibra ao completar. Soltar entre 0,5 e 1,5 s não faz nada |
| Y | Abriria as Opções (etapa 6). **Hoje:** alterna andar suave / teleporte |
| X | Fechar (Esc) no mapeamento final. **Hoje:** alterna a vinheta desligada → fraca → forte |
| Clique do stick esquerdo | Correr enquanto empurra; ao soltar o stick, para de correr |
| Stick esquerdo | Andar suave ou teleporte |
| Stick direito | Giro por passos (15/30/45/90°, padrão 30°) ou suave |
| Clique do stick direito | **Hoje:** alterna giro por passos / suave |
| Grip | Girar o boneco no palco do provador (quando o provador existir em VR) |
| Botão Meta segurado | Recentralizar (do sistema) |

- Sair era antes "os dois grips por 1,5 s". Foi trocado por **B segurado**, que é mais fácil e não se confunde com a empunhadura.
- Os atalhos Y, X e o clique do stick direito são **temporários** até o painel de opções existir. As escolhas ficam salvas em `localStorage` (`orvalho-vr`). No modo teste, nada é salvo.

## Locomoção
- **Padrões:** andar suave a 1,5 m/s, correr a 2,5 m/s, giro por passos de 30°, vinheta fraca, em pé, pulo ligado. Todos ajustáveis pela URL (veja `COMO-TESTAR-NO-QUEST.md`).
- **Movimento pelo rig, colisão pela cabeça:** andar, teleporte e giro só movem o rig. Não há física paralela à do desktop.
- **Andar na direção da cabeça** (não do controle).
- **Giro sempre em torno da cabeça:** a pessoa não sai do lugar.
- **Vinheta preta** na periferia ao andar, no giro suave e no pulo. No giro por passos e parado, não existe (custo zero). Desligável com X ou `?vr-vinheta=0`.
- **Pulo real** (a vista sobe), só do chão, ~0,42 m. O topo da cabeça não passa do forro nem de 2,10 m acima do piso (a altura das portas), porque a colisão é só em x/z. Vinheta durante o salto; `?vr-pulo=0` desliga.
- **Teleporte:** empurrar o stick para a frente mostra o arco e soltar teleporta. Verde = válido, coral = inválido.
  - **Válido:** chão a até 1 m de desnível, com o corpo cabendo, sem parede, vidro, guarda-corpo, pilar ou porta fechada no caminho do arco. Não se muda de andar pelo vão.
  - **Na escada**, o alvo gruda nas paradas (pé, patamar, topo). Sobe e desce em 2 teleportes.
  - Véu preto curto na chegada.
- **Postura "sentado":** a vista sobe até 1,60 m acima do piso, medindo a cabeça ao entrar e a cada recentralização.

## Interação
- **O alvo clicável é maior que o visual:** tolerância angular (até `atan(R / d)`, mínimo de 3°) e alcance de 4,5 m, só no andar atual, nunca através de parede ou vidro.
- **Sentar:** véu, cabeça no assento olhando para a frente, posição travada (sem colisão, como o boneco sentado no desktop). Na postura "em pé", a vista baixa até 0,72 m acima do assento; na postura "sentado", **só trava a posição**. Levanta com B curto ou empurrando o stick esquerdo.
- **Troca de ambiente sem sair do VR:** véu escuro, monta o outro ambiente e compila os shaders de uma vez.

## Testes e ferramentas
- **IWER** (emulador da Meta) só como devDependency, na versão exata 2.7.0. Nada dele vai para o site.
- **Página `/t` e endpoint de medições só no servidor HTTPS de desenvolvimento** (`npm run servir:https`), nunca no site publicado nem no servidor HTTP.
- Certificados e medições brutas nunca vão para o Git.
- A cada etapa, rodam os testes `vr` (que inclui a locomoção e a interação), `lab` e `avatar`. O Hall completo, no fim da fase (ele é lento).
