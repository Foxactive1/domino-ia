// Run with node --test tests/ui.test.cjs; no dependencies required.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(windowExtras = {}) {
  const context = vm.createContext({
    console: {log() {}}, window: {addEventListener() {}, ...windowExtras}, document: {},
    localStorage: {getItem() { return null; }, setItem() {}}
  });
  vm.runInContext(fs.readFileSync('jogo.js', 'utf8') + ';globalThis.api={UI};', context);
  return context.api.UI;
}
const t = (...p) => p;
const caixa = (left, width = 76) => ({getBoundingClientRect: () => ({left, width})});
function mesa({scrollLeft = 100, clientWidth = 300, scrollWidth = 1000, left = 50, children = []} = {}) {
  return {scrollLeft, clientWidth, scrollWidth, children, chamadas: [],
    getBoundingClientRect: () => ({left}), scrollTo(opcoes) { this.chamadas.push(opcoes); }};
}

test('ladoDaNovaPeca identifica a ponta que recebeu a peça', () => {
  const UI = load();
  assert.equal(UI.ladoDaNovaPeca([], [t(3, 4)]), 'direita');
  assert.equal(UI.ladoDaNovaPeca([t(3, 4)], [t(2, 3), t(3, 4)]), 'esquerda');
  assert.equal(UI.ladoDaNovaPeca([t(3, 4)], [t(3, 4), t(4, 6)]), 'direita');
  assert.equal(UI.ladoDaNovaPeca([t(1, 2), t(2, 5)], [t(0, 1), t(1, 2), t(2, 5)]), 'esquerda');
  assert.equal(UI.ladoDaNovaPeca([t(1, 2), t(2, 5)], [t(1, 2), t(2, 5), t(5, 5)]), 'direita');
  assert.equal(UI.ladoDaNovaPeca([t(3, 4)], [t(3, 4)]), null);                       // nada mudou
  assert.equal(UI.ladoDaNovaPeca([t(3, 4)], [t(1, 3), t(3, 4), t(4, 6)]), null);     // saltou mais de uma peça
});

test('rola para centralizar a peça nova, na ponta direita', () => {
  const UI = load();
  const alvo = caixa(400);
  const div = mesa({children: [caixa(0), caixa(200), alvo]});
  UI.rolarParaNovaPeca(div, [t(1, 2), t(2, 3)], [t(1, 2), t(2, 3), t(3, 3)]);
  assert.equal(div.chamadas.length, 1);
  assert.equal(div.chamadas[0].left, 100 + (400 - 50) - (300 - 76) / 2);   // 338
  assert.equal(div.chamadas[0].behavior, 'smooth');
});

test('na ponta esquerda usa a primeira peça da mesa', () => {
  const UI = load();
  const div = mesa({scrollLeft: 600, children: [caixa(60), caixa(140), caixa(220)]});
  UI.rolarParaNovaPeca(div, [t(2, 3), t(3, 3)], [t(1, 2), t(2, 3), t(3, 3)]);
  assert.equal(div.chamadas[0].left, 600 + (60 - 50) - (300 - 76) / 2);    // 498
});

test('re-render sem mudança não mexe na rolagem do usuário', () => {
  const UI = load();
  const div = mesa({children: [caixa(0), caixa(100)]});
  UI.rolarParaNovaPeca(div, [t(1, 2), t(2, 3)], [t(1, 2), t(2, 3)]);
  assert.equal(div.chamadas.length, 0);
});

test('mesa restaurada de uma vez é centralizada, sem animação', () => {
  const UI = load();
  const div = mesa({children: [caixa(0), caixa(100), caixa(200)]});
  UI.rolarParaNovaPeca(div, [], [t(1, 2), t(2, 3), t(3, 4)]);
  assert.deepEqual({...div.chamadas[0]}, {left: (1000 - 300) / 2, behavior: 'auto'});
});

test('movimento reduzido desliga a animação suave', () => {
  const UI = load({matchMedia: () => ({matches: true})});
  const div = mesa({children: [caixa(0), caixa(400)]});
  UI.rolarParaNovaPeca(div, [t(1, 2)], [t(1, 2), t(2, 3)]);
  assert.equal(div.chamadas[0].behavior, 'auto');
});

test('ambiente sem scrollTo (testes com DOM simulado) não quebra', () => {
  const UI = load();
  assert.doesNotThrow(() => UI.rolarParaNovaPeca({children: []}, [], [t(1, 2)]));
});

test('o HTML não depende de ícones ou utilitários inexistentes', () => {
  const fontes = ['jogo.js', 'online.js', 'index.html'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const morta of ['fas fa-', 'text-center', 'text-muted', 'btn-outline-secondary', 'me-1', 'ms-1', 'mb-3', 'mb-0', 'py-2'])
    assert.equal(fontes.includes(morta), false, `classe/ícone ausente do CSS ainda em uso: ${morta}`);
});
