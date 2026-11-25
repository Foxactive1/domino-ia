// Benchmark opcional (não roda no CI): node tools/bench_ia.cjs [partidas]
// Cada nível joga contra o outro com as mesmas regras, alternando quem começa.
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({console: {log() {}}, window: {addEventListener() {}}, document: {}, localStorage: {getItem() { return null; }, setItem() {}}});
vm.runInContext(fs.readFileSync('jogo.js', 'utf8') + ';globalThis.IA=IA;', context);
const IA = context.IA;

function embaralhar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function partida(nivelA, nivelB, comecaA) {
  const todas = []; for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) todas.push([i, j]);
  embaralhar(todas);
  const jog = [{nivel: nivelA, mao: todas.slice(0, 7), sem: new Set()}, {nivel: nivelB, mao: todas.slice(7, 14), sem: new Set()}];
  const estoque = todas.slice(14); let tab = [], pontas = [null, null], vez = comecaA ? 0 : 1, passesSeguidos = 0;
  while (true) {
    const eu = jog[vez], rival = jog[1 - vez];
    let escolha = IA.escolher({mao: eu.mao, tabuleiro: tab, extremidades: pontas, semNumeros: eu.sem}, eu.nivel);
    while (!escolha && estoque.length) {
      if (tab.length) rival.sem = new Set(pontas); // o adversário percebe que eu não tinha as pontas
      eu.mao.push(estoque.pop());
      escolha = IA.escolher({mao: eu.mao, tabuleiro: tab, extremidades: pontas, semNumeros: eu.sem}, eu.nivel);
    }
    if (escolha) {
      eu.mao.splice(escolha.indice, 1);
      if (!tab.length) { tab.push(escolha.peca); pontas = [escolha.peca[0], escolha.peca[1]]; }
      else if (escolha.lado === 'esquerda') { tab.unshift(escolha.peca); pontas[0] = escolha.peca[0]; }
      else { tab.push(escolha.peca); pontas[1] = escolha.peca[1]; }
      passesSeguidos = 0;
      if (!eu.mao.length) return vez;
    } else {
      pontas.forEach(n => rival.sem.add(n));
      if (++passesSeguidos === 2) {
        const soma = m => m.reduce((s, p) => s + p[0] + p[1], 0);
        const a = soma(jog[0].mao), b = soma(jog[1].mao);
        return a === b ? -1 : a < b ? 0 : 1;
      }
    }
    vez = 1 - vez;
  }
}
function confronto(a, b, n) {
  let va = 0, vb = 0, e = 0;
  for (let i = 0; i < n; i++) { const r = partida(a, b, i % 2 === 0); r === 0 ? va++ : r === 1 ? vb++ : e++; }
  const pct = x => (100 * x / n).toFixed(1).padStart(5) + '%';
  console.log(`${a.padEnd(6)} x ${b.padEnd(6)} → ${a}: ${pct(va)}  ${b}: ${pct(vb)}  empates: ${pct(e)}`);
}
const n = Number(process.argv[2]) || 4000;
confronto('hard', 'easy', n); confronto('hard', 'medium', n); confronto('medium', 'easy', n); confronto('hard', 'hard', n);
