import fs from 'node:fs';
const url=new URL('../facsimile.mjs',import.meta.url);let text=fs.readFileSync(url,'utf8');
text=text.replace('const markers=(record.passages||[]).map','const markers=oldSections.map(id=>`<span id="${esc(id)}" class="facsimile-legacy-marker" data-passage-kind="legacy_extraction_heading"></span>`).join(\'\')+(record.passages||[]).map');
text=text.replace('The full statutory body has not been machine-transcribed or certified as text-checked.','The statutory body is presented as original page images. Archived OCR, where present, is not an editorially verified transcription.');
text=text.replace('legacy_passage_anchors:(record.passages||[]).length,body_text_checked','legacy_passage_anchors:(record.passages||[]).length,legacy_provision_anchors:oldSections.length,body_text_checked');
fs.writeFileSync(url,text);
