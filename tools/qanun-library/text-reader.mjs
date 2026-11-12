import {renderLibraryReader} from './reader/reader.mjs';
export function renderTextReader(record,options={}){
 const source=renderLibraryReader(record,options);
 if(options.sourceLayoutText!==undefined&&source.report.provision_count===0&&source.report.contents_numbers_observed?.length){
  const fallback=renderLibraryReader(record,{...options,sourceLayoutText:undefined});
  if(fallback.provisions.length>0){fallback.report.source_layout_selection={selected:'stored_source_line_order',reason:'Independent PDF layout separated marginal headings from operative section numbers. Stored-source line order restores identified operative headings without changing source characters.',discarded_layout_sha256:source.report.source_layout_sha256};return fallback;}
 }
 return source;
}
