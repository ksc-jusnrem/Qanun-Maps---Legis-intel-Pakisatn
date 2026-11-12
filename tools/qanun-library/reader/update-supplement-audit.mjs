import fs from 'node:fs';
const u=new URL('./release-contract-audit.mjs',import.meta.url);let s=fs.readFileSync(u,'utf8');
s=s.replace("observed_result:'22 passed; 0 failed'","observed_result:'24 passed; 0 failed'");
s=s.replace("unresolved_printed_instrument_identities:relations.relationships.filter(r=>!r.target_id).length,focused_check:","unresolved_printed_instrument_identities:relations.relationships.filter(r=>!r.target_id).length,source_supplements:supplements.summary,source_supplement_inventory_sha256:supplements.source_inventory_sha256,source_supplement_pixel_proof:{manifest_sha256:pixelProof.manifest_sha256,pages:pixelProof.pages,all_pixels_match:pixelProof.all_pixels_match},focused_check:");
fs.writeFileSync(u,s);
