// My Timecard is read-only while employee punch-edit access is an open decision.
const TIMECARD_DISABLED_ACTIONS=new Set(["editPunch","addPunch","fixMissed","savePunch","delPunch","comment","saveComment","approveTc","removeAppr"]);
document.addEventListener("click",e=>{
  if(UI.punchOdooOpen&&!e.target.closest(".punch-project-picker")){
    UI.punchOdooOpen=false; UI.punchOdooQuery="";
    document.getElementById("punchOdooProjectMenu")?.remove();
    document.getElementById("punchOdooProjectTrigger")?.setAttribute("aria-expanded","false");
  }
  const el=e.target.closest("[data-act]"); if(!el) return;
  const a=el.dataset.act, emp=S.persona;
  if(S.view==="timecard"&&TIMECARD_DISABLED_ACTIONS.has(a)) return;
  if(a==="toast-dismiss"){ toastDismiss(); return; }
  if(el.closest("#toast")) toastDismiss();
  if(el.tagName==="SELECT"||(el.tagName==="INPUT"&&el.type!=="checkbox")) return;
  if(toAction(a,el)) return;
  if(ntAction(a,el)) return;
  switch(a){
    case "nav": UI.railOpen=false; go(el.dataset.view); break;
    case "kSelect": UI.kiosk={badge:null,msg:null,idle:60,intent:el.dataset.intent,panel:"auth",menuOpen:false,showDemoControls:true}; render(); setTimeout(()=>$("#badgeInput")?.focus(),30); break;
    case "kBack": kioskReset(); render(); break;
    case "kExit": kioskReset(); go("home"); break;
    case "kMenuClose": { const menu=el.closest(".kiosk-menu"); if(menu){ menu.open=false; UI.kiosk.menuOpen=false; menu.querySelector("summary")?.focus(); } break; }
    case "kDemoToggle": UI.kiosk.showDemoControls=!UI.kiosk.showDemoControls; render(); setTimeout(()=>$("#badgeInput")?.focus(),0); break;
    case "kDemoSuccess": {
      const K=UI.kiosk;
      if(K.intent==="recent"){ kioskBadge(PERSONAS.lukas.badge); break; }
      const action=K.intent==="out"?"punchOut":"punchIn";
      kioskReset(); render(); toast(`${t("verifiedBadge")} · ${t(action)} · ${t("previewOnly")}`,"success","top"); break;
    }
    case "kDemoFailure": kioskBadge("99-0000"); break;
    case "homeProjectsToggle": UI.homeShowAll=!UI.homeShowAll; render(); break;
    case "homeTimeOff": homeOpenTimeOff(el.dataset.team==="true",el.dataset.request==="true"); break;
    case "toggleRail": { UI.railOpen=!UI.railOpen; const rail=$("#rail"); rail.classList.toggle("open",UI.railOpen); el.setAttribute("aria-expanded",String(UI.railOpen)); break; }
    case "uj": e.stopPropagation(); UI.jOpen.add(el.dataset.id); go("journeys"); setTimeout(()=>{ const r=document.getElementById("j-"+el.dataset.id); r&&r.scrollIntoView({block:"center"}); r&&r.classList.add("flash"); },60); break;
    case "settings": openDrawer(); break;
    case "closeDrawer": UI.drawer=false; UI.nt=null; $("#layer").innerHTML=""; break;
    case "ovl": if(e.target===el){ const refresh=!!UI.odooManageMode; UI.odooManageMode=""; closeDialog(); if(refresh){ render(); setTimeout(()=>document.getElementById("punchOdooProjectTrigger")?.focus(),0); } } break;
    case "closeDlg": { const refresh=!!UI.odooManageMode; UI.odooManageMode=""; closeDialog(); if(refresh){ render(); setTimeout(()=>document.getElementById("punchOdooProjectTrigger")?.focus(),0); } break; }
    case "closeTcDetails": closeTcDetailsPopover(true); break;
    case "tcTransferMenu": openTcTransferPopover(el,{x:e.clientX,y:e.clientY,focus:e.detail===0}); break;
    case "tcPunchMenu": openTcPunchPopover(el,{x:e.clientX,y:e.clientY,focus:e.detail===0}); break;
    case "goPrevTc": S.period=-1; go("timecard"); break;
    case "toggleOdooPunchProject":
      UI.punchOdooOpen=!UI.punchOdooOpen; UI.punchOdooQuery=""; render();
      if(UI.punchOdooOpen) setTimeout(()=>document.getElementById("punchOdooSearch")?.focus(),0);
      else setTimeout(()=>document.getElementById("punchOdooProjectTrigger")?.focus(),0);
      break;
    case "selectOdooPunchProject": S._selProj=el.dataset.code||""; S._selTask=""; UI.punchOdooOpen=false; UI.punchOdooQuery=""; render(); break;
    case "manageOdooProjects": UI.punchOdooOpen=false; UI.punchOdooQuery=""; UI.odooCatalogQuery=""; UI.odooCatalogNotice=""; manageOdooProjects("manage"); break;
    case "openOdooCatalog": UI.odooCatalogQuery=""; UI.odooCatalogNotice=""; manageOdooProjects("add"); break;
    case "backToOdooProjects": manageOdooProjects("manage"); break;
    case "addOdooPunchProject": {
      const code=el.dataset.code, added=addOdooProjectToPunch(emp,code);
      UI.odooCatalogNotice=added?`${code} added and selected for this punch.`:`${code} is already available or is not active.`;
      manageOdooProjects("add"); break;
    }
    // punch
    case "punchIn": {
      const L=liveState(emp), pending=(S.pendingPunchTransfers||{})[emp], p=S._selProj&&assigned(emp).includes(S._selProj)&&!isPunchOdooHidden(emp,S._selProj)?S._selProj:"", tk=p&&PROJECTS[p].tasks.includes(S._selTask)?S._selTask:"";
      const err=p?validateProject(emp,p):null;
      if(err){showPunchNotice("error",err);break;}
      if(L.st!=="out"){showPunchNotice("error","You are already punched in.");break;}
      if(S.settings.simDuplicatePunchError){
        S.settings.simDuplicatePunchError=false; persist();
        const tx=simulatedUkgError(emp,"Punch In","POST /v1/timekeeping/timecard",`punches.add action PUNCH_IN${p?` project=${p}`:""}`,"Duplicate punch. UKG did not record this punch.");
        showPunchNotice("error",tx.error); break;
      }
      const d=laborDefaults(emp), labor=pending?pending:{project:d.project||"",task:d.task||"",tc:d.tc||"",func:d.func||""};
      const punch=addPunch(emp,"IN",p||null,tk||null,"Punch",null,labor);
      delete (S.pendingPunchTransfers||{})[emp]; persist();
      showPunchNotice("success",`${t("recorded")}: ${t("punchIn")} · ${fmtClock(tsTime(punch.t))}${p?` · ${p}`:""}`); break;
    }
    case "punchOut": {
      const L=liveState(emp); if(L.st==="out") break;
      if(S.settings.simDuplicatePunchError){
        S.settings.simDuplicatePunchError=false; persist();
        const tx=simulatedUkgError(emp,"Punch Out","POST /v1/timekeeping/timecard","punches.add action PUNCH_OUT","Duplicate punch. UKG did not record this punch.");
        showPunchNotice("error",tx.error); break;
      }
      if(L.st==="brk") addPunch(emp,"BRK_E");
      const punch=addPunch(emp,"OUT",null,null,"Punch");
      showPunchNotice("success",`${t("recorded")}: ${t("punchOut")} · ${fmtClock(tsTime(punch.t))}`); break;
    }
    case "startBrk": { const punch=addPunch(emp,"BRK_S"); showPunchNotice("success",`${t("recorded")}: ${t("startBreak")} · ${fmtClock(tsTime(punch.t))}`); break; }
    case "endBrk": { const punch=addPunch(emp,"BRK_E"); showPunchNotice("success",`${t("recorded")}: ${t("endBreak")} · ${fmtClock(tsTime(punch.t))}`); break; }
    case "startXfer": openPunchTransfer(); break;
    case "armPunchError": S.settings.simDuplicatePunchError=true; persist(); render(); toast("Next Punch In or Punch Out will show a duplicate-punch error from UKG."); break;
    // timecard
    case "mpOpen": manageProjects(); break;
    case "mpToggle": { const code=el.dataset.code; setHidden(emp,code,!el.checked,true); manageProjects(); render(); break; }
    case "gToday": S.period=0; UI.submitTried=false; render(); break;
    case "per": { const d=+el.dataset.d; const max=S.view==="grid"?1:0; S.period=Math.max(-1,Math.min(max,S.period+d)); UI.submitTried=false; render(); break; }
    case "toTimecard": closeDialog(); flash("timecard-grid"); break;
    case "approveTc": approveTimecard(); break;
    case "removeAppr": { const pk=periodKey(S.period); if(S.approvals.some(x=>x.emp===emp&&x.period===pk&&x.src==="Punches"&&x.status!=="Pending")){ toast("Your approver already acted on some lines. Ask them to reject the line you need to change.","error"); break; } removeApproval(); break; }
    case "refreshTc": ukg(emp,"Read timecard","POST /v1/timekeeping/employee_timecard/multi_read",`period ${fmtRange(S.period)}`); toast("Reading timecard from UKG…"); break;
    case "editPunch": { closeTcDetailsPopover(); if((S.tcAppr[emp]||{})[periodKey(S.period)]){ toast("Remove your approval to make changes.","error"); break; } const p=S.punches[emp].find(x=>x.id===el.dataset.id); p&&punchDialog(el.dataset.date,p); break; }
    case "addPunch": { if((S.tcAppr[emp]||{})[periodKey(S.period)]){ toast("Remove your approval to make changes.","error"); break; } const sc=persona().sched; punchDialog(el.dataset.date,null,{type:"IN",time:sc?sc.start:"09:00"}); break; }
    case "fixMissed": { if((S.tcAppr[emp]||{})[periodKey(S.period)]) break; const sc=persona().sched; punchDialog(el.dataset.date,null,{type:"OUT",time:sc?sc.end:"17:00"}); break; }
    case "savePunch": {
      const date=el.dataset.date, id=el.dataset.id, type=$("#dType").value, time=$("#dTime").value, proj=$("#dProj").value, task=$("#dTask").value, reason=$("#dReason").value, note=$("#dNote").value.trim();
      if(!time){ dlgErr("Enter a time."); break; }
      if(!reason){ dlgErr("Choose a reason for this change."); break; }
      if(`${date} ${time}`>nowTs()){ dlgErr("A punch cannot be in the future."); break; }
      if(!S.settings.empEdit){ S.audit.unshift({ts:nowTs(),who:persona().name,emp,what:`Correction requested: ${type} ${time} on ${fmtDay(date)}`,detail:note,reason}); closeDialog(); render(); toast("Correction request sent to your manager.","success"); break; }
      const withProj=type==="IN"||type==="XFER";
      if(id){ const p=S.punches[emp].find(x=>x.id===id); const old=`${p.type} ${tsTime(p.t)}${p.proj?" "+p.proj:""}`; Object.assign(p,{type,t:`${date} ${time}`,proj:withProj?proj:null,task:withProj?task:null,edited:true});
        p.sync=ukg(emp,"Edit punch","POST /v1/timekeeping/employee_timecard",`punches.update id=${id} ${type} ${time}`);
        S.audit.unshift({ts:nowTs(),who:persona().name,emp,what:`Edited punch on ${fmtDay(date)}: ${old} → ${type} ${time}${withProj?" "+proj:""}`,detail:note,reason}); }
      else { const p=addPunch(emp,type,withProj?proj:null,withProj?task:null,"Edit",`${date} ${time}`); p.edited=true; S.audit[0].reason=reason; S.audit[0].what=`Added ${type} ${time} on ${fmtDay(date)}${withProj?" "+proj:""}`; S.audit[0].detail=note; }
      closeDialog(); render(); toast("Punch saved. Totals recalculated.","success"); break; }
    case "delPunch": { const reason=$("#dReason").value; if(!reason){ dlgErr("Choose a reason for this change."); break; } const i=S.punches[emp].findIndex(x=>x.id===el.dataset.id); const p=S.punches[emp][i]; S.punches[emp].splice(i,1); ukg(emp,"Delete punch","POST /v1/timekeeping/employee_timecard",`punches.delete id=${p.id}`); S.audit.unshift({ts:nowTs(),who:persona().name,emp,what:`Deleted ${p.type} ${tsTime(p.t)} on ${fmtDay(tsDate(p.t))}`,detail:"",reason}); closeDialog(); render(); toast("Punch deleted.","success"); break; }
    case "comment": { closeTcDetailsPopover(); const d=el.dataset.date, cur=(S.comments[emp]||{})[d]||""; openDialog(`${t("comment")} · ${fmtDay(d)}`,`<label class="field"><span>Visible to your approvers ${uj("TC-04")}</span><textarea class="input" id="cText" rows="3">${esc(cur)}</textarea></label>`,`<button class="btn" data-act="closeDlg">${esc(t("cancel"))}</button><button class="btn primary" data-act="saveComment" data-date="${d}">${esc(t("save"))}</button>`); break; }
    case "saveComment": { const d=el.dataset.date, v=$("#cText").value.trim(); S.comments[emp]=S.comments[emp]||{}; if(v) S.comments[emp][d]=v; else delete S.comments[emp][d]; S.audit.unshift({ts:nowTs(),who:persona().name,emp,what:`Comment on ${fmtDay(d)}`,detail:v||"(removed)",reason:""}); closeDialog(); render(); toast("Comment saved.","success"); break; }
    // grid
    case "saveGrid": submitGrid(); break;
    case "archive": { const g=gridWeek(emp,S.period), r=g.rows.find(x=>x.id===el.dataset.row); if(r.h.some(x=>num(x))){ toast("Only rows without hours can be archived.","error"); break; } r.archived=true; render(); toast(`${r.proj} archived.`,"success"); break; }
    case "restore": { const r=gridWeek(emp,S.period).rows.find(x=>x.id===el.dataset.row); r.archived=false; render(); toast(`${r.proj} restored.`,"success"); break; }
    case "copyWeek": { const g=gridWeek(emp,S.period), prev=(S.grid[emp]||{})[periodKey(S.period-1)]; if(!prev){ toast("No rows last week to copy."); break; }
      let added=0, skipped=0; prev.rows.forEach(r=>{ if(r.archived) return; if(!PROJECTS[r.proj].active||!assigned(emp).includes(r.proj)){ skipped++; return; } if(g.rows.some(x=>x.proj===r.proj)) return; g.rows.push({id:uid("r"),proj:r.proj,task:r.task,h:[...r.h],status:"Draft",note:"",archived:false}); added++; });
      render(); toast(`Copied ${added} row${added===1?"":"s"}${skipped?`, ${skipped} closed project${skipped>1?"s":""} skipped`:""}.`,"success"); break; }
    case "addRow": openNewTime(); break;
    // approvals
    case "apFilter": UI.apFilter=el.dataset.f; UI.apSel.clear(); render(); break;
    case "apSel": el.checked?UI.apSel.add(el.dataset.id):UI.apSel.delete(el.dataset.id); render(); break;
    case "apSelAll": S.approvals.filter(x=>x.proj===el.dataset.proj&&x.status==="Pending").forEach(x=>el.checked?UI.apSel.add(x.id):UI.apSel.delete(x.id)); render(); break;
    case "apApprove": { const ids=[...UI.apSel]; decide(ids,"Approved"); toast(`${ids.length} line(s) approved.`,"success"); break; }
    case "apOne": decide([el.dataset.id],"Approved"); toast("Line approved.","success"); break;
    case "apReject": { const x=S.approvals.find(y=>y.id===el.dataset.id); openDialog(`${t("reject")} · ${x.proj}`,`<div class="sub">${esc(x.empName)} · ${fmtH(x.hours)} h · ${esc(x.task||"")}</div><label class="field"><span>Note to employee (required)</span><textarea class="input" id="rNote" data-act="rNote" rows="3" placeholder="Tell the employee what to fix"></textarea></label>`,`<button class="btn" data-act="closeDlg">${esc(t("cancel"))}</button><button class="btn danger" id="rBtn" data-act="doReject" data-id="${x.id}" disabled>${esc(t("reject"))}</button>`); break; }
    case "doReject": { const n=$("#rNote").value.trim(); if(!n) break; closeDialog(); decide([el.dataset.id],"Rejected",n); toast("Line returned to the employee with your note.","success"); break; }
    case "apEdit": { const x=S.approvals.find(y=>y.id===el.dataset.id); openDialog(`${t("edit")} · ${x.proj}`,`<div class="sub">${esc(x.empName)} · ${esc(x.task||"")}</div><div class="two"><label class="field"><span>${esc(t("hours"))}</span><input class="input" id="eH" inputmode="decimal" value="${x.hours}"></label><label class="field"><span>${esc(t("reason"))} (required)</span><input class="input" id="eR" placeholder="Why the change"></label></div><div class="err-text" id="dlgErr" hidden></div>`,`<button class="btn" data-act="closeDlg">${esc(t("cancel"))}</button><button class="btn primary" data-act="doEdit" data-id="${x.id}">${esc(t("save"))}</button>`); break; }
    case "doEdit": { const x=S.approvals.find(y=>y.id===el.dataset.id), h=num($("#eH").value), r=$("#eR").value.trim(); if(isNaN(h)||h<=0){ dlgErr("Enter hours greater than 0."); break; } if(!r){ dlgErr("Enter a reason."); break; }
      const from=x.hours, f=h/from; x.edited={from,reason:r}; x.hours=h; x.days=x.days.map(d=>Math.round(d*f*100)/100);
      if(x.rowId){ const g=S.grid[x.emp][x.period], row=g&&g.rows.find(q=>q.id===x.rowId); if(row){ row.edited=`${fmtH(from)} → ${fmtH(h)} h (${r})`; row.h=row.h.map(v=>v===""?"":String(Math.round(num(v)*f*100)/100)); } }
      S.audit.unshift({ts:nowTs(),who:"Oliver Grant",emp:x.emp,what:`Edited ${x.proj} hours ${fmtH(from)} → ${fmtH(h)}`,detail:x.empName,reason:r});
      ukg("oliver","Manager edit","POST /v1/timekeeping/timecard",`${x.proj} ${x.empName} ${fmtH(from)}→${fmtH(h)}h`);
      closeDialog(); render(); toast("Hours updated. Original value kept in audit.","success"); break; }
    // kiosk
    case "badge": kioskBadge(el.dataset.code); break;
    case "scan": kioskScan(el.dataset.code); break;
    case "kBrk": { const L=liveState("lukas"); if(L.st==="in"){ addPunch("lukas","BRK_S",null,null,"Scanner"); UI.kiosk.msg={cls:"ok",text:t("onBreak")}; } UI.kiosk.idle=30; render(); setTimeout(()=>$("#scanInput")?.focus(),30); break; }
    case "kEndBrk": { const L=liveState("lukas"); if(L.st==="brk"){ addPunch("lukas","BRK_E",null,null,"Scanner"); UI.kiosk.msg={cls:"ok",text:t("endBreak")}; } UI.kiosk.idle=30; render(); setTimeout(()=>$("#scanInput")?.focus(),30); break; }
    case "kOut": { const result=kioskPunchOut(); kioskReset(); render(); toast(result.message,result.ok?"success":"error","top"); break; }
    case "kDone": kioskReset(); render(); toast("Kiosk ready for the next person."); break;
    // journeys
    case "jToggle": { if(e.target.closest("button")) break; const id=el.dataset.id; UI.jOpen.has(id)?UI.jOpen.delete(id):UI.jOpen.add(id); render(); break; }
        case "shotOpen": { const src=el.dataset.src, alt=el.dataset.alt, cap=el.dataset.caption; $("#layer").innerHTML=`<div class="shot-lightbox" role="dialog" aria-modal="true" aria-label="${esc(cap)} screenshot" data-act="shotClose" style="position:fixed;inset:0;z-index:60;background:rgba(10,12,14,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 16px 16px;box-sizing:border-box;cursor:zoom-out"><button type="button" class="btn" data-act="shotClose" style="position:absolute;top:16px;right:16px" aria-label="Close screenshot">Close</button><img src="${esc(src)}" alt="${esc(alt)}" data-act="shotKeep" style="display:block;max-width:100%;max-height:calc(100vh - 110px);width:auto;height:auto;border-radius:8px;background:#fff;cursor:default"><p style="margin:0;color:#fff;font-size:14px">${esc(cap)} · prototype</p></div>`; $("#layer .shot-lightbox .btn")?.focus(); break; }
    case "shotKeep": break;
    case "shotClose": $("#layer").innerHTML=""; break;
    case "jRun": { e.stopPropagation(); const j=JOURNEYS.find(x=>x.id===el.dataset.id); const [p,v,hl]=j.demo; S.persona=p; S.period=J_PERIOD[j.id]??0; if(j.id==="PA-06"){} if(v==="kiosk") kioskReset(); go(v); flash(J_FOCUS[j.id]||hl); toast(`${j.id} · ${j.name}`); break; }
    case "reset": try{localStorage.removeItem(STORE_KEY);}catch(_){} S=seed(); S.seedWeek=periodKey(0); UI.drawer=false; $("#layer").innerHTML=""; kioskReset(); render(); toast("Demo data reset.","success"); break;
  }
});
document.addEventListener("contextmenu",e=>{
  const el=e.target.closest('[data-act="tcTransferMenu"],[data-act="tcPunchMenu"]');
  if(!el){ closeTcDetailsPopover(); return; }
  e.preventDefault();
  const point={x:e.clientX,y:e.clientY,focus:true};
  if(el.dataset.act==="tcPunchMenu") openTcPunchPopover(el,point); else openTcTransferPopover(el,point);
});
document.addEventListener("pointerdown",e=>{
  if(S.view==="kiosk"&&["auth","project"].includes(UI.kiosk.panel)) UI.kiosk.idle=UI.kiosk.panel==="auth"?60:30;
  const kioskMenu=document.querySelector(".kiosk-menu[open]");
  if(kioskMenu&&!kioskMenu.contains(e.target)){ kioskMenu.open=false; UI.kiosk.menuOpen=false; }
  const pop=document.getElementById("tcDetailsPopover");
  if(pop&&!pop.contains(e.target)&&!e.target.closest('[data-act="tcTransferMenu"],[data-act="tcPunchMenu"]')) closeTcDetailsPopover();
},true);
function kioskBadge(code){
  code=(code||"").trim();
  const K=UI.kiosk;
  K.idle=60;
  if(!K.intent){ K.msg={cls:"err",text:"Choose an action before scanning your badge."}; render(); return; }
  if(code===PERSONAS.lukas.badge){
    if(K.intent==="recent"){ K.badge=code; K.msg=null; K.panel="recent"; K.idle=60; render(); return; }
    const result=K.intent==="in"?kioskPunchIn():kioskPunchOut();
    kioskReset(); render(); toast(result.message,result.ok?"success":"error","top");
  }
  else { const message=`Badge ${code||"?"} not recognised. Try scanning again or ask your supervisor.`; kioskReset(); render(); toast(message,"error","top"); }
}
function kioskPunchIn(){
  const L=liveState("lukas");
  if(L.st!=="out") return {ok:false,message:"You’re already clocked in. No new punch was added."};
  addPunch("lukas","IN",null,null,"Scanner");
  return {ok:true,message:`${t("punchedIn")} · ${fmtClock(hm(new Date()))}`};
}
function kioskPunchOut(){
  const L=liveState("lukas");
  if(L.st==="out") return {ok:false,message:"You’re already clocked out. No new punch was added."};
  if(L.st==="brk") addPunch("lukas","BRK_E",null,null,"Scanner");
  addPunch("lukas","OUT",null,null,"Scanner");
  return {ok:true,message:`${t("punchedOut")} · ${fmtClock(hm(new Date()))}`};
}
function openDrawer(){
  $("#layer").innerHTML=`<div class="overlay" data-act="closeDrawerOvl" style="place-items:stretch end;padding:0"><aside class="drawer" role="dialog" aria-label="Demo settings"><header><h3>Demo settings</h3><button class="icon-btn" data-act="closeDrawer" aria-label="Close">${icon("x")}</button></header><div class="body">
    <label class="toggle"><input type="checkbox" id="setTags" data-act="setTags" ${S.settings.tags?"checked":""}><span><b>Show journey tags</b><small>Dashed IDs link each part of the screen to its journey.</small></span></label>
    <label class="toggle"><input type="checkbox" id="setHideViewAs" data-act="setHideViewAs" ${S.settings.hideViewAs?"checked":""}><span><b>Hide “Viewing as”</b><small>Hides the persona label and selector.</small></span></label>
    <label class="toggle"><input type="checkbox" id="setPunchError" data-act="setPunchError" ${S.settings.simDuplicatePunchError?"checked":""}><span><b>Simulate a duplicate-punch error from UKG</b><small>The next Punch In or Punch Out displays the returned error (PU-08).</small></span></label>
    <div class="stack"><b>Try these paths</b><span class="sub">1. Ava › Punch: punch in, transfer, break, punch out. 2. Ava › My Timecard › Previous period: review punch details and totals. 3. Oliver › Approvals: approve, edit, reject with a note. 4. Zofia › Project hours: see the rejection, fix, resubmit. 5. Lukas › Kiosk: badge, scan jobs, try MUC-1999.</span></div>
    ${toDemoSettings()}
    <button class="btn danger" data-act="reset">Reset demo data</button>
    <p class="sub">Data stays in this browser only. Nothing is sent to UKG or Odoo; calls are simulated and logged in the UKG sync tabs.</p></div></aside></div>`;
}
document.addEventListener("click",e=>{ const o=e.target.closest('[data-act="closeDrawerOvl"]'); if(o&&e.target===o){ UI.nt=null; $("#layer").innerHTML=""; } });
document.addEventListener("change",e=>{
  const el=e.target, a=el.dataset.act, emp=S.persona;
  if(el.id==="personaSelect") return setPersona(el.value);
  if(el.id==="langSelect"){ S.lang=el.value; render(); return; }
  if(el.id==="kioskLanguage"){ S.lang=el.value; UI.kiosk.menuOpen=true; render(); setTimeout(()=>document.getElementById("kioskLanguage")?.focus(),0); return; }
  if(a==="ntPaycode"&&UI.nt){ UI.nt.paycode=el.value; return; }
  switch(a){
    case "selProj": S._selProj=el.value; S._selTask=""; render(); break;
    case "selTask": S._selTask=el.value; break;
    case "punchOdooToggle": setPunchOdooHidden(emp,el.dataset.code,!el.checked); manageOdooProjects("manage",el.dataset.code); break;
    case "recentTransfer": if(el.value) useRecentPunchTransfer(el.value); break;
    case "xProj": S._xProj=el.value; S._xTask=null; render(); break;
    case "xTask": S._xTask=el.value; break;
    case "tf": S.period=+el.value; UI.submitTried=false; render(); break;
    case "task": { const r=gridWeek(emp,S.period).rows.find(x=>x.id===el.dataset.row); r.task=el.value; updateGrid(); persist(); break; }
    case "toggleArch": UI.showArch=el.checked; render(); break;
    case "setTags": S.settings.tags=el.checked; document.body.classList.toggle("hide-tags",!el.checked); persist(); break;
    case "setHideViewAs": S.settings.hideViewAs=el.checked; document.body.classList.toggle("hide-view-as",el.checked); persist(); break;
    case "setPunchError": S.settings.simDuplicatePunchError=el.checked; persist(); render(); break;
    case "jEpic": UI.jFilter.epic=el.value; render(); break;
    case "jSpec": UI.jFilter.spec=el.value; render(); break;
    case "jEv": UI.jFilter.ev=el.value; render(); break;
  }
});
document.addEventListener("input",e=>{
  const el=e.target, a=el.dataset.act;
  if(a==="h"){ const r=gridWeek(S.persona,S.period).rows.find(x=>x.id===el.dataset.row); r.h[+el.dataset.i]=el.value.trim(); UI.gDirty.add(r.id); updateGrid(); persist(); }
  if(a==="ntSearch"&&UI.nt){ UI.nt.q=el.value; ntRenderOpts(); }
  if(a==="punchOdooSearch"){
    UI.punchOdooQuery=el.value;
    const codes=assigned(S.persona).filter(code=>!isPunchOdooHidden(S.persona,code)), options=document.getElementById("punchOdooOptions");
    if(options) options.innerHTML=punchOdooProjectOptions(codes,S._selProj,UI.punchOdooQuery);
  }
  if(a==="odooCatalogSearch"){
    UI.odooCatalogQuery=el.value;
    const results=document.getElementById("odooCatalogResults"); if(results) results.innerHTML=odooCatalogResults(S.persona,UI.odooCatalogQuery);
  }
  if(a==="rNote"){ $("#rBtn").disabled=!el.value.trim(); }
  if(a==="jQ"){ UI.jFilter.q=el.value; const pos=el.selectionStart; render(); const q=$("#jQ"); q.focus(); q.setSelectionRange(pos,pos); }
  if(a==="scanInput"||a==="badgeInput") UI.kiosk.idle=UI.kiosk.panel==="auth"?60:30;
});
document.addEventListener("keydown",e=>{
  if(S.view==="kiosk"&&["auth","project"].includes(UI.kiosk.panel)) UI.kiosk.idle=UI.kiosk.panel==="auth"?60:30;
  const kioskMenu=document.querySelector(".kiosk-menu[open]");
  if(e.key==="Escape"&&kioskMenu){ e.preventDefault(); kioskMenu.open=false; UI.kiosk.menuOpen=false; kioskMenu.querySelector("summary")?.focus(); return; }
  if(e.key==="Tab"&&kioskMenu&&window.matchMedia("(max-width:620px)").matches){
    const focusable=[...kioskMenu.querySelectorAll(".kiosk-menu-trigger,.kiosk-menu-popover select,.kiosk-menu-help>summary,.kiosk-menu-exit")].filter(el=>el.getClientRects().length&&!el.disabled);
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last?.focus(); return; }
    if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first?.focus(); return; }
  }
  if(!UI.punchOdooOpen&&e.target.id==="punchOdooProjectTrigger"&&e.key==="ArrowDown"){
    e.preventDefault(); UI.punchOdooOpen=true; UI.punchOdooQuery=""; render(); setTimeout(()=>document.getElementById("punchOdooSearch")?.focus(),0); return;
  }
  if(UI.punchOdooOpen&&e.key==="Escape"){
    e.preventDefault(); UI.punchOdooOpen=false; UI.punchOdooQuery="";
    document.getElementById("punchOdooProjectMenu")?.remove();
    const trigger=document.getElementById("punchOdooProjectTrigger"); trigger?.setAttribute("aria-expanded","false"); trigger?.focus(); return;
  }
  if(UI.punchOdooOpen&&(e.key==="ArrowDown"||e.key==="ArrowUp")){
    const options=[...document.querySelectorAll("#punchOdooOptions .punch-odoo-option")],index=options.indexOf(document.activeElement);
    if(e.key==="ArrowDown"){ e.preventDefault(); options[index<0?0:Math.min(index+1,options.length-1)]?.focus(); }
    else if(index<0){ e.preventDefault(); options[options.length-1]?.focus(); }
    else if(index===0){ e.preventDefault(); document.getElementById("punchOdooSearch")?.focus(); }
    else { e.preventDefault(); options[index-1]?.focus(); }
  }
  if(e.key==="Escape"&&$("#tcDetailsPopover")){ closeTcDetailsPopover(true); return; }
  if(e.key==="Escape"&&$("#layer").innerHTML){ const refresh=!!UI.odooManageMode; UI.odooManageMode=""; UI.nt=null; $("#layer").innerHTML=""; if(refresh){ render(); setTimeout(()=>document.getElementById("punchOdooProjectTrigger")?.focus(),0); } return; }
  if(e.key==="Enter"&&e.target.id==="scanInput"){ kioskScan(e.target.value); }
  if(e.key==="Enter"&&e.target.id==="badgeInput"){ kioskBadge(e.target.value); }
});
document.addEventListener("toggle",e=>{
  if(e.target.matches?.(".kiosk-menu")){
    UI.kiosk.menuOpen=e.target.open;
    const trigger=e.target.querySelector("summary"), panel=e.target.querySelector(".kiosk-menu-popover"), mobile=window.matchMedia("(max-width:620px)").matches;
    trigger?.setAttribute("aria-expanded",String(e.target.open)); trigger?.setAttribute("aria-label",e.target.open?"Close timeclock menu":"Open timeclock menu");
    if(panel){ panel.setAttribute("role",mobile?"dialog":"region"); if(mobile&&e.target.open) panel.setAttribute("aria-modal","true"); else panel.removeAttribute("aria-modal"); }
  }
},true);
