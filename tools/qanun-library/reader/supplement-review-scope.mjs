import fs from 'node:fs';
const url=new URL('./supplements.mjs',import.meta.url);let s=fs.readFileSync(url,'utf8');
s=s.replace('source_supplement_inventory_sha256:m.source_inventory_sha256,source_body_contains_untranscribed_images','source_supplement_inventory_sha256:m.source_inventory_sha256,source_image_supplement_selection_complete:m.source_image_screening_complete===true,source_body_contains_untranscribed_images');
s=s.replace("assert.equal(report.source_supplement_inventory_sha256,m.source_inventory_sha256);","assert.equal(report.source_supplement_inventory_sha256,m.source_inventory_sha256);assert.equal(report.source_image_supplement_selection_complete,m.source_image_screening_complete===true);");
fs.writeFileSync(url,s);
