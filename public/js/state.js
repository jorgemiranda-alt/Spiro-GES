/* ---------- State ---------- */
let S;
const UI = {apFilter:"Pending", apSel:new Set(), jFilter:{epic:"",ev:"",spec:"",q:""}, jOpen:new Set(), gridErrors:[], showArch:false, submitTried:false, homeShowAll:false,
  kiosk:{badge:null,msg:null,idle:30,intent:null,panel:"home",menuOpen:false,showDemoControls:false}, drawer:false, railOpen:false, gDirty:new Set(), gKey:"",
  punchOdooOpen:false, punchOdooQuery:"", odooCatalogQuery:"", odooCatalogNotice:""};

function uid(p){ S.seq=(S.seq||1000)+1; return p+S.seq; }
function seedDay(date, pattern){ return pattern.map(([time,type,proj,task])=>({id:"p"+Math.random().toString(36).slice(2,9),t:`${date} ${time}`,type,proj,task,src:"Seed",sync:"seed"})); }
function seed(){
  const st={v:3,persona:"ava",lang:"en",view:"punch",period:0,seq:1000,settings:{simDuplicatePunchError:false,empEdit:false,tags:true,hideViewAs:false},
    punches:{ava:[],lukas:[]},comments:{ava:{},lukas:{}},tcAppr:{},hidden:{},grid:{zofia:{},maya:{}},approvals:[],txns:[],audit:[]};
  const prev=periodDays(-1), cur=periodDays(0), today=todayStr();
  // Ava — previous week tells the exception story
  const A=st.punches.ava;
  A.push(...seedDay(prev[0],[["07:58","IN","PRJ-4821","Client delivery"],["12:00","BRK_S"],["12:30","BRK_E"],["13:30","XFER","PRJ-4908","Production support"],["17:00","OUT"]]));
  A.push(...seedDay(prev[1],[["08:12","IN","PRJ-4821","Booth install"],["12:00","BRK_S"],["12:30","BRK_E"],["17:15","OUT"]]));
  A.push(...seedDay(prev[2],[["07:55","IN","PRJ-4908","Graphics"],["12:00","BRK_S"],["12:20","BRK_E"],["16:45","OUT"]]));
  A.push(...seedDay(prev[3],[["08:00","IN","PRJ-4821","Client delivery"],["12:00","BRK_S"],["12:30","BRK_E"],["13:00","XFER","PRJ-5012","Operations"]]));
  A.push(...seedDay(prev[4],[["08:00","IN","PRJ-4821","Client delivery"],["12:00","BRK_S"],["12:30","BRK_E"],["16:00","OUT"]]));
  st.comments.ava[prev[1]]="Client install ran late at the venue.";
  cur.slice(0,5).forEach(d=>{ if(d<today) A.push(...seedDay(d,[["07:57","IN","PRJ-4821","Client delivery"],["12:00","BRK_S"],["12:30","BRK_E"],["14:00","XFER","PRJ-4908","Production support"],["17:02","OUT"]])); });
  // Lukas — warehouse transfers
  const L=st.punches.lukas;
  const lp=[["06:58","IN","BER-1102","Build"],["09:40","XFER","MUC-2077","Kitting"],["11:30","BRK_S"],["12:00","BRK_E"],["13:15","XFER","BER-1102","Load-out"],["15:31","OUT"]];
  prev.slice(0,5).forEach(d=>L.push(...seedDay(d,lp)));
  cur.slice(0,5).forEach(d=>{ if(d<today) L.push(...seedDay(d,lp)); });
  // Grid — Zofia (hourly, PL)
  const row=(proj,task,h,status="Draft")=>({id:"r"+Math.random().toString(36).slice(2,8),proj,task,h:[...h,...Array(7-h.length).fill("")].map(v=>v===""?"":String(v)),status,note:"",archived:false});
  st.grid.zofia[periodKey(-1)]={rows:[row("PL-8804","Detailing",[6,6,6,6,6],"Approved"),row("PL-8650","Install",[2,2,1.5,2,""],"Approved"),row("PL-8810","Supplier calls",["","",0.5,"",2],"Approved")]};
  st.grid.zofia[periodKey(0)]={rows:[row("PL-8804","Detailing",[7.5,8]),row("PL-OPS","Admin",[0.5,""])]};
  st.grid.maya[periodKey(-1)]={rows:[row("PRJ-5310","Concept development",[4,5,4,3,4],"Recorded"),row("PRJ-5266","Client workshop",[2.5,2,3,3,2],"Recorded"),row("PRJ-5204","Internal meeting",[1.5,1,1,2,2],"Recorded")]};
  st.grid.maya[periodKey(0)]={rows:[row("PRJ-5310","Concept development",[4,5]),row("PRJ-5266","Client workshop",[2.5,1]),row("PRJ-5204","Internal meeting",[1.5,2])]};
  // Approval queue — other employees
  const ap=(emp,empName,off,proj,task,days,status="Pending")=>({id:"a"+Math.random().toString(36).slice(2,8),emp,empName,period:periodKey(off),proj,task,days,hours:days.reduce((a,b)=>a+(+b||0),0),src:"Timecard",status,note:"",edited:null,rowId:null});
  st.approvals.push(ap("priya","Priya Shah",0,"PRJ-4821","Booth install",[8,8,0,0,0,0,0]));
  st.approvals.push(ap("marcus","Marcus Lee",0,"PRJ-4908","Graphics",[4,4.5,4,0,0,0,0]));
  st.approvals.push(ap("jan","Jan Nowak",-1,"PL-8804","Install",[8,8,7.5,8,6.5,0,0]));
  st.approvals.push(ap("jan","Jan Nowak",-1,"PL-8810","Supplier calls",[0,2,0,2,0,0,0],"Approved"));
  st.audit.push({ts:`${prev[4]} 18:05`,who:"System",emp:"ava",what:"Nightly calculated totals pulled from UKG",detail:"POST /v1/timekeeping/timecard_metrics/multi_read",reason:""});
  return st;
}
function load(){ try{ const raw=localStorage.getItem(STORE_KEY); if(raw){ const s=JSON.parse(raw); if(s&&s.v===3&&s.seedWeek===periodKey(0)) return s; } }catch(e){} const s=seed(); s.seedWeek=periodKey(0); return s; }
function persist(){ try{ localStorage.setItem(STORE_KEY,JSON.stringify(S)); }catch(e){} }
S = load(); S.settings=S.settings||{};
S.settings.empEdit=false; // Punch editing remains disabled, including saved demo sessions.
delete S.settings.simTimeout; S.settings.simDuplicatePunchError=!!S.settings.simDuplicatePunchError;
const obsoleteUkgTransactions=new Set((S.txns||[]).filter(tx=>tx.action==="Read timecard before retry"||["Timeout","Reconciling","Reconciled"].includes(tx.status)).map(tx=>tx.id));
S.txns=(S.txns||[]).filter(tx=>!obsoleteUkgTransactions.has(tx.id));
S.audit=(S.audit||[]).filter(entry=>!String(entry.what||"").startsWith("Timeout reconciled for "));
S.hidden=S.hidden||{}; S.pendingPunchTransfers=S.pendingPunchTransfers||{};
S.odooAssignments=S.odooAssignments||{}; S.punchOdooHidden=S.punchOdooHidden||{};
// Pending transfers from earlier demo builds used Odoo project/task values as labor categories.
// Keep only values that belong to the independent UKG labor-category lists.
Object.entries(S.pendingPunchTransfers).forEach(([emp,p])=>{
  if(!p||typeof p!=="object"){ delete S.pendingPunchTransfers[emp]; return; }
  const categoryProject=LABOR.opts.proj.find(x=>x.v===(p.project||p.proj));
  if(!categoryProject){ delete S.pendingPunchTransfers[emp]; return; }
  p.project=categoryProject.v;
  delete p.proj;
  if((p.task&&!categoryProject.tasks.includes(p.task))||(categoryProject.taskReq&&!p.task)){ delete S.pendingPunchTransfers[emp]; return; }
});
// Seed history with the employee's labor-category defaults, never their Odoo project/task.
Object.entries(S.punches||{}).forEach(([emp,punches])=>punches.forEach(p=>{
  if(p.type==="XFER"&&p.src==="Seed"&&!p.labor){ const d=LABOR.byPersona[emp]||{}; p.labor={project:d.project||"",task:d.task||"",tc:d.tc||"",func:d.func||""}; }
}));
