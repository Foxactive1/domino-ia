# Dominó Pro · InNovaIdeia

Jogo de dominó duplo-seis contra uma IA baseada em regras, com três dificuldades e interface responsiva em verde profundo, marfim e dourado.

## Executar

Abra `index.html` em um navegador moderno ou sirva a pasta:

```bash
python -m http.server 8080
```

Acesse http://localhost:8080. Em outro dispositivo na mesma rede, use o IP do computador. Não requer npm, build, serviços externos nem chaves de API. Pode ser hospedado como site estático em GitHub Pages, Vercel ou outro servidor.

## Experiência

- Mesa com rolagem horizontal isolada: a sequência permanece legível em partidas longas.
- Layout com painel lateral em desktop, grade no tablet e coluna no celular.
- Peças em botões nativos, seleção por teclado, foco visível e anúncios de estado para leitores de tela.
- Perfil local, placar persistente, controles de som e histórico dos cinco movimentos mais recentes.
- Modais nativos com fechamento por Escape e preferência por movimento reduzido.

## Como jogar

1. Clique em **Nova partida**. Você e a IA recebem sete peças, com 14 na reserva.
2. Selecione uma peça habilitada e escolha **Jogar**, **Esquerda** ou **Direita**.
3. Quando não há encaixe, compre uma peça ou passe a vez. Esta variante permite passar mesmo com reserva disponível.
4. Vence quem esvazia a mão. Se ninguém pode jogar e a reserva acaba, vence a menor soma dos pontos; somas iguais resultam em empate.

Fácil escolhe aleatoriamente; médio prioriza peças de soma intermediária; difícil descarta primeiro as peças com maior soma. A IA não utiliza um serviço de aprendizado de máquina.

## Decisão sobre TypeScript

O aplicativo tem três arquivos principais e não usa framework ou bundler. Foi mantido JavaScript para preservar a execução direta e a hospedagem estática simples. TypeScript passa a ter maior valor com multiplayer, API, estados compartilhados ou uma equipe maior. A migração visual não exige React ou TypeScript.

## Estrutura

- `index.html`: estrutura, controles e diálogos.
- `estilo.css`: tokens visuais, mesa, peças e breakpoints.
- `jogo.js`: regras, IA, áudio e persistência local.
- `tests/game.test.cjs`: testes de regressão da lógica, sem dependências.

## Validação

```bash
node --check jogo.js
node --test tests/game.test.cjs
```

Os testes verificam as 28 peças, remoção da peça invertida da IA, reinício com jogada pendente, recuperação de dados inválidos e 150 partidas completas distribuídas entre os três níveis. Conferem conservação das peças, compatibilidade entre peças adjacentes e término das partidas.

Os testes de lógica usam uma simulação mínima de DOM e não substituem testes visuais em navegador. A validação visual automatizada não foi concluída neste ambiente porque o download do Chromium falhou. Para revisar o layout, confira larguras de 320, 390, 768, 1024 e 1440 pixels, modais, navegação por Tab/Enter e a mesa com muitas peças.

## Demonstrações e limites

A loja, moedas e assinatura Premium são simulações locais, sem pagamentos reais. Temas podem ser registrados como colecionáveis; a troca visual de tema ainda não está implementada. O perfil não é uma autenticação online. Dados ficam no navegador e podem desaparecer se o armazenamento for limpo. Se ele estiver indisponível, o jogo continua apenas durante a sessão.
