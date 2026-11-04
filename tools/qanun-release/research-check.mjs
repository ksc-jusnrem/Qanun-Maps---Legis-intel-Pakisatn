import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Provide generated public directory');
const data=JSON.parse(fs.readFileSync(new URL('./case-discovery.json',import.meta.url),'utf8'));
const page=fs.readFileSync(path.join(out,'case-law.html'),'utf8');
assert.equal(data.records.length,2365);assert.equal(new Set(data.records.map(c=>c.id)).size,2365);
assert.equal((page.match(/data-research-card/g)||[]).length,2365);
for(const id of ['234454','234434','234534','234441','234580','236053','234431','236049'])assert.ok(page.includes(`id="case-${id}"`));
assert.ok(data.records.find(c=>c.id==='234454').title.includes('POWER LINE'));
assert.ok(data.records.find(c=>c.id==='234434').title.includes('PAKISTAN LNG'));
for(const c of data.records){assert.equal(c.retrieval_date,null);assert.ok(!Object.hasOwn(c,'snippet'));assert.ok(!Object.hasOwn(c,'headnote'));assert.ok(!Object.hasOwn(c,'books'));for(const l of c.law_links){assert.ok(fs.existsSync(path.join(out,'laws',l.law_id+'.html')));assert.ok(fs.readFileSync(path.join(out,'laws',l.law_id+'.html'),'utf8').includes(`/case-law?law=${l.law_id}`));}}
const script=fs.readFileSync(new URL('./research-ui.js',import.meta.url));const token='sha256-'+crypto.createHash('sha256').update(script).digest('base64');const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));assert.ok(config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value.includes(token));
assert.ok(fs.readFileSync(path.join(out,'index.html'),'utf8').includes('href="/mappings"'));
assert.ok(fs.readFileSync(path.join(out,'mappings.html'),'utf8').includes('Read supporting provision(s)'));
console.log('PASS: distinct case identities, 2365 cards, resolved law links and reverse links, private fields excluded, unknown retrieval dates preserved, navigation and CSP.');
