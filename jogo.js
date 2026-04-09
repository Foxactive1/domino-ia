// ============================================================
//  DOMINÓ PRO - LÓGICA COMPLETA (separada do HTML)
// ============================================================

// ---------- UTILS ----------
const Utils = {
  gerarPecas() {
    const pecas = [];
    for (let i = 0; i <= 6; i++)
      for (let j = i; j <= 6; j++)
        pecas.push([i, j]);
    return pecas;
  },
  embaralhar(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  criarFaceSVG(n) {
    const face = document.createElement('div');
    face.className = 'domino-face';

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 30 30');

    const pipPositions = {
      0: [],
      1: [[15, 15]],
      2: [[7, 7], [23, 23]],
      3: [[7, 7], [15, 15], [23, 23]],
      4: [[7, 7], [23, 7], [7, 23], [23, 23]],
      5: [[7, 7], [23, 7], [15, 15], [7, 23], [23, 23]],
      6: [[7, 7], [23, 7], [7, 15], [23, 15], [7, 23], [23, 23]],
    };

    const pontos = pipPositions[n] || [];
    pontos.forEach(([cx, cy]) => {
      const shadow = document.createElementNS(ns, 'circle');
      shadow.setAttribute('cx', cx + 0.8);
      shadow.setAttribute('cy', cy + 0.8);
      shadow.setAttribute('r', '3.6');
      shadow.setAttribute('fill', 'rgba(0,0,0,0.3)');
      svg.appendChild(shadow);

      const pip = document.createElementNS(ns, 'circle');
      pip.setAttribute('cx', cx);
      pip.setAttribute('cy', cy);
      pip.setAttribute('r', '3.3');
      pip.setAttribute('fill', '#1a0a00');
      svg.appendChild(pip);

      const shine = document.createElementNS(ns, 'circle');
      shine.setAttribute('cx', cx - 1);
      shine.setAttribute('cy', cy - 1);
      shine.setAttribute('r', '1.1');
      shine.setAttribute('fill', 'rgba(255,255,255,0.2)');
      svg.appendChild(shine);
    });

    face.appendChild(svg);
    return face;
  },
  criarElementoPeca(peca, horizontal = false, classe = '') {
    const div = document.createElement('div');
    div.className = 'domino-peca nova-peca' + (horizontal ? ' horizontal' : '') + (classe ? ' ' + classe : '');
    div.appendChild(this.criarFaceSVG(peca[0]));

    const divisor = document.createElement('div');
    divisor.className = 'domino-divisor';
    div.appendChild(divisor);

    div.appendChild(this.criarFaceSVG(peca[1]));
    return div;
  }
};

// ---------- ANALYTICS ----------
const Analytics = {
  eventos: [],
  registrar(evento, dados = {}) {
    const entry = { timestamp: new Date().toISOString(), evento, ...dados };
    this.eventos.push(entry);
    console.log('[Analytics]', entry);
  },
  getEventos() { return this.eventos; }
};

// ---------- ÁUDIO ----------
const AudioManager = {
  ctx: null,
  ativo: true,
  volumeEfeitos: 1.0,

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API não suportada');
        this.ativo = false;
      }
    }
    const saved = localStorage.getItem('domino_som_vol');
    if (saved) this.volumeEfeitos = parseFloat(saved);
    const savedAtivo = localStorage.getItem('domino_som_ativo');
    if (savedAtivo !== null) this.ativo = (savedAtivo === 'true');
  },

  tocar(tipo) {
    if (!this.ativo || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const gainNode = this.ctx.createGain();
    gainNode.connect(this.ctx.destination);
    gainNode.gain.setValueAtTime(this.volumeEfeitos, now);

    const configs = {
      selecionar: () => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        o.connect(gainNode);
        o.start(now);
        o.stop(now + 0.12);
      },
      jogar: () => {
        [0, 0.05].forEach((delay, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(i === 0 ? 200 : 160, now + delay);
          g.gain.setValueAtTime(0.35 * this.volumeEfeitos, now + delay);
          g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + delay);
          o.stop(now + delay + 0.09);
        });
      },
      ia_joga: () => {
        const o = this.ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(140, now);
        o.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        o.connect(gainNode);
        o.start(now);
        o.stop(now + 0.13);
      },
      comprar: () => {
        [0, 0.08, 0.16].forEach((d, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(440 + i * 110, now + d);
          g.gain.setValueAtTime(0.12 * this.volumeEfeitos, now + d);
          g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.1);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + d);
          o.stop(now + d + 0.1);
        });
      },
      passar: () => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, now);
        o.frequency.exponentialRampToValueAtTime(150, now + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.connect(gainNode);
        o.start(now);
        o.stop(now + 0.2);
      },
      vitoria: () => {
        const notas = [523, 659, 784, 1047];
        notas.forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.12);
          g.gain.setValueAtTime(0, now + i * 0.12);
          g.gain.linearRampToValueAtTime(0.25 * this.volumeEfeitos, now + i * 0.12 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + i * 0.12);
          o.stop(now + i * 0.12 + 0.25);
        });
      },
      derrota: () => {
        const notas = [392, 349, 294, 220];
        notas.forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, now + i * 0.15);
          g.gain.setValueAtTime(0.18 * this.volumeEfeitos, now + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.2);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + i * 0.15);
          o.stop(now + i * 0.15 + 0.2);
        });
      },
      empate: () => {
        [440, 440].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.18);
          g.gain.setValueAtTime(0.15 * this.volumeEfeitos, now + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.18);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + i * 0.18);
          o.stop(now + i * 0.18 + 0.18);
        });
      },
      novo_jogo: () => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(330, now);
        o.frequency.exponentialRampToValueAtTime(660, now + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.connect(gainNode);
        o.start(now);
        o.stop(now + 0.2);
      },
    };

    if (configs[tipo]) configs[tipo]();
  },

  setVolume(vol) {
    this.volumeEfeitos = vol;
    localStorage.setItem('domino_som_vol', vol);
  },
  setAtivo(estado) {
    this.ativo = estado;
    localStorage.setItem('domino_som_ativo', estado);
  },
  toggle() {
    this.ativo = !this.ativo;
    localStorage.setItem('domino_som_ativo', this.ativo);
    return this.ativo;
  }
};

// ---------- CONTA DO USUÁRIO ----------
const Conta = {
  nome: 'Visitante',
  moedas: 0,
  premium: false,
  temas: ['clássico'],
  carregar() {
    const data = JSON.parse(localStorage.getItem('domino_conta')) || { nome: 'Visitante', moedas: 0, premium: false, temas: ['clássico'] };
    Object.assign(this, data);
    this.atualizarUI();
  },
  salvar() {
    localStorage.setItem('domino_conta', JSON.stringify({ nome: this.nome, moedas: this.moedas, premium: this.premium, temas: this.temas }));
    this.atualizarUI();
  },
  login() {
    const nome = document.getElementById('inputNome').value.trim() || 'Jogador';
    this.nome = nome;
    this.salvar();
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
    this.atualizarUI();
    Analytics.registrar('login', { nome });
  },
  adicionarMoedas(qtd) {
    this.moedas += qtd;
    this.salvar();
    Analytics.registrar('moedas_adicionadas', { qtd, saldo: this.moedas });
  },
  gastarMoedas(qtd) {
    if (this.moedas >= qtd) {
      this.moedas -= qtd;
      this.salvar();
      return true;
    }
    return false;
  },
  tornarPremium() {
    this.premium = true;
    this.salvar();
    document.getElementById('anuncioSimulado').classList.add('d-none');
    Analytics.registrar('assinatura_premium');
  },
  comprarTema(tema) {
    if (!this.temas.includes(tema) && this.gastarMoedas(500)) {
      this.temas.push(tema);
      this.salvar();
      return true;
    }
    return false;
  },
  atualizarUI() {
    document.getElementById('userNameDisplay').textContent = this.nome;
    document.getElementById('moedasDisplay').innerHTML = `<i class="fas fa-coins"></i> ${this.moedas}`;
    if (this.premium) {
      document.getElementById('premiumBadge').classList.remove('d-none');
      document.getElementById('anuncioSimulado').classList.add('d-none');
    } else {
      document.getElementById('premiumBadge').classList.add('d-none');
    }
    document.getElementById('modalMoedas').textContent = this.moedas;
  }
};

// ---------- MONETIZAÇÃO ----------
const Monetization = {
  comprarMoedas(qtd) {
    if (confirm(`Simular compra de ${qtd} moedas?`)) {
      Conta.adicionarMoedas(qtd);
      Analytics.registrar('compra_moedas', { qtd, valor: qtd === 100 ? 1.99 : 9.99 });
      UI.mostrarToast('Compra realizada!', 'success');
    }
  },
  assinarPremium() {
    if (confirm('Assinar plano premium por R$9,90/mês?')) {
      Conta.tornarPremium();
      Analytics.registrar('assinatura', { plano: 'premium', valor: 9.90 });
      UI.mostrarToast('Bem-vindo ao Premium!', 'success');
    }
  },
  comprarTema(tema) {
    if (Conta.comprarTema(tema)) {
      UI.mostrarToast(`Tema ${tema} adquirido!`, 'success');
      Analytics.registrar('compra_tema', { tema });
    } else {
      UI.mostrarToast('Moedas insuficientes!', 'warning');
    }
  },
  mostrarAnuncio() {
    UI.mostrarToast('Assistindo anúncio...', 'info');
    setTimeout(() => {
      Conta.adicionarMoedas(10);
      UI.mostrarToast('Ganhou 10 moedas!', 'success');
      Analytics.registrar('anuncio_assistido', { recompensa: 10 });
    }, 2000);
  }
};

// ---------- PLACAR ----------
const Placar = {
  jogador: 0, ia: 0, empate: 0, totalPartidas: 0, receitaTotal: 0,
  carregar() {
    const data = JSON.parse(localStorage.getItem('domino_placar')) || { jogador:0, ia:0, empate:0, totalPartidas:0, receitaTotal:0 };
    Object.assign(this, data);
    this.atualizarUI();
  },
  salvar() {
    localStorage.setItem('domino_placar', JSON.stringify({ jogador:this.jogador, ia:this.ia, empate:this.empate, totalPartidas:this.totalPartidas, receitaTotal:this.receitaTotal }));
    this.atualizarUI();
  },
  registrarVitoria(vencedor) {
    this.totalPartidas++;
    if (vencedor === 'jogador') this.jogador++;
    else if (vencedor === 'ia') this.ia++;
    else this.empate++;
    if (!Conta.premium) this.receitaTotal += 0.01;
    this.salvar();
    Analytics.registrar('partida_finalizada', { vencedor, receita_estimada: Conta.premium ? 0 : 0.01 });
  },
  resetarPlacar() {
    if (confirm('Zerar placar?')) {
      this.jogador = this.ia = this.empate = this.totalPartidas = this.receitaTotal = 0;
      this.salvar();
    }
  },
  atualizarUI() {
    document.getElementById('placarJogador').textContent = this.jogador;
    document.getElementById('placarIA').textContent = this.ia;
    document.getElementById('placarEmpate').textContent = this.empate;
    document.getElementById('totalPartidas').textContent = this.totalPartidas;

    const receita = this.receitaTotal.toFixed(2);
    document.getElementById('metricaReceita').textContent = `R$ ${receita}`;
    const ltv = (this.totalPartidas > 0) ? (this.receitaTotal / Math.max(1, Conta.nome !== 'Visitante' ? 1 : 1)).toFixed(2) : 0;
    document.getElementById('metricaLTV').textContent = `R$ ${ltv}`;
    document.getElementById('metricaChurn').textContent = '5%';
  }
};

// ---------- LÓGICA DO JOGO ----------
const Game = {
  maoJogador: [], maoIA: [], estoque: [], tabuleiro: [], extremidades: [null, null],
  vezDoJogador: true, pecaSelecionada: null, indexSelecionado: null, jogoAtivo: false,
  historico: [],

  iniciar() {
    const todas = Utils.embaralhar(Utils.gerarPecas());
    this.maoJogador = todas.slice(0, 7);
    this.maoIA = todas.slice(7, 14);
    this.estoque = todas.slice(14);
    this.tabuleiro = [];
    this.extremidades = [null, null];
    this.pecaSelecionada = null;
    this.indexSelecionado = null;
    this.vezDoJogador = true;
    this.jogoAtivo = true;
    this.historico = [];

    UI.renderizarMao();
    UI.atualizarInfo();
    UI.setMensagem('info', '🎮 Jogo iniciado! Selecione uma peça.');
    UI.mostrarBotoesAcao();
    UI.renderizarTabuleiro();
    AudioManager.tocar('novo_jogo');
    Analytics.registrar('jogo_iniciado');
  },

  podeJogar(peca) {
    if (this.tabuleiro.length === 0) return true;
    return peca[0] === this.extremidades[0] || peca[1] === this.extremidades[0] ||
           peca[0] === this.extremidades[1] || peca[1] === this.extremidades[1];
  },

  jogarPecaSelecionada(lado) {
    if (!this.pecaSelecionada || !this.vezDoJogador || !this.jogoAtivo) return;

    let peca = [...this.pecaSelecionada];

    if (this.tabuleiro.length === 0) {
      this.tabuleiro.push(peca);
      this.extremidades = [peca[0], peca[1]];
    } else if (lado === 'esquerda') {
      if (peca[1] === this.extremidades[0]) { /* ok */ }
      else if (peca[0] === this.extremidades[0]) { peca = [peca[1], peca[0]]; }
      else return;
      this.tabuleiro.unshift(peca);
      this.extremidades[0] = peca[0];
    } else {
      if (peca[0] === this.extremidades[1]) { /* ok */ }
      else if (peca[1] === this.extremidades[1]) { peca = [peca[1], peca[0]]; }
      else return;
      this.tabuleiro.push(peca);
      this.extremidades[1] = peca[1];
    }

    this.maoJogador.splice(this.indexSelecionado, 1);
    this.pecaSelecionada = null;
    this.indexSelecionado = null;
    UI.esconderBotoesJogar();
    this.adicionarHistorico(`👤 Você jogou [${peca[0]}|${peca[1]}] na ${lado}`);
    AudioManager.tocar('jogar');
    UI.renderizarTabuleiro();
    UI.renderizarMao();
    UI.atualizarInfo();

    if (this.verificarFimDeJogo()) return;

    this.vezDoJogador = false;
    UI.atualizarIndicadorTurno();
    UI.setMensagem('secondary', '🤖 IA está pensando...');
    setTimeout(() => this.turnoIA(), 900);
  },

  comprarPeca() {
    if (!this.vezDoJogador || !this.jogoAtivo) return;
    if (!this.estoque.length) {
      UI.setMensagem('warning', '📦 Estoque vazio! Passe a vez.');
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.remove('d-none');
      return;
    }
    const peca = this.estoque.pop();
    this.maoJogador.push(peca);
    AudioManager.tocar('comprar');
    this.adicionarHistorico(`👤 Você comprou [${peca[0]}|${peca[1]}]`);
    UI.renderizarMao();
    UI.atualizarInfo();

    if (this.podeJogar(peca)) {
      UI.setMensagem('info', `✅ Comprou [${peca[0]}|${peca[1]}]. Agora pode jogar!`);
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.add('d-none');
      UI.mostrarBotoesAcao();
    } else if (!this.estoque.length) {
      UI.setMensagem('warning', '📦 Sem mais peças no estoque. Passe a vez.');
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.remove('d-none');
    } else {
      UI.setMensagem('warning', `Comprou [${peca[0]}|${peca[1]}], ainda não encaixa.`);
      document.getElementById('btnPassar').classList.remove('d-none');
    }
  },

  passarVez() {
    if (!this.vezDoJogador || !this.jogoAtivo) return;
    this.adicionarHistorico('👤 Você passou a vez');
    AudioManager.tocar('passar');
    UI.setMensagem('secondary', '⏩ Você passou. IA jogando...');
    UI.esconderBotoesAcao();
    this.vezDoJogador = false;
    UI.atualizarIndicadorTurno();
    setTimeout(() => this.turnoIA(), 900);
  },

  turnoIA() {
    if (!this.jogoAtivo) return;

    const dif = document.getElementById('dificuldade').value;
    const jogaveis = this.maoIA.filter(p => this.podeJogar(p));

    if (jogaveis.length > 0) {
      let peca;
      if (dif === 'easy') peca = jogaveis[Math.floor(Math.random() * jogaveis.length)];
      else if (dif === 'medium') {
        const equilibradas = jogaveis.filter(p => (p[0]+p[1]) >=5 && (p[0]+p[1]) <=8);
        peca = (equilibradas.length ? equilibradas : jogaveis)[Math.floor(Math.random() * (equilibradas.length || jogaveis.length))];
      } else {
        peca = jogaveis.reduce((best, p) => (p[0]+p[1]) > (best[0]+best[1]) ? p : best);
      }

      let lado;
      const encaixaEsq = peca[0] === this.extremidades[0] || peca[1] === this.extremidades[0];
      const encaixaDir = peca[0] === this.extremidades[1] || peca[1] === this.extremidades[1];

      if (encaixaEsq && (!encaixaDir || Math.random() > 0.5)) {
        lado = 'esquerda';
        if (peca[1] !== this.extremidades[0]) peca = [peca[1], peca[0]];
        this.tabuleiro.unshift(peca);
        this.extremidades[0] = peca[0];
      } else {
        lado = 'direita';
        if (peca[0] !== this.extremidades[1]) peca = [peca[1], peca[0]];
        this.tabuleiro.push(peca);
        this.extremidades[1] = peca[1];
      }

      this.maoIA = this.maoIA.filter(p => !(p[0] === peca[0] && p[1] === peca[1]));
      this.adicionarHistorico(`🤖 IA jogou [${peca[0]}|${peca[1]}] na ${lado}`);
      AudioManager.tocar('ia_joga');
      UI.renderizarTabuleiro();
      UI.atualizarInfo();
      UI.setMensagem('danger', `🤖 IA jogou [${peca[0]}|${peca[1]}] na ${lado}.`);
    } else {
      let comprou = false;
      while (this.estoque.length > 0 && !comprou) {
        const nova = this.estoque.pop();
        this.maoIA.push(nova);
        if (this.podeJogar(nova)) {
          comprou = true;
          let p = [...nova];
          const encaixaE = p[0] === this.extremidades[0] || p[1] === this.extremidades[0];
          if (encaixaE) {
            if (p[1] !== this.extremidades[0]) p = [p[1], p[0]];
            this.tabuleiro.unshift(p);
            this.extremidades[0] = p[0];
          } else {
            if (p[0] !== this.extremidades[1]) p = [p[1], p[0]];
            this.tabuleiro.push(p);
            this.extremidades[1] = p[1];
          }
          this.maoIA = this.maoIA.filter(x => !(x[0] === nova[0] && x[1] === nova[1]));
          this.adicionarHistorico(`🤖 IA comprou e jogou [${p[0]}|${p[1]}]`);
          UI.renderizarTabuleiro();
          UI.atualizarInfo();
          UI.setMensagem('danger', `🤖 IA comprou e jogou [${p[0]}|${p[1]}].`);
        }
      }
      if (!comprou) {
        this.adicionarHistorico('🤖 IA passou a vez');
        UI.setMensagem('secondary', '🤖 IA passou. Sua vez!');
      }
    }

    if (this.verificarFimDeJogo()) return;

    this.vezDoJogador = true;
    UI.atualizarIndicadorTurno();
    UI.mostrarBotoesAcao();
  },

  verificarFimDeJogo() {
    if (!this.jogoAtivo) return true;

    if (this.maoJogador.length === 0) { this.finalizar('jogador'); return true; }
    if (this.maoIA.length === 0) { this.finalizar('ia'); return true; }

    if (!this.estoque.length) {
      const jogPode = this.maoJogador.some(p => this.podeJogar(p));
      const iaPode = this.maoIA.some(p => this.podeJogar(p));
      if (!jogPode && !iaPode) {
        const somaJog = this.maoJogador.reduce((s, p) => s + p[0] + p[1], 0);
        const somaIA = this.maoIA.reduce((s, p) => s + p[0] + p[1], 0);
        if (somaJog < somaIA) this.finalizar('jogador');
        else if (somaIA < somaJog) this.finalizar('ia');
        else this.finalizar('empate');
        return true;
      }
    }
    return false;
  },

  finalizar(vencedor) {
    this.jogoAtivo = false;
    Placar.registrarVitoria(vencedor);
    if (vencedor === 'jogador') {
      AudioManager.tocar('vitoria');
      UI.setMensagem('success', '🏆 Você venceu!');
      UI.mostrarToast('🏆 Você Venceu!', 'success');
    } else if (vencedor === 'ia') {
      AudioManager.tocar('derrota');
      UI.setMensagem('danger', '🤖 A IA venceu.');
      UI.mostrarToast('🤖 IA venceu!', 'danger');
    } else {
      AudioManager.tocar('empate');
      UI.setMensagem('warning', '🤝 Empate.');
      UI.mostrarToast('🤝 Empate', 'warning');
    }
    UI.esconderBotoesAcao();
  },

  adicionarHistorico(msg) {
    this.historico.unshift(msg);
    if (this.historico.length > 5) this.historico.pop();
    document.getElementById('historicoJogo').textContent = this.historico.join(' → ');
  }
};

// ---------- UI ----------
const UI = {
  renderizarMao() {
    const div = document.getElementById('maoJogador');
    div.innerHTML = '';
    if (!Game.maoJogador.length) {
      div.innerHTML = '<em class="text-muted">Sem peças!</em>';
      return;
    }
    Game.maoJogador.forEach((peca, i) => {
      const el = Utils.criarElementoPeca(peca);
      el.title = `[${peca[0]}|${peca[1]}]`;

      const jogavel = Game.podeJogar(peca);
      if (!Game.vezDoJogador || !Game.jogoAtivo) el.classList.add('bloqueada');
      else if (!jogavel && Game.tabuleiro.length > 0) el.classList.add('bloqueada');

      if (i === Game.indexSelecionado) el.classList.add('selecionada');

      el.addEventListener('click', () => this.selecionarPeca(i));
      div.appendChild(el);
    });
  },

  selecionarPeca(i) {
    if (!Game.vezDoJogador || !Game.jogoAtivo) return;
    const peca = Game.maoJogador[i];

    if (Game.indexSelecionado === i) {
      Game.indexSelecionado = null;
      Game.pecaSelecionada = null;
      document.getElementById('botoesJogar').classList.add('d-none');
      document.getElementById('dicaSelecao').textContent = '';
      this.renderizarMao();
      return;
    }

    Game.indexSelecionado = i;
    Game.pecaSelecionada = peca;
    AudioManager.tocar('selecionar');
    this.renderizarMao();

    if (Game.tabuleiro.length === 0) {
      document.getElementById('botoesJogar').classList.remove('d-none');
      document.getElementById('botoesJogar').classList.add('d-flex');
      document.getElementById('btnEsquerda').innerHTML = `<i class="fas fa-play me-1"></i>Jogar`;
      document.getElementById('btnDireita').classList.add('d-none');
      document.getElementById('dicaSelecao').textContent = `Peça [${peca[0]}|${peca[1]}] selecionada`;
    } else {
      const podEsq = peca[0] === Game.extremidades[0] || peca[1] === Game.extremidades[0];
      const podDir = peca[0] === Game.extremidades[1] || peca[1] === Game.extremidades[1];

      if (!podEsq && !podDir) {
        document.getElementById('dicaSelecao').textContent = '❌ Não encaixa';
        document.getElementById('botoesJogar').classList.add('d-none');
        return;
      }

      document.getElementById('botoesJogar').classList.remove('d-none');
      document.getElementById('botoesJogar').classList.add('d-flex');
      document.getElementById('btnEsquerda').innerHTML = `<i class="fas fa-arrow-left me-1"></i>Esquerda (${Game.extremidades[0]})`;
      document.getElementById('btnDireita').innerHTML = `Direita (${Game.extremidades[1]}) <i class="fas fa-arrow-right ms-1"></i>`;
      document.getElementById('btnEsquerda').classList.toggle('d-none', !podEsq);
      document.getElementById('btnDireita').classList.toggle('d-none', !podDir);
      document.getElementById('dicaSelecao').textContent = `Peça [${peca[0]}|${peca[1]}] selecionada`;
    }
  },

  renderizarTabuleiro() {
    const div = document.getElementById('tabuleiro');
    div.innerHTML = '';
    if (!Game.tabuleiro.length) {
      div.innerHTML = '<div class="tabuleiro-empty">Jogue a primeira peça!</div>';
      return;
    }
    Game.tabuleiro.forEach(peca => {
      const el = Utils.criarElementoPeca(peca, true, 'domino-tabuleiro');
      div.appendChild(el);
    });
  },

  atualizarInfo() {
    document.getElementById('contadorIA').textContent = Game.maoIA.length;
    document.getElementById('contadorJogador').textContent = Game.maoJogador.length;
    document.getElementById('contadorEstoque').textContent = Game.estoque.length;
    document.getElementById('extremidadesInfo').textContent = Game.extremidades[0] !== null ? `${Game.extremidades[0]} | ${Game.extremidades[1]}` : '— | —';
  },

  atualizarIndicadorTurno() {
    const el = document.getElementById('indicadorTurno');
    el.innerHTML = Game.vezDoJogador
      ? `<span class="dot-turno ativo me-1"></span>Sua vez`
      : `<span class="dot-turno inativo me-1"></span>Vez da IA`;
  },

  setMensagem(tipo, msg) {
    const div = document.getElementById('mensagemJogo');
    const tipos = { info:'alert-info', success:'alert-success', danger:'alert-danger', warning:'alert-warning', secondary:'alert-secondary' };
    div.className = `alert ${tipos[tipo] || 'alert-info'} text-center py-2 mb-3`;
    div.innerHTML = msg;
  },

  mostrarBotoesAcao() {
    if (!Game.jogoAtivo || !Game.vezDoJogador) return;
    const temJogavel = Game.maoJogador.some(p => Game.podeJogar(p));
    if (Game.tabuleiro.length === 0) {
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.add('d-none');
    } else if (temJogavel) {
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.add('d-none');
    } else if (Game.estoque.length > 0) {
      document.getElementById('btnComprar').classList.remove('d-none');
      document.getElementById('btnPassar').classList.remove('d-none');
      this.setMensagem('warning', '⚠️ Nenhuma peça encaixa. Compre ou passe.');
    } else {
      document.getElementById('btnComprar').classList.add('d-none');
      document.getElementById('btnPassar').classList.remove('d-none');
      this.setMensagem('warning', '⚠️ Estoque vazio. Passe a vez.');
    }
  },

  esconderBotoesAcao() {
    document.getElementById('btnComprar').classList.add('d-none');
    document.getElementById('btnPassar').classList.add('d-none');
    this.esconderBotoesJogar();
  },

  esconderBotoesJogar() {
    document.getElementById('botoesJogar').classList.add('d-none');
    document.getElementById('botoesJogar').classList.remove('d-flex');
  },

  mostrarToast(msg, tipo) {
    const t = document.getElementById('toastResultado');
    const cores = { success:'alert-success', danger:'alert-danger', warning:'alert-warning', info:'alert-info' };
    t.className = `alert ${cores[tipo] || 'alert-info'} mb-0`;
    t.innerHTML = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }
};

// ---------- INICIALIZAÇÃO ----------
window.addEventListener('load', () => {
  Conta.carregar();
  Placar.carregar();
  AudioManager.init();

  // Event listeners dos botões
  document.getElementById('btnNovoJogo').addEventListener('click', () => Game.iniciar());
  document.getElementById('btnEsquerda').addEventListener('click', () => Game.jogarPecaSelecionada('esquerda'));
  document.getElementById('btnDireita').addEventListener('click', () => Game.jogarPecaSelecionada('direita'));
  document.getElementById('btnComprar').addEventListener('click', () => Game.comprarPeca());
  document.getElementById('btnPassar').addEventListener('click', () => Game.passarVez());

  // Som
  document.getElementById('btnSom').addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('somModal'));
    document.getElementById('volEfeitos').value = AudioManager.volumeEfeitos;
    document.getElementById('somAtivo').checked = AudioManager.ativo;
    modal.show();
  });

  document.getElementById('volEfeitos').addEventListener('input', (e) => {
    AudioManager.setVolume(parseFloat(e.target.value));
  });

  document.getElementById('somAtivo').addEventListener('change', (e) => {
    AudioManager.setAtivo(e.target.checked);
  });

  // Anúncio periódico
  setInterval(() => {
    if (!Conta.premium && Game.jogoAtivo) {
      document.getElementById('anuncioSimulado').classList.remove('d-none');
    } else {
      document.getElementById('anuncioSimulado').classList.add('d-none');
    }
  }, 30000);
});