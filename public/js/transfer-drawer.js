/* ---------- "Add new" drawer: UKG Pro WFM Project > Transfer > Labor categories (simulated) ---------- */
const LC_KINDS = [["proj","Project"],["task","Task / LOB"],["tc","Timecard Code"],["func","Function"]];
const laborDefaults = emp => LABOR.byPersona[emp] || {};
const rowLc = (r,emp) => { const d=laborDefaults(emp);
  return [r.paycode||PAYCODES[0], r.tc===undefined?d.tc:r.tc, r.func===undefined?d.func:r.func].filter(Boolean).join(" · "); };

function openNewTime(){
  const d=laborDefaults(S.persona);
  UI.nt={step:"project",paycode:PAYCODES[0],lc:{proj:"",task:"",tc:d.tc||"",func:d.func||""},snap:null,lcSnap:null,open:null,q:"",err:"",busy:false};
  renderNT();
}
function openPunchTransfer(){
  const emp=S.persona, d=laborDefaults(emp), L=liveState(emp), pending=(S.pendingPunchTransfers||{})[emp];
  const current=L.labor||d;
  UI.nt={intent:"punch",step:"transfer",lc:{proj:pending?pending.project??"":current.project??d.project??"",task:pending?pending.task??"":current.task??d.task??"",tc:pending?pending.tc??"":current.tc??d.tc??"",func:pending?pending.func??"":current.func??d.func??""},snap:null,lcSnap:null,open:null,q:"",err:"",busy:false,showHidden:false};
  renderNT();
}
function ntClose(){ UI.nt=null; $("#layer").innerHTML=""; }
function ntSummary(lc){ return lc.proj?`${lc.proj}${lc.task?" · "+lc.task:""}`:""; }
function ntLcLines(lc){
  const punch=UI.nt.intent==="punch", pr=punch?LABOR.opts.proj.find(x=>x.v===lc.proj):lc.proj&&PROJECTS[lc.proj];
  const projectValue=punch?(pr?pr.l:lc.proj):(pr?`${lc.proj} ${pr.name}`:"");
  return [[punch?"Labor Category Project":"Project",projectValue],[punch?"Labor Category Task / LOB":"Task",punch?laborTaskName(lc.task):lc.task],["Timecard Code",lc.tc],["Function",lc.func]].filter(x=>x[1]);
}
function ntOptions(kind){
  const lc=UI.nt.lc, q=UI.nt.q.toLowerCase();
  const punch=UI.nt.intent==="punch";
  const all=kind==="proj"?(punch?LABOR.opts.proj.map(x=>({v:x.v,l:x.l})):assigned(S.persona).map(c=>({v:c,l:`${c} · ${PROJECTS[c].name}`,s:`${PROJECTS[c].client} · ${PROJECTS[c].show}${startNote(c)?" · "+startNote(c):""}`,hid:isHidden(S.persona,c)})).filter(o=>UI.nt.showHidden||!o.hid))
    :kind==="task"?(punch?(LABOR.opts.proj.find(x=>x.v===lc.proj)?.tasks||[]):(lc.proj?PROJECTS[lc.proj].tasks:[])).map(x=>({v:x,l:punch?laborTaskName(x):x}))
    :LABOR.opts[kind].map(x=>({v:x,l:x}));
  return all.filter(o=>!q||(o.l+" "+(o.s||"")).toLowerCase().includes(q));
}
function ntOptsHtml(kind){
  const o=ntOptions(kind), cur=UI.nt.lc[kind];
  const odooProject=kind==="proj"&&UI.nt.intent!=="punch";
  const row=x=>{ const pick=`<button class="nt-opt ${x.v===cur?"on":""}" data-act="ntPick" data-kind="${kind}" data-v="${esc(x.v)}"><span>${esc(x.l)}${x.hid?` <span class="chip">Hidden</span>`:""}${x.s?`<small>${esc(x.s)}</small>`:""}</span></button>`;
    return !odooProject?pick:`<div class="nt-optrow ${x.hid?"hid":""}">${pick}<button class="btn sm ghost nt-hidebtn" data-act="ntHide" data-v="${esc(x.v)}" aria-label="${x.hid?"Show":"Hide"} ${esc(x.v)}" title="${x.hid?"Show this project in your list":"Hide this project from your list"}">${icon(x.hid?"eye":"eyeoff",16)}${x.hid?"Show":"Hide"}</button></div>`; };
  const q=UI.nt.q, hidMatch=odooProject&&!UI.nt.showHidden?assigned(S.persona).filter(c=>isHidden(S.persona,c)&&(!q||(c+" "+PROJECTS[c].name+" "+PROJECTS[c].client).toLowerCase().includes(q.toLowerCase()))).length:0;
  return (o.map(row).join("")||`<p class="sub" style="margin:8px 10px">No matches.</p>`)+(hidMatch?`<p class="sub" style="margin:8px 10px">${hidMatch} hidden project${hidMatch>1?"s":""} match. Switch to <b>All</b> to see ${hidMatch>1?"them":"it"}.</p>`:"");
}
function ntRenderOpts(){ const b=$("#ntOpts"); if(b) b.innerHTML=ntOptsHtml(UI.nt.open); }
function ntLaborRow(kind,label){
  const nt=UI.nt, lc=nt.lc, v=lc[kind], isOpen=nt.open===kind;
  const punch=nt.intent==="punch", fieldLabel=punch&&kind==="proj"?"Labor Category Project":punch&&kind==="task"?"Labor Category Task / LOB":label;
  const blocked=kind==="task"&&!lc.proj;
  const pr=punch?LABOR.opts.proj.find(x=>x.v===lc.proj):lc.proj&&PROJECTS[lc.proj];
  const need=kind==="proj"||(kind==="task"&&pr&&pr.taskReq);
  const shownValue=kind==="task"&&punch?laborTaskName(v):v;
  const head=v?`<div class="lc-row"><span class="lc-k">${esc(fieldLabel)}${need?" *":""}</span><span class="lc-v">${kind==="proj"&&pr?(punch?esc(pr.l):`<b>${esc(v)}</b> ${esc(pr.name)}`):esc(shownValue)}</span>
      <button class="icon-btn" data-act="ntOpen" data-kind="${kind}" aria-label="Change ${esc(fieldLabel)}" title="Change">${icon("down",16)}</button>
      <button class="icon-btn" data-act="ntClear" data-kind="${kind}" aria-label="Remove ${esc(fieldLabel)}" title="Remove">${icon("x",16)}</button></div>`
    :`<button class="lc-add" data-act="ntOpen" data-kind="${kind}" ${blocked?`disabled title="Add a project first"`:""}>${icon("plus",18)}<span>Add ${fieldLabel}${need?" *":""}</span>${icon("down",14)}</button>`;
  const nAll=assigned(S.persona).length, nHid=hiddenCount(S.persona);
  const hid=kind==="proj"&&!punch?`<div class="seg" role="tablist" aria-label="Project list"><button role="tab" class="${nt.showHidden?"":"on"}" data-act="ntShowHid" data-val="0">Visible (${nAll-nHid})</button><button role="tab" class="${nt.showHidden?"on":""}" data-act="ntShowHid" data-val="1">All (${nAll})${nHid?` · ${nHid} hidden`:""}</button></div>`:"";
  return head+(isOpen?`<div class="nt-panel">${hid}<input class="input" id="ntSearch" data-act="ntSearch" placeholder="Search ${fieldLabel.toLowerCase()}" autocomplete="off" value="${esc(nt.q)}"><div id="ntOpts" class="nt-opts">${ntOptsHtml(kind)}</div></div>`:"");
}
function renderNT(){
  const nt=UI.nt; if(!nt) return;
  const P=persona(), d=laborDefaults(S.persona), lc=nt.lc;
  let title="Project", sub="", body="", foot="";
  if(nt.step==="project"){
    const sum=ntSummary(lc);
    body=`<label class="field"><span>Paycode *</span><select class="select" id="ntPaycode" data-act="ntPaycode">${PAYCODES.map(p=>`<option ${p===nt.paycode?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
      <div class="field"><span>Transfer</span><div class="nt-xfer"><button class="nt-xfer-box ${sum?"":"empty"}" data-act="ntStep" data-step="transfer" aria-label="Edit transfer">${esc(sum||"Select a transfer")}</button>
        <button class="icon-btn nt-go" data-act="ntStep" data-step="transfer" aria-label="Open transfer" title="Open transfer">${icon("right",20)}</button>
        <span class="icon-btn nt-info" title="${nt.intent==="punch"?(liveState(S.persona).st==="out"?"This transfer will be used when you punch in.":"This transfer applies from this punch forward."):"Transfer charges these hours to a project and task. Only labor categories are required in this release."}">${icon("info",18)}</span></div></div>`;
    foot=`<button class="btn pill" data-act="closeDrawer">${esc(t("cancel"))}</button><button class="btn pill primary" data-act="ntApply" ${nt.busy?"disabled":""}>${nt.busy?"Applying…":"Apply"}</button>`;
  } else if(nt.step==="transfer"){
    title="Transfer";
    const lines=ntLcLines(lc);
    body=`<div class="nt-emp"><span class="avatar">${esc(P.initials)}</span><b>${esc(P.name)}</b></div>
      <dl class="nt-dl"><dt>Primary location</dt><dd>${esc(d.location||"-")}</dd>
        <dt>Labor categories</dt><dd>${lines.length?lines.map(([k,v])=>`<div><span class="sub">${esc(k)}:</span> ${esc(v)}</div>`).join(""):"None"}</dd></dl>
      <div class="nt-links">
        <button class="lc-add" data-act="ntStep" data-step="labor">${icon("plus",18)}<span>Add Labor Category</span></button></div>`;
    foot=`<button class="btn pill" data-act="${nt.intent==="punch"?"closeDrawer":"ntBack"}">${esc(t("cancel"))}</button><button class="btn pill primary" data-act="ntTransferOk">${nt.intent==="punch"?esc(t("confirmXfer")):"Apply"}</button>`;
  } else {
    title="Transfer"; sub=nt.intent==="punch"?"UKG labor categories":"Labor categories";
    body=`<div class="nt-links">${LC_KINDS.map(([k,l])=>ntLaborRow(k,l)).join("")}</div>`;
    foot=`<button class="btn pill" data-act="ntLaborBack">Back</button><button class="btn pill primary" data-act="ntLaborOk">Ok</button>`;
  }
  $("#layer").innerHTML=`<div class="overlay nt-ovl" data-act="closeDrawerOvl" style="place-items:stretch end;padding:0"><aside class="drawer wide ${nt.intent==="punch"?"punch-transfer-drawer":""}" role="dialog" aria-label="${esc(title)}">
    <header><div><h3>${esc(title)}</h3>${sub?`<div class="sub nt-sub">${esc(sub)}</div>`:""}</div><button class="icon-btn" data-act="closeDrawer" aria-label="Close">${icon("x")}</button></header>
    <div class="body">${nt.err?`<div class="banner err" role="alert">${icon("x")}<div>${esc(nt.err)}</div></div>`:""}${body}</div><footer>${foot}</footer></aside></div>`;
  if(nt.open){ const s=$("#ntSearch"); if(s){ s.focus(); s.setSelectionRange(s.value.length,s.value.length); } }
}
function ntLaborValidate(){
  const lc=UI.nt.lc, pr=lc.proj&&PROJECTS[lc.proj];
  if(UI.nt.intent==="punch"){
    const laborProject=LABOR.opts.proj.find(x=>x.v===lc.proj);
    if(!laborProject) return "Labor Category Project is required.";
    if(laborProject.taskReq&&!lc.task) return `Labor Category Task / LOB is required for ${laborProject.l}.`;
    if(lc.task&&!laborProject.tasks.includes(lc.task)) return "Choose a Task / LOB that belongs to this labor category project.";
  } else {
    if(!lc.proj) return "Labor category incomplete: a Project is required.";
    if(pr&&pr.taskReq&&!lc.task) return `Labor category incomplete: ${lc.proj} requires a Task.`;
  }
  return "";
}
function ntApply(){
  const nt=UI.nt, emp=S.persona, lc=nt.lc, d=laborDefaults(emp);
  const e=ntLaborValidate(); if(e){ nt.err="Transfer is required. "+e; renderNT(); return; }
  const g=gridWeek(emp,S.period);
  const same=r=>!r.archived&&r.proj===lc.proj&&(r.task||"")===(lc.task||"")&&((r.tc===undefined?d.tc:r.tc)||"")===lc.tc&&((r.func===undefined?d.func:r.func)||"")===lc.func;
  if(g.rows.some(same)){
    nt.err=`${lc.proj}${lc.task?" / "+lc.task:""} with these labor categories is already on this timecard. Enter hours on the existing row.`; renderNT(); return; }
  nt.busy=true; nt.err=""; renderNT();   // UKG validates the labor entry before the row appears
  setTimeout(()=>{
    if(!UI.nt) return;
    const id=uid("r"); g.rows.push({id,proj:lc.proj,task:lc.task,h:Array(7).fill(""),status:"Draft",note:"",archived:false,paycode:nt.paycode,tc:lc.tc,func:lc.func});
    S.audit.unshift({ts:nowTs(),who:PERSONAS[emp].name,emp,what:`Added transfer row ${lc.proj}${lc.task?" / "+lc.task:""}`,detail:`${nt.paycode} · ${[lc.tc,lc.func].filter(Boolean).join(" · ")}`,reason:""});
    ntClose(); persist(); render(); toast(`${lc.proj} added.`);
    setTimeout(()=>{ const r=document.querySelector(`[data-row="${id}"]`); if(r){ r.scrollIntoView({block:"center"}); r.classList.add("flash"); } },40);
  },600);
}
function ntPunchApply(){
  const nt=UI.nt, emp=S.persona, lc=nt.lc, d=laborDefaults(emp), L=liveState(emp);
  if(L.st==="brk"){ nt.err="End your break before transferring."; renderNT(); return; }
  const required=ntLaborValidate();
  if(required){ nt.err=required; renderNT(); return; }
  if(L.st==="out"){
    S.pendingPunchTransfers=S.pendingPunchTransfers||{};
    S.pendingPunchTransfers[emp]={project:lc.proj||"",task:lc.task||"",tc:lc.tc||"",func:lc.func||""};
    ntClose(); persist(); clearPunchNotice(); render();
    return;
  }
  const current=L.labor||d;
  if((current.project||"")===(lc.proj||"")&&(current.task||"")===(lc.task||"")&&(current.tc||"")===(lc.tc||"")&&(current.func||"")===(lc.func||"")){
    nt.err="Choose different labor category values for this transfer."; renderNT(); return;
  }
  addPunch(emp,"XFER",L.proj,L.task,"Punch",null,{project:lc.proj,task:lc.task,tc:lc.tc||"",func:lc.func||""});
  ntClose(); clearPunchNotice(); render();
}
function useRecentPunchTransfer(id){
  const emp=S.persona, L=liveState(emp), source=S.punches[emp].find(p=>p.id===id&&p.type==="XFER");
  if(!source) return;
  if(L.st==="brk"){ showPunchNotice("error",t("transferAfterBreak")); return; }
  const d=laborDefaults(emp), transfer={project:source.labor?.project||"",task:source.labor?.task||"",tc:source.labor?.tc??d.tc??"",func:source.labor?.func??d.func??""};
  const cat=LABOR.opts.proj.find(x=>x.v===transfer.project);
  if(!cat||cat.taskReq&&!transfer.task||transfer.task&&!cat.tasks.includes(transfer.task)){ showPunchNotice("error","This saved transfer has incomplete labor categories. Add a transfer and choose the current categories."); return; }
  if(L.st==="out"){
    S.pendingPunchTransfers=S.pendingPunchTransfers||{}; S.pendingPunchTransfers[emp]=transfer;
    persist(); showPunchNotice("success","Your next Punch In will use this transfer."); return;
  }
  const current=L.labor||d;
  if((current.project||"")===(transfer.project||"")&&(current.task||"")===(transfer.task||"")&&(current.tc||"")===(transfer.tc||"")&&(current.func||"")===(transfer.func||"")){
    showPunchNotice("error","You are already using this transfer."); return;
  }
  addPunch(emp,"XFER",L.proj,L.task,"Punch",null,transfer);
  clearPunchNotice(); render();
}
/* Click router for the drawer; returns true when the action belonged to it. */
function ntAction(a,el){
  const nt=UI.nt; if(!nt||!a||a.slice(0,2)!=="nt") return false;
  switch(a){
    case "ntStep": if(el.dataset.step==="transfer") nt.snap={...nt.lc}; if(el.dataset.step==="labor") nt.lcSnap={...nt.lc}; nt.step=el.dataset.step; nt.open=null; nt.q=""; nt.err=""; renderNT(); break;
    case "ntBack": if(nt.snap) nt.lc=nt.snap; nt.step="project"; nt.err=""; renderNT(); break;
    case "ntTransferOk": if(nt.intent==="punch") ntPunchApply(); else { nt.step="project"; nt.err=""; renderNT(); } break;
    case "ntLaborBack": if(nt.lcSnap) nt.lc=nt.lcSnap; nt.step="transfer"; nt.open=null; nt.err=""; renderNT(); break;
    case "ntLaborOk": { const e=ntLaborValidate(); if(e){ nt.err=e; renderNT(); break; } nt.step="transfer"; nt.open=null; nt.err=""; renderNT(); break; }
    case "ntOpen": nt.open=nt.open===el.dataset.kind?null:el.dataset.kind; nt.q=""; renderNT(); break;
    case "ntShowHid": nt.showHidden=el.dataset.val==="1"; renderNT(); break;
    case "ntHide": { const c=el.dataset.v, hid=isHidden(S.persona,c);
      setHidden(S.persona,c,!hid); if(!hid&&nt.lc.proj===c){ nt.lc.proj=""; nt.lc.task=""; } renderNT(); render(); toast(hid?`${c} is visible again.`:`${c} hidden. Find it under All.`); break; }
    case "ntPick": { const k=el.dataset.kind, punch=nt.intent==="punch"; if(k==="proj"&&!punch&&isHidden(S.persona,el.dataset.v)) setHidden(S.persona,el.dataset.v,false); nt.lc[k]=el.dataset.v; if(k==="proj"){const pr=punch?LABOR.opts.proj.find(x=>x.v===nt.lc.proj):PROJECTS[nt.lc.proj];if(!pr||!pr.tasks.includes(nt.lc.task)) nt.lc.task="";} nt.open=null; nt.q=""; nt.err=""; renderNT(); break; }
    case "ntClear": { const k=el.dataset.kind; nt.lc[k]=""; if(k==="proj") nt.lc.task=""; nt.open=null; renderNT(); break; }
    case "ntNA": toast("Not required for transfers in this release."); break;
    case "ntApply": ntApply(); break;
    default: return false;
  }
  return true;
}
