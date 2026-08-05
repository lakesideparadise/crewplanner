const CACHE="cablecrew-v110";
const CORE=["./","./index.html","./manifest.webmanifest","./cablecrew_logo.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

// Alleen bestanden van CableCrew zelf behandelen. Firebase/Google-verkeer nooit
// onderscheppen: dit voorkomt CORS-cross-origin fouten op Safari/iPhone.
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request).catch(()=>caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
      }
      return response;
    }))
  );
});

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyBdeGM27e5xNRGipmEeQzmTW4aNMrKtc3A",
  authDomain:"cable-crew-planner.firebaseapp.com",
  projectId:"cable-crew-planner",
  storageBucket:"cable-crew-planner.firebasestorage.app",
  messagingSenderId:"179845869941",
  appId:"1:179845869941:web:3a4c640053c9eaf9f9e33c"
});

const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  const d=payload.data||{};
  const title=n.title||d.title||"CableCrew alarm";
  const options={
    body:n.body||d.body||"Open CableCrew voor meer informatie.",
    icon:"./cablecrew_logo.png",
    badge:"./cablecrew_logo.png",
    tag:d.alertId?`alarm-${d.alertId}`:"cablecrew",
    renotify:true,
    requireInteraction:d.type==="medical",
    data:{url:d.url||"./index.html",alertId:d.alertId||""}
  };
  self.registration.showNotification(title,options);
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=event.notification.data?.url||"./index.html";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if("focus" in client){client.navigate(url);return client.focus();}
    }
    return clients.openWindow(url);
  }));
});
