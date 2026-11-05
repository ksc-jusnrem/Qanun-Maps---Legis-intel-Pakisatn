import path from 'node:path';
import {createService} from '../tools/qanun-framework/service.mjs';
import {createHttpHandler} from '../tools/qanun-mcp/http.mjs';

let service;
const handle=createHttpHandler({
  allowedHosts:['www.jusnrem.legal','jusnrem.legal',process.env.VERCEL_URL].filter(Boolean),
  getService:()=>service ??= createService(path.join(process.cwd(),'landing-pages/qanun-maps')),
  getRegistry:()=>JSON.parse(process.env.QANUN_MCP_GRANTS || '{"grants":[]}')
});

export default {
  fetch: handle
};
