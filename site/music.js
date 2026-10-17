/** A single spelled-pitch model drives notation, audio and MIDI. No hidden enharmonic replacement. */
export const LETTERS=['C','D','E','F','G','A','B'];
const PCS=[0,2,4,5,7,9,11], SCALE=[0,2,4,5,7,9,11];
const ROMANS=['I','II','III','IV','V','VI','VII'];
export const KEYS={major:['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'],minor:['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B']};
export const KEY_RU={C:'До','C#':'До♯',Db:'Ре♭',D:'Ре',Eb:'Ми♭',E:'Ми',F:'Фа','F#':'Фа♯',G:'Соль',Ab:'Ля♭','G#':'Соль♯',A:'Ля',Bb:'Си♭',B:'Си'};
export const mod=(x,m=12)=>(x%m+m)%m;
export function pitch(name,octave=4){const m=/^([A-G])([#b]{0,2})$/.exec(name);if(!m)throw new Error('Неизвестная нота: '+name);const letter=LETTERS.indexOf(m[1]);const alter=[...m[2]].reduce((n,c)=>n+(c==='#'?1:-1),0);return {letter,alter,octave,midi:12*(octave+1)+PCS[letter]+alter};}
function at(letter,midi){const li=mod(letter,7);let alter=mod(midi-PCS[li]);if(alter>6)alter-=12;if(Math.abs(alter)>2)throw new Error('Слишком сложное нотное написание');return {letter:li,alter,midi,octave:Math.round((midi-PCS[li]-alter)/12)-1};}
export function noteName(n){return LETTERS[n.letter]+(n.alter>0?'♯'.repeat(n.alter):'♭'.repeat(-n.alter));}
export function asciiName(n){return LETTERS[n.letter]+(n.alter>0?'#'.repeat(n.alter):'b'.repeat(-n.alter));}
export function shiftNote(n,semitones){return at(n.letter,n.midi+semitones);}
export function keyPitches(tonic,mode='major'){const t=pitch(tonic);return (mode==='minor'?[0,2,3,5,7,8,10]:SCALE).map((s,i)=>at(t.letter+i,t.midi+s));}
export function normalizeSymbol(s){return String(s).replace(/♭/g,'b').replace(/♯/g,'#').replace(/°/g,'o').replace(/[⁶₆]/g,'6').replace(/[⁵₅]/g,'5').replace(/[⁴₄]/g,'4').replace(/[³₃]/g,'3').replace(/[²₂]/g,'2').replace(/[−–—]/g,'-').trim();}
/** Plain scale degrees always refer to the parallel major: minor uses bIII, bVI, bVII. */
export function parseChord(symbol,tonic='C',mode='major'){
 const norm=normalizeSymbol(symbol);const [raw,target,...extra]=norm.split('/');if(extra.length)throw new Error('Неверный аккорд: '+symbol);
 let key=pitch(tonic), s=raw;
 if(target){const t=/^([b#]*)([ivIV]+)$/.exec(target);if(!t)throw new Error('Неверная побочная ступень');const d=ROMANS.indexOf(t[2].toUpperCase());if(d<0)throw new Error('Неверная ступень');key=at(key.letter+d,key.midi+SCALE[d]+[...t[1]].reduce((v,c)=>v+(c==='#'?1:-1),0));}
 const cadential=s==='K64';if(cadential)s=(mode==='minor'?'i':'I')+'64';
 const m=/^([b#]*)([ivIV]+)(maj|ø|o)?(65|64|43|42|7|6)?$/.exec(s);if(!m)throw new Error('Не поддерживается обозначение: '+symbol);
 const degree=ROMANS.indexOf(m[2].toUpperCase());if(degree<0)throw new Error('Неверная ступень: '+symbol);
 const alteration=[...m[1]].reduce((v,c)=>v+(c==='#'?1:-1),0), suffix=m[4]||'', seventh=['7','65','43','42'].includes(suffix);
 const quality=m[3]==='o'?'dim':m[3]==='ø'?'half':m[2]===m[2].toLowerCase()?'minor':'major';
 const intervals=quality==='dim'||quality==='half'?[0,3,6]:quality==='minor'?[0,3,7]:[0,4,7];
 if(seventh)intervals.push(quality==='dim'?9:m[3]==='maj'?11:10);
 const root=at(key.letter+degree,key.midi+SCALE[degree]+alteration);
 const rootIn4=at(root.letter,60+mod(root.midi)); // keep spelling such as B#4 correct
 const tones=intervals.map((n,i)=>at(root.letter+2*i,rootIn4.midi+n));
 const inversion=['6','65'].includes(suffix)?1:['64','43'].includes(suffix)?2:suffix==='42'?3:0;
 if(inversion>=tones.length)throw new Error('Обращение не соответствует аккорду');
 const bass=at(tones[inversion].letter,36+mod(tones[inversion].midi));
 let name=noteName(root)+(quality==='minor'?'m':quality==='dim'?'dim':quality==='half'?'m7♭5':'');
 if(seventh&&quality!=='half')name+=m[3]==='maj'?'maj7':'7';
 if(inversion)name+='/'+noteName(bass);
 return {symbol,degree:degree+1,quality,seventh,root:rootIn4,tones,bass,inversion,name,cadential};
}
function bassDegree(s,tonic){const m=/^([b#]*)([1-7])$/.exec(normalizeSymbol(s));if(!m)throw new Error('Неверная ступень баса');const t=pitch(tonic),d=+m[2]-1;const a=[...m[1]].reduce((v,c)=>v+(c==='#'?1:-1),0);return at(t.letter+d,36+mod(t.midi+SCALE[d]+a));}
export function compile(progression,options={}){
 const tonic=options.tonic||'C',mode=options.mode||'major',pattern=options.pattern||'chords';
 if(!Array.isArray(progression)||!progression.length||progression.length>64)throw new Error('Нужно от 1 до 64 аккордов');
 let beat=0;const events=[],bars=[];
 progression.forEach((input,index)=>{
  const data=typeof input==='string'?{symbol:input}:input;
  const localMode=data.mode||mode;
  const localTonic=data.offset===undefined?tonic:KEYS[localMode][mod(pitch(tonic).midi+data.offset)];
  const c=parseChord(data.symbol,localTonic,localMode), beats=data.beats??4;
  if(![1,2,4].includes(beats))throw new Error('Поддерживаются длительности 1, 2, 4 доли');
  if(data.bass)c.bass=bassDegree(data.bass,localTonic);
  if(options.pedal)c.bass=bassDegree(options.pedal,tonic);
  if(data.bass||options.pedal)c.name=c.name.split('/')[0]+(mod(c.bass.midi)!==mod(c.root.midi)?'/'+noteName(c.bass):'');
  const rh=[];if(pattern==='arpeggio'){
   const base=c.root.midi>65?-12:0;
   const tones=c.tones.map(n=>shiftNote(n,base));
   const n=[tones[0],tones[2],shiftNote(tones[1],12),shiftNote(tones[seventhIndex(c)],12),shiftNote(tones[0],24),shiftNote(tones[seventhIndex(c)],12),shiftNote(tones[1],12),tones[2]];
   const count=beats*2;for(let i=0;i<count;i++){const ns=n[i];const e={hand:'right',notes:[ns],beat:beat+i*.5,duration:.5,index};events.push(e);rh.push(e);}
  }else{
   const ns=c.tones.map((n,i)=>i<c.inversion?shiftNote(n,12):n).sort((a,b)=>a.midi-b.midi);
   const e={hand:'right',notes:ns,beat,duration:beats,index};events.push(e);rh.push(e);
  }
  const left={hand:'left',notes:[c.bass],beat,duration:beats,index};events.push(left);
  bars.push({...c,index,beat,beats,rh,left,tonic:localTonic,mode:localMode});beat+=beats;
 });return {bars,events,totalBeats:beat,tonic,mode,pattern};
}
function seventhIndex(c){return c.seventh?3:2;}
export function transposeKey(tonic,mode,delta){return KEYS[mode][mod(pitch(tonic).midi+delta)];}
const variable=(n)=>{let b=[n&127];while(n>>=7)b.unshift((n&127)|128);return b;};
export function midiBytes(score,bpm=72,hand='both'){
 if(!Number.isFinite(bpm)||bpm<30||bpm>220)throw new Error('Неверный темп');
 const str=s=>Array.from(s,c=>c.charCodeAt(0)),u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const tempo=Math.round(60000000/bpm),ev=[{t:0,b:[0xff,0x51,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255],p:0}];
 score.events.filter(e=>hand==='both'||e.hand===hand).forEach(e=>e.notes.forEach(n=>{const ch=e.hand==='left'?1:0;ev.push({t:Math.round(e.beat*480),b:[0x90+ch,n.midi,e.hand==='left'?68:82],p:2});ev.push({t:Math.round((e.beat+e.duration*.88)*480),b:[0x80+ch,n.midi,0],p:1});}));
 ev.sort((a,b)=>a.t-b.t||a.p-b.p);let last=0,data=[0,0xc0,0,0,0xc1,0];for(const e of ev){data.push(...variable(e.t-last),...e.b);last=e.t;}data.push(...variable(Math.max(0,score.totalBeats*480-last)),0xff,0x2f,0);
 return new Uint8Array([...str('MThd'),0,0,0,6,0,0,0,1,1,224,...str('MTrk'),...u32(data.length),...data]);
}
