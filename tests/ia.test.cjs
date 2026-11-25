// Run with node --test tests/ia.test.cjs; no dependencies required.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadIA() {
  const context = vm.createContext({
    console: {log() {}}, window: {addEventListener() {}}, document: {},
    localStorage: {getItem() { return null; }, setItem() {}}
  });
  vm.runInContext(fs.readFileSync('jogo.js', 'utf8') + ';globalThis.api={IA,Game};', context);
  return context.api;
}
const {IA, Game} = loadIA();
const sem = (...n) => new Set(n);
const plain = value => JSON.parse(JSON.stringify(value)); // atravessa o contexto do vm

test('candidatos orienta a peça e calcula as pontas resultantes', () => {
  const c = IA.candidatos([[1, 2]], [[1, 3]], [1, 3]);
  assert.equal(c.length, 1);
  assert.deepEqual(plain(c[0].peca), [2, 1]);
  assert.equal(c[0].lado, 'esquerda');
  assert.deepEqual(plain(c[0].pontas), [2, 3]);
  const ambos = IA.candidatos([[3, 3]], [[3, 3]], [3, 3]);
  assert.deepEqual(plain(ambos.map(x => x.lado)).sort(), ['direita', 'esquerda']);
});

test('desconhecidas conta as sete peças de cada número', () => {
  assert.deepEqual(plain(IA.desconhecidas([], [])), Array(7).fill(7));
  const u = IA.desconhecidas([[6, 6], [6, 1]], [[1, 1]]);
  assert.equal(u[6], 5);   // [6,6] e [6,1] vistas
  assert.equal(u[1], 5);   // [6,1] e [1,1] vistas
  assert.equal(u[0], 7);
});

test('sem jogada possível devolve null', () => {
  assert.equal(IA.escolher({mao: [[0, 0]], tabuleiro: [[5, 6]], extremidades: [5, 6], semNumeros: sem()}, 'hard'), null);
});

test('difícil explora o número que o adversário não tem', () => {
  const ctx = {mao: [[3, 1], [5, 2], [1, 1]], tabuleiro: [[3, 5]], extremidades: [3, 5], semNumeros: sem(1)};
  const escolha = IA.escolher(ctx, 'hard');
  assert.deepEqual(plain(escolha.peca).sort(), [1, 3]);
  assert.equal(escolha.pontas.includes(1), true);
});

test('difícil prefere deixar uma ponta morta (todas as peças do número já visíveis)', () => {
  const tabuleiro = [[6, 0], [6, 1], [6, 2], [6, 4], [6, 5], [6, 6]];
  const ctx = {mao: [[3, 6], [4, 4]], tabuleiro, extremidades: [3, 4], semNumeros: sem()};
  const escolha = IA.escolher(ctx, 'hard');
  assert.deepEqual(plain(escolha.peca), [6, 3]);
  assert.deepEqual(plain(escolha.pontas), [6, 4]);
});

test('difícil é determinístico; fácil e médio aceitam rng injetado', () => {
  const ctx = {mao: [[2, 3], [4, 5], [6, 6]], tabuleiro: [[3, 4]], extremidades: [3, 4], semNumeros: sem()};
  const a = IA.escolher(ctx, 'hard'), b = IA.escolher(ctx, 'hard');
  assert.deepEqual(plain(a), plain(b));
  assert.ok(IA.escolher(ctx, 'easy', () => 0));
  assert.ok(IA.escolher(ctx, 'medium', () => 0.9));
});

test('jogador que compra ou passa revela os números que não tinha', () => {
  Game.tabuleiro = [[2, 5]]; Game.extremidades = [2, 5];
  Game.estoque = [[0, 0], [1, 1]]; Game.maoJogador = [[4, 4]];
  Game.vezDoJogador = true; Game.jogoAtivo = true; Game.semNumeros = new Set([6]);
  try { Game.comprarPeca(); } catch { /* UI sem DOM neste teste */ }
  assert.deepEqual([...Game.semNumeros].sort(), [2, 5]);   // compra substitui o conhecimento antigo
});
