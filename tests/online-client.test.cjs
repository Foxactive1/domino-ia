const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const ids=new Set([...fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const elements=new Map();
 const element=()=>({textContent:'',innerHTML:'',value:'medium',tagName:'DIV',className:'',children:[],classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(c){this.children.push(c)},setAttribute(){},addEventListener(){}});
 const context=vm.createContext({console:{log(){}},document:{getElementById(id){assert(ids.has(id),`Missing element: ${id}`);if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement(tag){return {...element(),tagName:tag.toUpperCase()}},createElementNS(){return element()},querySelectorAll(){return []}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout(){},clearTimeout(){},confirm(){return true}});
 vm.runInContext(fs.readFileSync('jogo.js','utf8')+fs.readFileSync('online.js','utf8')+';globalThis.api={Game,Online,UI};',context);
 const {Game,Online,UI}=context.api;
 const events=[];
 Online.socket={connected:true,volatile:{timeout(){return {emit(event,payload,cb){events.push({event,payload});cb(null,{ok:true})}}}}};
 const state={roomCode:'ABC234',you:0,round:1,revision:3,hand:[[1,2],[5,5]],opponentCount:6,stockCount:14,board:[[1,3]],ends:[1,3],turn:0,result:null,scores:[0,0,0],history:[],rematch:[],players:[{name:'Dione',connected:true},{name:'Amigo',connected:true}]};
 return {Game,Online,UI,state,events,elements};
}
test('online render finds all HTML controls and displays server state',()=>{const {Online,Game,state,elements}=setup();Online.render(state);assert.equal(Game.maoJogador.length,2);assert.equal(Game.maoIA.length,6);assert.equal(elements.get('opponentName').textContent,'Amigo');assert.equal(elements.get('btnNovoJogo').disabled,true);assert.equal(Game.vezDoJogador,true)});
test('online move sends index, side and revision without locally mutating hand',async()=>{const {Online,Game,UI,state,events}=setup();Online.render(state);UI.selecionarPeca(0);await Game.jogarPecaSelecionada('esquerda');assert.equal(events[0].event,'play_move');assert.equal(events[0].payload.index,0);assert.equal(events[0].payload.side,'left');assert.equal(events[0].payload.revision,3);assert.equal(Game.maoJogador.length,2)});
test('disconnect pauses moves, finished round enables rematch and IA returns on reset',()=>{const {Online,Game,state,elements}=setup();state.players[1].connected=false;Online.render(state);assert.equal(Game.jogoAtivo,false);state.players[1].connected=true;state.result={winner:0};Online.render(state);assert.equal(elements.get('btnNovoJogo').disabled,false);Online.reset();assert.equal(Online.active,false);Game.iniciar();assert.equal(Game.maoJogador.length,7)});
test('player messages are text, including HTML-like names',()=>{const {Online,state,elements}=setup();state.players[1].name='<img src=x onerror=alert(1)>';state.turn=1;Online.render(state);assert.match(elements.get('mensagemJogo').textContent,/<img/);assert.equal(elements.get('mensagemJogo').innerHTML,'')});
