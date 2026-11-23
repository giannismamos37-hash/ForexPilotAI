import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
function loadEnv(){try{for(const line of fs.readFileSync(path.join(root,".env"),"utf8").split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"")}}catch{}}
loadEnv();
const PORT=Number(process.env.PORT||8080),TD_KEY=process.env.TWELVE_DATA_API_KEY;
const SYMBOLS=["EUR/USD","GBP/USD","USD/JPY","XAU/USD","BTC/USD"],INTERVALS=["1min","5min","15min","30min","1h","4h","1day"];
const storage=process.env.FP_DATA_DIR||root;try{fs.mkdirSync(storage,{recursive:true})}catch(e){console.warn("Storage directory unavailable",e.message)}
const cache=new Map(),tokens=new Set(),positions=new Map(),lastSignal=new Map(),scannerResults=new Map(),signalHistory=[],closedTrades=[];
let scannerStatus={state:"starting",reason:"",lastRun:null,updated:0,errors:0};
const HISTORY_FILE=path.join(storage,"fp_signal_history.json"),TOKEN_FILE=path.join(storage,"fp_tokens.json"),POSITIONS_FILE=path.join(storage,"fp_positions.json"),TRADE_HISTORY_FILE=path.join(storage,"fp_trade_history.json"),SIGNAL_KEYS_FILE=path.join(storage,"fp_signal_keys.json");
try{const saved=JSON.parse(fs.readFileSync(HISTORY_FILE,"utf8"));if(Array.isArray(saved))signalHistory.push(...saved.slice(0,100))}catch{}
function saveSignalHistory(){try{fs.writeFileSync(HISTORY_FILE,JSON.stringify(signalHistory.slice(0,100)))}catch(e){console.warn("Signal history persistence unavailable",e.message)}}
try{const saved=JSON.parse(fs.readFileSync(SIGNAL_KEYS_FILE,"utf8"));if(saved&&typeof saved==="object")Object.entries(saved).forEach(([k,v])=>lastSignal.set(k,String(v)))}catch{}
function saveSignalKeys(){try{fs.writeFileSync(SIGNAL_KEYS_FILE,JSON.stringify(Object.fromEntries(lastSignal)))}catch(e){console.warn("Signal dedup persistence unavailable",e.message)}}
try{JSON.parse(fs.readFileSync(TOKEN_FILE,"utf8")).forEach(t=>tokens.add(t))}catch{}
try{const saved=JSON.parse(fs.readFileSync(POSITIONS_FILE,"utf8"));if(Array.isArray(saved))saved.forEach(p=>{if(p&&p.id&&SYMBOLS.includes(p.symbol)&&["BUY","SELL"].includes(p.side))positions.set(String(p.id),p)})}catch{}
try{const saved=JSON.parse(fs.readFileSync(TRADE_HISTORY_FILE,"utf8"));if(Array.isArray(saved))closedTrades.push(...saved.slice(0,100))}catch{}
function saveTokens(){try{fs.writeFileSync(TOKEN_FILE,JSON.stringify([...tokens]))}catch(e){console.warn("Token persistence unavailable",e.message)}}
function savePositions(){try{fs.writeFileSync(POSITIONS_FILE,JSON.stringify([...positions.values()]))}catch(e){console.warn("Paper position persistence unavailable",e.message)}}
function saveTradeHistory(){try{fs.writeFileSync(TRADE_HISTORY_FILE,JSON.stringify(closedTrades.slice(0,100)))}catch(e){console.warn("Paper trade history persistence unavailable",e.message)}}

function send(res,status,obj){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"});res.end(JSON.stringify(obj))}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",d=>{s+=d;if(s.length>100000)reject(new Error("Request too large"))});req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error("Invalid JSON"))}});req.on("error",reject)})}
const firebaseConfig={apiKey:process.env.FIREBASE_API_KEY||"",authDomain:process.env.FIREBASE_AUTH_DOMAIN||"",projectId:process.env.FIREBASE_PROJECT_ID||"",storageBucket:process.env.FIREBASE_STORAGE_BUCKET||"",messagingSenderId:process.env.FIREBASE_MESSAGING_SENDER_ID||"",appId:process.env.FIREBASE_APP_ID||""};
const firebaseReady=Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.messagingSenderId&&firebaseConfig.appId&&process.env.FCM_VAPID_KEY&&process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
function b64url(v){return Buffer.from(v).toString("base64url")}
async function fcmAccessToken(){
 const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||"{}"),now=Math.floor(Date.now()/1000);
 if(!sa.client_email||!sa.private_key)throw new Error("FCM service account is not configured");
 const head=b64url(JSON.stringify({alg:"RS256",typ:"JWT"})),claim=b64url(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
 const sig=crypto.sign("RSA-SHA256",Buffer.from(head+"."+claim),sa.private_key.replace(/\\n/g,"\n")).toString("base64url"),jwt=head+"."+claim+"."+sig;
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt}),signal:AbortSignal.timeout(12000)});
 const j=await r.json();if(!r.ok||!j.access_token)throw new Error(j.error_description||j.error||"FCM OAuth error");return j.access_token;
}
let fcmTokenCache=null,fcmTokenAt=0;
async function pushNotification(title,body,data={}){
 if(!firebaseReady||!tokens.size)return {sent:0,reason:"push-not-configured"};
 if(!fcmTokenCache||Date.now()-fcmTokenAt>3500000){fcmTokenCache=await fcmAccessToken();fcmTokenAt=Date.now()}
 let sent=0;const project=firebaseConfig.projectId;
 for(const token of [...tokens]){
  try{const r=await fetch("https://fcm.googleapis.com/v1/projects/"+project+"/messages:send",{method:"POST",headers:{Authorization:"Bearer "+fcmTokenCache,"Content-Type":"application/json"},body:JSON.stringify({message:{token,data:Object.fromEntries(Object.entries({title,body,...data}).map(([k,v])=>[k,String(v)])),android:{priority:"HIGH",notification:{channelId:"forexpilot-alerts",sound:"default",tag:"fp-"+String(data.symbol||data.type||"alert")}}}}),signal:AbortSignal.timeout(12000)});if(r.status===404||r.status===400){const j=await r.json().catch(()=>({}));if(String(j.error?.message||"").includes("registration token"))tokens.delete(token)}else if(r.ok)sent++;}catch(e){console.warn("FCM send failed",e.message)}
 }
 saveTokens();return {sent};
}
async function getSeries(symbol,interval="15min"){
 const k=symbol+"|"+interval,old=cache.get(k);if(old&&Date.now()-old.at<45000)return old.data;
 if(!TD_KEY)throw new Error("Twelve Data key missing");
 const u=new URL("https://api.twelvedata.com/time_series");u.searchParams.set("symbol",symbol);u.searchParams.set("interval",interval);u.searchParams.set("outputsize","100");u.searchParams.set("apikey",TD_KEY);
 const r=await fetch(u,{signal:AbortSignal.timeout(12000)}),p=await r.json();
 if(!r.ok||p.status==="error"||!Array.isArray(p.values))throw new Error(String(p.message||p.code||"Market data unavailable"));
 const values=p.values.map(v=>({datetime:v.datetime,open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close)})).filter(v=>[v.open,v.high,v.low,v.close].every(Number.isFinite)&&v.high>=v.low&&v.open>=v.low&&v.open<=v.high&&v.close>=v.low&&v.close<=v.high).reverse();if(values.length<40)throw new Error("Insufficient valid OHLC candles returned by market data provider");
 const data={symbol,interval,values,fetchedAt:new Date().toISOString(),source:"Twelve Data"};cache.set(k,{at:Date.now(),data});return data;
}
function ema(a,n){const k=2/(n+1);let v=a[0];for(let i=1;i<a.length;i++)v=a[i]*k+v*(1-k);return v}
function strategy(symbol,bars){
 if(bars.length<40)return null;const close=bars.map(x=>x.close),last=bars.at(-1),fast=ema(close.slice(-30),9),slow=ema(close.slice(-50),21);
 let g=0,l=0;for(let i=close.length-14;i<close.length;i++){const d=close[i]-close[i-1];if(d>0)g+=d;else l-=d}const rsi=l===0?100:100-100/(1+(g/14)/(l/14));
 const tr=bars.slice(-14).map((x,i)=>{const prev=bars[Math.max(0,bars.length-15+i)].close;return Math.max(x.high-x.low,Math.abs(x.high-prev),Math.abs(x.low-prev))}),atr=tr.reduce((a,b)=>a+b,0)/tr.length;
 const buy=fast>slow&&last.close>fast&&rsi>=52&&rsi<=68&&last.close>last.open,bear=fast<slow&&last.close<fast&&rsi>=32&&rsi<=48&&last.close<last.open;
 if(!buy&&!bear)return {symbol,side:"WAIT",price:last.close,datetime:last.datetime,rsi,atr,reason:"No complete EMA/RSI/candle confirmation"};
 const side=buy?"BUY":"SELL",sl=side==="BUY"?last.close-atr*1.5:last.close+atr*1.5,tp=side==="BUY"?last.close+(last.close-sl)*2:last.close-(sl-last.close)*2;
 const trendScore=Math.min(35,Math.abs(fast-slow)/Math.max(atr,1e-8)*20),rsiScore=Math.max(0,25-Math.abs(rsi-(side==="BUY"?60:40))*1.25),candleScore=Math.min(25,Math.abs(last.close-last.open)/Math.max(atr,1e-8)*25),priceScore=Math.min(15,Math.abs(last.close-fast)/Math.max(atr,1e-8)*15),score=Math.round(trendScore+rsiScore+candleScore+priceScore);return {symbol,side,price:last.close,sl,tp,rsi,atr,datetime:last.datetime,score,reason:"EMA trend strength + RSI position + candle body + price/EMA separation; ATR SL and 1:2 target"};
}
async function scanMarkets(){
 if(!TD_KEY){scannerStatus={state:"blocked",reason:"Twelve Data API key missing",lastRun:new Date().toISOString()};return}
 scannerStatus={state:"running",reason:"",lastRun:new Date().toISOString()};
 let errors=0,updated=0;
 for(const symbol of SYMBOLS){
  try{const d=await getSeries(symbol,"15min"),s=strategy(symbol,d.values);updated++;if(!s){scannerResults.set(symbol,{symbol,side:"WAIT",reason:"Insufficient candle history",timeframe:"15min",updatedAt:new Date().toISOString(),quality:"WAIT"});continue}scannerResults.set(symbol,{...s,timeframe:"15min",updatedAt:new Date().toISOString(),quality:s.side==="WAIT"?"WAIT":s.score>=80?"STRONG":s.score>=70?"GOOD":"LOW"});if(s.side==="WAIT"||s.score<70)continue;const candleTime=Date.parse(s.datetime),ageMs=Date.now()-candleTime;if(!Number.isFinite(candleTime)||ageMs>45*60*1000||ageMs< -5*60*1000){scannerResults.set(symbol,{...s,quality:"STALE",isStale:true,alertEligible:false,reason:"Signal candle is stale or timestamp invalid; alert suppressed",timeframe:"15min",updatedAt:new Date().toISOString()});continue;}
   const k=symbol+"|"+s.side+"|"+s.datetime;if(lastSignal.get(symbol)===k)continue;lastSignal.set(symbol,k);saveSignalKeys();signalHistory.unshift({...s,timeframe:"15min",createdAt:new Date().toISOString()});if(signalHistory.length>100)signalHistory.length=100;saveSignalHistory();
   const digits=symbol==="USD/JPY"?3:symbol==="XAU/USD"||symbol==="BTC/USD"?2:5;
   try{await pushNotification("ForexPilot AI · "+s.side+" "+symbol,"Entry "+s.price.toFixed(digits)+" · SL "+s.sl.toFixed(digits)+" · TP "+s.tp.toFixed(digits)+" · M15 · score "+s.score+"/100",{type:"signal",symbol,side:s.side,entry:s.price,sl:s.sl,tp:s.tp,timeframe:"15min",score:s.score})}catch(e){console.warn("Signal push delivery failed; scanner continues",e.message)}
  }catch(e){errors++;console.warn("Scan",symbol,e.message);scannerResults.set(symbol,{symbol,side:"ERROR",reason:"Market data unavailable",updatedAt:new Date().toISOString()})}
 }
 scannerStatus={state:errors===SYMBOLS.length?"error":errors?"partial":"ok",reason:errors?errors+" market(s) unavailable":"",lastRun:new Date().toISOString(),updated,errors};
}
async function monitorPositions(){
 for(const [id,t] of positions){
  try{const d=await getSeries(t.symbol,"1min"),last=d.values.at(-1);if(!last)continue;const sl=t.side==="BUY"?last.low<=t.sl:last.high>=t.sl,tp=t.side==="BUY"?last.high>=t.tp:last.low<=t.tp;
   if(sl||tp){const gapStop=sl&&(t.side==="BUY"?last.open<=t.sl:last.open>=t.sl);const exit=sl?(gapStop?last.open:t.sl):t.tp;positions.delete(id);const pl=(exit-t.entry)*Number(t.units||0)*(t.side==="BUY"?1:-1),closed={...t,exit,pl,reason:sl?"STOP LOSS":"TAKE PROFIT",closed:new Date().toISOString()};closedTrades.unshift(closed);if(closedTrades.length>100)closedTrades.length=100;saveTradeHistory();savePositions();await pushNotification("ForexPilot AI · "+(sl?"STOP LOSS":"TAKE PROFIT")+" · "+t.symbol,"Position closed by "+(sl?"SL":"TP")+" at "+exit,{type:"exit",id,symbol:t.symbol,side:t.side,exit,reason:sl?"SL":"TP"});}
  }catch(e){console.warn("Position monitor",t.symbol,e.message)}
 }
}
setTimeout(()=>{scanMarkets().catch(e=>console.warn("Initial scanner",e.message));monitorPositions().catch(e=>console.warn("Initial monitor",e.message))},15000);
setInterval(()=>scanMarkets().catch(e=>console.warn("Scanner",e.message)),180000);
setInterval(()=>monitorPositions().catch(e=>console.warn("Monitor",e.message)),30000);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://"+(req.headers.host||"localhost"));
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"});return res.end()}
 if(req.method==="GET"&&url.pathname==="/api/health")return send(res,200,{ok:true,provider:"Twelve Data",apiKeyConfigured:Boolean(TD_KEY),pushConfigured:firebaseReady,registeredDevices:tokens.size,scanner:"server-side-3min",scannerStatus,mode:"alerts-and-paper"});
 if(req.method==="GET"&&url.pathname==="/api/push/config")return send(res,200,{firebaseConfig,vapidKey:process.env.FCM_VAPID_KEY||"",configured:firebaseReady});
 if(req.method==="GET"&&url.pathname==="/api/scanner"){const now=Date.now(),results=SYMBOLS.map(symbol=>{const r=scannerResults.get(symbol)||{symbol,side:"LOADING",reason:"Waiting for first scan"};const ageSeconds=r.updatedAt?Math.max(0,Math.floor((now-Date.parse(r.updatedAt))/1000)):null;return {...r,ageSeconds,isStale:ageSeconds===null||ageSeconds>240};});return send(res,200,{symbols:SYMBOLS,interval:"15min",scannerStatus,results});}
 if(req.method==="GET"&&url.pathname==="/api/signals/history")return send(res,200,{signals:signalHistory});
 if(req.method==="POST"&&url.pathname==="/api/signals/history/clear"){signalHistory.length=0;saveSignalHistory();return send(res,200,{ok:true});}
 if(req.method==="POST"&&url.pathname==="/api/push/register"){try{const b=await body(req),token=String(b.token||"").trim();if(token.length<80||token.length>5000)return send(res,400,{error:"Invalid FCM token"});tokens.add(token);saveTokens();return send(res,200,{ok:true,registered:tokens.size})}catch(e){return send(res,400,{error:e.message})}}
 if(req.method==="POST"&&url.pathname==="/api/push/unregister"){try{const b=await body(req);tokens.delete(String(b.token||""));saveTokens();return send(res,200,{ok:true})}catch(e){return send(res,400,{error:e.message})}}
 if(req.method==="POST"&&url.pathname==="/api/trades/register"){try{const t=await body(req),id=String(t.id||crypto.randomUUID()),symbol=String(t.symbol||"").toUpperCase(),side=t.side,entry=Number(t.entry),sl=Number(t.sl),tp=Number(t.tp),units=Number(t.units),riskCash=Number(t.riskCash);if(positions.size>=5)return send(res,409,{error:"Maximum of 5 concurrent paper positions reached"});if(positions.has(id))return send(res,409,{error:"Position ID already exists"});if(!SYMBOLS.includes(symbol)||!["BUY","SELL"].includes(side)||![entry,sl,tp].every(Number.isFinite)||entry<=0||sl<=0||tp<=0||!Number.isFinite(units)||units<=0||!Number.isFinite(riskCash)||riskCash<=0)return send(res,400,{error:"Invalid trade payload"});if(side==="BUY"&&!(sl<entry&&tp>entry)||side==="SELL"&&!(tp<entry&&sl>entry))return send(res,400,{error:"Stop loss and take profit must be on the correct side of entry"});const computedRisk=units*Math.abs(entry-sl),riskMismatch=Math.abs(computedRisk-riskCash)/Math.max(riskCash,computedRisk,0.01);if(!Number.isFinite(computedRisk)||computedRisk<=0||riskMismatch>0.02)return send(res,400,{error:"Risk amount does not match position size and stop loss"});const totalRisk=[...positions.values()].reduce((sum,p)=>sum+Number(p.riskCash||0),0);if(totalRisk+riskCash>100)return send(res,409,{error:"Server paper risk cap reached (€100 total open risk)"});positions.set(id,{...t,id,symbol,side,entry,sl,tp,units,riskCash,entryAlert:false});savePositions();return send(res,200,{ok:true,id,active:positions.size})}catch(e){return send(res,400,{error:e.message})}}
 if(req.method==="POST"&&url.pathname==="/api/trades/close"){try{const b=await body(req),id=String(b.id||""),t=positions.get(id);if(!t)return send(res,404,{error:"Paper position not found"});const exit=Number(b.trade?.exit);if(!Number.isFinite(exit)||exit<=0)return send(res,400,{error:"Invalid exit price"});const reason=String(b.trade?.reason||"MANUAL").toUpperCase();if(!["MANUAL","STOP LOSS","TAKE PROFIT","SL","TP"].includes(reason))return send(res,400,{error:"Invalid close reason"});positions.delete(id);const pl=(exit-t.entry)*Number(t.units||0)*(t.side==="BUY"?1:-1),closed={...t,exit,pl,reason,closed:new Date().toISOString()};closedTrades.unshift(closed);if(closedTrades.length>100)closedTrades.length=100;saveTradeHistory();savePositions();return send(res,200,{ok:true,active:positions.size,history:closedTrades.length,trade:closed})}catch(e){return send(res,400,{error:e.message})}}
 if(req.method==="GET"&&url.pathname==="/api/trades/active")return send(res,200,{positions:[...positions.values()]});
 if(req.method==="GET"&&url.pathname==="/api/trades/history")return send(res,200,{trades:closedTrades});
 if(req.method==="GET"&&url.pathname==="/api/series"){const symbol=(url.searchParams.get("symbol")||"").toUpperCase(),interval=url.searchParams.get("interval")||"15min";if(!SYMBOLS.includes(symbol))return send(res,400,{error:"Symbol not enabled"});if(!INTERVALS.includes(interval))return send(res,400,{error:"Unsupported interval"});try{return send(res,200,await getSeries(symbol,interval))}catch(e){return send(res,502,{error:"Market data unavailable",details:String(e.message).slice(0,180)})}}
 if(url.pathname.startsWith("/api/"))return send(res,404,{error:"API route not found"});
 if(req.method!=="GET")return send(res,405,{error:"Method not allowed"});
 const reqPath=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname.slice(1)),file=path.resolve(root,reqPath);
 if(!file.startsWith(root+path.sep)&&file!==path.join(root,"index.html"))return send(res,403,{error:"Forbidden"});
 fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404,{"Content-Type":"text/plain"});return res.end("Not found")}res.writeHead(200,{"Content-Type":file.endsWith(".html")?"text/html; charset=utf-8":"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(buf)});
});
server.listen(PORT,"0.0.0.0",()=>console.log("ForexPilot AI server on "+PORT));
console.log("FCM push configured:",firebaseReady,"scanner symbols:",SYMBOLS.join(", "));
