import fs from 'node:fs';
const url=new URL('./manifest.json',import.meta.url),m=JSON.parse(fs.readFileSync(url,'utf8'));
const f=m.records.find(r=>r.id==='pk-code-4ff23b094ca55ea4');
f.original_pdf_page_count=281;
f.source_edition_note='The displayed Act is the edition held in the official ECP election-law volume eleclaws18.pdf. It is a different source edition from the archived 2002 compilation, whose text has not been verified against this facsimile. No claim is made that either is a current consolidation or has current legal force.';
fs.writeFileSync(url,JSON.stringify(m,null,2));
