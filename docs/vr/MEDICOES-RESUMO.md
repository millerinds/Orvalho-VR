# Resumo das medições no Quest 3S

Aparelho: Meta Quest 3S, Quest Browser 154, **72 Hz**. Taxas suportadas: 72/80/90/120. Os números vêm da página de testes `/t` (veja `COMO-TESTAR-NO-QUEST.md`). Os dados brutos ficam fora do repositório.

- **Draws e triângulos** são dos dois olhos.
- **fps méd** é a média das 8 direções (setores de 45°), cada direção com o mesmo peso.
- **CPU** é o tempo de atualização do jogo mais o de `renderer.render`.
- O tempo de GPU não está disponível no Quest Browser.

## Framebuffer e foveação (Lab)

| Framebuffer | Foveação | Resultado |
|---|---|---|
| ×1,3 | 0 | ~67–72 fps |
| ×1,5 | 0 | ~48–55 fps |
| ×1,5 | 1 | ~71 fps (210 draws, 432 K triângulos, CPU 3,9 ms) |
| ×1,7 | 1 | igual a ×1,5: o navegador limita em ~1,5 (5040×2640 nos dois olhos) |

- No Hall, ×1,0 e ×1,2 deram o mesmo fps no pior ponto: ali o limite não são os pixels.
- **Padrão adotado:** ×1,2 em qualquer ambiente no jogo. Só no modo teste o padrão é por ambiente (Lab ×1,5).

## Por ponto, com as otimizações (zonas, distância de 25 m, contorno até 10 m)

| Ponto | fps méd | Pior direção (fps · draws) | Draws méd / máx | CPU méd / máx (ms) |
|---|---|---|---|---|
| Lab | 71,2 | 270° O: 69,2 · 191 | 156 / 204 | 3,3 / 3,8 |
| Hall · entrada | 66,8 | 45° SE: 58,0 · 707 | 410 / 742 | 7,3 / 11,0 |
| Hall · café | 66,6 | 315° SO: 60,8 · 577 | 419 / 596 | 8,0 / 10,6 |
| Escada (patamar) | 63,0 | 315° SO: 48,2 · 931 | 540 / 972 | 9,0 / 13,5 |
| 1º andar · ACIOC | 66,4 | 135° NE: 52,6 · 772 | 409 / 970 | 7,0 / 12,0 |
| 1º andar · Incubadora | 64,1 | 315° SO: 51,4 · 928 | 487 / 960 | 8,1 / 12,4 |

Ainda não medidos no Quest: Hall · palco, 1º andar · vão, Administrativo e corredor da Incubadora. As baterias do `/t` cobrem esses pontos.

## Antes e depois das otimizações (Quest, piores direções; fps · draws)

| Variação | ACIOC 90° | ACIOC 135° | Incubadora 315° | Incubadora 270° | Café 45° |
|---|---|---|---|---|---|
| sem zonas e sem distância | 41,1 · 1.371 | 40,8 · 1.121 | 44,5 · 1.129 | 52,7 · 1.023 | 54,3 · 885 |
| só distância (25 m) | 51,8 · 987 | 47,7 · 964 | — | — | — |
| só zonas | 47,6 · 1.098 | 47,0 · 1.001 | 42,6 · 1.149 | 52,6 · 1.012 | — |
| **zonas + 25 m (padrão)** | **57,1 · 888** | **52,6 · 772** | **51,4 · 928** | **61,2 · 737** | **68,4 · 554** |
| zonas + 15 m | 62,6 · 806 | 55,8 · 745 | — | — | — |

- Zonas e distância somam de +7 a +16 fps nas piores vistas.
- Na Incubadora, as zonas não ajudam (há vidro para todos os lados); só a distância ajuda.
- Antes disso (rodada anterior, sem células com recorte), a vista ACIOC → corredor dava 35–40 fps com ~1.800 draws.

## Zonas recalculadas por geometria (emulador, mesmos números de draws que o Quest)

| Ponto | Draws méd antes → depois | Destaque |
|---|---|---|
| Administrativo | 508 → 433 (−15%) | 225°: 680 → 466; 270°: 642 → 430 |
| Incubadora | 517 → 471 (−9%) | 0°: 804 → 640; 45°: 490 → 326 |
| 1º andar · vão | 574 → 550 | — |
| Hall (entrada, café), ACIOC | ±1% | — |

Ainda não medido no Quest com a tabela nova.

## Distância máxima: mesas que somem vistas da Incubadora (emulador; decisão pendente)

| Vista | 25 m (hoje) | 40 m | sem limite |
|---|---|---|---|
| Incubadora 315° | 946 draws · 1,63 M tri | 1.112 · 1,82 M | 1.208 · 2,13 M |
| Corredor da Incubadora 315° | 888 · 1,32 M | 1.084 · 1,75 M | 1.126 · 1,80 M |
| ACIOC 135° | 956 · 1,34 M | 1.066 · 1,54 M | 1.166 · 1,84 M |

- Da Incubadora, a geometria diz que 79 itens do térreo são visíveis: 69 além de 25 m e 20 além de 40 m (o fundo do café).

## Quadros lentos (25–40 ms)

Bateria Lab, quadros acima de 25 ms depois do aquecimento:

| Passo | Quadros > 25 ms | Por minuto | Pior quadro |
|---|---|---|---|
| lab | 3 | 6,0 | 25,6 ms |
| lab-c0 | 2 | 4,0 | 26,4 ms |
| lab-fov05 | 2 | 4,0 | 26,6 ms |
| lab-mudo (sem painel de log e sem medidor) | 0 | 0 | 21,3 ms |

- Sem os painéis do instrumento, os picos sumiram. O medidor e o log foram aliviados: 1×/s, só quando algo muda, textura menor, sem mipmaps, e o POST fora do quadro.
- **Ainda não remedido no Quest** depois do alívio.

## Outros números

- **Troca Lab → Hall em VR:** ~2 s de vista escura (Quest).
- **Custo do Hall inteiro:** 817 malhas, 416 `InstancedMesh` com 1.395 instâncias, 722 materiais, 28 programas de shader, ~1,8 M triângulos se tudo fosse desenhado uma vez. É o porquê das células, das zonas e da distância.
