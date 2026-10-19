/** Display convention only. Internal pitches and lead-sheet chord symbols stay unchanged. */
export const ACADEMIC_ROOTS = Object.freeze({
 C:'C', 'C#':'Cis', Cb:'Ces', D:'D', 'D#':'Dis', Db:'Des',
 E:'E', 'E#':'Eis', Eb:'Es', F:'F', 'F#':'Fis', Fb:'Fes',
 G:'G', 'G#':'Gis', Gb:'Ges', A:'A', 'A#':'Ais', Ab:'As',
 B:'H', 'B#':'His', Bb:'B'
});
export function keyLabel(tonic, mode='major') {
 const root=ACADEMIC_ROOTS[tonic];
 if(!root || !['major','minor'].includes(mode))throw new Error('Неизвестная тональность');
 return mode==='minor'?root.toLowerCase()+'-moll':root+'-dur';
}
const RUSSIAN_NOTES={до:'C',ре:'D',ми:'E',фа:'F',соль:'G',ля:'A',си:'B'};
/** Format instructional prose, never user notes, URLs or stored course data. */
export function academicKeyNames(value) {
 return String(value??'').replace(/(?<![\p{L}\p{N}_])(до|ре|ми|фа|соль|ля|си)(?:\s*[-‑–]?\s*(диез|бемоль)|\s*([♯#♭]))?[\s‑-]+(мажор|минор)(?:а|е|у|ом)?(?![\p{L}\p{N}_])/giu,
  (_,name,word,sign,mode)=>keyLabel(RUSSIAN_NOTES[name.toLowerCase()]+(word?.toLowerCase()==='диез'||sign==='#'||sign==='♯'?'#':word?.toLowerCase()==='бемоль'||sign==='♭'?'b':''),mode.toLowerCase()==='минор'?'minor':'major'));
}
