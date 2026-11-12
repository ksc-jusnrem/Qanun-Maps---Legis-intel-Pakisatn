// Resume the presentation integration on an already generated, private preview.
import fs from 'node:fs';
import path from 'node:path';
import {integrateLibrary} from './integrate.mjs';
import {applySearchVisibility} from '../qanun-release/search-visibility.mjs';
const output=path.resolve(process.argv[2]);
if(!output.startsWith(path.resolve('work/library-repair')+path.sep))throw Error('Preview must stay in the private repair workspace');
const template=fs.readFileSync(path.join(output,'laws/pk-code-6c462b7d924dbbe3.html'),'utf8');
const head=title=>template.slice(0,template.indexOf('<body>')+6).replace(/<title>[\s\S]*?<\/title>/,'<title>'+title+' — Legis-Intel Pakistan</title>');
const header=template.slice(template.indexOf('<div class="topline">'),template.indexOf('<main id="main"'));
const footer=template.slice(template.indexOf('<footer>'),template.indexOf('</body>')).replace(/<script>[\s\S]*?<\/script>/g,'');
const records=fs.readdirSync(path.join(output,'laws')).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(output,'laws',n),'utf8')));
const report=integrateLibrary({output,records,head,header,footer});
applySearchVisibility(output,records);
console.log('PRIVATE_PREVIEW_GENERATED '+JSON.stringify({records:report.records,graph:report.graph_summary}));
