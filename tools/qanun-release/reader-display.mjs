// Presentation-only hiding of three unambiguous whole-line extraction markers.
// All characters remain in the HTML DOM and the original TXT/JSON downloads.
export function cleanDisplay(raw){
 return raw.replace(/(^|\n|>)([ \t]*(?:Page[ \t]+\d+[ \t]+of[ \t]+\d+|\d+[ \t]*\|[ \t]*P[ \t]+a[ \t]+g[ \t]+e|={5}[ \t]*PDF PAGE[ \t]+\d+[ \t]*={5})[ \t]*)(?=\r?\n|<|$)/g,(_,lead,line)=>lead+'<span class="page-artifact" aria-hidden="true">'+line+'</span>');
}
