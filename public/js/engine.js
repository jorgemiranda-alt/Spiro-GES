/* ---------- UKG request simulation ---------- */
function ukg(emp, action, endpoint, summary, onDone){
  const tx={id:uid("tx"),ts:nowTs(),emp,action,endpoint,summary,status:"Submitted",ref:""};
  S.txns.unshift(tx);
  setTimeout(()=>{ tx.status="Accepted"; tx.ref="UKG-"+(480000+S.seq); tick(); onDone&&onDone(tx); },850);
  return tx.id;
}
function simulatedUkgError(emp, action, endpoint, summary, message){
  const tx={id:uid("tx"),ts:nowTs(),emp,action,endpoint,summary,status:"Failed",ref:"",error:message};
  S.txns.unshift(tx);
  S.audit.unshift({ts:tx.ts,who:"UKG",emp,what:`${action} failed`,detail:message,reason:""});
  tick();
  return tx;
}
function txById(id){ return S.txns.find(x=>x.id===id); }
function syncChip(id){
  if(id==="seed") return `<span class="chip ok"><span class="dot"></span>Accepted</span>`;
  const tx=txById(id); if(!tx) return "";
  const cls={Submitted:"info",Accepted:"ok",Failed:"err"}[tx.status]||"";
  return `<span class="chip ${cls}"><span class="dot"></span>${tx.status}</span>`;
}
function tick(){ persist(); if(["punch","timecard","kiosk","approvals","home"].includes(S.view)) softRender(); }

/* ---------- Punch engine ---------- */
function dayPunches(emp,date){ return (S.punches[emp]||[]).filter(p=>tsDate(p.t)===date).sort((a,b)=>a.t<b.t?-1:a.t>b.t?1:0); }
function liveState(emp){
  const ps=dayPunches(emp,todayStr()); let st="out",proj=null,task=null,labor=null,since=null,segStart=null;
  for(const p of ps){
    if(p.type==="IN"||p.type==="XFER"){ st="in"; proj=p.proj; task=p.task; labor=p.labor||labor; since=since&&p.type==="XFER"?since:tsTime(p.t); segStart=tsTime(p.t); if(p.type==="IN") since=tsTime(p.t); }
    else if(p.type==="BRK_S"){ st="brk"; segStart=tsTime(p.t); }
    else if(p.type==="BRK_E"){ st="in"; segStart=tsTime(p.t); }
    else if(p.type==="OUT"){ st="out"; segStart=null; }
  }
  return {st,proj,task,labor,since,segStart,last:ps[ps.length-1]};
}
function addPunch(emp,type,proj,task,src="Punch",at=null,labor=null){
  const categories=labor?{project:labor.project||"",task:labor.task||"",tc:labor.tc||"",func:labor.func||""}:null;
  const categorySummary=categories?[["Labor Category Project",categories.project],["Labor Category Task / LOB",categories.task],["Timecard Code",categories.tc],["Function",categories.func]].filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(" · "):"";
  const p={id:uid("p"),t:at||nowTs(),type,proj:proj||null,task:task||null,labor:categories,src,sync:null};
  S.punches[emp].push(p);
  const label={IN:"Punch in",OUT:"Punch out",BRK_S:"Break start",BRK_E:"Break end",XFER:"Transfer"}[type];
  p.sync=ukg(emp,label,"POST /v1/timekeeping/timecard",`punches.add ${proj&&(type==="XFER"||type==="IN")?`transfer.project=${proj}`:""}${categorySummary?` labor.categories=${categorySummary}`:""} @ ${tsTime(p.t)}`.trim());
  S.audit.unshift({ts:p.t,who:PERSONAS[emp].name,emp,what:`${label}${proj?` · ${proj}${task?" / "+task:""}`:""}`,detail:`Source: ${src}${categorySummary?` · Labor categories: ${categorySummary}`:""}`,reason:""});
  persist(); return p;
}
function validateProject(emp,code){
  const pr=PROJECTS[code];
  if(!pr) return `${code} is not a Spiro project code. Scan again or ask your supervisor.`;
  if(!assigned(emp).includes(code)) return `${code} is not assigned to you. Select an active assigned project.`;
  if(!pr.active) return `${code} is closed. Select an active assigned project.`;
  return null;
}
const assigned = emp => [...new Set([...(PERSONAS[emp]?.projects||[]),...((S.odooAssignments||{})[emp]||[])])].filter(c=>PROJECTS[c]&&PROJECTS[c].active);

/* Build UKG-style segments & exceptions for a day */
function buildDay(emp,date){
  const P=PERSONAS[emp], ps=dayPunches(emp,date), segs=[], exc=[];
  let open=null, lastProj=null, lastTask=null, lastLabor=null, brkStart=null, firstIn=null, lastOut=null;
  const close=(p,kind)=>{ if(!open) return; open.out={t:tsTime(p.t),kind,p}; open.hours=(mins(open.out.t)-mins(open.in.t))/60; segs.push(open); open=null; };
  for(const p of ps){
    if(p.type==="IN"){ if(open) close(p,"Out"); open={in:{t:tsTime(p.t),kind:"In",p},proj:p.proj,task:p.task,labor:p.labor||null}; lastProj=p.proj; lastTask=p.task; lastLabor=p.labor||null; if(!firstIn) firstIn=tsTime(p.t); }
    else if(p.type==="XFER"){ if(open) close(p,"Transfer"); lastLabor=p.labor||lastLabor; open={in:{t:tsTime(p.t),kind:"Transfer",p},proj:p.proj,task:p.task,labor:lastLabor}; lastProj=p.proj; lastTask=p.task; if(!firstIn) firstIn=tsTime(p.t); }
    else if(p.type==="BRK_S"){ close(p,"Break"); brkStart=tsTime(p.t); }
    else if(p.type==="BRK_E"){ if(brkStart&&P.sched&&mins(tsTime(p.t))-mins(brkStart)<P.sched.brk) exc.push({code:"SHORT_BREAK",label:t("shortBrk"),sev:"warn",pid:p.id,msg:`Break ${mins(tsTime(p.t))-mins(brkStart)} min (minimum ${P.sched.brk})`}); brkStart=null; open={in:{t:tsTime(p.t),kind:"Break end",p},proj:lastProj,task:lastTask,labor:lastLabor}; }
    else if(p.type==="OUT"){ close(p,"Out"); lastOut=tsTime(p.t); }
  }
  const isToday=date===todayStr(), past=date<todayStr();
  if(open){
    if(isToday){ open.live=true; open.hours=Math.max(0,(mins(hm(new Date()))-mins(open.in.t))/60); segs.push(open); }
    else { open.missing=true; open.hours=0; segs.push(open); exc.push({code:"MISSED_OUT_PUNCH",label:t("missed"),sev:"err",seg:segs.length-1,msg:"No out punch recorded"}); }
  }
  const dow=parseYmd(date).getDay(), sched=P.sched&&P.sched.days.includes(dow)?P.sched:null;
  if(sched&&firstIn&&mins(firstIn)>mins(sched.start)+5) exc.push({code:"LATE_IN",label:t("late"),sev:"warn",pid:ps.find(p=>p.type==="IN"||p.type==="XFER").id,msg:`In at ${firstIn}, scheduled ${sched.start}`});
  if(sched&&lastOut&&!open&&mins(lastOut)<mins(sched.end)-5) exc.push({code:"EARLY_OUT",label:t("early"),sev:"warn",pid:[...ps].reverse().find(p=>p.type==="OUT").id,msg:`Out at ${lastOut}, scheduled ${sched.end}`});
  if(!sched&&ps.length) exc.push({code:"UNSCHEDULED",label:t("unsched"),sev:"warn",msg:"Worked on a day with no schedule"});
  if(sched&&!ps.length&&past) exc.push({code:"UNEXCUSED_ABSENCE",label:t("absent"),sev:"err",msg:"Scheduled but no punches"});
  const daily=segs.reduce((a,s)=>a+(s.hours||0),0);
  return {date,segs,exc,daily,sched};
}
function buildPeriod(emp,off){ let cum=0; return periodDays(off).map(d=>{ const b=buildDay(emp,d); cum+=b.daily; b.cum=cum; return b; }); }
