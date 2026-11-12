import assert from 'node:assert/strict';
export function assertPublicReadingBinding(record,row,reading,facsimile){
 if(['original_reading_restored','manually_collated_original_scan'].includes(row.comparison_status)){
  assert.ok(reading,'Restored reading is absent '+record.id);
  assert.equal(reading.text_sha256,row.comparison.corrected_reading_text_sha256,'Restored reading differs from audited text '+record.id);
  assert.equal(reading.source_sha256,row.original.sha256,'Restored reading belongs to another original '+record.id);
 }else assert.ok(!reading,'An unaudited reading version is present '+record.id);
 if(row.comparison_status==='original_facsimile_complete'){
  assert.ok(facsimile,'Original facsimile is absent '+record.id);
  assert.equal(facsimile.input_text_sha256,record.text_sha256);assert.equal(facsimile.source_pdf_sha256,row.original.sha256);
  assert.equal(row.comparison.body_text_checked,false);assert.equal(row.comparison.page_images_verified,true);assert.equal(row.comparison.reading_pages,facsimile.page_count);
 }
}
