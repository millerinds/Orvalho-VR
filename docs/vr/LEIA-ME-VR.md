# Orvalho em VR (WebXR): leia-me

O Orvalho é uma experiência 3D no navegador (three.js r149, scripts clássicos, sem build): um boneco de vidro-gelatina personalizável explora o Lab de IA e o Hall do Polo Inovale.

Esta pasta documenta o **modo VR**: o mesmo jogo no Meta Quest 3S (ou em qualquer headset com navegador WebXR), pelo Quest Browser, sem instalar nada.

**Situação:** prova de conceito fechada. Já funcionam:
- entrar e sair;
- andar, correr, girar, pular e teleportar;
- mãos de gelatina com laser;
- sentar;
- elevador com painel em mundo: Lab ↔ Hall (térreo) ↔ 1º andar sem sair do VR (09/11/2026, só testado no emulador);
- medidor e página de testes.

Faltam os painéis em mundo (equipamentos, conversa, provador), o tronco do boneco e o painel de opções.

## Índice
| Arquivo | Para quê |
|---|---|
| `ESTADO-E-PENDENCIAS.md` | O que está feito, o que falta, o que falta testar, bugs conhecidos |
| `COMO-TESTAR-NO-QUEST.md` | Passo a passo no PC e no Quest, página `/t`, baterias, medições, parâmetros de URL, controles, plano B |
| `DECISOES-VR.md` | As decisões (escala, framebuffer, 72 Hz, botões, teleporte, giro, vinheta…) e o porquê |
| `MUDANCAS-EM-RELACAO-A-VERSAO-SEM-VR.md` | O que mudou, arquivo por arquivo, e se o desktop foi afetado |
| `MEDICOES-RESUMO.md` | Resultados no Quest e o antes e depois das otimizações |
| `GUIA-DE-MODELAGEM-E-OTIMIZACAO.md` | **Regras para modelar o resto do prédio sem estourar o Quest** (orçamento de draws, células, zonas, materiais, vidro…) |

Outros documentos do repositório que valem para o VR:
- `README.md`: seção "Rodar no Meta Quest (VR)";
- `docs/continuidade/VR-WEBXR.md`: diário detalhado, rodada a rodada;
- `docs/DECISOES.md`: entradas de 31/10 e 02/11/2026;
- `CLAUDE.md` e `docs/continuidade/*`: regras gerais do projeto (three.js r149, Avatar Kit, estética Frutiger Aero, planta do Hall, colisão por altura).

## Visão geral do código
- **`src/xr/`:** todo o VR.
  - `sessao.js` liga tudo ao jogo pela API `O.jogo.vr`, em `src/mundo/jogo.js`;
  - o rig (`rig.js`) move a câmera e passa a cabeça pela mesma colisão do desktop;
  - `locomocao.js`, `maos.js` e `raio.js` são os controles.
- **`src/mundo/sala.js`:** células de recorte dos móveis, zonas de visibilidade e otimizações só de VR (`modoVR`, `visibilidadeVR`).
- **`testes/`:** testes com o IWER (emulador da Meta) e as ferramentas de medição. Nada disso vai para o site.

## Regras de trabalho deste projeto (combinadas)
- Etapas pequenas, cada uma testável: **antes de cada etapa, um plano curto e o ok** de quem é responsável; ao terminar, um checklist para o Quest.
- **Não simplificar o visual em silêncio:** dizer o que muda e por quê.
- **Não inventar comportamento de API.** O que for incerto (three r149, Quest Browser), verificar e dizer que é incerto.
- **Não inventar salas nem caminhos** sem foto ou planta (por exemplo, o caminho Hall → Lab).
- **Preservar:** three.js r149, o Avatar Kit, o provador, a estética Frutiger Aero, a colisão filtrada por altura, a persistência de `y` e os três raios de colisor derivados do corpo.
- **Testes:** um por vez, com `GPU=1`. A cada etapa, `vr`, `lab` e `avatar`; o Hall completo no fim.
- **Git:** nada de push sem combinar. O VR vive na branch `recurso/vr-webxr`; o GitHub Pages publica só a `main`.

## Prompt de retomada (colar numa sessão nova do Claude Code)

```
Você vai continuar o modo VR (WebXR, alvo Meta Quest 3S) do projeto Orvalho, que está na branch recurso/vr-webxr.
Antes de mudar qualquer código, leia nesta ordem:
1. CLAUDE.md e docs/continuidade/ (regras gerais do projeto);
2. docs/vr/LEIA-ME-VR.md, ESTADO-E-PENDENCIAS.md, DECISOES-VR.md, GUIA-DE-MODELAGEM-E-OTIMIZACAO.md,
   COMO-TESTAR-NO-QUEST.md, MUDANCAS-EM-RELACAO-A-VERSAO-SEM-VR.md e MEDICOES-RESUMO.md;
3. o código de src/xr/ e a API O.jogo.vr em src/mundo/jogo.js.
Regras: three.js r149 sem addons ES module; estética Frutiger Aero; nada de inventar salas ou caminhos sem referência;
não mexer em desempenho sem medir; antes de cada etapa, me mostre um plano curto e espere meu ok; ao terminar, rode
(com GPU=1, um por vez) npm run teste:vr, npm run teste:navegacao e npm run teste:avatar, e me entregue um checklist
para testar no Quest e a lista do que só foi verificado no emulador. Não faça commit nem push sem eu pedir.
Próxima etapa sugerida: etapa 5, o kit de painel em mundo (canvas 2D, visual Aero, clicável pelo laser) começando
pelos painéis dos equipamentos. Comece me dizendo o que entendeu do estado atual e o plano da etapa 5.
```
