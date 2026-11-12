import fs from 'node:fs';
import crypto from 'node:crypto';
const configPath=new URL('../../vercel.json',import.meta.url);
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const policy=config.headers.flatMap(x=>x.headers).find(h=>h.key==='Content-Security-Policy');
if(!policy)throw Error('CSP missing');
const script=fs.readFileSync(new URL('../qanun-release/reader-ui.js',import.meta.url),'utf8');
const token="'sha256-"+crypto.createHash('sha256').update(script).digest('base64')+"'";
policy.value=policy.value.replace(/script-src ([^;]+)/,(all,tokens)=>'script-src '+[...new Set(["'self'",...tokens.trim().split(/\s+/)])].join(' '));
if(!policy.value.includes(token))policy.value=policy.value.replace('script-src ',`script-src ${token} `);
const manifestFile=new URL('../qanun-release/integration-manifest.json',import.meta.url);
if(fs.existsSync(manifestFile)){
 const add=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key.endsWith('script_csp_token')&&typeof item==='string'){const bound="'"+item+"'";if(!policy.value.includes(bound))policy.value=policy.value.replace('script-src ', 'script-src '+bound+' ');}else if(key!=='manifest'&&key!=='readers')add(item);}};
 add(JSON.parse(fs.readFileSync(manifestFile,'utf8')));
}
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
console.log('Reader CSP and external library script policy synchronized');
