import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'work/library-repair/public');
const port=Number(process.argv[3]||4187);
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.pdf':'application/pdf'};
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const headers=Object.fromEntries(config.headers.flatMap(x=>x.headers).map(h=>[h.key,h.value]));
http.createServer((req,res)=>{
 try{const url=new URL(req.url,'http://127.0.0.1');let relative=decodeURIComponent(url.pathname);if(relative.includes('\0'))throw Error('Invalid path');relative=relative==='/'?'/index.html':relative;let file=path.resolve(root,'.'+relative);if(file!==root&&!file.startsWith(root+path.sep))throw Error('Unsafe path');if(!path.extname(file))file+='.html';const status=fs.existsSync(file)&&fs.statSync(file).isFile()?200:404;if(status===404)file=path.join(root,'404.html');res.writeHead(status,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log('Legis-Intel verification server http://127.0.0.1:'+port));
