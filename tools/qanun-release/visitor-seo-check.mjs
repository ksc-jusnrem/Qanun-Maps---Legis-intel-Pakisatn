import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pageMetadata,origin,googleVerification} from './search-visibility.mjs';
import {glossaryTerms} from './visitor-help.mjs';
const output=process.argv[2];
assert.ok(output,'Provide generated public directory');
const read=file=>fs.readFileSync(path.join(output,file),'utf8');
const robots=read('robots.txt');
assert.match(robots,/^Allow: \/$/m);
assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots),'Sitewide crawler block must be absent');
assert.ok(/^Disallow:\s*\/\s*$/m.test('User-agent: *\nDisallow: /\n'),'Block detector positive control');
assert.ok(robots.includes('Sitemap: '+origin+'/sitemap.xml'));
const urls=[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,1739);assert.equal(new Set(urls).size,urls.length);
for(const url of urls){
 const route=url.slice(origin.length);assert.ok(url.startsWith(origin+'/'));
 assert.ok(!/[?#]|\.html$/.test(route));
 const html=read(route==='/'?'index.html':route.slice(1)+'.html');
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,url);
 assert.ok(html.includes('rel="canonical" href="'+url+'"'),url);
 assert.match(html,/<meta name="description" content="[^"]+">/);
 assert.ok(!html.includes('content="noindex'),url);
}
for(const name of Object.keys(pageMetadata)){
 const html=read(name+'.html');
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1,name);
 assert.ok(html.includes('href="/guide"')&&html.includes('href="/glossary"'));
 assert.match(html,/<meta property="og:url"/);
}
assert.ok(read('index.html').includes('name="google-site-verification" content="'+googleVerification+'"'));
assert.equal((read('glossary.html').match(/<dt>/g)||[]).length,glossaryTerms.length);
// Every guide/glossary local link and anchor must resolve to a generated page.
for(const file of ['guide.html','glossary.html'])for(const [,href] of read(file).matchAll(/href="([^" ]+)"/g)){
 if(!href.startsWith('/')&&!href.startsWith('#'))continue;
 const u=new URL(href,origin+'/'+file.replace('.html',''));
 if(u.pathname.startsWith('/assets/')){assert.ok(fs.existsSync(path.join(output,u.pathname.slice(1))));continue;}
 const target=read(u.pathname==='/'?'index.html':u.pathname.slice(1)+'.html');
 if(u.hash)assert.ok(target.includes('id="'+u.hash.slice(1)+'"'),href);
}
let notices=0;
for(const name of fs.readdirSync(path.join(output,'laws')).filter(n=>n.endsWith('.json'))){
 const r=JSON.parse(read('laws/'+name));
 if(r.content_kind==='source_notice'){notices++;assert.ok(!urls.includes(origin+'/laws/'+r.id));assert.ok(read('laws/'+r.id+'.html').includes('noindex,follow'));}
}
assert.equal(notices,4);
console.log('VISITOR_SEO_PASS: 27 glossary terms, guide links and fragments, 1739 canonical sitemap URLs, crawler access, metadata, ownership marker and four excluded source notices.');
