# Porte para VR (WebXR) · continuidade

Última atualização: 02/11/2026 (Claude), 5ª rodada. Leia junto com `ESTADO-ATUAL.md`, `ARQUITETURA-TECNICA.md` e as entradas de 31/10 e 02/11 em `docs/DECISOES.md`.

## Retomar aqui (02/11/2026)

Resumo para uma sessão nova continuar sem contexto. O histórico de cada rodada está nas seções abaixo ("3ª rodada", "4ª rodada", "5ª rodada" etc.).

**Situação (02/11, 7ª rodada):**
- A locomoção (2a–2d) foi aprovada no Quest.
- Nesta rodada:
  - quadros lentos resolvidos no instrumento;
  - vinheta preta;
  - zonas recalculadas por geometria, com visibilidade parcial;
  - paradas da escada no teleporte;
  - **3a (mãos) e 4a (raio, sentar, troca Lab → Hall) feitas**, verificadas só no emulador.
- **PARADO para o usuário testar no Quest** (checklist em "7ª rodada").
- Aguarda decisão do usuário: o sumiço das mesas vistas da Incubadora (opções medidas na "7ª rodada", item 4).
- Depois: a etapa 5 (kit de painéis).

**Feito nesta rodada (02/11):**
- **Sair do VR: segurar B por 1,5 s** (anel que enche + vibração). O atalho dos dois grips foi removido. B curto chama a ação curta (`O.xr.sessao.aoBCurto`); ainda não há nada aberto em VR, então só registra no log.
- **Modo teste:** bipes (1 = fim do aquecimento, 2 = fim da volta, 3 = fim da bateria), giro automático de 12°/s em torno da cabeça (`?vr-giro`, 0 desliga) e **baterias** por ambiente (`?vr-bateria`, botões no `/t`). O formato das medições não mudou.
- `npm run medicoes:vr` mostra o Hz e o framebuffer reais e um resumo por teste.

### Pendências estacionadas da otimização (não mexer até o usuário retomar)
1. Compartilhar materiais iguais da estrutura (maior bloco restante; estimativa na "4ª rodada").
2. Falha intermitente do teste do Hall (vidro do 1º andar e bolha da porta do elevador; pista em "Pendências, em ordem" (c)).
3. Piores vistas medidas no Quest em 02/11, com o padrão: escada 315° (48 fps, 931 draws), Incubadora 315° (51 fps, 928), ACIOC 135° (53 fps, 772) e 90° (57 fps, 888), entrada 45° (58 fps, 707).
4. Não medidos ainda: `hall-palco`, `andar1-vao`, `administrativo`, `incubadora-corredor`, `acioc-c0`, `acioc-fb1`, `incub-z0`, `cafe-d0` e a caminhada ACIOC → Incubadora → escada com marcas. A "bateria Hall" e a "bateria Hall · variações" cobrem quase tudo isso.
5. Detalhe menor (anotado pelo usuário, irrelevante por ora): indo do ACIOC para a Incubadora, às vezes "uma parte branca some". Provavelmente um bloco de móveis cortado pela zona ou pela distância.

### Pronto (verificado no emulador IWER; no Quest, só o que está em "Resultados do Quest")
- **Etapa 1, sessão e câmera** (`src/xr/sessao.js`, `rig.js`):
  - botão "Entrar em VR" só com WebXR, com destaque no Quest Browser;
  - reference space local-floor → bounded-floor → local;
  - rig com colisão pela cabeça real, escada com cota;
  - DOM escondido em VR e desktop restaurado ao sair.
- **Saída:** segurar B por 1,5 s (desde 02/11; antes eram os dois grips).
- **72 Hz** pedido por padrão (`?vr-hz`); o medidor mostra a taxa ativa e a pedida.
- **Framebuffer** (`src/xr/opcoes.js`), automático quando não há `?vr-fb`:
  - **jogo normal: ×1,2 em qualquer ambiente** (decisão de 02/11: o valor não muda dentro da sessão, e o Hall é o caso crítico);
  - **só no modo teste**, por ambiente: Lab ×1,5, Hall ×1,2;
  - teto 1,5.
- **Foveação 1** por padrão (`?vr-fov`).
- **Medidor** (`src/xr/desempenho.js`):
  - topo fixo com teste, ponto, parâmetros, posição, yaw e zona;
  - fps, pior quadro, CPU separada em atualização e render, GPU (se houver `EXT_disjoint_timer_query_webgl2`), draws, triângulos e framebuffer real.
- **Log/diagnóstico** (`?vr-log=1`, `src/xr/log.js`): quadro fora do VR e painel dentro do VR.
- **Pontos de medição** (`?vr-ponto=<id>`, `src/xr/pontos.js`): `lab`, `hall-entrada`, `hall-palco`, `hall-cafe`, `escada`, `andar1-vao`, `acioc`, `administrativo`, `incubadora-corredor`, `incubadora`.
- **Ferramentas de teste no Quest, só no `npm run servir:https`** (`testes/servir-https.js` + `testes/vr-teste-servidor.js`):
  - página **`/t`** com um botão por teste;
  - **`?vr-teste=<id>`**: parâmetros só daquela carga, nada salvo;
  - **medição automática** por POST em `/__orvalho/medicoes` → `testes/medicoes-vr/<data>.jsonl` (fora do Git);
  - **8 setores de yaw** depois de 20 s de aquecimento;
  - **marca** com A ou gatilho;
  - leitura no PC com `npm run medicoes:vr`.
- **Otimizações do Hall** (`src/mundo/sala.js`):
  - **células de 8 m** com recorte pela câmera (vale também no desktop);
  - **portas juntas**: as peças de alumínio de cada folha viraram uma malha (`porta-ferragem`);
  - só em VR, desfeitas ao sair:
    - vidros de dupla face numa passada;
    - **corte de contornos** a 10 m (`?vr-contorno`);
    - **zonas de visibilidade** (`?vr-zonas`, `zonasVR` em `ambientes/hall-inovale/hall-inovale.js`);
    - **distância máxima** dos móveis de outras zonas, 25 m (`?vr-dist`).
- Aviso "Can't change size while VR device is presenting" corrigido (`jogo.js` → `size()`).

### NÃO feito
- ~~Etapa 2, locomoção~~: feita em 02/11 (2a–2d), aguardando o teste no Quest.
- Etapa 3, corpo e braços: o boneco do jogador fica oculto em VR.
- Etapa 4, interação por raio: laser, bolhas, NPCs, sentar.
- Etapa 5, painéis de UI em mundo: equipamentos, diálogo, elevador.
- Etapa 6, opções em VR: recentralizar e "Sair do VR"; hoje a saída é segurando B.
- Provador em VR.
- Compartilhar materiais iguais da estrutura: proposto, não aplicado.

### Resultados do Quest 3S já medidos e conclusões
- **Lab:** ~71 fps a 72 Hz com fb 1,5 + foveação 1 (210 draws, 432K tri, CPU 3,9 ms).
  - fb 1,5 e 1,7 deram o mesmo framebuffer (5040×2640): **1,5 é o teto** no Quest.
  - Sem foveação, fb 1,5 dava ~48–55 fps.
- **Hall (fb 1,2), medido antes das zonas, distância e portas:**
  - ACIOC → corredor: 35–40 fps, 1.500–1.860 draws, CPU 16–17,7 ms;
  - o mesmo ponto olhando as mesas: 71–72 fps, ~200 draws;
  - **fb 1,0 deu o mesmo fps que 1,2: o Hall não é limitado por pixels, e sim por draws/CPU**;
  - Incubadora → Hall: 50 fps, 1.050 draws, CPU 12,8 ms;
  - recepção/café: 69 fps, 670 draws.
  - As vistas ruins são **ACIOC → corredor** e **Incubadora → Hall**.
- No emulador, depois desta rodada, essas vistas caíram de 1.570 → ~965 e de 1.280 → ~970 draws (tabelas na "4ª rodada").
- **Medido no Quest em 02/11 (tabelas na "5ª rodada"):** com zonas + 25 m, o pior setor do ACIOC foi de 41 para 53–57 fps, o da Incubadora de 44,5 para 51 fps e o do café de 54 para 68 fps. Nenhuma das piores vistas chega a 72.
- Sem LOD de triângulos, a pedido do usuário, enquanto a GPU não se mostrar o limite.

### Pendências, em ordem
0. **(02/11)** O usuário testa a locomoção no Quest (checklist em "6ª rodada") e roda a "bateria Lab" (4 passos, ~2,5 min) para atribuir os quadros lentos. Depois, a 3a (mãos e braços). Os itens (b) e (c) abaixo estão **estacionados**.
1. **(a) Feito em 02/11** (1ª e 2ª parte da lista; ver "5ª rodada"). `gpuDisponivel` veio **falso**: o Quest Browser não expõe `EXT_disjoint_timer_query_webgl2`. Não houve marcas de pulo (a caminhada não foi feita).
2. **(b)** Decidir com o usuário, mostrando antes:
   - compartilhar materiais iguais da estrutura (estimativa −150 draws por vista larga; ver "4ª rodada");
   - outros cortes, se ainda faltar fps;
   - o valor padrão de `?vr-dist`.
3. **(c)** Investigar a falha intermitente do Hall em vez de repetir até passar. Já apareceu:
   - Gota, 3ª rodada: "vidro do 1º andar", z = 14,42;
   - Esguio, 3ª rodada: "bolha NÃO apareceu" na porta do elevador;
   - Jujuba, 4ª rodada: "vidro do 1º andar permaneceu sólido fora da porta", z = 14,47.

   Pista para o vidro: o teste (`testes/navegacao.js`, ~linha 363) anda a partir de x = 39, que fica dentro do vão da porta do podcast (x 38,1–39,1); se a porta abre a tempo, o corpo passa. Confirmar e, se for isso, mover o ponto do teste para um trecho sem porta, com aval do usuário. A da bolha ainda não tem pista.
4. **(d)** Etapa 2 (locomoção) em diante, sempre com plano curto antes e checklist do Quest depois.

### Decisões já tomadas
- **Sem git até o usuário mandar.** Nada de add, commit, branch, push.
  - Backup de antes do VR: uma cópia local da pasta (fora do repositório) (pasta inteira com `.git`). Não apagar.
  - A branch será `recurso/vr-webxr`, criada só quando o usuário mandar.
- **Escala 1:1** (mundo e olhos reais).
- Corpo em tamanho natural: a forma exata (fator do tronco e largura em relação ao colisor) se decide na etapa 3.
- Mapeamento de botões aprovado (tabela em "Decisões do usuário"). Hoje, em VR, existem B (segurar = sair; curto = ação curta) e, em modo teste, A ou gatilho (marca).
- **Plano B:** se o HTTPS local falhar num Quest, usar um túnel Cloudflare (`cloudflared`). Não foi preciso: o HTTPS local funcionou no Quest 3S.
- **`?vr-teste`, a página `/t` e o endpoint de medição existem só no `npm run servir:https`.** O site publicado (GitHub Pages copia só `index.html`, `css/`, `src/`, `ambientes/`, `vendor/`) não tem o endpoint; lá o jogo avisa no log e para de tentar.
- Certificado e chave (`.certs/`) e medições (`testes/medicoes-vr/`) nunca vão para o Git.
- Testes: por pedido desta fase, a cada passo rodar `vr`, `lab` e `avatar` (com `GPU=1`, um por vez) e o Hall uma vez no fim. O `CLAUDE.md` pede `teste:tudo` depois de mudanças no motor: confirmar com o usuário qual vale ao retomar.

### Como retomar
1. No PC, na pasta do projeto: `npm install` (só se faltar) e depois `npm run servir:https`.
2. No Quest Browser, abrir **`https://<IP-do-PC>:8443/t`**. O IP certo é o que o terminal mostra com ►. Aceitar o aviso do certificado (Avançado → Continuar).
3. Em cada teste:
   - toque no botão → **Entrar em VR** → parado, olhando para a frente → **1 bipe** (fim dos 20 s de aquecimento) → o jogo gira sozinho uma volta (12°/s, ~30 s) → **2 bipes**;
   - A ou gatilho onde algo surgir ou travar;
   - sair **segurando B por 1,5 s** e voltar para `/t`.
   - **Bateria** (botões verdes no topo do `/t`): os passos seguem sozinhos, com véu entre os pontos; **3 bipes** e a sessão termina.
   - O terminal mostra `[medição] inicio/fim …`.
4. **Ordem sugerida (quando a otimização voltar):** "bateria Hall" (9 pontos, ~7 min), "bateria Hall · variações" (~7 min), `acioc-fb1` avulso e, por fim, andar do ACIOC até a Incubadora e subir a escada, marcando com A os pulos notáveis.
5. No PC: `npm run medicoes:vr` (o arquivo mais recente; `-- todos` para todos).
6. Ferramentas no emulador:
   - `GPU=1 npm run teste:vr`;
   - `PONTOS=acioc VARRER=1 GPU=1 npm run medir:vr`;
   - `DIST=25 GPU=1 node testes/pulos-zonas-vr.js`.


## Regras combinadas com o usuário

- **Sem git até segunda ordem.** Nada de `add`, `commit`, `branch`, `push` ou `merge`. O trabalho fica direto na pasta.
- **Depois de testado no Quest, e só quando o usuário mandar:** criar a branch `recurso/vr-webxr` e mostrar o commit para ele aprovar.
- **Cópia de segurança de antes do VR:** uma cópia local da pasta (fora do repositório), a pasta inteira com `.git`, conferida como idêntica. Não apagar.
- **Etapas pequenas, cada uma testável.** Antes de cada etapa, mostrar o plano curto. Ao terminar, entregar um checklist para o Quest.
- **Não simplificar o visual em silêncio:** dizer o que muda e por quê.
- **Não inventar comportamento de API.** O que for incerto (three r149, Quest Browser), verificar e dizer que é incerto.
- **Preservar o resto:** three.js r149, o Avatar Kit, o provador, a estética Frutiger Aero, a colisão por altura, a persistência de `y` e os três raios de colisor.

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Escala | **A**: mundo 1:1, olhos na altura real, corpo visual escalado para a altura do jogador, colisor inalterado |
| Sentar no assento | Fade e abaixar a vista até a altura sentada, travando a posição. Com a postura "Sentado" das opções, só trava a posição. |
| IWER | Aprovado só como devDependency (`iwer@2.7.0`, versão exata). Nada vai para o site. |
| Branch | `recurso/vr-webxr`, criada só quando o usuário mandar |
| Botões | Aprovados como na tabela abaixo |

| Botão (Quest Touch) | Ação |
|---|---|
| Gatilho | Selecionar com o raio daquela mão |
| A | Pular (só do chão) |
| B (toque curto, solto antes de 0,5 s) | Fecha o que estiver aberto (painel, conversa, provador) ou levanta. Com nada aberto, abre o provador. |
| B segurado 1,5 s | **Sair do VR** (02/11; substitui os dois grips). Anel que enche a partir de 0,25 s e vibração ao completar. Soltar entre 0,5 e 1,5 s não faz nada. |
| Y | Abre e fecha as Opções. Com algo aberto, fecha. |
| X | Fechar (Esc) |
| Clique do thumbstick esquerdo | Correr, enquanto empurra; ao soltar o stick, para de correr (02/11) |
| Thumbstick esquerdo | Andar suave (1,5 m/s) ou teleporte (empurrar para a frente mostra o arco; soltar teleporta). No modo suave, só anda |
| Thumbstick direito | Giro por passos (15/30/45/90°, padrão 30°) ou giro suave (90°/s) |
| Y (até existir o painel de opções) | Alterna andar suave / teleporte (salvo; no modo teste, só nesta carga) |
| Clique do thumbstick direito (idem) | Alterna giro por passos / suave (salvo; no modo teste, só nesta carga) |
| Grip | Girar o boneco no palco do provador |

O botão Meta (direito) é do sistema. O ☰ esquerdo provavelmente não chega ao WebXR: **confirmar no aparelho**.

## Etapas

1. **Sessão VR e câmera: feita e testada no Quest 3S** (entrada, 72 Hz, fb/foveação, log; saída segurando B desde 02/11). Ferramentas de medição e otimizações do Hall feitas e medidas no aparelho em 02/11; o resto da otimização está estacionado.
2. Locomoção: andar suave relativo à cabeça (opção: ao controle), teleporte com arco e marcador verde/coral, correr, pulo com A, giro por passos e suave em torno da cabeça, vinheta.
3. Controles e braços:
   - cabeça oculta (`visible = false`, com o contorno e os acessórios de cabeça);
   - braços na pose do grip;
   - corpo amortecido sob a cabeça;
   - opção "Ocultar corpo";
   - aparência do provador.
4. Interação por raio: laser, hover nas bolhas, gatilho, haptic; alvos de raio para NPCs e assentos; sentar e levantar; conversa sem enquadrar a câmera.
5. UI em mundo: kit de painel em canvas 2D, porque o `HTMLMesh` da r149 é ES module e perderia o visual Aero. Inclui painéis dos equipamentos, diálogo, elevador e o provador em VR (2º boneco num palco).
6. Opções em `localStorage` `orvalho-vr`:
   - movimento, giro, postura e altura de olhos;
   - mão dominante;
   - ocultar corpo e vinheta;
   - velocidade;
   - recentralizar e sair do VR.
7. Otimização: em andamento, antecipada por causa do Hall. Feito: corte de contornos, células, zonas, distância, portas juntas, fb por ambiente, foveação. Pendente: medir no Quest pela página `/t` e decidir sobre materiais compartilhados da estrutura. "Gelatina leve" e LOD só se a GPU virar o limite.

## O que a etapa 1 fez

**Arquivos novos:**
- `src/xr/opcoes.js`: opções `orvalho-vr`, por enquanto `escalaFb`, `foveacao` e `medidor`. Também lê `?vr-fb=`, `?vr-fov=` e `?vr-medidor=0` da URL e salva.
- `src/xr/rig.js`: `O.xr.criarRig(camera)`. A câmera fica dentro do rig. O ponto da cabeça passa por `alturaPiso` e por `colisao.resolver` com o raio do corpo, e o rig recua o que foi recusado. `centrar()` põe a cabeça onde o boneco estava, olhando para onde ele olhava; também é usado no `reset` do reference space.
- `src/xr/desempenho.js`: medidor preso à vista com fps/alvo, ms (média e pior), quadros lentos, CPU, draw calls, triângulos, framebuffer, foveação e reference space. A cada 10 s escreve `[Orvalho VR] …` no console.
- `src/xr/sessao.js`: `O.xr.sessao`.
  - Detecta com `isSessionSupported`.
  - Mostra os botões `#btn-vr` (tela inicial) e `#hud-vr`.
  - Pede a sessão de forma síncrona dentro do clique.
  - Escolhe o reference space antes do `setSession` (a r149 pede um tipo só). Em `local`, o rig sobe 1,6 m.
  - Usa `body.em-vr` para esconder o DOM e restaura tudo no `end`.
- `testes/vr.js`: `npm run teste:vr`, com o IWER injetado por `addInitScript` e `installRuntime({ forceInstall: true })`, porque o Chromium tem `navigator.xr` nativo.
- `testes/servir.js`: `npm run servir`, servidor estático na porta 8000 (esta máquina não tem Python).

**Arquivos alterados:**
- `src/mundo/jogo.js`:
  - `renderer.xr.enabled = true`;
  - `setAnimationLoop` no lugar de `requestAnimationFrame`;
  - `parar()` não para o desenho em VR;
  - ramo VR no loop;
  - `amb.atualizar` recebe a cabeça no mundo;
  - teclado, mouse e `visibilitychange` ignorados em VR;
  - API `O.jogo.vr = { contexto, ligar(h), desligar, ativo }`.
- `src/app.js`: `entrar(continuar, { imediato })` devolve `false` se abriu o provador; ganhou `O.app.esconderVeu`.
- `index.html`: ícone `i-vr`, botões e scripts de `src/xr/` depois do `app.js`.
- `css/orvalho.css`: `.btn.vr` (gota água), `body.vr-destaque` e `body.em-vr`.
- `package.json`: `iwer` 2.7.0 (dev), scripts `servir` e `teste:vr`; `teste:tudo` agora termina com `node testes/vr.js`.
- `README.md`, `docs/DECISOES.md` e `docs/continuidade/ESTADO-ATUAL.md`.

**Conferido no `vendor/three-r149.min.js`:**
- existem `WebXRManager`, `setFoveation`, `setFramebufferScaleFactor`, `setReferenceSpaceType`, `getController`, `getControllerGrip` e `getHand`;
- **não há multiview**, então cada draw call é feita duas vezes;
- `updateCamera` copia a pose para `camera.position/quaternion` relativa ao pai e atualiza os filhos da câmera.

## Teste no Quest sem cabo (31/10/2026)

O usuário **não tem modo desenvolvedor** no Quest, então não dá para usar `adb reverse` nem `chrome://inspect`. O caminho é HTTPS na rede de casa.

**Novos arquivos:**
- `testes/servir-https.js`: `npm run servir:https`.
  - Escuta em 0.0.0.0:8443 e reaproveita o `atender` de `testes/servir.js`.
  - O certificado autoassinado é gerado com `selfsigned@5.5.0` (devDependency, versão exata) em `.certs/`.
  - O SAN tem `localhost`, `127.0.0.1` e todos os IPv4 da máquina. O certificado é refeito se o IP mudar ou se faltarem menos de 7 dias para vencer.
  - O IP sugerido ignora VPNs e adaptadores virtuais. Na máquina de desenvolvimento havia adaptadores de VPN; o IP certo é o da rede de casa (Ethernet ou Wi-Fi). `ORVALHO_IP` força outro.
- `src/xr/log.js`: é o primeiro script do `index.html`, antes do three.js.
  - Captura sempre: `console.error`/`warn`, erros não capturados (inclusive de carregamento), promessas rejeitadas e as linhas `[Orvalho VR]`.
  - Só mostra com `?vr-log=1`, salvo em `orvalho-vr.log`.
  - Fora do VR, o quadro `#diag-vr` mostra isSecureContext, navigator.xr, immersive-vr, endereço, navegador, "Último VR" e as mensagens.
  - Dentro do VR, o painel `xr-log` fica preso à câmera, à direita do medidor, e é redesenhado no máximo 1×/s.

**Alterados:**
- `opcoes.js` (opção `log`);
- `desempenho.js` (manda a amostra para `O.xr.log.medidas`);
- `sessao.js` (cria e descarta o painel; `O.xr.sessao.painelLog()`);
- `servir.js` (exporta `atender` e bloqueia `.certs/`, `node_modules/` e `.git/`);
- `.gitignore` (`.certs/`, `*.key`, `*.crt`, `*.pem`);
- `css/orvalho.css` (`.diag-vr`);
- `package.json`;
- `README.md`.

**Botão no controle para o log:** não foi criado. A tabela de botões aprovada não tem botão livre; se o usuário quiser, a sugestão é o clique do thumbstick direito.

**Verificado nesta máquina (não no Quest):**
- No Chromium 156 desktop, sem `ignoreHTTPSErrors`, `https://<IP-do-PC>:8443` mostra "Erro de privacidade". Depois de Avançado → Continuar, `isSecureContext = true` e `navigator.xr` existe.
- Por `http://<IP-do-PC>` os dois são falsos.
- `teste:vr` seção 8 (IWER): quadro, captura de erros, painel em VR, medidas após sair e o ×.

**Ainda não confirmado:** se o **Quest Browser** trata a página aceita com aviso como contexto seguro e expõe o WebXR. Se não expuser, o plano B é um túnel Cloudflare (`cloudflared tunnel --url http://localhost:8000`), a documentar no README só nesse caso.

**Resultado do usuário no Quest 3S (Lab):** o HTTPS funcionou.
- Com `?vr-fb=1.3`: ~67–72 fps (13,9 ms, CPU 3,7 ms, 226 draw, 456K tri).
- Com 1.5: ~48–55 fps.
- O limite é a GPU.

## Taxa de quadros, saída e bug das opções (31/10/2026, 2ª rodada)

- **`?vr-hz` não existia** antes desta rodada; o "alvo 90" era a taxa padrão do Quest Browser. Agora:
  - `opcoes.hz` vale 72 por padrão (`?vr-hz=`; 0 deixa a do navegador);
  - `sessao.js` chama `updateTargetFrameRate` com a taxa suportada mais próxima;
  - o medidor mostra `FPS · ATIVO <session.frameRate> HZ` e, na última linha, `PEDIDO 72 HZ`;
  - o log registra "taxa pedida → ativa · suportadas".
- **Framebuffer padrão** (atualizado na 3ª rodada): automático por ambiente, com **Lab 1,5** e Hall 1,2. O Hall só muda depois de medido no Quest. `?vr-fb=` aceita de 0,5 a 2,0 (1,7 para comparar nitidez); `?vr-fb=auto` volta ao automático.
- **Bug corrigido em `opcoes.js`:** sem nada salvo, `isFinite(null)` virava 0, e tudo caía no mínimo da faixa (fb 0,5, foveação 0). Como `?vr-fb=1.3` salva por cima disso, **no Quest a foveação provavelmente ficou 0** nas medições do usuário. No aparelho, abrir uma vez com `?vr-fov=1`.
- **Sair:** segurar os dois grips (botão 1 do xr-standard) por 1,5 s chama `session.end()`, fora do quadro (`setTimeout`), porque o IWER despacha o `end` na hora e desmontava o rig no meio do passo. A dica vai para o log na entrada. É provisório: o botão definitivo fica no painel de opções (etapa 6).
- **`teste:vr` seção 9:** 72 Hz ativo, medidor e saída pelos grips (um grip só não sai; soltar antes de 1,5 s não sai).

## Custo do mapa em VR (31/10/2026, `npm run medir:vr`, IWER/Quest 3, dois olhos)

**O que fica carregado:** só o ambiente atual. Lab e Hall são ambientes separados: `carregarAmbiente` descarta o anterior com `dispose`. Mas o **Hall inteiro** (térreo, 1º andar, ACIOC, Administrativo, Incubadora) fica carregado e montado ao mesmo tempo. Não há culling por sala nem por andar.

**Totais da cena do Hall:**
- 817 malhas, sendo 416 `InstancedMesh` com 1.395 instâncias;
- 579 geometrias, 115 texturas, 722 materiais e 28 programas de shader;
- 1,8 M triângulos se tudo for desenhado uma vez.

O `renderer.info.memory` conta só o que já subiu para a GPU, então varia de ponto para ponto (geo 310–578, tex 35–116). Lab: 78 geometrias, 8 texturas e 18 programas.

| Ponto | draw (2 olhos) | tri (2 olhos) | Sem culling (draw / tri) | Contornos (draw) | Vidro 2× (draw) |
|---|---|---|---|---|---|
| Lab (referência) | 218 | 435K | 163 / 411K | 91 | 19 |
| Hall entrada | 1.220 | 3,20 M | 971 / 3,27 M | 418 | 42 |
| Hall centro → palco | 1.350 | 3,21 M | 971 / 3,27 M | 443 | 159 |
| Hall centro → café | 1.120 | 3,20 M | 971 / 3,27 M | 415 | 47 |
| 1º andar → vão | 950 | 3,04 M | 971 / 3,27 M | 392 | 33 |
| ACIOC | 1.656 | 3,47 M | 971 / 3,27 M | 474 | 182 |
| Administrativo | 1.318 | 3,21 M | 971 / 3,27 M | 420 | 98 |
| Incubadora (corredor) | 966 | 2,97 M | 971 / 3,27 M | 387 | 42 |
| Incubadora (dentro) | 1.290 | 3,29 M | 971 / 3,27 M | 450 | 121 |

**Causa principal:** em `sala.js`, cada tipo de móvel vira uma `InstancedMesh` com as instâncias do Hall inteiro e `frustumCulled = false`. A r149 recortaria pela esfera da geometria na origem, e não pelas instâncias. O contorno é uma 2ª `InstancedMesh` com a mesma geometria. Resultado: ~970 draws e ~3,2 M triângulos (dois olhos) são desenhados **em qualquer ponto e direção**. Os contornos sozinhos são ~1,7 M desses triângulos.

**Estimativas por otimização** (simuladas sobre o frustum dos dois olhos; **nada foi aplicado**):

| Proposta | Efeito estimado nos pontos do Hall (2 olhos) | Risco |
|---|---|---|
| **A. `forceSinglePass` nos vidros transparentes de dupla face** (existe na r149) | −16 a −91 draws; triângulos quase iguais | baixo: a ordem face de trás/da frente pode mudar em vidros curvos |
| **B. Instâncias em células de 6 m por pavimento, com culling por célula** (geometria-invólucro com `boundingSphere` própria, atributos compartilhados) | triângulos −1,0 a −3,0 M (para 0,23–2,3 M); draws de −830 a **+290** (olhando o salão inteiro, mais células visíveis = mais draws) | médio: muda a montagem em `sala.js`; precisa revalidar os testes |
| **B + contornos só até 10 m** | triângulos para 0,21–1,39 M; draws para 128–868 (o melhor caso é a Incubadora; o pior, a ACIOC) | médio: some a linha escura dos móveis distantes (muda o visual; mostrar antes) |
| B + contornos só até 6 m | ~mais 5–10% sobre o anterior | o corte de contorno fica visível mais perto |
| **C. Mesclar malhas estáticas por material** | 0 a −222 draws (já é feito em boa parte por `sala.js`) | médio: mesclar o mapa inteiro anula o culling; seria por célula |
| **D. Instancing de malhas repetidas** | ~0 a −24 draws: já está feito | — |
| **E. Culling por sala/andar (portais)** | não medido; o limite superior "objetos inteiramente no outro andar" fica entre 350 e 690 draws, mas parte deles aparece pelo vão | alto: exige definir portais e salas na planta |

Orçamento de referência: no Lab, 226 draws / 456K tri a ×1,3 deram 67–72 fps no Quest. O Hall está **4–8× acima em draws e ~7× em triângulos**. Mesmo com A + B + contornos até 10 m, os pontos mais abertos (ACIOC, Administrativo) seguem acima do Lab. Por isso o próximo passo é medir no Quest antes de decidir.

## 3ª rodada (31/10/2026): Lab a ×1,5, otimizações do Hall e `?vr-ponto`

**Medição do usuário no Quest 3S (Lab, 72 Hz confirmado):**

| fb | foveação | Resultado |
|---|---|---|
| 1,3 | 0 | ~67–72 fps |
| 1,5 | 0 | ~48–55 fps |
| 1,5 | 1 | ~71 fps, 14,2 ms (pior 25), lentos 10/90, 210 draws, 432K tri, CPU 3,9 ms |

A foveação 1 recuperou ~16 fps em ×1,5. As medições anteriores ao conserto do bug (foveação 0) não valem como referência.

**Aplicado:**
- **Células de 8 m por pavimento** nos móveis instanciados (`sala.js`), com geometria-invólucro que compartilha atributos, esfera das instâncias e `frustumCulled = true`.
  - Descoberta: a r149 cria **toda** `InstancedMesh` com `frustumCulled = false` no construtor.
  - Vale no desktop também. A imagem não muda: comparação de pixels em 6 vistas fixas, diferença de 0,04–1,1%, igual ao ruído das animações.
  - Luminárias e sombras do piso ficam sem recorte (são planos baratos).
- **Só em VR** (`amb.modoVR`, desfeito ao sair):
  - vidros transparentes de dupla face com `forceSinglePass`;
  - contornos dos móveis só nas células a até `?vr-contorno` m (padrão 10), via `amb.contornosAte` a cada quadro.
- **`?vr-ponto=<id>`** (`src/xr/pontos.js`, carregado antes do `app.js`). O `medir:vr` usa a mesma lista.
- **Medidor:** mostra "FB ×escala" e tenta ler o tamanho real pelo alvo de render da sessão (`renderer.getRenderTarget()`). Se não der, mostra "camadas". **Confirmar no Quest.**

**Custo medido em VR no emulador (dois olhos; só draws e triângulos, que não dependem da GPU nem da foveação). O fps do Hall ainda será medido pelo usuário:**

| Ponto | Antes (draw / tri) | Agora (draw / tri) | Agora sem corte de contorno |
|---|---|---|---|
| Lab | 218 / 435K | **138 / 309K** | 138 / 309K |
| Hall entrada | 1.220 / 3,20 M | **776 / 1,14 M** | 916 / 1,54 M |
| Hall palco | 1.350 / 3,21 M | **852 / 1,48 M** | 1.070 / 2,10 M |
| Hall café | 1.120 / 3,20 M | **606 / 0,99 M** | 724 / 1,34 M |
| 1º andar → vão | 950 / 3,04 M | **314 / 0,78 M** | 368 / 0,91 M |
| ACIOC | 1.656 / 3,47 M | **1.500 / 2,36 M** | 1.834 / 3,22 M |
| Administrativo | 1.318 / 3,21 M | **992 / 1,55 M** | 1.228 / 2,14 M |
| Incubadora (corredor) | 966 / 2,97 M | **248 / 0,64 M** | 260 / 0,67 M |
| Incubadora (dentro) | 1.290 / 3,29 M | **876 / 1,65 M** | 982 / 1,85 M |

- **Tamanho da célula:** 6 m tem menos triângulos e mais draws; 10 m tem o contrário. 8 m ficou no meio (`CELULA=6 npm run medir:vr` para comparar).
- **Referência do Quest no Lab** (fb 1,5, foveação 1, ~71 fps): 210 draws / 432K tri. Sem o corte do contorno, o Lab agora fica em 138 / 309K.
- **No Hall, ainda acima do Lab:**
  - palco: 4× em draws e 3,4× em triângulos;
  - ACIOC: 7× e 5,5×.
- **O que resta nos piores pontos:**
  - ACIOC: móveis visíveis 770 draws / 1,98 M tri (pelo vidro se vê o salão quase inteiro), contornos 201, portas 205 e paredes/vidros/NPCs/placas ~320;
  - palco: móveis 432, portas 173, contornos 100 e o resto 147.

**Testes da 3ª rodada (GPU, um por vez):**
- avatar, Lab ×3, Hall Jujuba, Hall Gota e `vr` (seções 1–10) passaram.
- Hall Esguio teve 1 falha intermitente ("bolha NÃO apareceu" na porta do elevador) e passou ao repetir.
- Nenhum código do jogo faz raycast; se algum dia fizer, cuidado: o raycast da `InstancedMesh` da r149 usaria a esfera da célula em cada instância.

**Próximos candidatos (não aplicados; mostrar antes):**
- portas: juntar as peças de cada folha por material (estimo −40 a −60% dos 130–205 draws) → **feito na 4ª rodada**;
- LOD dos móveis com mais triângulos (bancada-acioc, cadeira-plateia, mesa-empresa, ilha-acioc e mesa-café têm 110–145K tri cada no Hall inteiro): versão com menos segmentos nas células distantes;
- culling por sala (portais) para a ACIOC e o Administrativo.

## 4ª rodada (31/10/2026): ferramentas de medição no Quest, zonas, distância e portas

**Medição do usuário no Quest 3S (14 medições, resumidas):**
- Lab: 70–72 fps. fb 1,5 e 1,7 deram o **mesmo** framebuffer (5040×2640): o Quest limita em ~1,5. O teto de `?vr-fb` voltou a 1,5.
- Hall com fb 1,2:
  - ACIOC olhando o corredor (lado da Incubadora): 35–40 fps, 1.500–1.860 draws, 2,4–3,3 M tri, CPU 16–17,7 ms;
  - mesmo ponto olhando as mesas: 71–72 fps, 170–210 draws, ~600K tri;
  - com fb 1,0 no corredor: 40 fps, igual a 1,2. **Não é limite de pixels: é a quantidade de draws e a CPU**;
  - Incubadora olhando o Hall: 50 fps, 1.050 draws, 1,86 M tri, CPU 12,8 ms;
  - Hall recepção/café: 69 fps, 670 draws, CPU 9 ms.
- No log: ~1.800 draws com CPU de 21 ms e de 6 ms em instantes diferentes; os primeiros ~20 s parecem aquecimento; aviso "THREE.WebGLRenderer: Can't change size while VR device is presenting".

**Parte 1, ferramentas (feito):**
- **Página `/t` (= `/vr-teste.html`)**, gerada pelo `servir:https` (`testes/vr-teste-servidor.js`; não é arquivo do site). Um botão por teste: todos os pontos e as variações nas piores vistas. Cada botão usa `?vr-log=1&vr-fov=1&vr-fb=auto`, o ponto, os parâmetros e `?vr-teste=<id>`. A página marca o que já foi medido no dia.
- **`?vr-teste`** (`opcoes.js`): os parâmetros da URL valem só naquela carga e não são salvos.
  - Bug achado no caminho: ao carregar, o log ligado pela URL chamava `salvar({log})` e gravava as opções. Agora ele só mostra o painel.
- **Rótulo fixo** no topo do medidor e do painel de log: teste, ponto, parâmetros (fb, fov, contorno, zonas, dist), posição (x, z), yaw em graus com rumo (0 = S/+z, 90 = L/+x) e zona.
- **Medição automática** (`src/xr/teste.js`): POST para `/__orvalho/medicoes`, que acrescenta linhas em `testes/medicoes-vr/<data>.jsonl` (fora do Git). Registros: `inicio`, `resumo` (a cada 10 s), `setores`, `marca`, `fim`.
  - Cada registro leva teste, ponto, parâmetros, fb real, Hz ativo, posição, yaw, zona, fps médio e pior, draws, triângulos e CPU separada em **atualização** (do início do quadro até antes do `renderer.render`: passo, colisão, portas, NPCs, zonas) e **render** (`renderer.render`, os dois olhos).
  - **GPU:** só com `EXT_disjoint_timer_query_webgl2`. O WebXR não informa o tempo de GPU. No Chromium do PC (IWER) a extensão existe; **no Quest, o registro `inicio` diz** (`gpuDisponivel`/`gpuMotivo`). Em GPU de tiles (Adreno), o tempo medido assim pode não incluir a resolução dos tiles: tratar como indicação.
  - Segurança do endpoint: só no `servir:https`, só IPs privados/loopback (403), só `application/json` (415), corpo de até 32 KB (413), tipo de registro conhecido (400), só POST (405), arquivo do dia decidido pelo servidor e limitado a 20 MB, sem rota de leitura. `ORVALHO_MEDICOES=0` desliga. Fora do `servir:https`, o jogo avisa uma vez no log e para de tentar.
- **Varredura por direção:** descarta os primeiros 20 s; depois agrupa cada quadro em 8 setores de yaw (45°) com fps médio e pior, draws e triângulos (média e máximo), CPU de atualização e de render e GPU. Envia a tabela a cada 10 s e no fim. `npm run medicoes:vr` mostra a tabela de cada sessão.
- **Marca:** botão A (controle direito) ou qualquer gatilho.
- **Aviso "Can't change size":** o `ResizeObserver` chamava `renderer.setSize` quando a página mudava de layout ao entrar em VR (`body.em-vr`). `size()` agora não faz nada durante a sessão; ao sair, `desligar()` chama `size()`. O `teste:vr` agora falha se o aviso aparecer.

**Parte 2, custo do Hall (emulador IWER/Quest 3, dois olhos; draws e triângulos não dependem da GPU; o fps é o Quest que diz).**

Ferramenta: `npm run medir:vr` classifica cada draw por categoria e por zona; `VARRER=1` mede as 8 direções de cada ponto.
- Correção da ferramenta: os ganchos pegavam um desenho a mais. As categorias saíam ~17–25% acima do total; os totais estavam certos. Agora a ferramenta conta os desenhos, e as tabelas abaixo usam as categorias normalizadas pelo total.
- Outra correção: as pessoas eram reconhecidas pela altura do sprite da etiqueta, e as bolhas que flutuam pelo hall às vezes caíam na mesma faixa. Agora as pessoas têm `userData.npc`.

*Item 1: categorias nas 3 piores vistas, antes desta rodada* (draws / triângulos):

| Vista (yaw) | Total | Móveis | Portas | Vidros | Pinos | Contornos | Estrutura | Outros |
|---|---|---|---|---|---|---|---|---|
| ACIOC → corredor (90°, L) | 1.500 / 2,36 M | 656 / 1,39 M | 176 | 100 | 28 | 104 / 397K | 320 / 139K | 116 / 404K |
| ACIOC → corredor (135°, NE) | 1.570 / 2,51 M | 694 / 1,49 M | 176 | 110 | 28 | 118 / 441K | 328 / 151K | 116 / 404K |
| Incubadora → Hall (270°, O) | 1.092 / 1,91 M | 554 / 1,25 M | 44 | 82 | 20 | 60 / 338K | 302 / 142K | 30 / 159K |
| Incubadora → Hall (315°, NO) | 1.280 / 2,14 M | 632 / 1,38 M | 88 | 94 | 24 | 108 / 452K | 304 / 129K | 30 / 159K |
| Hall café (270°, O) | 608 / 0,99 M | 274 / 513K | 24 | 36 | 12 | 66 / 175K | 164 / 129K | 32 / 159K |
| Hall café (0°, S) | 736 / 1,05 M | 318 / 602K | 26 | 22 | 12 | 64 / 157K | 262 / 125K | 32 / 159K |

- "Outros" = pessoas (~86 draws, Dagliê e Danimara vistas do ACIOC) + elevador e painéis do VR.
- "Estrutura" = paredes, piso, forro, molduras, luminárias, sombras; ~150–200 malhas por vista, cada uma com material próprio.
- O emulador dá 1.500–1.570 no ACIOC; o Quest mostrou 1.500–1.860 (o campo de visão do 3S não é idêntico ao do Quest 3 do IWER).

*Itens 2–4, antes → depois* (draws; cada coluna soma a anterior):

| Vista (yaw) | Antes | Portas juntas | + zonas | + distância 25 m (**padrão**) | (distância 15 m) |
|---|---|---|---|---|---|
| ACIOC → corredor (90°) | 1.500 | 1.388 | 1.108 | **896** / 1,20 M | 802 |
| ACIOC → corredor (135°) | 1.570 | 1.462 | 1.174 | **964** / 1,35 M | 866 |
| Incubadora → Hall (270°) | 1.092 | 1.080 | 1.080 | **810** / 1,40 M | 680 |
| Incubadora → Hall (315°) | 1.280 | 1.234 | 1.232 | **972** / 1,64 M | 846 |
| Corredor da Incubadora (315°) | 1.152 | 1.128 | 1.126 | **886** | 772 |
| Hall entrada (45°) | 1.310 | 1.216 | 940 | **820** | — |
| Hall café (0°) | 736 | 734 | 632 | **634** | — |
| Hall café (270°) | 608 | 592 | 594 | **592** | — |
| Escada, patamar (pior: 315°) | — | — | — | **1.004** | — |

- **Portas (item 4):** caixilho, dobradiças e puxador de cada folha viraram uma malha (`porta-ferragem`); a folha continua separada. No ACIOC, 176 → 68 draws.
- **Zonas (item 2):** ver abaixo. Ajudam onde há parede opaca no caminho (Administrativo e salas vistos do ACIOC e do térreo; as pessoas do Administrativo). Da Incubadora não ajudam: dali se vê quase tudo pelo vidro.
- **Distância (item 3):** `?vr-dist` (padrão 25 m) vale só para os blocos de móveis de **outras** zonas. Os da zona da cabeça nunca somem: no térreo, uma zona só, a plateia vista do café fica inteira. Por isso o café quase não muda.
- **Final (padrão), categorias nas piores vistas:**
  - ACIOC 135°: 964 = móveis 298, portas 60, vidros 110, pinos 20, contornos 118, **estrutura 327**, outros 30;
  - Incubadora 315°: 972 = móveis 368, portas 44, vidros 94, pinos 24, contornos 108, **estrutura 304**, outros 30;
  - café 0°: 634 = móveis 222, portas 18, vidros 24, pinos 12, contornos 64, **estrutura 262**, outros 32.

**Zonas (`zonasVR` em `hall-inovale.js`; motor em `sala.js` → `visibilidadeVR`):**
- Térreo e 1º andar são um ambiente só. Zonas: `escada` (os dois pavimentos), `hall` (térreo inteiro), `acioc`, `salas` (servidor/reuniões e podcast), `administrativo`, `incubadora`, `incubadora-corredor`, `corredor` (mezanino e núcleo).
- Quem vê quem (o resto fica oculto):

  | Da zona | Não desenha |
  |---|---|
  | hall | salas, administrativo (atrás da laje e das paredes do núcleo) |
  | acioc | salas, administrativo (atrás do núcleo opaco; de lá, só um raspão pelo vidro da frente, a 30+ m) |
  | salas | administrativo (divisória opaca) |
  | administrativo | salas (divisória opaca) |
  | corredor, incubadora, incubadora-corredor | nada (vidro para todos os lados) |
  | escada | nada, e sem limite de distância |

- Ocultos: blocos de móveis, portas que abrem (aparecem se qualquer um dos dois lados for visível), marcadores e pessoas. Piso, paredes, vidros, molduras e luminárias nunca somem.
- **Pulos (`testes/pulos-zonas-vr.js`)**, com 25 m: o que muda ao atravessar cada passagem (blocos de móveis; não há teste de oclusão, então é um limite superior):
  - porta do ACIOC → corredor: aparecem 18 blocos das salas a ~20 m (frente de vidro vista de raspão) e 3 bem longe;
  - entrar no Administrativo ou nas salas: somem os da sala vizinha, atrás da divisória opaca (não se veem);
  - saindo da escada para o corredor: somem ~67 blocos do térreo a ~25 m, atrás e abaixo de quem chega;
  - corredor ↔ Incubadora: somem 3–15 blocos a 24–26 m;
  - pé da escada (hall → escada): aparecem os do Administrativo e das salas a ~10 m, mas escondidos pela laje até a pessoa subir.
  - Com 15 m, os mesmos pulos acontecem a ~14–15 m (106 blocos do térreo ao sair da escada): mais perceptível. Por isso o padrão é 25.
  - **No vidro, não testado no aparelho:** se algum pulo incomodar, a marca (A) registra onde. A primeira versão das zonas tratava a escada como térreo: ao chegar ao 1º andar, 57 blocos do Administrativo e 35 das salas surgiam a 2–4 m. A zona `escada` resolveu.

**Não aplicado (proposta, com estimativa do `medir:vr`):**
- **Compartilhar materiais iguais da estrutura** (hoje cada `std()` cria um material novo, e a mescla por material não junta nada). Estimativa: estrutura + vidros 434 → ~278 draws no ACIOC 135°, 394 → ~258 na Incubadora 315°, 282 → ~190 no café 0°. É o maior bloco que sobrou.
- LOD de triângulos: não, a pedido do usuário (o limite é draws/CPU, não pixels).

**Testes desta rodada (GPU, um por vez):**
- `vr` (seções 1–12) passou: modo teste ponta a ponta, endpoint e página `/t`, zonas, distância, e sem o aviso de `setSize`.
- `lab` (Jujuba) e `avatar` passaram.
- Hall (Jujuba), uma vez no fim: 251 verificações passaram e 1 falhou, "vidro do 1º andar permaneceu sólido fora da porta (z=14,47)". É a mesma falha intermitente da 3ª rodada (Gota, z=14,42). O ponto do teste (x = 39) fica dentro do vão da porta do podcast (x 38,1–39,1), que abre quando o boneco se aproxima; se ela abre a tempo, o corpo passa. Colisão e lógica das portas não mudaram nesta rodada. Corrigir o teste (usar x ≈ 35, num trecho sem porta) fica para quando o usuário quiser.
- `servir:https` testado com `curl`: `/t` 200; POST 204 grava a linha; texto 415; GET 405; corpo grande 413. O `npm run servir` (HTTP) não tem `/t` (404).

## 5ª rodada (02/11/2026): medições no Quest, saída pelo B, modo teste mais fácil

### Medições do usuário no Quest 3S (`testes/medicoes-vr/2026-11-02.jsonl`, fora do Git)
Quest Browser 154, 72 Hz ativo (suportadas 72/80/90/120), foveação 1. Framebuffer real: Lab 5040×2640 (×1,5), Hall 4032×2112 (×1,2). **GPU: indisponível** (o Quest Browser não expõe `EXT_disjoint_timer_query_webgl2`), então não dá para separar GPU de CPU/driver pelo jogo. Aquecimento de 20 s descartado; volta manual de 360°.

Padrão (contorno 10 m, zonas, 25 m). "fps méd" = média dos 8 setores (cada direção pesa igual); CPU = atualização + render (`renderer.render`).

| Ponto | fps méd | Pior setor (fps, draws) | Pior quadro | Draws méd / máx | CPU méd / máx (ms) |
|---|---|---|---|---|---|
| lab | 71,2 | 270° O: 69,2 · 191 | 25,7 ms | 156 / 204 | 3,3 / 3,8 |
| hall-entrada | 66,8 | 45° SE: 58,0 · 707 | 37,7 ms | 410 / 742 | 7,3 / 11,0 |
| hall-cafe | 66,6 | 315° SO: 60,8 · 577 | 39,6 ms | 419 / 596 | 8,0 / 10,6 |
| escada | 63,0 | **315° SO: 48,2 · 931** | 28,3 ms | 540 / 972 | 9,0 / 13,5 |
| acioc | 66,4 | 135° NE: 52,6 · 772 (90° L: 57,1 · 888) | 27,9 ms | 409 / 970 | 7,0 / 12,0 |
| incubadora | 64,1 | 315° SO: 51,4 · 928 (0° S: 60,9 · 768) | 28,4 ms | 487 / 960 | 8,1 / 12,4 |

Comparações nas piores direções (fps / draws):

| Variação | ACIOC 90° L | ACIOC 135° NE | Incubadora 315° SO | Incubadora 270° O | Café 45° SE | Café 90° L |
|---|---|---|---|---|---|---|
| antes (sem zonas, sem distância) | 41,1 / 1.371 | 40,8 / 1.121 | 44,5 / 1.129 | 52,7 / 1.023 | 54,3 / 885 | 58,8 / 868 |
| só distância 25 m (`-z0`) | 51,8 / 987 | 47,7 / 964 | — | — | — | — |
| só zonas (`-d0`) | 47,6 / 1.098 | 47,0 / 1.001 | 42,6 / 1.149 | 52,6 / 1.012 | — | — |
| **padrão (zonas + 25 m)** | **57,1 / 888** | **52,6 / 772** | **51,4 / 928** | **61,2 / 737** | **68,4 / 554** | **67,3 / 526** |
| zonas + 15 m (`-d15`) | 62,6 / 806 | 55,8 / 745 | — | — | — | — |

**Conclusões:**
- **Zonas e distância ajudaram de fato no Quest.** Nas piores vistas, o ganho foi de +12 a +16 fps no ACIOC, +7 na Incubadora e +9 a +14 no café, com 30–40% menos draws.
  - No ACIOC as duas contam e se somam (cada uma sozinha dá +6 a +11).
  - Na Incubadora as zonas não fazem nada (dali se vê tudo pelo vidro), como o emulador previa; o ganho é só da distância.
  - 15 m rende mais +3 a +5 fps no ACIOC, mas com pulos mais perto (ver "4ª rodada"). O padrão ficou em 25.
- **Ainda não basta:** nenhum ponto do Hall fica em 72 em todas as direções. O pior setor fica entre 48 e 61 fps em todos os 5 pontos do Hall medidos.
- **O fps acompanha os draws:** ~72 até ~200 draws, 60–68 entre 500 e 600, 51–57 entre 750 e 950, e 41–47 acima de 1.000. A CPU de render cresce ~1 ms a cada 100 draws (3,3 ms com 156; 10,7 com 888; 15,5 com 1.371). O limite continua sendo draws, não pixels.
- **Pior quadro de 25–40 ms em todos os pontos, inclusive no Lab:** são travadas isoladas, não ligadas à direção. Não investigado.
- A sessão `acioc` das 14:51 (7,6 s, sem setores, 1 marca) parece o começo da caminhada, que não foi feita. Foi descartada.
- O usuário notou que, indo do ACIOC para a Incubadora, às vezes "uma parte branca some". **Detalhe menor**, anotado nas pendências estacionadas.
- `npm run medicoes:vr` mostrava "? Hz" e "real camadas" porque o registro `inicio` sai antes de a sessão informar esses valores. O resumo agora usa o primeiro valor conhecido da sessão e termina com uma linha por teste. **A gravação não mudou.**

### Mudanças pequenas (feitas)
- **Sair segurando B** (`src/xr/sessao.js`, `src/xr/botoes.js`):
  - B do controle direito segurado 1,5 s chama `session.end()` fora do quadro, 180 ms depois de um pulso háptico (`hapticActuators[0].pulse`).
  - O anel (`O.xr.criarAnel`: borda grossa, trilho claro, preenchimento verde-folha e brilho de gota, com o rótulo "SEGURE B · SAIR DO VR") aparece depois de 0,25 s, preso à vista, e enche no sentido horário. Custa 1 draw por peça e por olho só enquanto está visível.
  - **Toque curto e segurar:** a ação curta dispara ao soltar, se o B ficou apertado menos de 0,5 s. Soltar entre 0,5 e 1,5 s não faz nada (desistiu de sair). Depois de completar, soltar não dispara nada. Um botão que já estava apertado ao entrar na sessão não conta até ser solto.
  - A ação curta é um registro de tratadores (`O.xr.sessao.aoBCurto(fn)`, o mais recente primeiro). Nesta etapa ainda não há nada aberto em VR, então só registra no log. Painéis, assento, conversa e provador se registram nas próximas etapas.
  - O atalho dos dois grips foi removido. A dica no log agora é "segure B por 1,5 s".
- **`src/xr/botoes.js`:** leitura dos botões do xr-standard por lado (borda, tempo apertado), pulso háptico e o anel. Será a base da locomoção.
- **`src/xr/veu.js`:** fade escuro preso à vista (esfera vista por dentro). Hoje serve à bateria; depois, ao teleporte, ao assento e à troca de ambiente.
- **`rig.girar(rad)`:** gira o rig em torno da cabeça (a cabeça não sai do lugar). Hoje serve ao giro automático; depois, ao giro por passos e ao suave. `rig.pronto()` diz se a cabeça já está no ponto.
- **Modo teste** (`src/xr/teste.js`):
  - **Bipes** em WebAudio, criados no toque em "Entrar em VR" (`O.xr.teste.prepararAudio`, chamado dentro do gesto), mais um pulso háptico por bipe nos dois controles. São 1 no fim do aquecimento, 2 no fim da volta e 3 no fim da bateria. **Confirmar no Quest** que o som toca durante a sessão imersiva; se não tocar, a vibração avisa do mesmo jeito.
  - **Giro automático:** depois do aquecimento, o rig gira 12°/s em torno da cabeça até completar 360°, sem mudar a posição (no emulador, desvio de 0,0 cm). Só no modo teste. `?vr-giro=<°/s>` muda a velocidade e `?vr-giro=0` desliga (aí a volta acaba quando os 8 setores tiverem 60 quadros cada).
  - Ao fim da volta sai também um registro `setores` (mesmo tipo de sempre). O `inicio` ganhou dois campos aditivos: `giroAuto` e, em bateria, `bateria: { id, passo, de }`. Tipos, campos e endpoint não mudaram.
- **Bateria** (`?vr-bateria=<id>`, listas em `src/xr/pontos.js`, que agora também guarda as variações; a página `/t` lê de lá):
  - **Viável:** vários pontos e variações de zonas, distância, contorno e **foveação** numa sessão só. As otimizações já eram recalculadas a cada quadro e a foveação muda pela camada (`fixedFoveation`, conferido na r149). Cada passo troca os parâmetros (`opcoes.definirTeste`), escurece, leva a cabeça ao ponto e ao rumo dele e só começa a gravar quando a cabeça chegou e a zona foi recalculada. O 2º passo em diante aquece 10 s (os shaders já estão compilados). Cada passo grava como um teste avulso, com o mesmo id, e no fim a sessão termina sozinha.
  - **Não viável numa sessão:**
    - **framebuffer** (só vale ao entrar): por isso `acioc-fb1` fica avulso e há uma bateria por ambiente;
    - **trocar Hall ↔ Lab** (outro framebuffer, e `irPara` ainda usa `parar()` e `requestAnimationFrame` duplo, que não servem em VR);
    - **taxa de quadros**: possível com `updateTargetFrameRate`, mas não entrou em nenhuma bateria.
  - Baterias: `hall` (9 pontos com o padrão, ~7 min), `hall-var` (10 variações nas piores vistas, ~7 min) e `lab` (`lab`, `lab-c0`, `lab-fov05`, ~2 min). Botões verdes no topo do `/t`, com o tempo estimado e quantos passos já foram medidos no dia.
- **Página `/t`:** instruções novas (parado, bipes, giro, B, bateria) e o grupo "Variações · Lab".

### Testes (GPU, um por vez)
- `vr` passou inteiro (15 seções):
  - **seção 9:** dois grips não saem; B rápido faz a ação curta, sem anel; B solto em 0,9 s mostra o anel sem sair e sem ação; B segurado sai em ~1,7 s com 1 pulso háptico; soltar depois não dispara nada; dica no log;
  - **seção 11:** agora com `?vr-giro=0` (volta manual, como antes);
  - **novas 13–15:**
    - giro automático com bipes 1,2, exatamente 360° e cabeça parada;
    - bateria Lab: três passos na ordem, parâmetros e foveação trocados e restaurados, fb ×1,5 em todos, bipes 1,2,1,2,1,3, fim automático e nada salvo;
    - bateria Hall: 9 pontos nos dois pavimentos, cada `inicio` com a cabeça no ponto (≤ 0,08 m), olhos a 1,60 m do piso e a zona certa.
- `lab` (Jujuba) e `avatar` passaram.
- O Hall completo não rodou: fica para o fim, como combinado.

### Plano proposto em 02/11 (aprovado com ajustes; ver "6ª rodada")
Ordem: 2a andar suave, giro (passos de 30° e suave), correr e vinheta → 2b pulo com A (teto pela cabeça real) → 2c teleporte (arco, chão válido e escada) → 2d em pé/sentado e recentralizar → 3a mãos e braços de gelatina nos controles (origem do laser) → 4a raio (laser, hover, gatilho e haptic) com assentos e a ligação Hall ↔ Lab → 5a kit de painel em mundo + painéis dos equipamentos → 5b elevador → 5c diálogo com NPC → 3b corpo (tronco) → 5d provador em VR → 6 painel de opções. Mãos e braços entram **antes** da interação, porque o laser sai deles; o tronco fica para depois, porque tem decisões pendentes. Ordem dos painéis: equipamentos → elevador → diálogo → provador. A cada etapa rodam só `vr`, `lab` e `avatar`; o Hall completo, no fim.

Perguntas feitas ao usuário (com a recomendação):
1. **Velocidade em VR:** 1,5 m/s andando e 2,5 m/s correndo (o desktop usa 1,8 e 3,0), ajustável por URL.
2. **Correr:** o clique do stick alterna e desliga quando o stick volta ao centro (em vez de segurar o clique).
3. **Opções antes do painel:** URL salva em `orvalho-vr` (`?vr-mov`, `?vr-giro-tipo`, `?vr-giro-passo`, `?vr-vinheta`, `?vr-postura`, `?vr-vel`), links prontos no `/t` e, como atalho temporário, Y alternando entre suave e teleporte.
4. **Pulo:** pulo real (a vista sobe ~0,42 m) com vinheta durante o salto e opção para desligar. No modo teste, A continua sendo a marca, e o pulo fica desligado.

Este resumo deve ser atualizado com o que o usuário aprovar.

## 8ª rodada (02/11/2026): fechamento da prova de conceito

- **Aprovado no Quest:** o laser, o sentar e a troca Lab → Hall (~2 s de vista escura). O usuário fechou a etapa como prova de conceito. O desempenho fica como pendência.
- **Vinheta:** atalho **X** (controle esquerdo) alterna desligada → fraca → forte, com aviso na vista e salvo em `orvalho-vr`.
  - O X do mapeamento aprovado é "Fechar (Esc)", que em VR ainda não tem uso (o B curto já fecha). Quando o painel de opções existir, rever.
  - Listado no README, no `/t` ("Controles em VR") e numa linha do log ao entrar.
- **Véu** (teleporte, sentar, troca de ambiente): preto, como a vinheta (era azul-marinho).
- **Acessórios:** o kit tem 16 de cabeça, 2 de corpo (gravata, gravata borboleta) e nenhum de braço.
  - Em VR, os de cabeça ficam ocultos **por desenho** (a cabeça não é desenhada); os de corpo **faltam fazer** (esperam o tronco, 3b).
  - As mãos recebem a cor e o tipo de braço do provador (teste da seção 20). Não havia bug.
- **Documentação para continuar sem esta sessão:** `docs/vr/` (leia-me com prompt de retomada, mudanças, estado e pendências, como testar, decisões, medições e guia de modelagem e otimização). README: seção "Rodar no Meta Quest (VR)".
- IP da rede, adaptadores de VPN e o caminho do backup foram tirados destes documentos (agora genéricos).

## 7ª rodada (02/11/2026): quadros lentos, vinheta, zonas por geometria, escada no teleporte, mãos e raio (3a, 4a)

O usuário aprovou no Quest: andar, velocidades, pulo, teleporte, giro por passos, o clique do stick direito e os avisos. Não houve travessia de parede. O fps cai um pouco no Hall, o que é esperado.

### 1. Quadros lentos de 25–40 ms: o instrumento era a causa
Bateria Lab no Quest (02/11, 16:10; o mesmo framebuffer ×1,5 em todos os passos):

| Passo | Quadros > 25 ms após o aquecimento | Por minuto | Coincidem com redesenho (3 quadros) | fps méd | pior setor | pior quadro |
|---|---|---|---|---|---|---|
| lab | 3 | 6,0 | 0% (1 de 10 na sessão inteira, 10%) | 71,1 | 70,1 | 25,6 ms |
| lab-c0 | 2 | 4,0 | 0% | 71,1 | 69,4 | 26,4 ms |
| lab-fov05 | 2 | 4,0 | 0% | 70,5 | 68,8 | 26,6 ms |
| **lab-mudo** (sem log e sem medidor) | **0** | **0** | — | **72,0** | **71,8** | **21,3 ms** |

- **Veredito:** sem o painel de log e o medidor, os quadros lentos desaparecem: 0 contra 2–3 por passo (4–6/min), e o pior quadro cai de 25–27 para 21 ms.
- Mas os picos **não** coincidem no tempo com os redesenhos: só 1 em 17, o que é o acaso (~8% medidor, ~4% log). O custo é indireto: provavelmente a coleta de lixo e a memória dos canvas e das texturas reenviadas, que estouram depois.
- A amostra é pequena (P(0 | mesma taxa) ≈ 8%). Tratei como causa provável e deixei o instrumento mais leve:
  - **medidor:** canvas de 75% (384×288), sem mipmaps, no máximo 1×/s (era 2×/s), e só redesenha (e reenvia a textura) se algum valor visível mudou;
  - **painel de log:** canvas de 75%, sem mipmaps. Redesenha na hora só quando chega mensagem nova; as medidas e o topo (posição, yaw), no máximo a cada 5 s (era ~1 s);
  - **POST:** saiu do quadro do XR. O `JSON.stringify` e o `fetch` rodam num `setTimeout(0)`. O formato dos registros não mudou.
- **Para confirmar:** rodar de novo a bateria Lab. `lab` deve ficar perto de `lab-mudo`.
- Achado no caminho: o `vr-locomocao.js` (6ª rodada) gravava as medições do teste automático no arquivo real do Quest (`testes/medicoes-vr/2026-11-02.jsonl`, 5 sessões `t-loc`). Corrigido: o teste agora usa uma pasta temporária. As 15 linhas falsas foram removidas, e a cópia de antes ficou na pasta temporária da sessão.

### 2. Vinheta
- Agora é **preta** (era azul-marinho #06213f).
- O nível 0 já existia (`?vr-vinheta=0`, salvo em `orvalho-vr`, e o link "vinheta desligada" no `/t`).
- **Custo zero desligada:** a malha fica `visible = false` em todos os quadros. Verificado em 90 quadros andando, no `vr-locomocao.js`. Sem ser desenhada, a textura nunca sobe para a GPU.

### 3. Zonas por geometria (aplicado)
- **Nova ferramenta** `testes/visibilidade-zonas-vr.js` (GPU=1, ~20 s):
  - para cada zona, amostra posições caminháveis (grade de 1 m; térreo, 1,5 m) com cabeça a 1,3 e 1,9 m;
  - de cada posição, renderiza as 6 direções com um "item buffer": cada bloco de móveis, pessoa e marcador numa cor própria; estrutura opaca em preto (oclui); vidros ocultos (não ocluem); portas ocultas (como abertas, o caso conservador);
  - imprime o que cada zona vê e uma tabela `ve` sugerida;
  - **calibração:** aborta se uma cor-id não voltar igual.
  - Três armadilhas da primeira versão, corrigidas: o preto de face única deixava paredes de dupla face "transparentes" vistas por trás; as cascas de contorno voltavam a aparecer (o `modoVR(false)` vinha depois da troca de materiais); e o "balcão do café visto do Administrativo" era o contorno de uma cadeira.
- **Pin = Cafeteria Pin**, no térreo, sob a laje do ACIOC (interativo `cafeteria`, x 4,3, z 13,25). O térreo era uma zona só; agora o café (x < 14) é a subzona `cafe`, do **grupo** `terreo`.
  - Zonas do mesmo grupo se veem sempre e contam como "zona da cabeça" para a distância máxima. O térreo não corta a si mesmo.
- **Resultado da geometria:**
  - do Administrativo não se veem a ACIOC, o café nem as salas;
  - das salas não se vê o café;
  - mas o térreo vê o painel acústico das salas (em 50 vistas) e uma peça do Administrativo (o ar-condicionado) pelos vidros do 1º andar;
  - o ACIOC vê um armário das salas;
  - as salas veem uma mesa do Administrativo.
- **Visibilidade parcial** (motor: `sala.js`): quando menos de 30% dos itens de uma zona são vistos, `ve` lista só esses: `{ zona, em: [[x0, z0, x1, z1], …] }`, um retângulo de ±0,75 m em volta do centro de cada bloco.
  - Vale para blocos de móveis, pessoas e marcadores (todos entram na análise).
  - As portas de uma zona parcial continuam aparecendo (a análise as trata como abertas).
  - A tabela de `hall-inovale.js` é a que a ferramenta gerou. **Refazer ao mudar a planta.**
- **Draws antes → depois** (emulador, 8 direções; média; pior direção):

  | Ponto | Draws médios | Direções que mudaram | Triângulos médios |
  |---|---|---|---|
  | administrativo | 508 → 433 (−15%) | 225°: 680 → 466 · 270°: 642 → 430 · 315°: 530 → 390 | 828K → 706K |
  | incubadora | 517 → 471 (−9%) | 0°: 804 → 640 · 45°: 490 → 326 | 1,09M → 1,01M |
  | andar1-vao | 574 → 550 (−4%) | 225°: 586 → 528 · 315°: 486 → 426 | 1,02M → 1,00M |
  | hall-palco | 477 → 462 | 135°: 322 → 264 | 820K → 737K |
  | hall-entrada, hall-cafe, acioc | ±1% | — | — |

  Uma primeira versão, com zonas inteiras, piorava o térreo em +100 a +270 draws (as pessoas do Administrativo voltavam a ser desenhadas). A parcial resolveu.

### 4. Mesas que somem vistas da Incubadora (medido; NÃO aplicado, aguarda o usuário)
- **Itens do térreo que a geometria diz visíveis:**
  - da Incubadora: 79, dos quais 69 além de 25 m (somem hoje) e 20 além de 40 m (o fundo do café: balcão, mesas, estante, a 40–48 m);
  - do corredor da Incubadora: 90 (51 além de 25 m; 12 além de 40 m).
- **Draws e triângulos** (emulador, com a tabela nova):

  | Vista | 25 m (hoje) | 40 m | sem limite |
  |---|---|---|---|
  | Incubadora 315° | 946 / 1,63M | 1.112 / 1,82M | 1.208 / 2,13M |
  | Incubadora 270° | 810 / 1,40M | 980 / 1,60M | 1.080 / 1,91M |
  | Corredor da Incubadora 315° | 888 / 1,32M | 1.084 / 1,75M | 1.126 / 1,80M |
  | ACIOC 135° | 956 / 1,34M | 1.066 / 1,54M | 1.166 / 1,84M |
  | 1º andar → vão 90° | 854 / 1,59M | 924 / 1,68M | 916 / 1,68M |

- **(a) 40 m** (por zona ou direção): +110 a +200 draws nas piores vistas (~+18%). Pela relação medida no Quest, ~5 fps a menos (de ~51 para ~46 na Incubadora 315°). O sumiço passa a acontecer só no fundo do café (20 itens a 40–48 m), o que ainda é notável vindo da Incubadora.
- **(b) móveis simplificados ao longe:** os contornos já não são desenhados além de 10 m. Menos segmentos tira só triângulos (estimativa: das +500K de "sem limite", metade) e **não reduz draws**, que são o limite no Quest. Sozinho, não resolve. É trabalho grande (LOD por tipo de móvel).
- **(c) materiais iguais da estrutura:** estimativa de −136 draws na Incubadora 315° e −156 no ACIOC 135° (4ª rodada). Com (c), "40 m" fica em ~976 na Incubadora 315° (hoje 946) e "sem limite" em ~1.072.
- **Recomendação:** (c) primeiro e, com a sobra, (a) "sem limite" ou ≥ 48 m só para o térreo visto do 1º andar. É o único jeito de o fundo do café não sumir sem perder fps em relação a hoje.

### 5. Escada descendo no teleporte (corrigido)
- **Reprodução** (emulador, do topo a 4,20 m, olhando para baixo):
  - só miras muito inclinadas (−40° a −60°) eram válidas, pousando 0,4–1 m abaixo, a 1–2 m de distância;
  - as miras naturais (−30° a 0°) pousavam mais de 1 m abaixo e eram **recusadas**, inclusive o patamar (2,10);
  - do patamar, o mesmo.
  - Subindo funcionava porque a rampa "vem ao encontro" do arco; descendo, ela foge dele.
- **Opções avaliadas:**
  - grudar na rampa a no máximo 1 m: continuaria com 4–5 pulos;
  - andar suave assistido só na escada: mistura os modos e é o menos confortável para quem escolheu teleporte;
  - **paradas da escada**: escolhida, por ser a mais simples e confortável.
- **Feito:**
  - quando o arco pousa na escada (ou a até 0,6 m das pontas), o alvo gruda na parada mais próxima do pouso: pé, patamar ou topo, menos a parada em que a pessoa já está. O marcador fica na parada;
  - o desnível maior que 1 m é aceito só nesse caso, porque o caminho pela escada é contínuo;
  - sobe e desce em 2 teleportes (0 → 2,1 → 4,2 → 2,1 → 0, testado);
  - mirar além da escada, no chão do térreo, continua recusado;
  - motor: `amb.paradasEscada(x, z)`, em `sala.js`.

### 3a. Mãos (`src/xr/maos.js`)
- Em cada controle, o braço de gelatina do próprio boneco, com a **mesma geometria e os mesmos materiais** (cor, tipo de braço e contorno do provador; trocar o braço no avatar troca a mão).
- Tamanho de mão: o braço normal com 0,30 m; curto e bolinha, proporcionalmente menores.
- Preso ao `targetRaySpace`, com a **ponta na origem do raio** (verificado: 0,0 cm). O corpo do braço fica para trás, sobre o controle.
- Sem modelos de controle.
- No modo teste as mãos ficam ocultas, para as medições continuarem comparáveis.
- O tronco (3b) continua para depois.

### 4a. Raio (`src/xr/raio.js`)
- **Laser** de cada mão, a partir da ponta. Sem alvo: curto (0,18 m), translúcido, aquático. Com alvo: vai até ele, verde, com um ponto, um anel e a pílula com o rótulo virada para a cabeça. Tique háptico ao entrar num alvo.
- **Alvos:** os interativos (equipamentos, assentos, pessoas, ligação Lab → Hall, elevador).
  - O alvo clicável é **maior que o visual**: tolerância angular até `atan(R / d)`, com R de 0,3 m (bolha), 0,45 (assento, ligação), 0,5 (pessoa) e 0,4 (elevador), e mínimo de 3°;
  - **alcance de 4,5 m**, só no pavimento atual, sem parede ou vidro no caminho (para pessoas, até o ponto de atendimento à frente delas: a Keila fica atrás do balcão).
- **Gatilho** daquela mão:
  - assento → sentar;
  - porta do Lab → troca de ambiente;
  - equipamento, pessoa e elevador → aviso "… EM VR: NA ETAPA 5" (os painéis ainda são DOM).
- **Sentar:**
  - véu; a cabeça vai para o assento, olhando para a frente dele;
  - locomoção travada (o giro continua) e rig fixo, sem colisão, como o boneco sentado no desktop;
  - na postura "em pé", a vista baixa até 0,72 m acima do assento (1,22 m do piso num assento de 0,50 m); na postura "sentado", **só trava a posição**.
  - **Levantar:** B curto (primeiro tratador real do `aoBCurto`) ou empurrar o stick esquerdo (depois de 0,5 s). Vai para a saída do assento, com véu, e a vista volta.
- **Troca de ambiente em VR:** `O.jogo.vr.irPara(id)` monta o ambiente novo dentro da sessão (sem `parar()` nem `requestAnimationFrame` duplo), com a vista escura, põe o jogador na chegada e compila os shaders. O framebuffer continua o da entrada (×1,2).
  - **Só existe a ligação Lab → Hall** (a porta do Lab). O Hall não tem caminho de volta ao Lab nem no desktop, desde que a ligação pelo elevador foi removida. Nenhuma porta foi inventada.
- No modo teste o raio fica desligado (gatilho e A são a marca).

### Testes (GPU, um por vez)
- `vr-locomocao.js` ganhou:
  - as seções 20 (mãos), 21 (raio: alvo, tolerância de 6° pega e 20° não, alcance, gatilho), 22 (sentar e levantar nas duas posturas, stick travado, B e stick levantam) e 23 (Lab → Hall em VR);
  - a escada no teleporte (paradas) e a vinheta desligada;
  - filtro `SECOES=20,21`.
- `vr.js`, seção 12: do ACIOC, o Administrativo fica oculto e das salas só o bloco visto.
- Resultado da rodada completa: ver `TESTES-E-VALIDACAO.md` (02/11, 7ª rodada).

### Checklist do Quest (7ª rodada)
1. **Picos:** "bateria Lab" e depois `npm run medicoes:vr`. Os passos `lab` e `lab-mudo` devem ter perto de 0 quadros > 25 ms.
2. **Vinheta:** andar com "vinheta fraca" (deve ser preta) e com "vinheta desligada" (nada escurece).
3. **Zonas:** no Administrativo, olhar para o oeste: nada some ou aparece de repente. Do térreo, olhar para o 1º andar (salas e Administrativo pelo vidro) e andar do ACIOC para a Incubadora. Marcar com A se algo pular.
4. **Escada no teleporte:** do topo, mirar a escada (vai ao patamar) e de novo (vai ao pé); subir do mesmo jeito.
5. **Mãos:** ver os dois braços de gelatina com a cor do avatar, na posição da mão, sem tremer.
6. **Laser:** passar o laser por uma bolha do Lab (fica verde, rótulo "Ver projeto", tique) e apertar o gatilho (aviso da etapa 5). Mirar um pouco ao lado e conferir que ainda pega. Mirar algo a mais de 5 m: não pega.
7. **Sentar:** num assento dos arcos do térreo, gatilho: senta olhando para a frente, com a vista mais baixa. B curto levanta. Sentar de novo e empurrar o stick para levantar. Com o link "sentado" do `/t`, sentar só trava.
8. **Lab → Hall:** no Lab (`jogar lab`), mirar a porta ("Ir para Hall do Polo Inovale"), gatilho: vai para o Hall sem sair do VR. Anotar quanto tempo a vista fica escura.
9. **Keila:** mirar a Keila de perto: "Conversar" e, no gatilho, o aviso da etapa 5.
10. Sair segurando B.

### Verificado só no emulador (o Quest confirma)
- O tamanho e a posição das mãos (no IWER, o `targetRaySpace` coincide com o controle; no Quest pode haver um ângulo entre a empunhadura e o raio).
- Se a tolerância angular e o alcance são confortáveis.
- A legibilidade do rótulo.
- O tempo de vista escura na troca Lab → Hall (no Quest, montar o Hall pode levar alguns segundos).
- O conforto ao sentar (vista baixando).
- Se os picos sumiram de fato.
- A ausência de "pulos" visuais com a visibilidade parcial.

## 6ª rodada (02/11/2026): quadros lentos, framebuffer e locomoção (etapas 2a–2d)

### Decisões do usuário nesta rodada
- Velocidades em VR: 1,5 m/s andando e 2,5 m/s correndo, ajustáveis pela URL.
- Correr: clique do stick esquerdo enquanto empurra; ao soltar o stick, para de correr.
- Opções: pela URL, por links no `/t` e por dois atalhos no VR (Y: suave/teleporte; clique do stick direito: passos/suave). Tudo salvo em `orvalho-vr`; no modo teste, nada é salvo.
- Pulo real, com vinheta durante o salto e opção para desligar. No modo teste, A continua sendo a marca.
- Teleporte: empurrar o stick esquerdo para a frente mostra o arco e soltar teleporta. No modo "andar suave", o mesmo stick só anda.
- Framebuffer do jogo normal: ×1,2 em qualquer ambiente. O "auto" por ambiente (Lab ×1,5) fica só no modo teste.
- **Para a 4a (anotado, não implementado):**
  - o alvo clicável das bolhas, pessoas e assentos é maior que o visual (tolerância angular), com alcance máximo de ~4–5 m;
  - com a postura "Sentado" ativa, sentar não abaixa a vista: só trava a posição.
- Parar depois da 2d para o teste no Quest, antes da 3a.

### Quadros lentos de 25–40 ms (investigação; o instrumento não foi mudado)
- **Nos dados do Quest:** em 42 das 62 janelas de 10 s, depois do aquecimento, o pior quadro ficou entre 25 e 29 ms, inclusive no Lab com 156 draws.
  - Isso é ~1 quadro perdido (2 × 13,9 ms) por janela, em toda janela.
  - Picos de 30–39 ms aparecem em 8 janelas.
  - O padrão combina com algo periódico, mas os registros antigos só têm o pior quadro de cada janela de 10 s. **Não dá para atribuir com eles.**
- **O que o instrumento faz periodicamente:**
  - o medidor redesenha um canvas de 512×384 e reenvia a textura **a cada 0,5 s**;
  - o painel de log redesenha 640×520 **a cada ~1 s** (o rótulo muda com a posição e o yaw);
  - o POST e a linha `[Orvalho VR]` no console saem **a cada 10 s**.
  - Os dois redesenhos geram mipmaps a cada envio. Num GPU de tiles, enviar um canvas à textura pode exigir sincronização. É o suspeito mais forte, mais que o POST de 10 s.
- **No emulador (RTX 4060):** mediana de 5 ms e só 1 pico (na entrada da sessão). O PC não reproduz o fenômeno, então não serve para decidir.
- **Feito:**
  - cada quadro acima de 25 ms agora fica registrado no modo teste, nos campos aditivos `picos` (`[{ t, ms, ev }]`) e `picosTotal` do `resumo` e do `fim`;
  - `ev` traz os eventos do instrumento nos 3 últimos quadros (`medidor`, `log`, `envio`, `console`), porque o custo de um redesenho aparece no render do quadro seguinte e só é medido no outro;
  - o `medicoes:vr` mostra os quadros > 25 ms por minuto, a % que coincide com cada evento e a distribuição pelo segundo do ciclo de 10 s.
  - **Linha de base para ler esses números:** por acaso, ~8% dos quadros coincidem com o medidor e ~4% com o log.
- **Controle:** a bateria Lab ganhou o passo `lab-mudo` (sem painel de log e sem medidor). Se `lab-mudo` tiver bem menos quadros > 25 ms que `lab`, a causa é o instrumento. Aí a correção seria:
  - textura sem mipmaps;
  - medidor a 1×/s;
  - log só quando o texto muda;
  - e o POST fora do quadro (`setTimeout`).
- **Ainda não mudei nada no instrumento**, para não perder a comparação. Se nada coincidir, a causa é outra: sistema, compositor ou coleta de lixo.

### Locomoção (feito; `src/xr/locomocao.js`, chamado por `sessao.js` antes de `rig.passo`)
- **Andar suave (2a):**
  - stick esquerdo, na direção da cabeça (frente, trás e lados);
  - zona morta 0,15, velocidade proporcional à inclinação até 1,5 m/s;
  - o movimento entra no rig (`rig.deslocar`) e a colisão da cabeça decide: a mesma do andar físico, com escada, paredes, vidros, guarda-corpos e vazio (`null` recusa).
- **Correr:** clique do stick esquerdo enquanto empurra (2,5 m/s); desliga quando o stick volta ao centro.
- **Giro:**
  - por passos: 30° ao passar de 0,7, e rearma abaixo de 0,3;
  - suave: 90°/s;
  - os dois em torno da cabeça (`rig.girar`). Direita = sentido horário visto de cima.
- **Vinheta:**
  - plano de 2,4 m a 0,3 m da vista, preso à câmera, com miolo transparente;
  - fraca: claro até ~30° e escuro a partir de ~50°; forte: escala 0,63;
  - acende ao andar, no giro suave e no pulo, e some em ~0,7 s;
  - no giro por passos e parado, fica oculta (0 draws).
- **Pulo (2b):**
  - A, só do chão, a ~0,42 m, sem pulo duplo;
  - o topo da cabeça (olhos + 0,11 m) não passa do forro (`tetoEm`) nem de **2,10 m acima do piso** (altura das portas). Com olhos a 1,60 m, o pulo fica em 0,39 m. É a solução simples para a cabeça não atravessar vergas (a colisão é só em x/z): pessoas mais altas pulam menos;
  - vinheta durante o salto; `?vr-pulo=0` desliga;
  - no modo teste, A é a marca e não pula.
- **Teleporte (2c):**
  - com `mov = teleporte`, empurrar o stick para a frente mostra o arco a partir da mão esquerda (`targetRaySpace`, lido com `renderer.xr.getFrame()` e `frame.getPose`): parábola com 8 m/s e gravidade 9,8, em até 70 bolinhas aquáticas (1 InstancedMesh), e um alvo no chão, anel com miolo;
  - verde = válido; coral = inválido;
  - **válido:** o arco não cruza parede, vidro, guarda-corpo, pilar nem porta fechada do pavimento atual (`colisao.raio`; móveis baixos não barram o arco); pousa num piso com **no máximo 1 m de desnível** em relação à cota atual (mesmo pavimento, ou subir e descer a escada em pulos); e o corpo cabe ali (o `resolver` não empurra).
  - Ou seja: não se muda de andar pelo vão nem se pula o guarda-corpo.
  - Soltar o stick teleporta, com um véu de 0,1 s. Soltar num alvo inválido não faz nada.
  - **Bug encontrado e corrigido pelo teste:** na rampa da escada, o alvo era sempre recusado, porque o piso do ponto de pouso era comparado com o do ponto amostrado (a rampa é inclinada).
- **Postura (2d):**
  - "sentado" mede a cabeça rastreada (média de ~0,4 s, ~1 s depois de entrar e a cada recentralização do sistema, segurando o botão Meta) e eleva a vista até 1,60 m acima do piso;
  - "em pé" usa a altura real;
  - recentralizar: o do sistema já funcionava (`reset` → `rig.centrar`) e agora também remede a postura. O botão próprio vem com o painel de opções.
- **Aviso em mundo** (`O.xr.criarAviso`, em `botoes.js`): pílula Aero que aparece por 1,6 s nos atalhos ("MOVIMENTO: TELEPORTE", "GIRO: SUAVE"), com um tick háptico.
- **Opções** (`opcoes.js`):
  - `mov`, `giroTipo`, `giroPasso` (vale a escolha mais próxima de 15/30/45/90), `giroVel`, `vinheta`, `postura`, `vel`, `velCorrer` e `pulo`;
  - URL: `?vr-mov`, `?vr-giro-tipo`, `?vr-giro-passo`, `?vr-giro-vel`, `?vr-vinheta`, `?vr-postura`, `?vr-vel`, `?vr-correr`, `?vr-pulo`;
  - `opcoes.alterar()` salva no jogo normal e, no modo teste, vale só nesta carga.
- **`/t`:** blocos "Jogar (sem modo teste)" (Lab, Hall · entrada, pé da escada, 1º andar · vão, ACIOC) e "Opções de movimento". O ponto `escada-pe` é novo.

### Testes (GPU, um por vez)
- `npm run teste:vr` agora roda `testes/vr.js` e o novo `testes/vr-locomocao.js` (seções 16–19; peças comuns em `testes/vr-comum.js`). Sozinho: `npm run teste:vr:locomocao`.
- O `vr-locomocao.js` verifica:
  - padrões e URL;
  - fb ×1,2 no jogo e ×1,5 no Lab só no modo teste;
  - velocidade de 1,50 m/s andando e 2,52 correndo, na direção da cabeça, de lado e para trás;
  - correr para ao soltar o stick;
  - vinheta só em movimento;
  - giro de exatamente 30°, sem repetir e sem sair do lugar, e giro suave a 90°/s;
  - atalhos salvos e com aviso;
  - Lab sem atravessar nada;
  - escada pelo stick até 4,20 m;
  - guarda-corpo do vão sem cair;
  - pulo de 0,39 m (limite de 2,10 m), sem pulo duplo e com vinheta;
  - teleporte válido no chão, inválido na fachada e no vão, e na escada só até 1 m;
  - sentado a 1,60 m e em pé com a altura real;
  - no modo teste, A não pula e o Y não salva.
- O `vr.js` foi atualizado: fb ×1,2 no Lab fora do modo teste, bateria Lab com 4 passos e campos `picos`.
- Resultado dos quatro (`vr`, locomoção, `lab`, `avatar`): ver "Testes" em `TESTES-E-VALIDACAO.md` (02/11, 6ª rodada).

### Checklist do Quest (etapas 2a–2d)
Use `npm run servir:https` e abra `/t` no Quest. Os botões "jogar …" abrem o jogo sem modo teste.
1. **Lab** (`jogar lab`): andar com o stick nas 4 direções; paredes e móveis barram, sem tremer.
2. **Hall** (`jogar hall-entrada`): andar pelo salão.
3. **Correr:** clicar o stick esquerdo enquanto empurra; soltar o stick e conferir que para de correr.
4. **Giro:** 30° para a direita e para a esquerda; segurar o stick não repete.
5. **Escada** (`jogar escada-pe`): subir e descer com o stick.
6. **Vidro e guarda-corpo** (`jogar andar1-vao`): empurrar contra o guarda-corpo do vão e contra um vidro; não passa nem cai.
7. **Pulo:** pular parado, andando, sob uma porta e na escada. Anotar se enjoa.
8. **Teleporte:** apertar Y (aviso "MOVIMENTO: TELEPORTE") e mirar no chão (verde, soltar vai), na parede (coral, soltar não faz nada), no vão do 1º andar (coral) e nos degraus (verde até ~1 m acima). Apertar Y de novo para voltar.
9. **Giro suave:** clicar o stick direito (aviso "GIRO: SUAVE") e comparar o conforto; clicar de novo.
10. **Postura:** link "sentado" do `/t`, entrar sentado numa cadeira (a vista deve ficar na altura de quem está em pé); recentralizar segurando o botão Meta; voltar com o link "em pé".
11. **Vinheta:** comparar "fraca" e "forte" pelos links, e anotar se ajuda ou incomoda.
12. **Sair:** segurar B por 1,5 s (anel e vibração).
13. **Quadros lentos:** rodar a "bateria Lab" (4 passos, ~2,5 min) e depois `npm run medicoes:vr` no PC.

### Verificado só no emulador (o Quest confirma)
Conforto da velocidade e da vinheta; sensação do giro de 30° e do suave; leitura do arco e das cores do alvo; se a mira sai da mão certa e no ângulo esperado (no IWER, a pose do `targetRaySpace` é a do controle); se o pulo de 0,39 m enjoa; a altura sentada; o deadzone e o drift reais dos sticks; se o clique do stick direito é confortável como atalho; se o aviso é legível.

## Testes com a GPU da máquina (31/10/2026)

`testes/navegador.js` centraliza a abertura do Chromium para `fluxo-avatar`, `navegacao`, `primeiro-andar`, `vr` e `medir-vr`.
- **Padrão (sem mudança):** WebGL por software. Nesta máquina é o "Microsoft Basic Render Driver" (WARP), não o SwiftShader.
- **`GPU=1`:** `--use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu --enable-gpu-rasterization` com o headless novo (RTX 4060). Se não pegar, avisa e segue por software.

Tempos, um teste por vez, com limite de tempo:

| Teste | Software | GPU |
|---|---|---|
| avatar | 11 s | 9 s |
| Lab Jujuba | 64 s | 32 s |
| Hall Jujuba | 1.232 s, 28 falhas por tempo esgotado | 568 s, 0 falha |
| vr | 144 s | 36–47 s |

- `teste:tudo` completo com GPU: ~31 min, com os 8 testes rodados à parte.
- Hall Gota com GPU teve 1 falha intermitente ("vidro do 1º andar", z = 14,42). Ao repetir, passou, e também passou contra a cópia sem VR (z = 14,23).
- Prints: as diferenças vêm do tempo (posição da câmera, dica do HUD ainda visível, boneco preso na escada no modo software), não da maneira de desenhar.

## Testes (31/10/2026, Windows desta máquina)

| Teste | Resultado |
|---|---|
| `teste:vr`, código novo | **passou tudo** |
| `teste:avatar` e Lab (3 corpos) | passaram, mas numa rodada feita enquanto os arquivos eram editados: **refazer** |
| Hall (3 corpos) | **inconclusivo**: até o código original (rodado da cópia do backup) deu "tempo esgotado" nos percursos do Hall nesta máquina; a última rodada foi interrompida pelo sistema por falta de memória |

**Rodada de 31/10 (depois do log/HTTPS):** `teste:tudo` passou no avatar e no Lab (Jujuba, Gota e Esguio). O Hall Jujuba deu 22 falhas: escada parada em y = 2,10, portas abrindo só até ~0,5–0,6 e elevador. Na mesma máquina, a **cópia de backup sem VR deu as mesmas 22 e mais 5** (tempo esgotado). Logo, não é regressão do VR: é lentidão desta máquina nos percursos do Hall. A suíte para no primeiro Hall, então Gota/Esguio no Hall e o `teste:vr` dentro do `teste:tudo` não rodaram. O `teste:vr` foi rodado à parte e passou inteiro, com a seção 8. Pendente: rodar o Hall numa máquina mais rápida.

O `teste:vr` cobre:
- botões sem e com WebXR, e o destaque no Quest;
- sessão em local-floor;
- câmera no rig, HUD escondido, boneco oculto;
- a cabeça entra no ponto e no rumo do boneco, com olhos a 1,60 m;
- 12 m de caminhada física no Lab sem atravessar nada;
- a escada do Hall andando, de 0 a 4,20 m, com a altura salva;
- fallbacks para bounded-floor e para local (olhos a +1,6 m);
- saída que restaura o desktop (câmera solta, HUD, boneco, W anda, posição salva);
- console sem erros.

**Para rodar os testes no Windows:**
```sh
export CHROMIUM="$LOCALAPPDATA/ms-playwright/chromium-1248/chrome-win64/chrome.exe"   # Git Bash
npm run teste:tudo
```
`testes/vr.js` acha o Chromium sozinho; os outros testes precisam de `CHROMIUM`. O fps do emulador (cerca de 8) não representa o Quest. No Lab o emulador contou cerca de 224 draw calls (dois olhos).

## Checklist da etapa 1 no Quest 3S (ainda não feito)

Rodar `npm run servir:https` e abrir no Quest Browser a URL que o terminal mostrar (`https://<IP>:8443/?vr-log=1`). No aviso, tocar em Avançado → Continuar. O quadro de diagnóstico precisa mostrar isSecureContext **sim** e navigator.xr **sim**. Com modo desenvolvedor, o caminho alternativo é `npm run servir` + `adb reverse tcp:8000 tcp:8000` + `http://localhost:8000`.

1. O botão "Entrar em VR" aparece com destaque na tela inicial. Entrar por ele e também pelo botão de óculos do HUD.
2. A entrada não fica muito tempo em tela preta.
3. **Escala:** olhando para baixo, o chão está nos pés. Portas e mesas parecem do tamanho real. Anotar a impressão dos NPCs de 1,30 m (Keila, Dagliê).
4. Você aparece onde o boneco estava, olhando para onde ele olhava.
5. **Andar fisicamente:** paredes, vidro e guarda-corpo barram. Inclinar a cabeça contra a parede não atravessa. Subir a escada andando, se houver espaço.
6. Segurar o botão Meta para recentralizar: a vista se reposiciona sem atravessar paredes.
7. **Conforto:** a imagem não treme nem congela.
8. **Medidor:** o texto é legível? Anotar fps e draw calls em três pontos: no Lab, no centro do Hall olhando o palco, e na Incubadora do 1º andar. Anotar também com `?vr-fb=0.8` e com `?vr-fov=0`.
9. **Sair:** botão Meta e depois sair. O desktop volta, com o boneco onde você estava.
10. Se algo falhar: ler o painel de log dentro do VR e o quadro de diagnóstico depois de sair (sem modo desenvolvedor não há `chrome://inspect`).

## Incertezas para confirmar no aparelho

- Se o Quest pausa o `requestAnimationFrame` da janela durante a sessão. A entrada pela tela inicial já monta o jogo sem esperar por ele, mas o véu só some pelo `aoPronto`; ao sair, `sessao.js` esconde o véu.
- Se a página fica "oculta" (`visibilitychange`) durante a sessão. Em VR o jogo ignora esse evento.
- Como se sai da sessão no Quest Browser. Ainda não há botão "Sair do VR"; ele vem na etapa 6.
- Se o ☰ esquerdo chega ao WebXR.
- Legibilidade do medidor (painel de 24 cm a 70 cm).

## Pontos a decidir

- **NPCs com 1,30 m.** Em VR, com olhos a ~1,6 m, a pessoa olha os NPCs de cima. Escalar só em VR mexe na bolha, no olhar e no estrado de 0,45 m da Keila. Decidir depois de ver no Quest.
- **Tronco escalado (etapa 3).** Para a cabeça coincidir com os olhos, o fator é ~1,6×. A Jujuba fica com ~2,1 m de altura e ~1,1 m de largura de tronco (a Gota, ~1,2 m), mais larga que o colisor (0,66 / 0,74 / 0,53 m) e que o corredor de fundo do Lab (0,97 m). Opções: aceitar, usar um fator menor com o tronco mais baixo, ou ligar "Ocultar corpo" por padrão.
- **O Lab é mais largo que a sala real** (+20% no comprimento, +60% na largura, decisão já registrada). Em VR ele vai parecer espaçoso. Não mexer sem o usuário pedir.
- **Pulo sob vergas.** A colisão é só em x/z, então uma pessoa alta pulando sob uma porta de 2,10 m passa a cabeça pela verga. Na etapa 2, o teto do pulo deve usar a altura real da cabeça.

## Riscos já levantados para as próximas etapas

- **Desempenho:** sem multiview, gelatina com clearcoat nos móveis e vidros transparentes desenhando uns sobre os outros. Medir antes de simplificar.
- **Painéis em canvas:** carregar as fontes (`document.fonts`) antes de desenhar e redesenhar só quando algo muda. As miniaturas SVG do provador precisam das cores aplicadas no lugar de `var(--c1)`; confirmar que não sujam o canvas no Quest Browser.
- **Provador VR:** a vitrine usa um segundo `WebGLRenderer`, que não aparece no headset. Em VR o palco será um 2º `criarBoneco` na cena principal.
- **`O.jogo.pausar()` e `irPara` usam `parar()` e `requestAnimationFrame` duplo.** Em VR o `parar()` já não para o desenho, mas a troca de ambiente (Hall ↔ Lab) e o elevador precisam de um caminho próprio: fade, e um `setTimeout` no lugar do `requestAnimationFrame` duplo.
- **Elevador e aviso "Levantar":** hoje são DOM e serão recriados em mundo.
- **CSP futura do Flask:** as miniaturas em `data:` vão exigir `img-src data:`.
- **GitHub Pages:** publica só a `main`. Para testar a branch no Quest, usar `npm run servir:https` (ou `adb reverse` com modo desenvolvedor); não publicar a branch no site.
