import {legacyReaderDestination} from './tools/qanun-release/canonical-readers.mjs';
import {readerRoutes} from './tools/qanun-release/reader-routes.mjs';

// Native platform middleware for this framework:null static deployment.
// Exact legacy-reader shape only: canonical pages, API, MCP, TXT and JSON never enter it.
export const config={runtime:'nodejs',matcher:['/laws/((?:pk-code|punjab-code|kp-code|balochistan-code)-[a-f0-9]{16}(?:\\.html)?/?)']};
export default function middleware(request) {
 const destination=legacyReaderDestination(request.url,readerRoutes);
 if(!destination)return; // Defensive only: excluded by the statically scoped matcher.
 if(destination.unknown)return new Response('Reader record not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 return new Response(null,{status:301,headers:{Location:destination.url,'Cache-Control':'public, max-age=86400'}});
}
