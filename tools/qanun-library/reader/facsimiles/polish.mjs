import fs from 'node:fs';
const url=new URL('../facsimile.mjs',import.meta.url);let text=fs.readFileSync(url,'utf8');
text=text.replace('data-passage-kind="original_extracted_headers"','data-passage-kind="${damagedOCR?\'original_damaged_ocr\':\'original_extracted_headers\'}"');
text=text.replace('The earlier text extraction contains headers and publication details; it does not contain the statutory body shown in these pages.','${damagedOCR?\'The archived OCR contains visible recognition errors. Read the original pages below; the uncorrected OCR remains separately preserved for comparison.\':\'The earlier text extraction contains headers and publication details; it does not contain the statutory body shown in these pages.\'}');
text=text.replace('>Pakistan Code official source</a>','>${f.original_url.includes(\'drs.molaw.gov.pk\')?\'Ministry of Law DRS official source\':\'Pakistan Code official source\'}</a>');
text=text.replace('Header extraction and original stored transcription','${damagedOCR?\'Archived damaged OCR and original stored transcription\':\'Header extraction and original stored transcription\'}');
text=text.replace('original extracted headers retained separately. Selected passage review is separately recorded.','original stored extraction retained separately. Selected passage review is separately recorded.');
fs.writeFileSync(url,text);
