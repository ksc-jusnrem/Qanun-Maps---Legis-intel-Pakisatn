import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSections} from './section-navigation.mjs';
test('Rule 16 OCR spacing remains navigable without changing the source',()=>{
 const record=JSON.parse(fs.readFileSync(new URL('../../landing-pages/qanun-maps/laws/pk-code-6c462b7d924dbbe3.json',import.meta.url),'utf8'));
 const entry=parseSections(record).entries.find(e=>e.number==='16');
 assert.ok(entry);
 assert.match(Array.from(record.text).slice(entry.character_start,entry.character_start+100).join(''),/16\.\s+Cases to be brought b efore the Cabinet/);
});
test('contents number alone does not corroborate an unrelated operative heading',()=>{
 const record={title:'Example Rules',content_kind:'stored_law_text',text:'1. Scope .... 1\n2. Powers .... 2\n3. Duties .... 3\n\n1. Scope.--These rules apply.\n2. Completely different.--This is not the listed heading.\n3. Duties.--Keep records.'};
 assert.deepEqual(parseSections(record).entries.map(e=>e.number),['1','3']);
});
