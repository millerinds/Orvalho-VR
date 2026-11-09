# Instruções para continuar o Orvalho

Antes de alterar código, leia integralmente:

1. `docs/continuidade/HANDOFF-CLAUDE.md`
2. `docs/continuidade/ESTADO-ATUAL.md`
3. `docs/continuidade/ARQUITETURA-TECNICA.md`
4. `docs/continuidade/CORRECOES-HALL.md`
5. `docs/continuidade/TESTES-E-VALIDACAO.md`

Depois leia `README.md`, `docs/DECISOES.md` e `docs/REGRAS-orvalho.md`.

Para o modo VR, leia também `docs/vr/LEIA-ME-VR.md` e os demais arquivos de `docs/vr/`.

Publicação: este é o repositório `millerinds/Orvalho-VR` (versão VR), branch `main`, GitHub Pages por Actions em <https://millerinds.github.io/Orvalho-VR/>. Ele é independente do `millerinds/Orvalho` (versão tradicional): não envie nada daqui para lá sem decisão explícita.

Regras essenciais:

- Preserve three.js r149, o Avatar Kit, o provador e a estética Frutiger Aero.
- A planta atual do Hall é `docs/hall/planta-hall-v2.json`; mantenha JSON, SVG, PNG e cena consistentes. Os arquivos gerados ficam fora do Git: rode `python3 docs/hall/gerar-planta-v2.py docs/hall` para recriá-los.
- Fotos, PDF e demais referências institucionais nunca vão para o GitHub (ver `.gitignore`).
- Não invente salas/interiores sem referência fotográfica ou planta.
- Não remova a filtragem de colisão por altura nem a persistência de `y`.
- Mantenha os três raios de colisor derivados do corpo.
- Rode `npm run teste:tudo` após mudanças no motor, Hall, avatar, câmera ou persistência.
- Preserve as alterações existentes no Git; não faça push nem commit sem pedido do usuário.
