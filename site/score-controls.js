/** Small SVG controls, not notation: no fonts, external assets or user data. */
const svg=(name,body,viewBox='0 0 24 24')=>`<svg class="${name}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;
const arrow=path=>svg('transpose-icon',`<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`);
export const LOWER_ICON=arrow('M12 4v16m-5-5 5 5 5-5');
export const HIGHER_ICON=arrow('M12 20V4m-5 5 5-5 5 5');
// Bravura noteheadBlack outline from the existing VexFlow bundle, scaled to 5.2px.
// The middle voice is retained; the outer voices move to a closer position.
const head='M-0.887 2.202C0.679 2.202 2.6 0.759 2.6 -0.734C2.6 -1.64 1.89 -2.202 0.887 -2.202C-1.046 -2.202 -2.6 -0.771 -2.6 0.734C-2.6 1.652 -1.841 2.202 -0.887 2.202Z';
export const VOICING_ICON=svg('voicing-control-icon',
 '<path class="voice-connections" d="M5 4.5 23 7M5 12H23M5 19.5 23 17" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>'+
 [[5,4.5],[5,12],[5,19.5],[23,7],[23,12],[23,17]].map(([x,y])=>`<path class="voice-head" d="${head}" transform="translate(${x} ${y})" fill="currentColor"/>`).join(''),'0 0 28 24');
export const VOICING_TITLE='Плавное голосоведение правой руки';
export const VOICING_INTRO='Подобраны удобные расположения аккордов правой руки. Бас не меняется.';
const HINT_KEY='harmony.voicing-icon-help.v1';
/** One brief explanation on the first successful touch activation in this browser.
 * Storage is optional: privacy modes must not prevent the musical control from working.
 */
export function makeVoicingHint(env=globalThis){
 let shown=false;
 return notify=>{
  if(shown||typeof notify!=='function'||!env.matchMedia?.('(pointer: coarse)').matches)return;
  try{if(env.localStorage?.getItem(HINT_KEY)==='1'){shown=true;return;}}catch{/* optional */}
  shown=true;notify(VOICING_INTRO);
  try{env.localStorage?.setItem(HINT_KEY,'1');}catch{/* once per page when storage is unavailable */}
 };
}
