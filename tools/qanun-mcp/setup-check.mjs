import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {clientFiles} from '../qanun-release/connectors.mjs';
const output=process.argv[2];
for(const [name,expected] of Object.entries(clientFiles))assert.equal(fs.readFileSync(path.join(output,'client-setup',name),'utf8'),expected+'\n');
const code=JSON.parse(clientFiles['claude-code.json']);assert.equal(code.mcpServers['qanun-maps'].headers.Authorization,'Bearer ${QANUN_ACCESS_TOKEN}');
const vs=JSON.parse(clientFiles['vscode.json']);assert.equal(vs.inputs[0].password,true);assert.equal(vs.servers['qanun-maps'].type,'http');
assert.equal(JSON.parse(clientFiles['stdio-client.json']).mcpServers['qanun-maps'].command,'node');
for(const name of ['index.html','about.html','legislation.html','mappings.html','case-law.html','membership.html','rule-workbench.html','connectors.html']) {
 const html=fs.readFileSync(path.join(output,name),'utf8');assert.ok(html.includes('href="/connectors"'),name+' client navigation missing');assert.ok(html.includes('href="/rule-workbench"'),name+' workbench navigation missing');
}
assert.equal(fs.readFileSync(path.join(output,'client-setup/bridge.mjs'),'utf8'),fs.readFileSync(new URL('./bridge.mjs',import.meta.url),'utf8'));
console.log('CLIENT_SETUP_PASS: six setup documents, bridge, client navigation and protected credential placeholders');
