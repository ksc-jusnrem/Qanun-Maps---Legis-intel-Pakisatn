import fs from 'node:fs';
import path from 'node:path';

// Reuse the existing public factual copy. No new accounts, data practices or commercial terms.
export function buildPolicyPages({output,head,header,footer,aboutHtml,membershipHtml}) {
 const section=id=>{
  const found=aboutHtml.match(new RegExp('<section id="'+id+'">[\\s\\S]*?<\\/section>'));
  if(!found)throw Error('Existing policy section absent: '+id);return found[0];
 };
 const contact=section('contact').replace('<p><a href="mailto:contact@jusnrem.com?subject=Legis-Intel%20pilot%20access">','<p id="pilot-access"><a href="mailto:contact@jusnrem.com?subject=Legis-Intel%20pilot%20access">');
 const privacy=section('privacy');
 const terms=membershipHtml.match(/<details class="rights-note" id="terms">[\s\S]*?<\/details>/)?.[0]?.replace('<details class="rights-note"','<details open class="rights-note"');
 if(!terms)throw Error('Existing rights and permitted-use statement absent');
 const provenance='<section id="download-provenance"><h2>Citing text and structured records</h2><p>TXT and JSON downloads identify a held record and source version. They are research representations, not certification of current law. When citing or reusing them, retain the record identifier, source attribution, version or snapshot, passage reference and relevant review limits. A source-snapshot date is not a legal-currency date.</p><p>Original platform material and underlying legislation, judgments and other third-party sources have distinct rights. A downloadable file does not create a blanket licence over third-party material. Check the source and applicable permitted use; contact KSC.JUSNREM with a specific reuse question.</p></section>';
 const pages=[['contact','Contact and corrections',contact],['privacy','Privacy and research use',privacy],['terms','Rights and permitted use',terms+provenance]];
 for(const [route,title,body] of pages){
  const main=`<main id="main" class="visitor-page policy-page"><div class="eyebrow">LEGIS-INTEL PAKISTAN · INFORMATION</div><h1>${title}</h1>${body}<p><a href="/guide">Visitor guide</a> · <a href="/connectors#client-setup">MCP setup</a> · <a href="/contact">Contact</a></p></main>`;
  fs.writeFileSync(path.join(output,route+'.html'),head(title)+header+main+footer+'</body></html>');
 }
 return {routes:pages.map(([route])=>'/'+route),existing_anchors_preserved:true};
}
