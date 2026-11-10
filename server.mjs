import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv();
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const PORT = Number(process.env.PORT || 8080);
const ALLOWED = new Set(["EUR/USD","GBP/USD","USD/JPY","XAU/USD","QQQ","SPY"]);
const cache = new Map();
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8"};

function send(res, status, data, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method !== "GET") return send(res,405,{error:"Method not allowed"});
  if (url.pathname === "/api/health") {
    return send(res,200,{ok:true,provider:"Twelve Data",apiKeyConfigured:Boolean(API_KEY),mode:"live-provider-proxy"});
  }
  if (url.pathname === "/api/series") {
    if (!API_KEY) return send(res,503,{error:"Missing TWELVE_DATA_API_KEY. Add it to .env on the server."});
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const interval = url.searchParams.get("interval") || "15min";
    if (!ALLOWED.has(symbol)) return send(res,400,{error:"Symbol not enabled in this starter build."});
    if (!["5min","15min","30min","1h","4h","1day"].includes(interval)) return send(res,400,{error:"Unsupported interval."});
    const key = `${symbol}|${interval}`;
    const cached = cache.get(key);
    if (cached && Date.now()-cached.at < 60000) return send(res,200,{...cached.data,cached:true});
    try {
      const endpoint = new URL("https://api.twelvedata.com/time_series");
      endpoint.searchParams.set("symbol",symbol);
      endpoint.searchParams.set("interval",interval);
      endpoint.searchParams.set("outputsize","100");
      endpoint.searchParams.set("apikey",API_KEY);
      const upstream = await fetch(endpoint, {headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)});
      const payload = await upstream.json();
      if (!upstream.ok || payload.status === "error" || !Array.isArray(payload.values)) {
        const msg = payload.message || payload.code || `Provider HTTP ${upstream.status}`;
        return send(res,502,{error:"Market-data provider error",details:String(msg).slice(0,240)});
      }
      const values = payload.values.map(v=>({
        datetime:v.datetime, open:Number(v.open), high:Number(v.high), low:Number(v.low), close:Number(v.close), volume:v.volume==null?null:Number(v.volume)
      })).filter(v=>[v.open,v.high,v.low,v.close].every(Number.isFinite)).reverse();
      const data = {symbol,interval,exchange:payload.meta?.exchange||null,currency:payload.meta?.currency||null,values,fetchedAt:new Date().toISOString(),source:"Twelve Data"};
      cache.set(key,{at:Date.now(),data});
      return send(res,200,data);
    } catch (e) {
      return send(res,502,{error:"Could not reach market-data provider",details:String(e.message).slice(0,180)});
    }
  }
  if (url.pathname.startsWith("/api/")) return send(res,404,{error:"API route not found"});
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(__dirname, requested);
  if (!file.startsWith(__dirname + path.sep) && file !== path.join(__dirname,"index.html")) return send(res,403,{error:"Forbidden"});
  fs.readFile(file,(err,buf)=>{
    if(err) return send(res,404,"Not found","text/plain; charset=utf-8");
    res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream","X-Content-Type-Options":"nosniff"});
    res.end(buf);
  });
});
server.listen(PORT,"0.0.0.0",()=>console.log(`ForexPilot Live Starter listening on ${PORT}`));
