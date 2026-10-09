/* ---------- Dialogs ---------- */
function openDialog(title,body,foot){
  $("#layer").innerHTML=`<div class="overlay" data-act="ovl"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeDlg" aria-label="Close">${icon("x")}</button></header><div class="body">${body}</div><footer>${foot}</footer></div></div>`;
  setTimeout(()=>{ const f=$("#layer input:not([type=checkbox]),#layer select,#layer textarea"); f&&f.focus(); },30);
}
const closeDialog=()=>{ $("#layer").innerHTML=""; };
let tcDetailsTrigger=null;
function closeTcDetailsPopover(returnFocus=false){
  const pop=document.getElementById("tcDetailsPopover"), trigger=tcDetailsTrigger;
  if(pop) pop.remove();
  if(trigger) trigger.setAttribute("aria-expanded","false");
  if(trigger) trigger.removeAttribute("aria-controls");
  tcDetailsTrigger=null;
  if(returnFocus&&trigger&&trigger.isConnected) trigger.focus();
}
function tcDetailsMarkup(title,details,laborFields){
  return `<header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-act="closeTcDetails" aria-label="Close details">${icon("x",18)}</button></header>
    <dl class="tc-transfer-details">${details.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    <section class="tc-transfer-category"><h4>Labor category</h4>${laborFields.length?`<p class="tc-transfer-category-values">${esc(laborFields.map(([,value])=>value).join(", "))}</p>`:`<p class="sub">No labor category recorded.</p>`}</section>`;
}
function placeTcDetailsPopover(el,pop,point={}){
  tcDetailsTrigger=el; el.setAttribute("aria-expanded","true"); el.setAttribute("aria-controls","tcDetailsPopover");
  const margin=12, rect=el.getBoundingClientRect(), width=pop.offsetWidth, height=pop.offsetHeight, hasPoint=!!(point.x||point.y);
  let left=hasPoint?point.x:rect.left, top=hasPoint?point.y:rect.bottom+6;
  if(left+width>innerWidth-margin) left=innerWidth-width-margin;
  if(top+height>innerHeight-margin) top=hasPoint?Math.max(margin,(point.y||rect.bottom)-height):Math.max(margin,rect.top-height-6);
  pop.style.left=`${Math.max(margin,left)}px`; pop.style.top=`${Math.max(margin,top)}px`;
  if(point.focus) pop.querySelector("button:not(:disabled)")?.focus({preventScroll:true});
}
function openTcTransferPopover(el,point={}){
  closeTcDetailsPopover();
  const date=el.dataset.date, project=[el.dataset.project,el.dataset.projectName].filter(Boolean).join(" · ")||t("noProject");
  const task=el.dataset.task||"";
  const laborFields=[["Project",el.dataset.lcProject],["Task / LOB",el.dataset.lcTask],["Timecard Code",el.dataset.lcTimecode],["Function",el.dataset.lcFunction]].filter(([,value])=>value);
  const title="Transfer details", details=[["Date",fmtDay(date)],["Time",`${el.dataset.timeStart||"—"} – ${el.dataset.timeEnd||"—"}`],["Project",project],...(task?[["Task",task]]:[])];
  const pop=document.createElement("section");
  pop.id="tcDetailsPopover"; pop.className="tc-transfer-popover"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",title);
  pop.innerHTML=tcDetailsMarkup(title,details,laborFields);
  document.body.appendChild(pop);
  placeTcDetailsPopover(el,pop,point);
}
function openTcPunchPopover(el,point={}){
  closeTcDetailsPopover();
  const date=el.dataset.date, type=el.dataset.type||"Punch", time=el.dataset.time||"—";
  const laborFields=[["Project",el.dataset.lcProject],["Task / LOB",el.dataset.lcTask],["Timecard Code",el.dataset.lcTimecode],["Function",el.dataset.lcFunction]].filter(([,value])=>value);
  const details=[["Date",fmtDay(date)],["Time",time],["Punch",type],...(el.dataset.exceptions?[["Exceptions",el.dataset.exceptions]]:[])], title="Punch details";
  const pop=document.createElement("section");
  pop.id="tcDetailsPopover"; pop.className="tc-transfer-popover"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",title);
  pop.innerHTML=tcDetailsMarkup(title,details,laborFields);
  document.body.appendChild(pop);
  placeTcDetailsPopover(el,pop,point);
}
function dlgErr(m){ const e=$("#dlgErr"); if(e){ e.textContent=m; e.hidden=!m; } }
function punchDialog(date,p,preset){
  const emp=S.persona, A=assigned(emp);
  const type=p?p.type:(preset&&preset.type)||"IN", time=p?tsTime(p.t):(preset&&preset.time)||"", proj=p&&p.proj||(preset&&preset.proj)||A[0];
  const canEdit=S.settings.empEdit;
  openDialog(p?"Correct punch":"Add punch",`
    <div class="sub">${esc(fmtDay(date))} · ${esc(PERSONAS[emp].name)}</div>
    ${canEdit?"":`<div class="banner warn">Your organisation routes punch corrections to your manager. Your request is sent for review. ${uj("TC-04")}</div>`}
    <div class="two"><label class="field"><span>Type</span><select class="select" id="dType">${[["IN",t("in")],["OUT",t("out")],["XFER",t("transfer")],["BRK_S",t("startBreak")],["BRK_E",t("endBreak")]].map(([v,l])=>`<option value="${v}" ${v===type?"selected":""}>${esc(l)}</option>`).join("")}</select></label>
    <label class="field"><span>Time</span><input class="input" type="time" id="dTime" value="${time}"></label></div>
    <div class="two"><label class="field"><span>${esc(t("project"))} (In / Transfer)</span><select class="select" id="dProj">${A.map(c=>`<option value="${c}" ${c===proj?"selected":""}>${c} · ${esc(PROJECTS[c].name)}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("task"))}</span><select class="select" id="dTask">${PROJECTS[proj].tasks.map(x=>`<option ${p&&p.task===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label></div>
    <label class="field"><span>${esc(t("reason"))} (required)</span><select class="select" id="dReason"><option value="">Choose a reason…</option>${REASONS.map(r=>`<option>${esc(r)}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("comment"))}</span><textarea class="input" id="dNote" rows="2" placeholder="Optional"></textarea></label>
    <div class="err-text" id="dlgErr" hidden></div>`,
    `${p&&canEdit?`<button class="btn danger" data-act="delPunch" data-id="${p.id}" style="margin-right:auto">Delete punch</button>`:""}<button class="btn" data-act="closeDlg">${esc(t("cancel"))}</button><button class="btn primary" data-act="savePunch" data-id="${p?p.id:""}" data-date="${date}">${canEdit?esc(t("save")):"Send to manager"}</button>`);
}

