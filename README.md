# Orvalho VR · Polo Inovale em 3D e em realidade virtual

Versão **VR (WebXR)** do [Orvalho](https://github.com/millerinds/Orvalho): o mesmo jogo 3D no navegador (estilo Frutiger Aero, boneco de vidro-gelatina, Lab de IA e Hall do Polo Inovale), com a opção de **entrar em VR** num headset compatível, sem instalar nada.

**Jogar online:** <https://millerinds.github.io/Orvalho-VR/> · **Repositório:** <https://github.com/millerinds/Orvalho-VR>

**Versão tradicional (sem VR):** <https://millerinds.github.io/Orvalho/> · <https://github.com/millerinds/Orvalho>

## Autoria

O porte para VR (WebXR) foi desenvolvido por **Kalil**: sessão e rig de câmera, locomoção, teleporte, mãos de gelatina, laser, sentar, troca Lab → Hall, medidor de desempenho, otimizações do Hall (células de recorte e zonas de visibilidade) e os testes com o IWER. Os commits dele estão preservados neste histórico (branch original `recurso/vr-webxr`). A base é o "Orvalho 1.0" de Juan Miller. Documentação do porte: [`docs/vr/`](docs/vr/LEIA-ME-VR.md).

## Relação com o Orvalho tradicional

- São **repositórios e sites independentes**. Este repositório começou do commit `f192392` ("Orvalho 1.0: primeira versão pública") do `Orvalho`, mais os commits do VR. Nada aqui altera o repositório, o Pages ou as Actions do `Orvalho`.
- No desktop, sem headset, a imagem e os controles são os do Orvalho tradicional (ver [`docs/vr/MUDANCAS-EM-RELACAO-A-VERSAO-SEM-VR.md`](docs/vr/MUDANCAS-EM-RELACAO-A-VERSAO-SEM-VR.md)).
- Os dois sites ficam na mesma origem (`millerinds.github.io`), então **compartilham o `localStorage`**: o avatar e o ponto salvo da exploração passam de um para o outro. O formato do save é o mesmo nas duas versões; o VR só acrescenta a chave `orvalho-vr`.

## Três níveis de experiência (não confundir)

1. **Navegação convencional no computador:** teclado e mouse, como no Orvalho tradicional. Funciona em qualquer navegador moderno com WebGL.
2. **Visualização 3D no navegador:** o mesmo ambiente em celular ou computador, sem imersão.
3. **Sessão VR imersiva:** só num headset com navegador WebXR (alvo e único aparelho testado: **Meta Quest 3S, Quest Browser**). O botão **Entrar em VR** só aparece quando o navegador oferece `immersive-vr`; sem suporte, ele fica oculto e o jogo segue normal no modo 1/2.

## Dispositivos e navegadores testados

| Ambiente | Situação |
|---|---|
| Meta Quest 3S · Quest Browser | Testado por Kalil em 02/11/2026 (servidor local HTTPS): entrar/sair, andar, girar, pular, teleporte, mãos, laser, sentar, Lab → Hall. Desempenho no Hall: 48–53 fps nas piores vistas (alvo 72). Ver [`docs/vr/MEDICOES-RESUMO.md`](docs/vr/MEDICOES-RESUMO.md). |
| Chromium (playwright) + IWER, emulador da Meta | Suíte `teste:vr` (inclui `testes/vr-elevador.js`: Lab → cabine → Hall → 1º andar → Lab numa sessão só), `teste:avatar`, `teste:navegacao`, `teste:primeiro` e `teste:elevador` (elevador no desktop: Lab → Hall → 1º andar → Lab) passando. O emulador **não** comprova conforto, fps nem comportamento no headset. |
| Site publicado no GitHub Pages | Ver a seção "Publicação". **A sessão imersiva a partir da URL pública ainda precisa ser validada num headset real.** |

## Limitações conhecidas

- Prova de conceito: painéis de equipamentos, conversa com NPCs e provador **ainda não funcionam dentro do VR** (aparece o aviso "… EM VR: NA ETAPA 5"). Fora do VR funcionam normalmente. O **elevador funciona em VR** (veja abaixo).
- Elevador em VR: a cabine fica fora da colisão do Hall; lá dentro a posição fica travada (só a cabeça gira), como ao sentar. O Lab não tem elevador modelado (sem foto/planta): a porta do Lab leva à cabine do elevador do Hall, e "Lab IA" aparece no painel **sem número de pavimento** (ligação provisória). 2º e 3º andares indisponíveis.
- No desktop vale a mesma lógica: a porta do Lab ("Ir ao elevador") leva ao Hall, diante do elevador, com o painel aberto e o visor em "Lab"; o painel tem "Lab IA" (sem número de pavimento), que volta ao Lab. No desktop o boneco não entra na cabine: fica diante das portas, como antes.
- Não há tronco do boneco no VR (só as mãos) nem painel de opções em mundo; as opções são atalhos (Y, X, clique do stick direito) ou parâmetros de URL.
- Desempenho do Hall no Quest abaixo de 72 fps em algumas vistas (escada, Incubadora, ACIOC).
- Caminho físico Hall → Lab inexistente (falta referência do trajeto real); no desktop e no VR, a volta ao Lab é pelo elevador ("Lab IA").
- Outros headsets e navegadores (Pico, Vision Pro, Chrome com headset no PC etc.) não foram testados.
- Lista completa: [`docs/vr/ESTADO-E-PENDENCIAS.md`](docs/vr/ESTADO-E-PENDENCIAS.md).

## Demonstração (roteiro rápido)

1. No Quest, abra o **Quest Browser** em <https://millerinds.github.io/Orvalho-VR/> (HTTPS, exigido pelo WebXR).
2. Monte o boneco (ou **Continuar**) e toque em **Entrar em VR**; aceite a permissão do navegador.
3. Stick esquerdo anda, stick direito gira, gatilho usa o laser (sentar, elevador), A pula, Y alterna andar suave/teleporte. **B segurado 1,5 s sai do VR.**
4. **Elevador (roteiro Lab → Hall → 1º andar → Lab):**
   - no Lab, mire a porta ("Ir ao elevador") e aperte o gatilho: você aparece dentro da cabine do Hall, com o visor em "Lab";
   - olhe para a parede **à direita**: o painel tem Térreo, 1º andar, Lab IA, 2 e 3 (indisponíveis) e "Sair da cabine". O botão mirado acende;
   - escolha Térreo: portas abrem; saia pelo botão "Sair da cabine", com B rápido ou empurrando o stick esquerdo;
   - no Hall, mire "Chamar elevador" junto às portas: elas abrem e o alvo vira "Entrar no elevador"; gatilho de novo para entrar;
   - escolha 1º andar (ou Lab IA para voltar ao Lab).
5. Sem headset, a mesma URL mostra o jogo no modo desktop normal.

## Como atualizar a versão VR

1. Trabalhe numa branch a partir da `main` deste repositório, rode os testes (`GPU=1 npm run teste:vr`, `teste:navegacao`, `teste:avatar`) e abra um PR para a `main`.
2. O merge na `main` publica sozinho (workflow `.github/workflows/pages.yml`, ~1 min).
3. Para trazer mudanças do Orvalho tradicional: `git remote add tradicional https://github.com/millerinds/Orvalho.git`, `git fetch tradicional` e faça merge/cherry-pick numa branch, testando o VR antes do PR. O inverso (levar o VR para o tradicional) é decisão à parte; não empurre daqui para lá.

## Tecnologias

- HTML, CSS e JavaScript puros, com scripts clássicos no espaço de nomes `window.Orvalho`. Não há bundler nem etapa de build, e funciona até por `file://`.
- [three.js r149](https://threejs.org/) (cópia local em `vendor/three-r149.min.js`): material vidro-gelatina com shaders próprios, `InstancedMesh` para móveis repetidos e texturas desenhadas em canvas.
- Persistência no `localStorage` do navegador (aparência do avatar e ponto da exploração).
- Testes com [playwright-core](https://playwright.dev/) (só para desenvolvimento), dirigindo o boneco pelo teclado num Chromium real.
- Publicação estática no GitHub Pages por GitHub Actions.

## Como rodar

Não precisa instalar nada nem fazer build.

- **Mais simples:** abra `index.html` no navegador (duplo clique). Funciona por `file://`.
- **Com servidor local** (recomendado para desenvolver):
  ```sh
  python3 -m http.server 8000
  ```
  e abra <http://localhost:8000>.

As fontes vêm do Google Fonts. Sem internet, o navegador usa as fontes de reserva e o resto funciona igual: o three.js está em `vendor/`.

## Controles

| | |
|---|---|
| `W A S D` ou setas | andar (relativo à câmera), inclusive na escada principal |
| `Shift` | correr |
| `Espaço` | pular (só do chão; sem pulo duplo) |
| arrastar o mouse | girar a câmera |
| roda do mouse | aproximar e afastar |
| `E`, `Enter` ou clique na bolha | interagir com o equipamento em foco (Espaço agora é o pulo) |
| `P` ou botão do cabide | abrir o provador sem sair do lab |
| `E` perto de um assento | sentar (E, Espaço, Esc ou andar para levantar) |
| `E` na frente de uma pessoa | conversar (a câmera enquadra a pessoa; `Esc` encerra) |
| `Esc` | fechar painel ou provador |

## Rodar no Meta Quest (VR)

O jogo roda em VR pelo **Quest Browser** (ou qualquer navegador com WebXR), sem instalar nada no headset. A documentação completa está em [`docs/vr/`](docs/vr/LEIA-ME-VR.md).

1. **No PC**, na pasta do projeto (Node.js instalado):
   ```sh
   npm install
   npm run servir:https
   ```
   Na primeira vez, ele gera um certificado autoassinado em `.certs/` (fora do Git). O terminal mostra o endereço a abrir, marcado com **►**: `https://<IP-do-PC>:8443/t`.
2. **Achar o IP do PC**, se precisar: o marcado com ► (com VPN, use o da rede de casa). Ou Windows `ipconfig` (Endereço IPv4 do Wi-Fi ou Ethernet), macOS `ipconfig getifaddr en0`, Linux `hostname -I`. Para forçar um IP: `ORVALHO_IP=<IP-do-PC> npm run servir:https`.
3. **Firewall do Windows** (se o Quest não abrir a página): permita o Node.js em **Redes privadas**, ou, num PowerShell como administrador:
   ```powershell
   New-NetFirewallRule -DisplayName "Orvalho HTTPS 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private
   ```
   A rede do PC precisa estar como **Privada**, e o Quest na mesma rede.
4. **No Quest Browser**, abra `https://<IP-do-PC>:8443/t` e aceite o aviso do certificado (**Avançado → Continuar**). Salve nos favoritos.
5. Toque em um botão "jogar …" (ou num teste) e depois em **Entrar em VR**.
6. **Controles:**
   - stick esquerdo: andar (clique enquanto empurra: correr);
   - stick direito: girar 30° (clique: passos/suave);
   - gatilho: usar o laser (sentar, porta do Lab);
   - A: pular;
   - Y: andar suave / teleporte;
   - X: vinheta;
   - B rápido: levantar;
   - **B segurado 1,5 s: sair do VR**;
   - botão Meta segurado: recentralizar.
7. **Plano B:**
   - **túnel Cloudflare:** `npm run servir` e `cloudflared tunnel --url http://localhost:8000`, e abra o endereço `https://…trycloudflare.com` no Quest. Nunca faça túnel para o `servir:https`;
   - **cabo com modo desenvolvedor:** `npm run servir`, `adb reverse tcp:8000 tcp:8000` e `http://localhost:8000/` no Quest.

> **Segurança:** o `npm run servir:https` é só para desenvolvimento. Ele traz a página `/t` e um endpoint que grava medições no PC (`testes/medicoes-vr/`), sem autenticação. O endpoint aceita só IPs da rede local e loopback, só JSON pequeno, e não tem rota de leitura. Use-o só na rede de casa e desligue o servidor depois (`ORVALHO_MEDICOES=0` desliga o endpoint). Nada disso existe no site publicado.

## Modo VR (WebXR) · em desenvolvimento

O jogo também roda em realidade virtual pelo navegador (padrão WebXR, sessão `immersive-vr`). O alvo é o **Meta Quest 3S (Meta Quest Browser)**, mas vale para qualquer headset com navegador compatível. O desktop não muda: sem suporte a WebXR, os botões de VR nem aparecem.

- **Entrar:** botão **"Entrar em VR"** na tela inicial (no Quest Browser ele vem primeiro e maior) ou o botão de óculos no HUD. O navegador só abre a sessão a partir de um clique, então não dá para entrar sozinho.
- **Sair:** **segure B (controle direito) por 1,5 s**. Um anel enche na frente da vista e o controle vibra ao completar. Soltar antes não sai, e um toque rápido em B é outra ação (fechar o que estiver aberto). O botão "Sair do VR" também vai para o painel de opções. O desktop volta como estava, com o boneco onde você estava e olhando para onde você olhava.
- **Situação:** sessão, câmera e rig, colisão pela cabeça real, medidor de fps, locomoção pelos controles, mãos de gelatina, laser, sentar e elevador com painel em mundo (Lab ↔ Hall térreo ↔ 1º andar). Painéis em mundo de equipamentos e conversa, corpo, provador e opções vêm nas próximas etapas.
- **Controles em VR (Quest Touch):**

  | Controle | Ação |
  |---|---|
  | stick esquerdo | andar na direção da cabeça (1,5 m/s) ou, no modo teleporte, empurrar para a frente para mirar e soltar para ir |
  | clique do stick esquerdo (empurrando) | correr (2,5 m/s) até soltar o stick |
  | stick direito | girar 30° por passo (ou suave, 90°/s), em torno da cabeça |
  | gatilho | com o laser numa bolha, assento, pessoa ou porta: executar (sentar, ir para outro ambiente; painéis em VR na próxima etapa) |
  | A | pular (só do chão) |
  | Y | alternar andar suave / teleporte (fica salvo) |
  | X | alternar a vinheta de conforto: desligada → fraca → forte (fica salvo; atalho até existir o painel de opções) |
  | clique do stick direito | alternar giro por passos / suave (fica salvo) |
  | B rápido | levantar do assento (depois: fechar o que estiver aberto) |
  | B segurado 1,5 s | sair do VR |
  | botão Meta segurado | recentralizar (do sistema) |

  As mãos são os braços de gelatina do seu boneco, e o laser sai da ponta deles. O alvo pega com uma folga de ângulo, até 4,5 m, e nunca através de parede. O teleporte só aceita chão do mesmo pavimento (até 1 m acima ou abaixo), sem parede, vidro ou guarda-corpo no caminho. Na escada, o alvo gruda no pé, no patamar ou no topo. Uma vinheta escurece a periferia enquanto você anda, gira suave ou pula.
- **Código:** `src/xr/` (`sessao.js`, `rig.js`, `botoes.js`, `veu.js`, `desempenho.js`, `teste.js`, `pontos.js`, `opcoes.js`, `log.js`), ligado ao jogo por `O.jogo.vr`.

### Testar no Quest pelo Wi-Fi (sem cabo e sem modo desenvolvedor)

O WebXR só existe em **contexto seguro**. Por isso `http://192.168.x.x` não serve: o navegador não cria o `navigator.xr` e o botão de VR não aparece. A solução é um servidor **HTTPS** local com certificado autoassinado.
- O certificado é gerado na primeira execução, em `.certs/` (fora do Git).
- O SAN inclui `localhost`, `127.0.0.1` e os IPs desta máquina.
- Se o IP mudar, ele é refeito sozinho, e o Quest mostra o aviso de novo uma vez.

1. **Mesma rede:** o Quest no Wi-Fi de casa e o PC no mesmo roteador, por Wi-Fi ou por cabo. Redes de convidados costumam isolar os aparelhos.
2. **Servidor:** na pasta do projeto, rode `npm install` (só na primeira vez, para instalar o `selfsigned`) e depois `npm run servir:https`.
   - O terminal mostra a URL a abrir, por exemplo `https://<IP-do-PC>:8443/?vr-log=1`.
   - Se o PC tiver VPN (Radmin, ZeroTier, Hamachi…), use o IP marcado com ►, não os listados como "outros".
   - Para forçar outro IP: `ORVALHO_IP=<IP-do-PC> npm run servir:https` (Git Bash) ou `$env:ORVALHO_IP='<IP-do-PC>'; npm run servir:https` (PowerShell).
3. **Firewall do Windows** (só se o Quest não conseguir abrir a página):
   - Se aparecer a janela "Permitir acesso" para o Node.js, marque **Redes privadas** e permita.
   - Ou libere só a porta, num **PowerShell como administrador**:
     ```powershell
     New-NetFirewallRule -DisplayName "Orvalho HTTPS 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private
     ```
     Para remover depois: `Remove-NetFirewallRule -DisplayName "Orvalho HTTPS 8443"`.
   - Pelo caminho gráfico:
     1. Painel de Controle → **Firewall do Windows Defender** → Configurações avançadas → **Regras de Entrada** → Nova Regra…
     2. Porta → TCP, `8443` → Permitir a conexão.
     3. Marque **Particular** e dê o nome "Orvalho HTTPS 8443".
   - A rede do PC precisa estar como **Privada** (Configurações → Rede e Internet → propriedades da conexão). Em rede **Pública** essa regra não vale.
4. **No Quest Browser**, digite a URL do terminal, com `https://` e `:8443`.
   - Aparece o aviso "Sua conexão não é particular" (`NET::ERR_CERT_AUTHORITY_INVALID`). Isso é esperado com certificado autoassinado.
   - Toque em **Avançado** e depois em **Continuar para <IP-do-PC> (não seguro)**.
5. **Diagnóstico:** com `?vr-log=1`, um quadro pequeno no canto inferior esquerdo mostra:
   - `isSecureContext`: precisa ser **sim**;
   - `navigator.xr`: precisa ser **sim**;
   - `immersive-vr`: **sim** quando o aparelho aceita a sessão VR;
   - o endereço e a versão do navegador.

   Se `isSecureContext` ou `navigator.xr` aparecer **NÃO** mesmo depois de aceitar o aviso, este caminho não serve neste Quest. Anote o que o quadro mostra e pare por aí.
6. **Entrar:** o botão **"Entrar em VR"** aparece primeiro e maior na tela inicial. Toque nele.
7. **Log dentro do VR:** com `?vr-log=1`, um painel fica preso à vista, à direita (o medidor fica à esquerda). Ele mostra:
   - `console.error`, `console.warn`, erros não capturados e promessas rejeitadas;
   - o início e o fim da sessão;
   - o resumo do medidor a cada 10 s.

   Ao sair do VR, o quadro do navegador mostra as mesmas mensagens e o "Último VR" (fps, ms, draw calls…). O log continua ligado (fica salvo em `orvalho-vr`) até você tocar no **×** do quadro ou abrir a página com `?vr-log=0`. Ainda não há botão no controle para ligar ou desligar o log dentro do VR: use a URL antes de entrar.

8. **Medir sem prints (página de testes):** com o `servir:https` rodando, abra `https://<IP>:8443/t` no Quest Browser e salve nos favoritos.
   - Um botão grande por teste: todos os pontos (`lab`, `hall-entrada`, `hall-palco`, `hall-cafe`, `escada`, `andar1-vao`, `acioc`, `administrativo`, `incubadora-corredor`, `incubadora`) e variações nas piores vistas (sem zonas, sem limite de distância, 15 m, todos os contornos, framebuffer ×1,0, "rodada anterior").
   - Cada botão abre o jogo com `?vr-log=1&vr-fov=1&vr-fb=auto`, o ponto, os parâmetros da variação e `?vr-teste=<id>`. Com `?vr-teste`, os parâmetros valem **só naquela carga**: nada fica salvo para o próximo teste.
   - No jogo, toque em **Entrar em VR** e fique parado olhando para a frente (pode sentar):
     - 20 s de aquecimento, descartado ("AQUECENDO") e **1 bipe**;
     - o jogo **gira sozinho** uma volta em torno da sua cabeça (12°/s, ~30 s; "GIRO n/360°"), sem mudar a posição, e dá **2 bipes**. Com `?vr-giro=0`, a volta é sua, e os 2 bipes vêm quando as 8 direções tiverem quadros suficientes;
     - **A** ou **gatilho** registra uma marca;
     - **segure B por 1,5 s** para sair.
   - O áudio dos bipes é criado no toque em "Entrar em VR". Cada bipe também vibra os controles.
   - **Baterias** (botões verdes no topo do `/t`): vários testes numa sessão só, um ambiente por bateria (o framebuffer só muda ao entrar).
     - Entre os passos, a vista escurece e você vai para o próximo ponto. Do 2º passo em diante, o aquecimento é de 10 s.
     - Ao fim de cada passo, 2 bipes; no fim da bateria, **3 bipes**, e a sessão termina sozinha.
     - Hoje há "bateria Hall" (9 pontos), "bateria Hall · variações" e "bateria Lab". Cada passo grava como o teste avulso de mesmo nome.
   - Os números vão sozinhos para o PC: `testes/medicoes-vr/<data>.jsonl` (fora do Git). `npm run medicoes:vr` mostra a tabela dos 8 setores de cada teste.
   - O endpoint de gravação existe **só no `servir:https`** (nunca no site nem no `npm run servir`), aceita só IPs da rede local, só JSON de até 32 KB, e grava só nesse arquivo. Não tem autenticação: existe enquanto o servidor de teste roda. `ORVALHO_MEDICOES=0` desliga.

O certificado serve só para desenvolvimento. Nunca versione `.certs/`: o `.gitignore` já ignora a pasta e os arquivos `*.key`, `*.crt` e `*.pem`. O servidor também não entrega nada de `.certs/`, `node_modules/` ou `.git/`.

### Testar no Quest com cabo (modo desenvolvedor)

Com o modo desenvolvedor, dá para usar o cabo USB com `adb reverse`. Como `http://localhost` conta como contexto seguro, não precisa de certificado, e o console completo fica no `chrome://inspect`:

1. Ative o **modo desenvolvedor** do Quest (app Meta Horizon no celular → dispositivo → Modo do desenvolvedor) e instale o `adb` (Android Platform Tools).
2. Ligue o Quest no computador por USB, aceite a depuração no headset e confira com `adb devices`.
3. Na pasta do projeto: `npm run servir` (servidor local na porta 8000).
4. `adb reverse tcp:8000 tcp:8000`
5. No Quest Browser, abra `http://localhost:8000/` e toque em **Entrar em VR**.
6. Console do Quest no computador: Chrome → `chrome://inspect/#devices` → *inspect* na aba do Orvalho. O medidor imprime um resumo a cada 10 s (`[Orvalho VR] …`).

O GitHub Pages já é HTTPS, mas só publica a `main`, então não serve para testar o que está fora dela.

### Medir desempenho

Dentro do VR há um medidor preso à vista (canto inferior esquerdo).
- **Topo fixo:** id do teste, ponto, parâmetros ativos (`FB ×1.2A` = automático, `FOV`, `C` contorno, `Z` zonas, `D` distância), posição (x, z), direção da cabeça (yaw em graus: 0 = +z/S, 90 = +x/L, 180 = N, 270 = O) e a zona de visibilidade.
- **Medidas:** fps / alvo, tempo de quadro (média e pior), quadros lentos, CPU por quadro separada em **atualização** do jogo e **render** (`renderer.render`, os dois olhos), GPU (só se o navegador expuser `EXT_disjoint_timer_query_webgl2`; o WebXR não informa), draw calls e triângulos (dos dois olhos), framebuffer real e reference space.
- O fps fica verde no alvo, âmbar até 85% e coral abaixo.

Para comparar configurações sem painel de opções, use a URL (o valor fica salvo em `orvalho-vr`, exceto com `?vr-teste`):

| Parâmetro | Efeito |
|---|---|
| `?vr-fb=1.2` | escala do framebuffer (0,5–**1,5**; 1 = padrão do aparelho). Sem o parâmetro (ou com `?vr-fb=auto`): **×1,2 em qualquer ambiente** no jogo; só no modo teste, o padrão do ambiente onde a sessão começou (**Lab 1,5, Hall 1,2**). Teto 1,5: no Quest 3S, 1,5 e 1,7 deram o mesmo framebuffer (5040×2640, os dois olhos) |
| `?vr-hz=72` | taxa de quadros pedida ao aparelho (**padrão 72**; vale a suportada mais próxima; `0` deixa a do navegador). O medidor mostra a taxa **ativa** (`session.frameRate`) e a pedida |
| `?vr-fov=0.5` | foveated rendering fixo (0 desligado … 1 máximo; padrão 1) |
| `?vr-medidor=0` | esconde o medidor |
| `?vr-log=1` | liga o diagnóstico e o log: o quadro fora do VR e o painel dentro dele (`?vr-log=0` desliga) |
| `?vr-contorno=10` | em VR, contornos dos móveis só até essa distância, em m (**padrão 10**; `0` = todos) |
| `?vr-zonas=0` | em VR, desliga a visibilidade por zonas do Hall (**padrão 1**) |
| `?vr-dist=25` | em VR, distância máxima dos blocos de móveis das **outras** zonas, em m (**padrão 25**; `0` = sem limite) |
| `?vr-ponto=hall-palco` | põe o jogador num ponto de medição antes de entrar: `lab`, `hall-entrada`, `hall-palco`, `hall-cafe`, `escada`, `andar1-vao`, `acioc`, `administrativo`, `incubadora-corredor`, `incubadora`. Substitui a exploração salva |
| `?vr-teste=acioc` | modo de medição (página `/t`): parâmetros só desta carga, envio automático das medidas ao `servir:https`, varredura por direção e marcas |
| `?vr-giro=12` | só no modo teste: velocidade do giro automático depois do aquecimento, em °/s (**padrão 12**, uma volta; `0` = volta manual) |
| `?vr-mov=teleporte` | movimento do stick esquerdo: `suave` (**padrão**) ou `teleporte` |
| `?vr-giro-tipo=suave` · `?vr-giro-passo=45` · `?vr-giro-vel=90` | giro: `passos` (**padrão**, 15/30/45/90°, **30**) ou `suave` (°/s, **90**) |
| `?vr-vinheta=2` | vinheta de conforto: 0 desligada, **1 fraca**, 2 forte |
| `?vr-postura=sentado` | `pe` (**padrão**, altura real) ou `sentado` (a vista sobe até 1,60 m acima do piso) |
| `?vr-vel=1.5` · `?vr-correr=2.5` | velocidades andando e correndo, m/s |
| `?vr-pulo=0` | desliga o pulo (A) |
| `?vr-bateria=hall` | só no modo teste: roda a bateria (`hall`, `hall-var` ou `lab`, listas em `src/xr/pontos.js`) numa sessão só |

Em VR, o Hall usa otimizações que mudam um pouco o visual. Ao sair do VR, todas são desfeitas:
- os vidros transparentes de dupla face são desenhados numa passada só;
- os contornos dos móveis só aparecem até `?vr-contorno` metros;
- **zonas** (térreo, escada, corredor do 1º andar, ACIOC, salas, Administrativo, corredor da Incubadora, Incubadora): móveis, portas, marcadores e pessoas das zonas que não se veem da zona da cabeça ficam ocultos. Piso, paredes e vidros nunca somem. A tabela de quem vê quem está em `zonasVR`, no arquivo do Hall;
- os blocos de móveis das **outras** zonas além de `?vr-dist` metros ficam ocultos. Os da zona da cabeça nunca somem (no térreo, a plateia vista do café continua inteira).

O recorte dos móveis por células de 8 m vale também no desktop, e a imagem não muda.

### Testar sem headset

- **Emulador manual:** extensão **Immersive Web Emulator** (Meta) no Chrome desktop; abra o jogo, o botão "Entrar em VR" aparece e a aba *WebXR* das DevTools move headset e controles.
- **Automático:** `npm run teste:vr` usa o **IWER** (`iwer`, o runtime do emulador, só como devDependency) num Chromium real. Ele confere botões, sessão, fallback do reference space (local-floor → bounded-floor → local), colisão da cabeça, escada, saída e restauração. O fps do emulador não representa o Quest: fluidez e conforto só se confirmam no aparelho.
- **Custo de desenho por ponto:** `npm run medir:vr` entra em VR no emulador em pontos do Lab e do Hall (térreo, 1º andar, ACIOC, Administrativo, Incubadora) e grava `testes/relatorio-medir-vr.json`. O relatório traz draw calls, triângulos, memória do renderer, draws por **categoria** (móveis, portas, vidros, pinos, contornos, estrutura, outros) e por **zona**, e estimativas de otimização. `VARRER=1` mede as 8 direções de cada ponto; `PONTOS=acioc,incubadora` limita; `VR_QUERY='vr-zonas=0&vr-dist=0'` compara. As contagens dependem da cena, não da GPU; o fps não vale para o Quest.
- **Pulos das zonas:** `DIST=25 node testes/pulos-zonas-vr.js` lista, para cada porta ou passagem entre zonas, quantos blocos de móveis aparecem ou somem ao atravessar e a que distância.
- **Visibilidade real entre as zonas:** `GPU=1 node testes/visibilidade-zonas-vr.js` amostra posições de cada zona do Hall e renderiza as 6 direções com um item buffer (cada bloco de móveis, pessoa e marcador numa cor). Diz o que se vê de verdade e imprime a tabela `ve` sugerida para `zonasVR`, com visibilidade parcial. Refazer ao mudar a planta.

## Fluxo

1. **Tela inicial:** "Entrar no Orvalho", "Personalizar personagem" e "Continuar exploração" (este último só aparece quando há uma exploração salva). Na primeira visita, "Entrar" passa antes pelo provador.
2. **Provador:** é o do avatar-kit (olhos, 5 corpos, 3 braços, 12 cores, 17 acessórios + "Nenhum", formato da janela). O botão "Entrar no Orvalho" salva e entra.
3. **Jogo:** o boneco entra com a configuração salva, antes do primeiro quadro, então nunca aparece o boneco padrão. O provador abre por cima do jogo pausado; "Voltar ao lab" salva e volta.
4. **Persistência:** a aparência fica no `localStorage`, com as mesmas chaves do kit (`orvalho-avatar-*`). Ambiente, posição horizontal, altura/pavimento e câmera ficam em `orvalho-jogo`.

## Estrutura

```
index.html                 telas (inicial, jogo, provador) e ordem dos scripts
css/orvalho.css            estilos: os blocos "do kit" vêm do avatar-kit sem mudanças
vendor/three-r149.min.js   three.js r149 (a mesma versão e o mesmo build do kit)
src/
  orvalho.js               espaço de nomes window.Orvalho e registro de ambientes
  app.js                   fluxo de telas
  boneco/
    paleta.js              dados do boneco + carregar/salvar o avatar (copiados do kit)
    gelatina.js            material vidro-gelatina e contorno (o shader do kit, compartilhado com os móveis)
    estudio.js             ambiente PMREM de estúdio (reflexos)
    boneco.js              criarBoneco(): modelo, acessórios e animações, sem renderer
    vitrine.js             Doll(): palco pequeno do avatar e do provador (mesma API do kit)
  ui/provador.js           provador do kit, abrindo a partir da tela inicial ou do jogo
  mundo/
    jogo.js                loop, entrada no mundo, WASD, salvar posição
    camera.js              câmera em 3ª pessoa que não atravessa parede
    colisao.js             colisão no plano x/z filtrada pela altura do piso
    sala.js                monta um ambiente a partir da planta (dados)
    moveis.js              catálogo de móveis (peças em metros, paletas, colisão)
    formas.js              caixa arredondada, cilindro e texturas em canvas
    interacao.js           bolha "E · Ver projeto" e painel Aero
    npcs.js                pessoas do espaço (Keila, Dagliê, Danimara) com o kit do avatar
    elevador.js            elevador do Hall: folhas animadas, cabine e painel de andares
ambientes/lab-ia/
  lab-ia.js                planta do lab: medidas reais × jogo, paredes, móveis, interativos
  conteudo.js              texto dos painéis (por enquanto, demonstrativo)
ambientes/hall-inovale/
  hall-inovale.js          planta do hall: fachada, níveis, anexo, pilares, escada, móveis, interativos
  moveis-hall.js           móveis próprios do hall (mesa do café, recepção, arcos, plateia, telão…)
  conteudo.js              texto dos painéis (demonstrativo)
referencia/                avatar-kit.html original (intocado); fotos e esboços ficam só localmente (fora do Git)
docs/                      regras de design, prompts, histórico e decisões (DECISOES.md, MEDIDAS-lab-ia.md)
```

## Testes de navegação

```sh
npm install                       # só o playwright-core, para os testes
npm run teste:avatar              # provador: criar, cancelar, salvar e continuar
npm run teste:navegacao           # Lab de IA, corpo Jujuba (também: teste:navegacao:gota, teste:navegacao:esguio)
npm run teste:hall                # Hall do Inovale, escada, térreo e primeiro andar
npm run teste:primeiro            # matriz focada do 1º andar com Jujuba, Gota e Esguio
npm run teste:vr                  # modo VR no emulador IWER (sessão, rig, colisão da cabeça, saída)
npm run teste:tudo                # Lab e Hall com Jujuba, Gota e Esguio, e o modo VR
```

**Testes com a GPU da máquina:** com `GPU=1`, o Chromium usa a placa de vídeo pelo ANGLE (D3D11 no Windows), com o headless novo, em vez do WebGL por software (aqui, o "Microsoft Basic Render Driver").
- Como rodar: `GPU=1 npm run teste:vr` no Git Bash, ou `$env:GPU='1'; npm run teste:vr` no PowerShell.
- Cada teste imprime `[navegador] …` com o WebGL em uso.
- Se a GPU não pegar, o teste avisa e segue por software, que continua sendo o padrão.
- Nesta máquina (RTX 4060), o Hall com Jujuba caiu de ~20,5 min (com 28 falhas por tempo esgotado) para ~9,5 min, sem falhas.
- Rodar com GPU não diz nada sobre o desempenho no Quest.

No Windows, aponte o Chromium do Playwright: `set CHROMIUM=%LOCALAPPDATA%\ms-playwright\chromium-<versão>\chrome-win64\chrome.exe` (no Git Bash, `export CHROMIUM=...`). O `teste:vr` já procura nesse lugar sozinho.

Os testes cobrem o provador e dirigem o boneco pelo teclado pela sala inteira, medem corredores, conferem colisores, assentos, transições e, no Hall, sobem/descem a escada, testam guarda-corpos e restauram a altura salva. Os relatórios ficam em `testes/relatorio-*.json`. A suíte procura o Chromium do Playwright em `~/Library/Caches/ms-playwright`; em outro lugar, use `CHROMIUM=/caminho/do/chrome`.

Para rodar a mesma suíte contra o site publicado: `ORVALHO_URL=https://millerinds.github.io/Orvalho-VR/ npm run teste:tudo` (vale também para `teste:avatar`, `teste:hall` e `teste:primeiro`).

## Trabalho em equipe (Juan e Kalil)

Este repositório é `millerinds/Orvalho-VR`; a branch principal é `main`. Cada mudança nasce numa branch própria e chega à `main` por pull request revisado.

```sh
git switch main && git pull                 # começa sempre da main atualizada
git switch -c ajuste/porta-do-podcast       # uma branch por funcionalidade ou correção
# ... edita, testa no navegador ...
npm run teste:tudo                          # os testes precisam passar antes do PR
git add -A && git commit -m "Ajusta a porta do podcast"
git push -u origin ajuste/porta-do-podcast
gh pr create --fill                         # ou abra o PR pelo site do GitHub
```

- **Revisão:** a outra pessoa revisa o PR (de preferência abrindo o jogo e conferindo o que mudou). O merge na `main` publica o site.
- **Fotos e material institucional** (pastas `FOTOS HALL/`, `referencia/`, ZIPs, PDF, comparações e plantas em imagem) ficam fora do repositório pelo `.gitignore`. Cada pessoa os mantém localmente. Não publique esse material sem autorização do Polo Inovale.
- Leia `CLAUDE.md` e `docs/continuidade/` antes de mexer no motor ou nos ambientes.

## Publicação (GitHub Pages)

`.github/workflows/pages.yml` roda a cada push na `main` (ou manualmente, na aba **Actions**). Ele copia só os arquivos do jogo (`index.html`, `css/`, `src/`, `ambientes/`, `vendor/`) para o site e publica no Pages. Leva cerca de 1 minuto. O andamento aparece em **Actions** e o endereço é <https://millerinds.github.io/Orvalho-VR/>. Todos os caminhos são relativos, então o jogo funciona no subdiretório `/Orvalho-VR/`. Não há build: o site é a cópia dos arquivos. O Pages deste repositório usa a fonte **GitHub Actions** (Settings → Pages) e é independente do Pages do `Orvalho`. O GitHub Pages serve por HTTPS, que o WebXR exige. Não há backend: a persistência fica no navegador de cada visitante.

## Como criar outro ambiente

1. Copie `ambientes/lab-ia/` para `ambientes/<id>/` e edite a planta: `sala`, `paredes` (com vãos), `moveis`, `entrada` e `interativos`.
2. Se precisar de um móvel novo, acrescente o tipo em `src/mundo/moveis.js`, sempre com formas arredondadas (`O.formas.caixa`, torno, esferas).
3. Inclua os dois arquivos no `index.html`.
4. A troca de ambiente já existe em `jogo.js` (`carregarAmbiente`). Falta só ligar uma porta a ela (ver `docs/DECISOES.md`).
