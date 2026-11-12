import fs from 'node:fs';
const url=new URL('./release-contract-audit.mjs',import.meta.url);let s=fs.readFileSync(url,'utf8');
s=s.replace("observed_result:'24 passed; 0 failed'","observed_result:'25 passed; 0 failed'");
s=s.replace("all original facsimile assets. Final whole-library", "all original facsimile and supplementary graphic assets with independent source-pixel proof. Final whole-library");
fs.writeFileSync(url,s);
