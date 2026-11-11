const C="fpai-v9";
self.addEventListener("install",e=>e.waitUntil((async()=>{const c=await caches.open(C);await c.addAll(["./","./index.html","./manifest.json"]);await self.skipWaiting()})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.pathname.startsWith("/api/"))return;
 if(e.request.mode==="navigate"||u.pathname.endsWith(".html")){
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(C).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
 }
});
