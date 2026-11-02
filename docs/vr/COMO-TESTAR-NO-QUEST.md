# Como testar no Meta Quest

O WebXR só existe em **contexto seguro** (HTTPS ou `http://localhost`). Por isso o caminho padrão é um servidor HTTPS local com certificado autoassinado, acessado pelo Quest no Wi-Fi de casa. Não precisa de cabo nem de modo desenvolvedor.

## 1. No PC (uma vez)
1. Instale o Node.js (o projeto foi testado com o 22) e, na pasta do projeto, rode `npm install`. Ele instala só ferramentas de desenvolvimento: `playwright-core`, `iwer` e `selfsigned`.
2. Para os testes automáticos, instale um Chromium do Playwright (por exemplo, `npx playwright install chromium`) ou aponte `CHROMIUM` para um Chrome ou Chromium.
   - No Windows, o caminho fica em `%LOCALAPPDATA%\ms-playwright\chromium-<versão>\chrome-win64\chrome.exe`.

## 2. Servidor HTTPS
```sh
npm run servir:https
```
- Escuta na porta **8443** em todas as interfaces e serve a pasta do projeto.
- Na primeira execução, gera certificado e chave em `.certs/` (fora do Git). O certificado vale para `localhost`, `127.0.0.1` e os IPs da máquina, e é refeito sozinho se o IP mudar ou se faltarem menos de 7 dias para vencer.
- O terminal mostra o endereço a abrir no Quest, marcado com **►**: `https://<IP-do-PC>:8443/t`.
- Se o PC tiver VPN ou adaptadores virtuais, use o IP da rede de casa (o marcado com ►). Para forçar outro IP:
  - Git Bash: `ORVALHO_IP=<IP-do-PC> npm run servir:https`
  - PowerShell: `$env:ORVALHO_IP='<IP-do-PC>'; npm run servir:https`
- **Para achar o IP do PC sem o terminal:** Windows, `ipconfig` (o "Endereço IPv4" do adaptador Wi-Fi ou Ethernet); macOS, `ipconfig getifaddr en0`; Linux, `hostname -I`.

### Firewall do Windows (só se o Quest não abrir a página)
- Na janela "Permitir acesso" do Node.js, marque **Redes privadas**.
- Ou, num PowerShell como administrador:
  ```powershell
  New-NetFirewallRule -DisplayName "Orvalho HTTPS 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private
  ```
  Para remover depois: `Remove-NetFirewallRule -DisplayName "Orvalho HTTPS 8443"`.
- A rede do PC precisa estar como **Privada**. Redes de convidados costumam isolar os aparelhos.

## 3. No Quest
1. Quest e PC na mesma rede.
2. No **Quest Browser**, abra `https://<IP-do-PC>:8443/t` (com `https://` e `:8443`).
3. Aparece "Sua conexão não é particular": toque em **Avançado → Continuar para … (não seguro)**. Isso é esperado com certificado autoassinado.
4. Salve `/t` nos favoritos.

### Se não abrir
- **A página não carrega:** revise rede e firewall, e confira o IP marcado com ►.
- **O botão "Entrar em VR" não aparece:** abra a página do jogo com `?vr-log=1`. Um quadro no canto mostra `isSecureContext`, `navigator.xr` e `immersive-vr`. Se os dois primeiros forem "NÃO", a página não está em contexto seguro (faltou `https://` ou aceitar o aviso).
- **A sessão não abre:** o navegador só abre VR a partir de um toque no botão. Nada abre sozinho.
- **Erros dentro do VR:** com `?vr-log=1`, há um painel de log preso à vista, à direita. Depois de sair, o mesmo quadro mostra "Último VR".

### Plano B
- **Túnel Cloudflare** (outra rede, ou se o certificado der problema):
  - rode `npm run servir` (HTTP, porta 8000) e, noutro terminal, `cloudflared tunnel --url http://localhost:8000`;
  - abra no Quest o endereço `https://…trycloudflare.com` que ele mostrar;
  - a página `/t` e o endpoint de medições **não existem** no `npm run servir`, de propósito. **Não use túnel com o `servir:https`**: o túnel chega ao servidor como `localhost` e exporia o endpoint de medições na internet.
- **Cabo USB com modo desenvolvedor:** `npm run servir`, `adb reverse tcp:8000 tcp:8000`, e no Quest abra `http://localhost:8000/`. `localhost` conta como contexto seguro. O console completo fica em `chrome://inspect/#devices` no PC.

## 4. Página `/t` (só no `servir:https`)
- **Controles em VR:** resumo dos botões.
- **Jogar (sem modo teste):** abre o jogo num ponto (Lab, Hall · entrada, pé da escada, 1º andar · vão, ACIOC). Depois, é só tocar em **Entrar em VR**.
- **Opções de movimento:** links que gravam a opção no jogo (`orvalho-vr`).
- **Baterias** (uma por ambiente, porque o framebuffer só muda ao entrar):
  - `hall`: 9 pontos com o padrão, ~7 min;
  - `hall-var`: variações nas piores vistas, ~7 min;
  - `lab`: padrão, todos os contornos, foveação 0,5 e "mudo" (sem painéis), ~2,5 min.
- **Pontos e variações avulsos:** um teste por botão. A página marca o que já foi medido no dia.

### Como rodar um teste
1. Toque no teste, depois em **Entrar em VR**.
2. Fique parado olhando para a frente (pode sentar). Os 20 s de aquecimento são descartados; **1 bipe** no fim.
3. O jogo **gira sozinho** uma volta em torno da cabeça (12°/s, ~30 s). Não gire a cabeça; feche os olhos se incomodar. **2 bipes** no fim.
4. **A** ou **gatilho** registra uma "marca" (algo estranho naquele instante).
5. Saia **segurando B por 1,5 s**.

Na bateria, os passos seguem sozinhos (aquecimento de 10 s a partir do 2º passo); **3 bipes** no fim, e a sessão termina sozinha. Cada bipe também vibra os controles.

### Medições
- O jogo envia os números por POST para o PC, que grava em `testes/medicoes-vr/<data>.jsonl` (fora do Git).
- Ler no PC: `npm run medicoes:vr` (o arquivo mais recente), `npm run medicoes:vr -- <AAAA-MM-DD>` ou `-- todos`.
- O resumo mostra, por teste: os 8 setores de direção (fps médio e pior, draws, triângulos, CPU de atualização e de render), as marcas, os quadros acima de 25 ms (com a coincidência com o instrumento) e uma linha-resumo por teste.

> **Segurança do endpoint de medições:** ele existe só no `servir:https`, aceita só IPs de rede local e loopback, só JSON de até 32 KB e tipos de registro conhecidos, grava só no arquivo do dia (até 20 MB) e não tem rota de leitura. **Não tem autenticação:** é para desenvolvimento, na rede de casa. `ORVALHO_MEDICOES=0` desliga.

## 5. Parâmetros de URL

Sem `?vr-teste`, os parâmetros ficam salvos em `orvalho-vr`. Com `?vr-teste`, valem só naquela carga.

| Parâmetro | Valores | Efeito |
|---|---|---|
| `vr-fb` | 0,5–1,5 · `auto` | Escala do framebuffer. `auto` (padrão): ×1,2 no jogo; no modo teste, Lab ×1,5 e Hall ×1,2 |
| `vr-hz` | 0–144 (padrão **72**) | Taxa pedida; vale a suportada mais próxima. 0 = a do navegador |
| `vr-fov` | 0–1 (padrão **1**) | Foveação fixa |
| `vr-contorno` | m (padrão **10**; 0 = todos) | Contornos dos móveis só até essa distância |
| `vr-zonas` | 0 · 1 (padrão **1**) | Zonas de visibilidade do Hall |
| `vr-dist` | m (padrão **25**; 0 = sem limite) | Distância máxima dos móveis de outras zonas |
| `vr-medidor` | 0 · 1 (padrão 1) | Medidor de fps preso à vista |
| `vr-log` | 0 · 1 (padrão 0) | Quadro de diagnóstico e painel de log em VR |
| `vr-ponto` | id do ponto | Põe o jogador no ponto (substitui a exploração salva) |
| `vr-teste` | id | Modo teste: medição, bipes, giro automático, marcas; nada é salvo |
| `vr-giro` | °/s (padrão **12**; 0 = volta manual) | Só no modo teste: giro automático depois do aquecimento |
| `vr-bateria` | `hall` · `hall-var` · `lab` | Só no modo teste: roda a bateria numa sessão |
| `vr-mov` | `suave` (padrão) · `teleporte` | Movimento do stick esquerdo |
| `vr-giro-tipo` | `passos` (padrão) · `suave` | Giro do stick direito |
| `vr-giro-passo` | 15 · **30** · 45 · 90 | Ângulo do passo (outros valores vão para a escolha mais próxima) |
| `vr-giro-vel` | 20–240 °/s (padrão **90**) | Velocidade do giro suave |
| `vr-vinheta` | 0 desligada · **1 fraca** · 2 forte | Vinheta de conforto |
| `vr-postura` | `pe` (padrão) · `sentado` | Sentado: a vista sobe até 1,60 m acima do piso |
| `vr-vel` · `vr-correr` | m/s (padrão **1,5** · **2,5**) | Velocidades |
| `vr-pulo` | 0 · 1 (padrão 1) | Pulo com A |

**Pontos** (`vr-ponto`): `lab`, `hall-entrada`, `hall-palco`, `hall-cafe`, `escada-pe`, `escada`, `andar1-vao`, `acioc`, `administrativo`, `incubadora-corredor`, `incubadora`.

## 6. Controles em VR

| Controle | Ação |
|---|---|
| Stick esquerdo | Andar na direção da cabeça; no modo teleporte, empurrar para a frente para mirar e soltar para ir |
| Clique do stick esquerdo (empurrando) | Correr até soltar o stick |
| Stick direito | Girar 30° por passo (ou suave) |
| Clique do stick direito | Alterna giro por passos / suave |
| Gatilho | Com o laser num alvo: executar |
| A | Pular (no modo teste: marca) |
| Y | Alterna andar suave / teleporte |
| X | Vinheta: desligada → fraca → forte |
| B rápido | Levantar / fechar |
| B segurado 1,5 s | Sair do VR |
| Botão Meta segurado | Recentralizar (do sistema) |

Ao entrar, o log registra uma linha com esse resumo.

## 7. Testes automáticos (no PC, sem headset)
Rode **um por vez**, porque o PC pode ficar sem memória. Com `GPU=1`, o Chromium usa a placa de vídeo.

```sh
GPU=1 npm run teste:vr          # testes/vr.js (sessão, rig, medidor, B, modo teste, baterias, zonas)
                                # + testes/vr-locomocao.js (locomoção, mãos, raio, sentar, Lab → Hall)
GPU=1 npm run teste:navegacao   # Lab (Jujuba)
GPU=1 npm run teste:avatar      # provador
GPU=1 npm run teste:tudo        # tudo, inclusive o Hall com 3 corpos (~30 min ou mais)
```
- `SECOES=20,21 node testes/vr-locomocao.js` roda só algumas seções.
- **Ferramentas de análise (fora do `teste:tudo`):**
  - `npm run medir:vr`: draws e triângulos por categoria e zona; `PONTOS=…`, `VARRER=1` (8 direções), `VR_QUERY='vr-dist=40'`;
  - `node testes/visibilidade-zonas-vr.js`: visibilidade real entre as zonas e a tabela `ve` sugerida; `PASSO`, `PASSO_HALL`, `DETALHE=origem:destino`, `INTEIRA`;
  - `node testes/pulos-zonas-vr.js`: o que aparece ou some nas passagens; `DIST`.
- O fps do emulador não representa o Quest; draws e triângulos, sim.
