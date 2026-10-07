/* ---------- Actions ---------- */
function toast(m,kind="info",placement="bottom",action=null){
  const el=$("#toast"),message=$("#toast-message"),mark=$("#toast-icon"),actionButton=$("#toast-action"),dismiss=$("#toast-dismiss");
  if(!el||!message||!mark||!actionButton||!dismiss)return;
  clearTimeout(toast.t);
  const level=kind==="success"||kind==="error"?kind:"info",glyph=level==="success"?"check":level==="error"?"x":"info";
  el.classList.remove("show","toast-info","toast-success","toast-error","toast-kiosk");
  el.classList.add(`toast-${level}`);
  if(placement==="top")el.classList.add("toast-kiosk");
  mark.innerHTML=icon(glyph,18);
  dismiss.innerHTML=icon("x",16);
  message.textContent=String(m??"");
  message.setAttribute("role",level==="error"?"alert":"status");
  message.setAttribute("aria-live",level==="error"?"assertive":"polite");
  message.setAttribute("aria-atomic","true");
  dismiss.setAttribute("aria-label",t("dismiss"));
  actionButton.hidden=!(action?.label&&action?.act);
  actionButton.textContent=action?.label||"";
  if(action?.label&&action?.act)actionButton.dataset.act=action.act;
  else delete actionButton.dataset.act;
  el.setAttribute("aria-hidden","false");
  el.classList.add("show");
  toast.duration=level==="error"?8000:5200;
  toast.t=setTimeout(toastDismiss,toast.duration);
}
function toastDismiss(){
  const el=$("#toast");if(!el)return;
  clearTimeout(toast.t);el.classList.remove("show","toast-info","toast-success","toast-error","toast-kiosk");el.setAttribute("aria-hidden","true");
}
function toastResumeTimer(){const el=$("#toast");if(!el?.classList.contains("show"))return;clearTimeout(toast.t);toast.t=setTimeout(toastDismiss,toast.duration||5200);}
const appToastRoot=$("#toast");
appToastRoot?.addEventListener("pointerenter",()=>clearTimeout(toast.t));
appToastRoot?.addEventListener("pointerleave",toastResumeTimer);
appToastRoot?.addEventListener("focusin",()=>clearTimeout(toast.t));
appToastRoot?.addEventListener("focusout",e=>{if(!appToastRoot.contains(e.relatedTarget))toastResumeTimer();});
appToastRoot?.addEventListener("keydown",e=>{if(e.key==="Escape")toastDismiss();});
function showPunchNotice(kind,text){ render(); toast(text,kind==="success"?"success":"error"); }
function go(view){ if(S.view==="kiosk"&&view!=="kiosk") kioskReset(); S.view=view; syncAppRoute(view); render(); window.scrollTo({top:0}); }
function setPersona(k){ kioskReset(); S.persona=k; S.period=0; UI.submitTried=false; UI.homeShowAll=false; UI.apSel.clear(); toResetUI(); go(PERSONAS[k].land); }
function flash(key){ if(!key) return; setTimeout(()=>{ const el=document.querySelector(`[data-hl="${key}"]`); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } },80); }
const J_PERIOD={"TC-03":-1,"TC-04":-1};
const J_FOCUS={"TC-01":"timecard-grid","TC-02":"timecard-grid","TC-03":"timecard-grid","TC-04":"timecard-grid","TC-07":"totals"};

function approveTimecard(){
  const emp=S.persona, off=S.period, days=buildPeriod(emp,off), pk=periodKey(off);
  const missed=days.flatMap(d=>d.exc.filter(e=>e.code==="MISSED_OUT_PUNCH"||e.code==="UNEXCUSED_ABSENCE").map(e=>`${fmtDay(d.date)}: ${e.label}`));
  if(missed.length){ openDialog("Fix these before approving",`<div class="banner err"><div>Missed punches block approval. Fix them, then approve again. ${uj("TC-08")}</div></div><ul>${missed.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`,`<button class="btn primary" data-act="toTimecard">Review timecard</button>`); return; }
  if(days.some(d=>d.segs.some(s=>s.live))){ toast("Punch out before approving the current period.","error"); return; }
  (S.tcAppr[emp]=S.tcAppr[emp]||{})[pk]="employee";
  const by={}; days.forEach((d,i)=>d.segs.forEach(s=>{ if(!s.hours) return; const k=s.proj; by[k]=by[k]||{task:s.task,days:Array(7).fill(0)}; by[k].days[i]+=s.hours; }));
  let routed=0;
  Object.entries(by).forEach(([proj,v])=>{ S.approvals.push({id:uid("a"),emp,empName:PERSONAS[emp].name,period:pk,proj,task:v.task,days:v.days.map(x=>Math.round(x*100)/100),hours:Math.round(v.days.reduce((a,b)=>a+b,0)*100)/100,src:"Punches",status:"Pending",note:"",edited:null,rowId:null}); routed++; });
  ukg(emp,"Employee approval","POST /v1/timekeeping/employee_timecard_approvals",`startDate=${periodDays(off)[0]} endDate=${periodDays(off)[6]}`);
  S.audit.unshift({ts:nowTs(),who:PERSONAS[emp].name,emp,what:"Approved timecard",detail:`${fmtRange(off)} · ${routed} project line(s) sent to Line Managers / Project Owners`,reason:""});
  render(); toast(`Timecard approved. ${routed} project line(s) sent for project approval.`,"success");
}
function removeApproval(){
  const emp=S.persona, pk=periodKey(S.period);
  delete (S.tcAppr[emp]||{})[pk];
  const before=S.approvals.length; S.approvals=S.approvals.filter(a=>!(a.emp===emp&&a.period===pk&&a.src==="Punches"&&a.status==="Pending"));
  S.audit.unshift({ts:nowTs(),who:PERSONAS[emp].name,emp,what:"Removed timecard approval",detail:`${before-S.approvals.length} pending line(s) withdrawn`,reason:""});
  render(); toast("Approval removed. Your timecard is editable again.","success");
}
function decide(ids,status,note,){
  ids.forEach(id=>{ const a=S.approvals.find(x=>x.id===id); if(!a||a.status!=="Pending") return;
    a.status=status; a.note=note||"";
    if(a.rowId){ const g=S.grid[a.emp]&&S.grid[a.emp][a.period]; const r=g&&g.rows.find(x=>x.id===a.rowId); if(r){ r.status=status; r.note=status==="Rejected"?note:""; } }
    S.audit.unshift({ts:nowTs(),who:"Oliver Grant",emp:a.emp,what:`${status} ${a.proj} · ${fmtH(a.hours)} h`,detail:`Project approval · ${a.empName}`,reason:note||""});
    S.audit.unshift({ts:nowTs(),who:"Oliver Grant",emp:"oliver",what:`${status} ${a.proj} · ${a.empName} · ${fmtH(a.hours)} h`,detail:"",reason:note||""});
    if(status==="Approved") ukg("oliver","Project time approved","POST /v1/timekeeping/timecard",`${a.proj} ${a.empName} ${fmtH(a.hours)}h approved`);
  });
  UI.apSel.clear(); render();
}
function submitGrid(){   // Save: sends the rows changed since the last save
  const emp=S.persona, g=gridWeek(emp,S.period); UI.submitTried=true;
  const v=updateGrid();
  if(v.errs.length){ toast("Fix the highlighted cells before saving.","error"); return; }
  const isSal=PERSONAS[emp].type==="salary"; let n=0;
  g.rows.forEach(r=>{ if(r.archived||r.status==="Approved"||!UI.gDirty.has(r.id)) return;
    const days=r.h.map(x=>num(x)||0), hrs=days.reduce((a,b)=>a+b,0); if(!hrs) return; n++;
    r.status=isSal?"Recorded":"Submitted"; r.note="";
    if(!isSal){ let a=S.approvals.find(x=>x.rowId===r.id);
      if(a){ Object.assign(a,{days,hours:hrs,task:r.task,status:"Pending",note:"",edited:null}); }
      else S.approvals.push({id:uid("a"),emp,empName:PERSONAS[emp].name,period:periodKey(S.period),proj:r.proj,task:r.task,days,hours:hrs,src:"Grid",status:"Pending",note:"",edited:null,rowId:r.id}); }
  });
  UI.gDirty.clear(); UI.submitTried=false;
  if(!n){ render(); toast("Nothing to save. Enter hours first."); return; }
  g.savedAt=new Date().toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit"});
  ukg(emp,isSal?"Project hours recorded":"Project hours submitted","POST /v1/timekeeping/timecard",`${n} row(s) · activity hours ${fmtRange(S.period)}`);
  S.audit.unshift({ts:nowTs(),who:PERSONAS[emp].name,emp,what:`${isSal?"Recorded":"Submitted"} ${n} project row(s)`,detail:fmtRange(S.period),reason:""});
  render(); toast(isSal?`${n} row(s) saved. Salaried time needs no approval.`:`${n} row(s) saved and sent for project approval.`,"success");
}
function kioskReset(){ UI.kiosk={badge:null,msg:null,idle:30,intent:null,panel:"home",menuOpen:false,showDemoControls:false}; }
function kioskScan(code){
  code=code.trim().toUpperCase(); if(!code) return;
  const K=UI.kiosk, emp="lukas"; K.idle=30;
  if(!K.badge||K.intent!=="in"){ K.msg={cls:"err",text:"Choose Punch In and scan your badge before scanning a job."}; render(); return; }
  const err=validateProject(emp,code);
  if(err){ K.msg={cls:"err",text:err}; render(); setTimeout(()=>$("#scanInput")?.focus(),30); return; }
  const L=liveState(emp);
  if(L.st==="in"&&L.proj===code){ K.msg={cls:"err",text:`You’re already on ${code}. Scan a different job barcode to switch projects.`}; render(); setTimeout(()=>$("#scanInput")?.focus(),30); return; }
  const task=PROJECTS[code].tasks[0];
  if(L.st==="out"){ addPunch(emp,"IN",code,task,"Scanner"); K.msg={cls:"ok",text:`${t("punchedIn")}: ${code} · ${PROJECTS[code].name} · ${fmtClock(hm(new Date()))}`}; }
  else { if(L.st==="brk") addPunch(emp,"BRK_E",null,null,"Scanner"); addPunch(emp,"XFER",code,task,"Scanner"); K.msg={cls:"ok",text:`${t("transfer")} → ${code} · ${PROJECTS[code].name} · ${fmtClock(hm(new Date()))}`}; }
  K.panel="done"; K.idle=4; render();
}
