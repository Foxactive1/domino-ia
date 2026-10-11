# Dominó Pro · InNovaIdeia

Jogo de dominó duplo-seis contra uma IA baseada em regras ou contra um amigo online, com interface responsiva em verde profundo, marfim e dourado.

## Executar

Abra `index.html` em um navegador moderno ou sirva a pasta:

```bash
python -m http.server 8080
```

Acesse http://localhost:8080. Em outro dispositivo na mesma rede, use o IP do computador. O modo IA não requer npm, build, serviços externos nem chaves de API. O modo online exige o servidor Python abaixo. Pode ser hospedado como site estático em GitHub Pages, Vercel ou outro servidor.

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


## Multiplayer online

Usa a mesma arquitetura do Jogo da Velha: Flask + Flask-SocketIO + cliente Socket.IO 4.8.1. O cliente foi copiado do projeto de referência, com o aviso de licença MIT preservado em `vendor/socket.io.min.js`.

```bash
python -m venv .venv
# Linux / Termux:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python server.py
```

Abra http://localhost:5000 (ou o IP do computador na mesma rede). No site, salve seu nome no perfil, clique em **Criar sala** e envie o código ou **Copiar convite** ao amigo. Ele abre o link no endereço do mesmo servidor e clica em **Entrar**. No modo online, **Nova partida** passa a ser **Pedir revanche**: ambos precisam aceitar após o término. Não é preciso publicar dois serviços separados.

- O servidor distribui as peças, valida turno, encaixe, compra e passe.
- Cada conexão recebe sua mão, a mesa pública e apenas a quantidade de peças do adversário e da reserva.
- Revisões da mesa rejeitam comandos atrasados ou duplicados.
- Desconexões pausam a partida. A sessão desta aba guarda um token privado em `sessionStorage`; ao reconectar ou recarregar a mesma aba, o jogador retoma sua posição. **Reconectar** permite tentar novamente manualmente. Não compartilhe o token; o convite contém apenas o código.
- Sair explicitamente encerra a sala para ambos. Salas inativas expiram após duas horas. O placar online pertence à sala e fica separado do placar local contra IA.
- Um código dá acesso à vaga livre. Não há cadastro, matchmaking público ou espectadores nesta versão.

### Render

Depois de incorporar este PR à `main`, crie um **Web Service** ligado ao repositório ou use o Blueprint `render.yaml`. Uma hospedagem de site estático executa somente o modo IA.

| Configuração | Valor |
| --- | --- |
| Runtime | Python |
| Branch | `main` (ou `feat/online-multiplayer` para testar o PR) |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn --workers 1 --threads 40 --timeout 120 --bind 0.0.0.0:$PORT server:app` |
| Health Check | `/health` |
| `SECRET_KEY` | Valor aleatório gerado pelo serviço |
| `PYTHON_VERSION` | `3.12.10` |
| `ROOM_TTL_SECONDS` | `7200` |

Use uma instância com **um worker**: as salas estão em memória. Mais workers ou réplicas exigem armazenamento compartilhado e uma arquitetura de sincronização apropriada; não basta aumentar `--workers`. Deploys, reinícios ou suspensão do serviço encerram as salas. Após publicar, duas pessoas devem abrir o mesmo endereço HTTPS do Render. CORS continua restrito à mesma origem.

Referências: [Render Flask](https://render.com/docs/deploy-flask), [Flask-SocketIO deployment](https://flask-socketio.readthedocs.io/en/latest/deployment.html).

### Testes online

```bash
node --test tests/*.cjs
python -m unittest discover -s tests -p 'test_*.py' -v
```

São nove testes JavaScript (lógica local e adaptador online com DOM simulado) e oito testes Python com clientes Socket.IO de integração. Cobrem 150 partidas contra IA e 50 partidas online, sala cheia, privacidade, jogadas inválidas, revisões antigas, desconexão, reconexão, revanche, expiração e arquivos públicos permitidos.

Teste opcional em Linux/Termux com Gunicorn real, um cliente WebSocket e outro polling:

```bash
pip install 'python-socketio[client]'
python tests/network_smoke.py
```

Validação de rede e testes automatizados concluídos. A revisão visual em navegador permanece pendente: o Chromium não pôde ser baixado neste ambiente. Antes de publicar, confira o convite em dois celulares, recuperação de conexão, controles de revanche e retorno ao modo IA.
