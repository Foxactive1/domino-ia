// Socket.IO is loaded only when online play is requested; IA remains fully static.
const Online = {
  socket: null, session: null, state: null, active: false, pending: false,
  key: 'domino_online_session_v1',
  save(session) {
    this.session = session;
    try { session ? sessionStorage.setItem(this.key, JSON.stringify(session)) : sessionStorage.removeItem(this.key); } catch { /* in-memory session */ }
  },
  async connect() {
    if (location.protocol === 'file:') throw new Error('Para jogar online, abra o endereço publicado do jogo.');
    if (!window.io) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/socket.io.min.js';
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error('Não foi possível carregar o modo online.')); };
        document.head.appendChild(script);
      });
    }
    if (!this.socket) {
      this.socket = window.io({ autoConnect: false, reconnection: true });
      this.socket.on('room_state', state => this.render(state));
      this.socket.on('connect', () => {
        if (this.session) {
          this.active = true;
          this.ack('join_game', this.session).catch(error => {
            this.save(null); this.reset(); this.message(error.message);
          });
        }
      });
      this.socket.on('disconnect', () => {
        if (!this.active) return;
        Game.jogoAtivo = false; UI.renderizarMao(); UI.esconderBotoesAcao();
        document.getElementById('indicadorTurno').textContent = 'Reconectando…';
        this.message('Conexão interrompida. Tentando reconectar à sala…');
      });
      this.socket.on('room_closed', data => { this.save(null); this.reset(); this.message(data.message); });
      this.socket.on('session_replaced', () => {
        this.save(null); this.reset(); this.socket.disconnect(); this.message('Esta sessão foi retomada em outra conexão.');
      });
    }
    if (this.socket.connected) return;
    await new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        this.socket.off('connect', success); this.socket.off('connect_error', failure);
        error ? reject(error) : resolve();
      };
      const success = () => finish();
      const failure = () => finish(new Error('O serviço online não está disponível neste endereço. Você ainda pode jogar contra a IA.'));
      const timer = setTimeout(() => finish(new Error('Servidor demorou para responder. Tente novamente.')), 15000);
      this.socket.once('connect', success); this.socket.once('connect_error', failure); this.socket.connect();
    });
  },
  ack(event, payload) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) return reject(new Error('Sem conexão com o servidor.'));
      // volatile prevents a move made offline from being replayed after reconnection.
      this.socket.volatile.timeout(10000).emit(event, payload, (error, response) => {
        if (error) return reject(new Error('Sem resposta do servidor. Aguarde a atualização da mesa antes de tentar novamente.'));
        if (!response?.ok) return reject(new Error(response?.error || 'Operação não concluída.'));
        resolve(response);
      });
    });
  },
  message(text) {
    document.getElementById('onlineStatus').textContent = text;
    UI.setMensagem('info', text);
  },
  async run(action) {
    if (this.pending) return;
    this.pending = true;
    document.querySelectorAll('[data-online-action]').forEach(el => { el.disabled = true; });
    let failure;
    try { await action(); } catch (error) { failure = error.message; }
    finally {
      this.pending = false;
      document.querySelectorAll('[data-online-action]').forEach(el => { el.disabled = false; });
      if (this.active && this.state) this.render(this.state);
      if (failure) this.message(failure);
    }
  },
  async enter(create) {
    if (this.active) throw new Error('Saia da sala atual antes de entrar em outra.');
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!create && !/^[A-Z2-9]{6}$/.test(code)) throw new Error('Informe o código de seis caracteres da sala.');
    await this.connect();
    const response = await this.ack(create ? 'create_game' : 'join_game', { name: Conta.nome, roomCode: code });
    this.save({roomCode: response.roomCode, token: response.token});
    document.getElementById('roomCodeInput').value = response.roomCode;
  },
  send(action, side) {
    return this.run(async () => {
      if (!this.state) return;
      const payload = {roomCode: this.state.roomCode, revision: this.state.revision, action};
      if (action === 'play') {
        if (Game.indexSelecionado === null) return;
        payload.index = Game.indexSelecionado;
        payload.side = side === 'esquerda' ? 'left' : 'right';
      }
      UI.esconderBotoesAcao();
      await this.ack('play_move', payload);
    });
  },
  render(state) {
    clearTimeout(Game.timerIA);
    this.state = state; this.active = true;
    const ready = state.players.length === 2 && state.players.every(p => p.connected) && this.socket?.connected;
    const rival = state.players[1 - state.you];
    Game.maoJogador = state.hand.map(t => [...t]);
    Game.maoIA = Array.from({length: state.opponentCount}, () => [0,0]);
    Game.estoque = Array.from({length: state.stockCount}, () => [0,0]);
    Game.tabuleiro = state.board.map(t => [...t]); Game.extremidades = [...state.ends];
    Game.vezDoJogador = state.turn === state.you;
    Game.jogoAtivo = ready && state.result === null;
    Game.pecaSelecionada = null; Game.indexSelecionado = null;
    UI.esconderBotoesAcao(); UI.renderizarTabuleiro(); UI.renderizarMao(); UI.atualizarInfo();
    if (Game.jogoAtivo) UI.mostrarBotoesAcao();
    document.getElementById('opponentName').textContent = rival?.name || 'Aguardando adversário';
    document.getElementById('sessionLabel').textContent = `Online · Sala ${state.roomCode} · Rodada ${state.round}`;
    document.getElementById('dificuldade').disabled = true;
    document.getElementById('btnNovoJogo').textContent = '↻ Pedir revanche';
    document.getElementById('btnNovoJogo').disabled = !ready || state.result === null || state.rematch.includes(state.you);
    document.getElementById('btnResetPlacar').disabled = true;
    document.getElementById('placarJogador').textContent = state.scores[state.you];
    document.getElementById('placarIA').textContent = state.scores[1-state.you];
    document.getElementById('placarEmpate').textContent = state.scores[2];
    document.getElementById('totalPartidas').textContent = state.scores.reduce((sum,n) => sum+n,0);
    document.getElementById('historicoJogo').textContent = state.history.join(' → ') || 'Compartilhe o convite para começar.';
    document.getElementById('dicaSelecao').textContent = Game.jogoAtivo && Game.vezDoJogador ? 'Selecione uma peça para jogar' : '';
    document.getElementById('onlineLobby').classList.add('d-none');
    document.getElementById('onlineRoom').classList.remove('d-none');
    document.getElementById('roomCodeDisplay').textContent = state.roomCode;
    let message = !rival ? 'Sala criada. Compartilhe o código ou o link e aguarde seu amigo.' :
      !ready ? 'Partida pausada. Aguardando reconexão.' : Game.vezDoJogador ? 'Sua vez. Escolha uma peça.' : `Vez de ${rival.name}.`;
    if (state.result !== null) {
      message = state.result.winner === null ? 'Rodada empatada.' : state.result.winner === state.you ? 'Você venceu a rodada!' : `${rival?.name || 'Adversário'} venceu a rodada.`;
      if (state.rematch.length) message += state.rematch.includes(state.you) ? ' Aguardando o adversário aceitar a revanche.' : ' O adversário pediu revanche. Toque em Pedir revanche para aceitar.';
    }
    document.getElementById('indicadorTurno').textContent = state.result !== null ? 'Rodada encerrada' : !ready ? 'Aguardando' : Game.vezDoJogador ? 'Sua vez' : 'Vez do adversário';
    this.message(message);
  },
  reset() {
    this.active = false; this.state = null;
    clearTimeout(Game.timerIA);
    Game.jogoAtivo = false; Game.maoJogador = []; Game.maoIA = []; Game.estoque = []; Game.tabuleiro = []; Game.extremidades = [null,null];
    Game.pecaSelecionada = null; Game.indexSelecionado = null;
    UI.esconderBotoesAcao(); UI.renderizarMao(); UI.renderizarTabuleiro(); UI.atualizarInfo();
    document.getElementById('indicadorTurno').textContent = 'Aguardando partida';
    document.getElementById('opponentName').textContent = 'Inteligência artificial';
    document.getElementById('sessionLabel').textContent = 'Você × Inteligência artificial';
    document.getElementById('dificuldade').disabled = false;
    document.getElementById('btnNovoJogo').disabled = false;
    document.getElementById('btnNovoJogo').textContent = '↻ Nova partida';
    document.getElementById('btnResetPlacar').disabled = false;
    document.getElementById('onlineLobby').classList.remove('d-none');
    document.getElementById('onlineRoom').classList.add('d-none');
    Placar.atualizarUI();
  },
  async leave() {
    if (this.socket?.connected) await this.ack('leave_game', {}).catch(() => {});
    this.save(null); this.reset(); this.socket?.disconnect();
    this.message('Você saiu da sala. Pode iniciar uma partida contra a IA.');
  }
};

// Route existing controls to authoritative online actions without changing IA rules.
for (const [method, action] of [['jogarPecaSelecionada','play'], ['comprarPeca','draw'], ['passarVez','pass']]) {
  const local = Game[method].bind(Game);
  Game[method] = function(side) { return Online.active ? Online.send(action, side) : local(side); };
}
const startLocal = Game.iniciar.bind(Game);
Game.iniciar = function() {
  if (!Online.active) return startLocal();
  return Online.run(() => Online.ack('new_round', {roomCode: Online.state?.roomCode}));
};
window.addEventListener('load', () => {
  document.getElementById('btnCreateRoom').addEventListener('click', () => Online.run(() => Online.enter(true)));
  document.getElementById('joinRoomForm').addEventListener('submit', event => { event.preventDefault(); Online.run(() => Online.enter(false)); });
  document.getElementById('btnReconnectRoom').addEventListener('click', () => Online.run(async () => {
    await Online.connect();
    if (Online.session) await Online.ack('join_game', Online.session);
  }));
  document.getElementById('btnLeaveRoom').addEventListener('click', () => Online.run(() => Online.leave()));
  document.getElementById('btnCopyInvite').addEventListener('click', () => Online.run(async () => {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room', Online.state.roomCode);
    try { await navigator.clipboard.writeText(url.href); UI.mostrarToast('Convite copiado!', 'success'); }
    catch { window.prompt('Copie este convite:', url.href); }
  }));
  const invite = new URL(location.href).searchParams.get('room');
  if (invite && /^[A-Z2-9]{6}$/i.test(invite)) document.getElementById('roomCodeInput').value = invite.toUpperCase();
  try { const saved = JSON.parse(sessionStorage.getItem(Online.key)); if (saved?.roomCode && saved?.token) Online.session = saved; } catch { /* no session */ }
  if (Online.session) {
    Online.active = true;
    clearTimeout(Game.timerIA); Game.jogoAtivo = false;
    document.getElementById('onlineLobby').classList.add('d-none');
    document.getElementById('onlineRoom').classList.remove('d-none');
    document.getElementById('roomCodeDisplay').textContent = Online.session.roomCode;
    document.getElementById('btnNovoJogo').disabled = true;
    Online.message('Retomando sua sala…');
    Online.run(() => Online.connect());
  }
});
