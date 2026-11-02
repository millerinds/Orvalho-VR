# Estado atual do Orvalho

Data do handoff: 30/10/2026.

## Funciona

- Fluxo inicial, provador, Avatar Kit e persistência da aparência.
- Lab de IA navegável, com cinco interações e ligação provisória ao Hall.
- Hall navegável no térreo com os três corpos (Jujuba, Gota e Esguio).
- Cafeteria Pin na parede interna, na mesma linha do elevador e da escada de emergência.
- Nexo alinhada à parede interna e à passagem “Acesso às salas 1, 2 e 3”.
- Acesso às salas 1, 2 e 3 corrigido para a esquerda da Nexo, com maquete e fechamento envidraçado.
- Banheiros do térreo em corredor próprio, com portas em ambos os lados e PCD.
- Escada principal navegável: dois lances, patamar, chegada ao primeiro andar e descida.
- 1º andar refeito pelas fotos E01–E45, X46 e X47 (ver `EXPANSAO-PRIMEIRO-ANDAR.md`):
  - faixa interna com ACIOC Hub, núcleo, salas fechadas e Administrativo;
  - ala leste sobre o palco, com corredor de poltronas e Incubadora Joaçaba.
- O vidro do ACIOC fica na borda da laje e é visto do térreo; a Incubadora aparece por cima do palco.
- Portas de ACIOC, Administrativo, Incubadora e salas internas abrem quando o boneco se aproxima.
- Correções de 31/10:
  - a parede do térreo que cortava o 1º andar agora para na laje;
  - Administrativo com mesa de reuniões e sala interna (Dagliê na entrada, Danimara mais para dentro);
  - Incubadora refeita e sem nomes de empresas;
  - salas de podcast e servidor;
  - dois nichos de banheiro navegáveis;
  - elevador sem cintilação.
- 2ª rodada de 31/10:
  - Administrativo com sala de projetos, área de reuniões e sala de Dagliê e Danimara, com mais espaço para circular;
  - Incubadora sem sala isolada e com a porta externa norte funcionando;
  - salas de incubação com portas;
  - arte do elevador na ordem original;
  - nichos de banheiro refeitos;
  - portas das escadas de emergência abrindo para antecâmaras;
  - lixeiras fora do vão.
- Câmera acompanha a mudança de nível e respeita lajes/forros.
- Persistência de `x`, `y`, `z`, ambiente e câmera.
- Quatro assentos interativos nos arcos.
- NPCs Keila, Dagliê e Danimara construídos pelo mesmo sistema do avatar:
  - cada um tem um ponto de atendimento à frente, com "E · Conversar";
  - durante a conversa, a câmera enquadra a pessoa por cima do ombro e o diálogo fica na base da tela.
- Keila atende pela frente do balcão da recepção.
- Elevador interativo entre térreo e 1º andar, mantendo aparência e câmera:
  - folhas que abrem e fecham e cabine visível nos dois pavimentos;
  - painel lateral com visor e seta de viagem.

## Modo VR (WebXR) · prova de conceito fechada em 02/11/2026 (documentação para continuar: `docs/vr/`)

> **02/11:**
> - medições do Quest lidas (zonas e distância ajudaram: piores vistas de 41–54 para 51–68 fps, mas nenhuma chega a 72);
> - a otimização do Hall está **estacionada**;
> - sair do VR agora é **segurar B 1,5 s**;
> - o modo teste ganhou bipes, giro automático e baterias;
> - locomoção (2a–2d) aprovada no Quest;
> - 7ª rodada:
>   - quadros lentos atribuídos ao instrumento (medidor e log) e instrumento aliviado;
>   - vinheta preta;
>   - zonas recalculadas por geometria, com visibilidade parcial;
>   - escada com paradas no teleporte;
>   - **mãos (3a) e raio, sentar e Lab → Hall (4a)**;
> - **parado para o teste no Quest**;
> - as opções para as mesas que somem vistas da Incubadora aguardam o usuário.
>
> Ver a "5ª rodada" em `VR-WEBXR.md`.

- **Para continuar, leia primeiro a seção "Retomar aqui" de `docs/continuidade/VR-WEBXR.md`.** Ela tem o que está pronto, os resultados do Quest, as pendências em ordem, as decisões e os comandos.
- **Sem git até o usuário mandar.** Backup de antes do VR: uma cópia local da pasta (fora do repositório) (com `.git`; não apagar). A branch `recurso/vr-webxr` só será criada quando o usuário mandar.
- **Pronto:**
  - etapa 1 (sessão, rig, câmera, colisão pela cabeça), testada no Quest 3S;
  - 72 Hz;
  - framebuffer por ambiente (Lab ×1,5, Hall ×1,2; teto 1,5) e foveação 1;
  - medidor e log em VR;
  - saída segurando B por 1,5 s (até 01/11, eram os dois grips);
  - `?vr-ponto`;
  - página de testes `/t` com medição automática (só no `npm run servir:https`);
  - otimizações do Hall: células com recorte, portas juntas e, só em VR, contornos até 10 m, zonas de visibilidade e distância máxima de 25 m para móveis de outras zonas.
- **Feito em 02/11:** locomoção (andar suave, correr, giro por passos/suave, vinheta, pulo, teleporte, postura); framebuffer ×1,2 no jogo.
- **Feito em 02/11 (7ª rodada):** mãos de gelatina nos controles, laser com alvos (tolerância angular, 4,5 m), sentar e levantar, troca Lab → Hall dentro do VR.
- **Não feito:** corpo (tronco) (o boneco fica oculto em VR), painéis de UI em mundo (equipamentos, conversa e elevador mostram um aviso), opções em VR e provador em VR.
- **Quest 3S até agora:**
  - Lab: ~71 fps (fb 1,5, foveação 1);
  - Hall: limitado por draws, não por pixels (fb 1,0 = 1,2).
    - Em 02/11, com zonas + 25 m: média de 63–67 fps por ponto.
    - Piores setores: escada 315° (48), Incubadora 315° (51), ACIOC 135° (53), entrada 45° (58) e café 315° (61).
- **Próximo passo:** o usuário testa a 3a e a 4a no Quest (checklist na "7ª rodada" de `VR-WEBXR.md`) e decide sobre as mesas da Incubadora; depois, a etapa 5 (kit de painéis).
- **A decidir no aparelho:** altura dos NPCs (1,30 m) em VR e a largura do tronco escalado (~1,6×) em relação ao colisor.
- **Teste instável do Hall** (vidro do 1º andar e bolha da porta do elevador): investigar a causa, não repetir até passar. Pista em `VR-WEBXR.md`.

## Parcial ou propositalmente limitado

- As divisas e dimensões do 1º andar são estimadas pelas fotos, pois não há planta oficial do pavimento.
- A largura da ala leste (11 m) conflita com os 44 m do PDF do ático.
- Salas das empresas e salas fechadas do corredor não são navegáveis.
- A Nexo permanece fechada. O volume visível e os móveis documentados foram preservados, sem criar usos ou salas adicionais.
- A porta envidraçada no fim do corredor dos banheiros é fechada.
- O Lab continua como ambiente separado; o elevador não declara um pavimento para ele.
- Medidas verticais e profundidade do térreo continuam estimadas por fotos.
- Logos de terceiros continuam genéricos; o logo INOVALE é aproximado.

## Pendente de referência externa

- Planta oficial do térreo e do 1º andar, sobretudo a largura da ala leste e as divisas entre núcleo, salas e Administrativo.
- Fotos do interior das salas fechadas do corredor e da ordem real das salas das empresas.
- Medidas com trena: profundidade do hall, pé-direito, nível do primeiro andar e largura/comprimento da escada.
- Caminho real até o Lab de IA.
- Arquivo oficial do logo INOVALE e autorização para marcas de terceiros.
- Conteúdo institucional definitivo dos painéis marcados como demonstração.

## Fontes de verdade

- Cena: `ambientes/hall-inovale/hall-inovale.js`.
- Planta atualizada: `docs/hall/planta-hall-v2.json` (v2.1, com térreo e 1º andar) e índice E01–E45 + X46/X47 em `docs/hall/indice-fotos-primeiro-andar.txt`.
- Planta visual: `docs/hall/planta-hall-v2.svg` e `.png`.
- Motor de níveis: `src/mundo/sala.js`, `src/mundo/colisao.js`, `src/mundo/jogo.js` e `src/mundo/camera.js`.
- Resultados automatizados: `testes/relatorio-navegacao-*.json` e `testes/relatorio-fluxo-avatar.json`.
