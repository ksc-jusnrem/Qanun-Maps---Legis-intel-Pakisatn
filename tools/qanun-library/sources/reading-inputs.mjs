import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let data,inputs;
export function loadSourceReadingInputs(){
 if(!data){const bytes=fs.readFileSync(new URL('./reading-inputs.json.gz',import.meta.url)),summary=JSON.parse(fs.readFileSync(new URL('./reading-inputs-summary.json',import.meta.url),'utf8'));if(sha(bytes)!==summary.bundle_sha256)throw Error('Original reading-input bundle changed');data=JSON.parse(zlib.gunzipSync(bytes));inputs=new Map(Object.entries(data.records));}
 return inputs;
}
export function getSourceReadingInput(record,expectedOriginalSha256){
 const input=loadSourceReadingInputs().get(record.id);if(!input)return{};
 if(input.proof.input_text_sha256!==record.text_sha256)return{};
 if(expectedOriginalSha256&&expectedOriginalSha256!==input.proof.original_pdf_sha256)throw Error('Source reader original identity mismatch '+record.id);
 if(input.sourceLayoutText){
  if(sha(input.sourceLayoutText)!==input.proof.layout_text_sha256||input.sourceLayoutText.replace(/\s+/g,'')!==record.text.replace(/\s+/g,''))throw Error('Literal original layout differs '+record.id);
 }
 for(const c of input.displayCorrections||[]){const original=Array.from(record.text).slice(c.character_start,c.character_end).join('');if(!/^\s+$/.test(original)||c.replacement!=='')throw Error('Source spacing correction changes a character '+record.id);}
 return input;
}
