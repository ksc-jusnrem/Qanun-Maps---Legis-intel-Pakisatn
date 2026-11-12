import fs from 'node:fs';
import path from 'node:path';
import {displayRecordTitle} from '../qanun-library/record-display.mjs';
export const origin='https://www.jusnrem.legal';
export const googleVerification='ZfQYjWfzY5gs7nfQ2rdPg0hVjxE6kzOuEoQ7hr4CTDg';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pageMetadata={
 'index':['Legis-Intel Pakistan — Legislation as Code','Explore Pakistani legislation, rule mapping and Judicial Intelligence. Find source-linked legal texts and discover the Legis-Intel MCP research connector.'],
 'legislation':['Pakistan Legislation Library | Legis-Intel Pakistan','Search held Pakistani legislation by title and source collection. Read provisions, inspect source editions and download structured research records.'],
 'mappings':['Qanun Maps — Rule Mapping | Legis-Intel Pakistan','Explore selected Pakistani statute and judgment relationships. Compare supporting passages, source editions and review limits in Qanun Maps, the mapping tool of Legis-Intel Pakistan.'],
 'library-map':['Law Library Map | Legis-Intel Pakistan','Follow instrument citations, provision references and incoming links across the law library, with exact source evidence and unresolved references.'],
 'case-law':['Pakistan Judicial Intelligence | Legis-Intel Pakistan','Search judgment discovery records and inspect selected reviewed judgment-to-provision relationships with source passages and research limitations.'],
 'rule-workbench':['Rules as Code Research Workbench | Legis-Intel Pakistan','Inspect source-linked research propositions, supporting passages and evidence gaps in the Legis-Intel Pakistan Rules as Code workbench.'],
 'legislative-intelligence':['Legislative Intelligence | Legis-Intel Pakistan','Explore the Legislative Intelligence framework and visual explanations connecting legal sources, institutional responsibilities and implementation.'],
 'connectors':['Legis-Intel MCP Connector | Legis-Intel Pakistan','Learn how the Legis-Intel MCP pilot brings held legislation and mapped evidence into compatible AI clients, with setup options and current availability.'],
 'membership':['Access and Plans | Legis-Intel Pakistan','Explore planned Legis-Intel Pakistan subscriptions at US$5 monthly or US$50 annually and institutional licensing. Payments and paid activation are coming soon.'],
 'about':['About Legis-Intel Pakistan | Legislation as Code','Understand Legis-Intel Pakistan, its Law as Code programme, machine-readable legislation, rule mapping and Judicial Intelligence research by KSC.JUSNREM.'],
 'guide':['How to Use Legis-Intel Pakistan | Visitor Guide','Learn to search legislation, find provisions, inspect rule mappings and Judicial Intelligence, retain source references and use the MCP research pilot.'],
 'glossary':['Law as Code & Legal Research Glossary | Legis-Intel Pakistan','Plain-language definitions of Law as Code, Rules as Code, machine-readable law, MCP, rule mapping, provenance and Legis-Intel Pakistan research labels.']
};
// Search verification is a public ownership marker, not an API credential.
export function applySearchVisibility(output,records){
 const entries=[];
 const apply=(file,route,title,description,index=true)=>{
  let html=fs.readFileSync(path.join(output,file),'utf8');
  const canonical=origin+route;
  const tags=`<meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta name="robots" content="${index?'index,follow,max-image-preview:large':'noindex,follow'}"><meta property="og:type" content="website"><meta property="og:site_name" content="Legis-Intel Pakistan"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><link rel="icon" type="image/svg+xml" href="/assets/ksc-round-k.svg">${route==='/'?`<meta name="google-site-verification" content="${googleVerification}">`:''}`;
  html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`).replace('</head>',tags+'</head>');
  fs.writeFileSync(path.join(output,file),html);
  if(index)entries.push(canonical);
 };
 for(const [name,[title,description]] of Object.entries(pageMetadata))apply(name+'.html',name==='index'?'/':'/'+name,title,description);
 for(const record of records)apply('laws/'+record.id+'.html','/laws/'+record.id,displayRecordTitle(record)+' | Legis-Intel Pakistan',`Read the held ${record.source_collection} record for ${displayRecordTitle(record)}. Inspect its text, source edition and research limits.`,record.content_kind==='stored_law_text');
 fs.writeFileSync(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /mcp\n\nSitemap: ${origin}/sitemap.xml\n`);
 // No fabricated lastmod dates: source retrieval dates are not page modification dates.
 fs.writeFileSync(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries.map(url=>`  <url><loc>${escape(url)}</loc></url>`).join('\n')+'\n</urlset>\n');
 return {indexable_pages:entries.length,excluded_source_notices:records.filter(r=>r.content_kind==='source_notice').length};
}
