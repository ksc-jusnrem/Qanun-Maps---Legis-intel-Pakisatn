import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pageMetadata,googleVerification} from './search-visibility.mjs';
const out=process.argv[2];assert.ok(out,'Provide generated public directory');
const read=name=>fs.readFileSync(path.join(out,name),'utf8');
for(const file of [...Object.keys(pageMetadata).map(name=>name+'.html'),'404.html','laws/pk-code-6c462b7d924dbbe3.html']){
 const html=read(file);
 assert.match(html,/<strong>Legis-Intel Pakistan <span class="beta">/);
 assert.ok(html.includes('<small>LEGISLATION AS CODE</small>'));
 assert.ok(html.includes('href="/mappings">Qanun Maps</a>'));
 assert.ok(html.includes('href="/connectors">Legis-Intel MCP</a>'));
 assert.ok(!html.includes('<strong>Qanun Maps <span class="beta">'));
 assert.match(html,/<title>[^<]*Legis-Intel Pakistan[^<]*<\/title>/);
}
assert.ok(read('index.html').includes('Every rule has a source. Every connection has a reason.'));
assert.ok(read('index.html').includes('From legal text<br><em>to connected intelligence.</em>'));
assert.ok(read('index.html').includes(googleVerification));
assert.ok(read('mappings.html').includes('<h1>Qanun Maps</h1>'));
assert.ok(read('mappings.html').includes('The mapping tool within Legis-Intel Pakistan — Legislation as Code.'));
assert.ok(read('glossary.html').includes('id="qanun-maps"'));
assert.ok(read('about.html').includes('id="project-identity"'));
// Connection identities remain stable so existing client installations keep working.
assert.ok(JSON.parse(read('client-setup/claude-code.json')).mcpServers['qanun-maps']);
assert.ok(read('client-setup/README.txt').includes('https://www.jusnrem.legal/mcp'));
assert.ok(read('client-setup/README.txt').includes('Legis-Intel MCP'));
console.log('BRAND_RELEASE_PASS: platform and mapping-tool identity, navigation, hero, metadata, ownership marker and legacy MCP compatibility.');
