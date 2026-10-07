/* ---------- Date helpers ---------- */
const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const parseYmd = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const mins = s => { const [h,m]=s.split(":").map(Number); return h*60+m; };
const tsDate = ts => ts.slice(0,10), tsTime = ts => ts.slice(11,16);
function weekStart(offset=0){ const t=new Date(); t.setHours(0,0,0,0); const dow=(t.getDay()+6)%7; return addDays(t,-dow+offset*7); }
const todayStr = () => ymd(new Date());
const nowTs = () => `${todayStr()} ${hm(new Date())}`;
const periodKey = off => ymd(weekStart(off));
function periodDays(off){ const s=weekStart(off); return [...Array(7)].map((_,i)=>ymd(addDays(s,i))); }
const loc = () => LOCALE[S.lang]||"en-US";
const fmtDay = s => parseYmd(s).toLocaleDateString(loc(),{weekday:"short",month:"short",day:"numeric"});
const fmtDayShort = s => parseYmd(s).toLocaleDateString(loc(),{weekday:"short",day:"numeric"});
const fmtRange = off => { const d=periodDays(off); return `${parseYmd(d[0]).toLocaleDateString(loc(),{month:"short",day:"numeric"})} – ${parseYmd(d[6]).toLocaleDateString(loc(),{month:"short",day:"numeric",year:"numeric"})}`; };
const fmtH = h => (Math.round(h*100)/100).toLocaleString(loc(),{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtClock = t => { const [h,m]=t.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit"}); };
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const t = k => (I18N[S.lang]&&I18N[S.lang][k]) || I18N.en[k] || k;
