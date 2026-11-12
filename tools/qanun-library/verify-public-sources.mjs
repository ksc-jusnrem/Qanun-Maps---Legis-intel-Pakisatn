import fs from 'node:fs';
import assert from 'node:assert/strict';
const audit=JSON.parse(fs.readFileSync(new URL('./source-status.json',import.meta.url),'utf8'));
const records=fs.readdirSync('landing-pages/qanun-maps/laws').filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync('landing-pages/qanun-maps/laws/'+n,'utf8')));
const accepted=new Set(['matched_original_normalized','matched_original_nonwhitespace','matched_original_character_stream','matched_original_character_sequence','original_reading_restored','manually_collated_original_scan','original_facsimile_complete']);
let matched=0,notices=0;
for(const r of records){
 const a=audit.records[r.id];assert.ok(a,'Missing source row '+r.id);assert.equal(a.stored_text_sha256,r.text_sha256,'Stale source row '+r.id);
 if(r.content_kind==='source_notice'){notices++;continue;}
 assert.ok(accepted.has(a.comparison_status),'Unresolved original source '+r.id+' '+a.comparison_status);
 assert.equal(a.original?.identity_checked,true,'Source identity unchecked '+r.id);assert.match(a.original.sha256,/^[a-f0-9]{64}$/);
 assert.ok(a.comparison,'No source inspection evidence '+r.id);if(a.comparison_status==='original_facsimile_complete'){assert.equal(a.comparison.body_text_checked,false);assert.equal(a.comparison.page_images_verified,true)};assert.equal(a.current_force_status,'not_checked');matched++;
}
assert.equal(Object.keys(audit.records).length,records.length);
console.log('PUBLIC_SOURCE_REGISTER_PASSED '+JSON.stringify({records:records.length,matched,notices}));
