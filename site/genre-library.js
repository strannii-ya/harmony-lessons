/** Category metadata only. Musical exercises are loaded through authenticated database access. */
export const GENRES=[
 ['blues','Блюз'],['jazz','Джаз'],['rock','Рок'],['pop','Поп'],['waltz','Вальс'],
 ['country','Кантри'],['soul','Соул / R&B'],['funk','Фанк'],['folk','Фолк'],['postrock','Пост-рок']
].map(([id,label])=>({id,label}));
export const isGenre=e=>e.library_section==='genres';
export const genreLabel=e=>GENRES.find(g=>g.id===e.genre)?.label||'';
export function selectExercises(exercises,{collection='all',genre='all',lesson='all',query='',favorites=null}={}){
 const q=String(query).trim().toLocaleLowerCase('ru');
 return exercises.filter(e=>(!favorites||favorites.has(e.id))&&
  (collection==='all'||(collection==='genres'?isGenre(e):!isGenre(e)))&&
  (genre==='all'||isGenre(e)&&e.genre===genre)&&
  (lesson==='all'||!isGenre(e)&&String(e.lesson_id)===String(lesson))&&
  (!q||[e.title,e.goal,e.discuss,genreLabel(e),...e.progression.map(x=>typeof x==='string'?x:x.symbol)].join(' ').toLocaleLowerCase('ru').includes(q)));
}
