const CACHE='poodman-shell-v2';
const CORE=['./','./index.html','./offline.html','./favicon.svg','./manifest.webmanifest','./file.svg','./globe.svg','./window.svg'];

function sameOrigin(url){return url.origin===self.location.origin}
function isApi(url){return url.pathname.endsWith('.php')||url.search.includes('school-api.php')}
function isShellAsset(url){return eventlessStatic(url.pathname)||url.pathname.endsWith('/')}
function eventlessStatic(path){return /\.(?:js|mjs|css|html|svg|png|webp|ico|webmanifest|woff2?|ttf|txt)$/i.test(path)}

const inflight=new Set();
async function pull(cache,url){
 if(inflight.has(url))return null;
 inflight.add(url);
 try{
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok)return null;
  await cache.put(url,response.clone());
  await cacheLinked(cache,response,url);
  return response;
 }catch{return null}
 finally{inflight.delete(url)}
}
async function cacheLinked(cache,response,base){
 const type=response.headers.get('content-type')||'';
 const path=new URL(base,self.location.origin).pathname;
 if(!/css|html/.test(type)&&!/\.(?:css|html)$/i.test(path))return;
 let text='';
 try{text=await response.clone().text()}catch{return}
 const refs=new Set();
 for(const match of text.matchAll(/(?:url\(\s*|src=["']|href=["'])([^"')\s]+)/g))refs.add(match[1]);
 for(const ref of refs){
  if(!ref||ref.startsWith('data:')||ref.startsWith('#')||ref.includes('.php'))continue;
  let absolute;
  try{absolute=new URL(ref,base)}catch{continue}
  if(!sameOrigin(absolute)||isApi(absolute)||await cache.match(absolute.href))continue;
  if(!isShellAsset(absolute)&&!eventlessStatic(absolute.pathname))continue;
  await pull(cache,absolute.href);
 }
}

self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.all(CORE.map(path=>pull(cache,new URL(path,self.registration.scope).href)));
 const index=await cache.match(new URL('./index.html',self.registration.scope).href)||await cache.match(new URL('./',self.registration.scope).href);
 if(index)await cacheLinked(cache,index,new URL('./index.html',self.registration.scope).href);
 await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key!==CACHE&&(key.startsWith('poodman-shell-')||key.startsWith('poodman-offline-'))).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));

// school-api.php and every other PHP route stay network-only. Desk retries live in IndexedDB.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(!sameOrigin(url)||isApi(url)||event.request.method!=='GET')return;
 if(event.request.mode==='navigate'){event.respondWith(shellPage());return}
 if(!eventlessStatic(url.pathname))return;
 event.respondWith(cacheFirst(event.request));
});

async function shellPage(){
 const cache=await caches.open(CACHE);
 const cached=await cache.match(new URL('./index.html',self.registration.scope).href)||await cache.match(new URL('./',self.registration.scope).href);
 if(cached)return cached;
 try{
  const response=await fetch(new URL('./index.html',self.registration.scope).href);
  if(response.ok)await cache.put(new URL('./index.html',self.registration.scope).href,response.clone());
  return response;
 }catch{
  return await cache.match(new URL('./offline.html',self.registration.scope).href)||Response.error();
 }
}

async function cacheFirst(request){
 const cache=await caches.open(CACHE);
 const hit=await cache.match(request);
 if(hit)return hit;
 try{
  const response=await fetch(request);
  if(response.ok&&response.type==='basic'){
   await cache.put(request,response.clone());
   await cacheLinked(cache,response,request.url);
  }
  return response;
 }catch{
  return await cache.match(request)||Response.error();
 }
}
