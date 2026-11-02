# Mudanças em relação à versão sem VR

Base de comparação: o commit "Orvalho 1.0: primeira versão pública" da `main`. Tudo abaixo é do porte para VR.

**Efeito no desktop:** a imagem e os controles do desktop não mudam. As únicas mudanças que também rodam fora do VR são:
- o laço por `setAnimationLoop` (mesmo laço da janela);
- o recorte dos móveis por células (a imagem é idêntica: comparação de pixels em 6 vistas, diferença de 0,04–1,1%, igual ao ruído das animações);
- as portas que abrem, com as ferragens numa malha só (mesmo visual).

Sem WebXR no navegador, os botões de VR nem aparecem.

## Arquivos do jogo alterados

| Arquivo | O que mudou | Por quê | Desktop |
|---|---|---|---|
| `index.html` | ícone `i-vr`; botões "Entrar em VR" (`#btn-vr` na tela inicial, `#hud-vr` no HUD); scripts de `src/xr/` (o `log.js` primeiro de todos, o `pontos.js` antes do `app.js`, o resto depois) | entrada no VR e captura de erros desde o carregamento | sem WebXR, os botões ficam ocultos |
| `css/orvalho.css` | `.btn.vr` (botão-gota água); `body.vr-destaque` (no Quest Browser, o botão de VR vem primeiro e maior); `body.em-vr` (esconde HUD, avisos, painel e elevador durante a sessão); `.diag-vr` (quadro de diagnóstico) | o Quest não tem DOM em sessão imersiva | só age com as classes do VR |
| `src/app.js` | `entrar(continuar, { imediato })` monta o jogo na hora, sem esperar o véu, e devolve `false` se precisou abrir o provador; `O.app.esconderVeu` exportado | a sessão imersiva pode pausar o `requestAnimationFrame` da janela, então a entrada pelo botão de VR não pode depender dele | o fluxo normal é o mesmo |
| `src/mundo/jogo.js` | `renderer.xr.enabled = true`; `setAnimationLoop` no lugar de `requestAnimationFrame`; `parar()` não para o desenho em VR; ramo VR no laço (a cabeça move o jogador); teclado, mouse e `visibilitychange` ignorados em VR; `size()` não faz nada durante a sessão (a r149 recusa `setSize` em VR); API `O.jogo.vr = { contexto, ligar, desligar, ativo, irPara }` | ligar o jogo à sessão sem duplicar lógica: colisão, piso, portas, NPCs e save continuam os do desktop; `irPara` troca de ambiente dentro da sessão | sem sessão, o laço é o mesmo |
| `src/mundo/sala.js` | **células de 8 m** com geometria-invólucro e recorte (`celulas`, `involucro`, `esferaDasInstancias`); ferragens de cada porta numa malha (`porta-ferragem`); **zonas de visibilidade** (`zonaEm`, grupos, visibilidade parcial); `modoVR(on)` (vidros numa passada) e `visibilidadeVR(cabeça, opções)` (contornos, zonas, distância); `zonaVR()`; `paradasEscada(x, z)` | o Hall tinha ~1.000 draws em qualquer direção; as células e as zonas cortam o que não se vê; as paradas servem ao teleporte na escada | as células valem no desktop (imagem igual); o resto só em VR |
| `ambientes/hall-inovale/hall-inovale.js` | `zonasVR`: zonas (escada, café, térreo, ACIOC, salas, Administrativo, corredor da Incubadora, Incubadora, corredor) e a tabela `ve` calculada por geometria | dados das zonas do Hall | nenhum |
| `src/mundo/interacao.js`, `camera.js`, `colisao.js`, `npcs.js`, `elevador.js`, `src/boneco/*`, `src/ui/provador.js` | **não mudaram** | o VR usa as APIs existentes (por exemplo `colisao.raio`, `alturaPiso`, os interativos e os braços do boneco) | — |

## Arquivos novos do jogo (`src/xr/`)

| Arquivo | Papel |
|---|---|
| `log.js` | Captura erros, avisos e linhas `[Orvalho VR]` desde o carregamento. Com `?vr-log=1`, mostra o quadro de diagnóstico fora do VR e um painel de log dentro dele |
| `pontos.js` | Pontos de medição (`?vr-ponto`), variações e baterias de teste (a página `/t` lê daqui) |
| `opcoes.js` | Opções do VR em `localStorage` (`orvalho-vr`) e parâmetros da URL; modo teste (nada salvo); framebuffer automático |
| `rig.js` | Rig da câmera: colisão pela cabeça real, recentralizar, girar em torno da cabeça, deslocar, pulo, postura, assento |
| `desempenho.js` | Medidor preso à vista: fps, tempo de quadro, CPU (atualização e render), draws, triângulos, framebuffer real; eventos do instrumento para atribuir quadros lentos |
| `botoes.js` | Leitura dos botões e sticks (xr-standard) com bordas e tempo apertado, vibração, o anel de "segurar B" e o aviso em mundo |
| `veu.js` | Véu preto (fade) para teleporte, sentar, troca de ambiente e bateria |
| `locomocao.js` | Andar suave, correr, giro por passos ou suave, vinheta, pulo, teleporte (com paradas na escada), postura, atalhos Y, X e clique do stick direito |
| `maos.js` | Mãos: os braços de gelatina do boneco presos ao `targetRaySpace` de cada controle |
| `raio.js` | Laser, alvos com tolerância angular, rótulo, gatilho, sentar e levantar, troca de ambiente |
| `teste.js` | Modo teste: registros por POST, setores de direção, marcas, bipes, giro automático, baterias |
| `sessao.js` | Sessão WebXR: detecção, entrada, reference space, 72 Hz, framebuffer e foveação; liga tudo ao jogo; B segurado sai; restaura o desktop ao sair |

## Ferramentas de desenvolvimento e testes (nada disso vai para o site)

| Arquivo | Papel |
|---|---|
| `testes/servir.js` | `npm run servir`: servidor HTTP estático na porta 8000 (útil sem Python e para o `adb reverse`) |
| `testes/servir-https.js` | `npm run servir:https`: HTTPS na porta 8443 com certificado autoassinado (`selfsigned`) e as rotas de `testes/vr-teste-servidor.js` |
| `testes/vr-teste-servidor.js` | Página `/t` e endpoint `POST /__orvalho/medicoes` (só rede local, só JSON, sem leitura) |
| `testes/resumir-medicoes-vr.js` | `npm run medicoes:vr`: tabelas das medições do Quest |
| `testes/navegador.js` | Abre o Chromium dos testes; `GPU=1` usa a placa de vídeo |
| `testes/vr.js`, `testes/vr-locomocao.js`, `testes/vr-comum.js` | Testes do VR com o IWER (emulador da Meta) |
| `testes/medir-vr.js` | `npm run medir:vr`: draws e triângulos por categoria e zona |
| `testes/pulos-zonas-vr.js` | O que aparece ou some nas passagens entre zonas |
| `testes/visibilidade-zonas-vr.js` | Visibilidade real entre zonas por item buffer; gera a tabela `ve` |
| `testes/navegacao.js`, `testes/fluxo-avatar.js`, `testes/primeiro-andar.js` | Só trocaram o jeito de abrir o Chromium (`testes/navegador.js`, que funciona no Windows e no macOS e aceita `GPU=1`) |

## Configuração do repositório
- `package.json`:
  - devDependencies novas: `iwer` 2.7.0 e `selfsigned` 5.5.0, versões exatas;
  - scripts `servir`, `servir:https`, `teste:vr` (roda `vr.js` e `vr-locomocao.js`), `teste:vr:locomocao`, `medir:vr`, `medicoes:vr`;
  - `teste:tudo` termina com os testes de VR;
  - o jogo continua sem dependências.
- `.gitignore`: certificados e chaves (`.certs/`, `*.key`, `*.crt`, `*.pem`), medições brutas (`testes/medicoes-vr/`) e arquivos locais.
- `README.md`: seções "Modo VR" e "Rodar no Meta Quest (VR)".
- `docs/`: esta pasta (`docs/vr/`), `docs/continuidade/VR-WEBXR.md` (diário detalhado das rodadas) e as entradas de VR em `docs/DECISOES.md`.
- A publicação (GitHub Pages) não mudou: continua copiando só `index.html`, `css/`, `src/`, `ambientes/` e `vendor/`, e só na `main`.
