/* ---------- Rendering ---------- */
const $ = s => document.querySelector(s);
function persona(){ return PERSONAS[S.persona]; }
function pendingForOliver(){ return S.approvals.filter(a=>a.status==="Pending"&&PROJECTS[a.proj]&&PROJECTS[a.proj].approver==="oliver").length; }

function renderRail(){
  const P=persona(), items=P.views;
  const titles={home:t("home"),punch:t("punch"),timecard:t("timecard"),grid:t("grid"),kiosk:t("kiosk"),approvals:t("approvals"),journeys:t("journeys"),timeoff:t("timeoff")};
  const nav=v=>`<button class="nav ${S.view===v?"active":""}" data-act="nav" data-view="${v}" title="${esc(t(v))}">${icon(VIEW_ICON[v])}<span class="lbl">${esc(t(v))}</span>${v==="approvals"&&pendingForOliver()?`<span class="count">${pendingForOliver()}</span>`:""}</button>`;
  const personaOptions=Object.entries(PERSONAS).map(([k,p])=>`<option value="${k}" ${k===S.persona?"selected":""}>${esc(p.label)}</option>`).join("");
  $("#rail").innerHTML=`
    <div class="rail-head">
      <div class="brand"><span class="logo-chip"><img src="${LOGO_SRC}" alt="Spiro" width="104" height="53"></span><div><small>Time &amp; Operations</small></div></div>
      <div class="rail-mobile-context"><h1>${esc(titles[S.view])}</h1><small>${esc(P.name)} · ${esc(P.role)}</small></div>
      <button class="rail-menu" data-act="toggleRail" aria-controls="railBody" aria-expanded="${UI.railOpen}">${esc(t("menu"))}</button>
    </div>
    <div class="rail-body" id="railBody">
      <div class="rail-context"><div class="crumbs">${esc(P.name)} · ${esc(P.role)}</div><h1>${esc(titles[S.view])}</h1></div>
      <div class="rail-tools">
        <div class="rail-tool persona-tool"><label for="personaSelect" data-t="viewingAs">${esc(t("viewingAs"))}</label><select id="personaSelect" class="select persona-select" aria-label="Demo persona">${personaOptions}</select></div>
        <div class="rail-tool"><label for="langSelect" data-t="language">${esc(t("language"))}</label><select id="langSelect" class="select" aria-label="${esc(t("language"))}">
          <option value="en" ${S.lang==="en"?"selected":""}>English</option><option value="fr" ${S.lang==="fr"?"selected":""}>Français</option><option value="de" ${S.lang==="de"?"selected":""}>Deutsch</option><option value="nl" ${S.lang==="nl"?"selected":""}>Nederlands</option><option value="pl" ${S.lang==="pl"?"selected":""}>Polski</option>
        </select></div>
        <button class="rail-settings" id="settingsBtn" data-act="settings" aria-label="Demo settings" title="Demo settings">${icon("gear",18)}<span>Demo settings</span></button>
      </div>
      <nav class="rail-nav" aria-label="${esc(t("menu"))}">
        <div><div class="rail-label">${esc(t("timekeeping"))}</div>${items.map(nav).join("")}</div>
        <div><div class="rail-label">${esc(t("delivery"))}</div>${nav("journeys")}</div>
      </nav>
    </div>`;
  $("#rail").classList.toggle("open",UI.railOpen);
  document.documentElement.lang=S.lang;
  document.body.classList.toggle("hide-tags",!S.settings.tags);
  document.body.classList.toggle("hide-view-as",!!S.settings.hideViewAs);
  $("#shell").classList.toggle("ukg",S.view==="grid"||S.view==="timecard");
  $("#shell").classList.toggle("timeoff",S.view==="timeoff");
  $("#shell").classList.toggle("kiosk-mode",S.view==="kiosk");
}
function render(){
  if(!persona().views.includes(S.view)&&S.view!=="journeys") S.view=persona().land;
  renderRail();
  const V={home:viewHome,punch:viewPunch,timecard:viewTimecard,grid:viewGrid,kiosk:viewKiosk,approvals:viewApprovals,journeys:viewJourneys,timeoff:viewTimeOff}[S.view];
  $("#content").innerHTML=V();
  $("#content").classList.toggle("home-content",S.view==="home");
  if(S.view==="grid") updateGrid();
  persist();
}
/* Re-render without destroying focused inputs */
function softRender(){
  const a=document.activeElement;
  if(a&&(a.id==="scanInput"||a.id==="badgeInput")&&!$("#layer").innerHTML){ const id=a.id,val=a.value; render(); const n=document.getElementById(id); if(n){ n.value=val; n.focus(); } return; }
  if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.tagName==="SELECT")&&$("#content").contains(a)) { renderRail(); return; }
  if($("#layer").innerHTML) { renderRail(); return; }
  render();
}

/* Home */
const ht = key => (HOME_COPY[S.lang]||HOME_COPY.en)[key] || HOME_COPY.en[key] || key;
const homeFmtH = value => Number(value||0).toLocaleString(loc(),{minimumFractionDigits:0,maximumFractionDigits:2});

function homeProjectData(){
  const codes=S.persona==="oliver"
    ? Object.keys(PROJECTS).filter(code=>PROJECTS[code].approver==="oliver")
    : assigned(S.persona);
  return codes.map(code=>{
    const project=PROJECTS[code], totals=burn(code);
    return {code,project,actual:totals.used,estimate:totals.est,pct:totals.pct,remaining:totals.est-totals.used};
  }).filter(row=>row.project.active&&!row.project.startIn&&row.estimate>0)
    .sort((a,b)=>b.pct-a.pct||b.actual-a.actual);
}

function homeProjectRow(row){
  const pct=Math.max(0,row.pct), width=Math.min(100,pct);
  const state=pct>=100?"over":pct>=90?"near":pct>=75?"watch":"within";
  const stateLabel=ht(state==="over"?"overEstimate":state==="near"?"nearEstimate":state==="watch"?"watchEstimate":"withinEstimate");
  const remaining=row.remaining>=0?`${homeFmtH(row.remaining)} ${ht("hoursShort")}`:`${homeFmtH(Math.abs(row.remaining))} ${ht("hoursOver")}`;
  return `<li class="home-project-row">
    <div class="home-project-copy"><div class="home-project-name"><b>${esc(row.project.name)}</b><span class="home-project-code">${esc(row.code)}</span></div><div class="home-project-context">${esc(row.project.client)}${row.project.show&&row.project.show!=="—"?` <span aria-hidden="true">·</span> ${esc(row.project.show)}`:""}</div></div>
    <div class="home-project-measure"><div class="home-project-values"><span>${esc(ht("actualShort"))} <b class="num">${homeFmtH(row.actual)} h</b></span><span>${esc(ht("estimateShort"))} <b class="num">${homeFmtH(row.estimate)} h</b></span><span class="home-project-remaining">${esc(remaining)}</span></div>
      <div class="home-budget-track ${state}" role="img" aria-label="${esc(`${homeFmtH(row.actual)} ${ht("hoursActualOf")} ${homeFmtH(row.estimate)} ${ht("hoursEstimate")}. ${Math.round(pct)}%. ${stateLabel}. ${remaining}.`)}"><span class="home-budget-fill" style="width:${width}%"></span><i class="home-budget-tick tick-75" aria-hidden="true"></i><i class="home-budget-tick tick-90" aria-hidden="true"></i></div>
      <div class="home-project-state"><span class="home-state-label ${state}">${esc(stateLabel)}</span><span class="num">${Math.round(pct)}% ${esc(ht("used"))}</span></div>
    </div>
  </li>`;
}

function homeQuickActions(P){
  if(S.persona==="oliver") return [
    {view:"approvals",icon:"check",label:t("approvals"),detail:`${pendingForOliver()} ${ht("itemsWaiting")}`,primary:true},
    {view:"timeoff",icon:"cal",label:`${t("timeoff")} · ${toText("team")}`,detail:`${S.timeOff.requests.filter(r=>r.manager===S.persona&&r.emp!==S.persona&&r.status==="Submitted").length} ${ht("requestsWaiting")}`,team:true}
  ];
  const entry=P.views.includes("punch")?{view:"punch",icon:"clock",label:t("punch"),primary:true}
    :P.views.includes("grid")?{view:"grid",icon:"grid",label:t("grid"),primary:true}
    :{view:"kiosk",icon:"scan",label:t("kiosk"),primary:true};
  const actions=[entry,{view:"timeoff",icon:"cal",label:`${toText("new")} ${t("timeoff")}`,request:true}];
  if(P.views.includes("timecard")) actions.push({view:"timecard",icon:"table",label:t("viewTc")});
  else if(P.views.includes("grid")&&entry.view!=="grid") actions.push({view:"grid",icon:"grid",label:t("grid")});
  return actions;
}

function homeOpenTimeOff(team=false,request=false){
  toInit();
  UI.to.scope=team&&toManager()?"team":"mine";
  UI.to.screen="list"; UI.to.selected=null; UI.to.detailOpen=false;
  UI.to.filter=team?"Submitted":"all"; UI.to.typeFilter="all"; UI.to.employeeFilter="all";
  UI.to.from=""; UI.to.until=""; UI.to.error=null; UI.to.errors={};
  go("timeoff");
  if(request&&!team) toStart();
}

function homeTimeOffPanel(){
  if(S.persona==="oliver"){
    const requests=S.timeOff.requests.filter(r=>r.manager===S.persona&&r.emp!==S.persona&&r.status==="Submitted").sort((a,b)=>a.start.localeCompare(b.start)).slice(0,3);
    return `<section class="panel home-side-section home-team-leave"><header class="home-side-head"><div><h3>${esc(ht("teamRequests"))}</h3><p>${esc(ht("teamRequestsNote"))}</p></div><span class="home-count num">${S.timeOff.requests.filter(r=>r.manager===S.persona&&r.emp!==S.persona&&r.status==="Submitted").length}</span></header>
      ${requests.length?`<ul class="home-leave-list">${requests.map(r=>`<li><span class="home-leave-mark" aria-hidden="true">${icon("cal",16)}</span><span class="home-leave-copy"><b>${esc(toName(r.emp))}</b><small>${esc(toText(toType(r.type).label))} · ${esc(toDateRange(r))}</small></span><span class="home-leave-status">${esc(toText(r.status))}</span></li>`).join("")}</ul>`:`<p class="home-empty-note">${esc(ht("noPendingLeave"))}</p>`}
      <button class="home-text-action" data-act="homeTimeOff" data-team="true">${esc(`${t("timeoff")} · ${toText("team")}`)}${icon("right",15)}</button>
    </section>`;
  }
  const eligible=new Set(toEligibleTypes().map(type=>type.id));
  const balances=Object.entries(TO_SAMPLE.balances).filter(([type])=>eligible.has(type)).map(([type,balance])=>({type,balance}));
  const max=Math.max(...balances.map(x=>x.balance.amount));
  const current=parseYmd(todayStr()), periodStart=new Date(current.getFullYear(),current.getMonth(),1), periodEnd=new Date(current.getFullYear(),current.getMonth()+1,0);
  const periodStartLabel=periodStart.toLocaleDateString(loc(),{month:"short",day:"numeric",year:"numeric"}), periodEndLabel=periodEnd.toLocaleDateString(loc(),{month:"short",day:"numeric",year:"numeric"});
  const requests=S.timeOff.requests.filter(r=>r.emp===S.persona&&r.end>=todayStr()&&["Submitted","Approved"].includes(r.status)).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,2);
  return `<section class="panel home-side-section home-timeoff"><header class="home-side-head"><div><h3>${esc(ht("timeOffBalances"))}</h3><p>${esc(ht("availableHoursByType"))}</p></div><button class="icon-btn home-calendar-link" type="button" data-act="homeTimeOff" aria-label="${esc(ht("openTimeOff"))}" title="${esc(ht("openTimeOff"))}">${icon("right",17)}</button></header>
    <div class="home-reporting-period" aria-label="${esc(ht("reportingPeriod"))}"><span class="home-period-mark" aria-hidden="true">${icon("cal",16)}</span><div class="home-period-copy"><div class="home-period-kicker"><span>${esc(ht("reportingPeriod"))}</span><span class="home-period-scope"><i aria-hidden="true"></i>${esc(ht("calendarMonth"))}</span></div><div class="home-period-range"><time datetime="${ymd(periodStart)}">${esc(periodStartLabel)}</time><span aria-hidden="true">–</span><time datetime="${ymd(periodEnd)}">${esc(periodEndLabel)}</time></div></div></div>
    <div class="home-balance-context"><span aria-hidden="true"></span>${esc(ht("availableNow"))}</div>
    <ul class="home-balance-list">${balances.map(({type,balance})=>`<li><div class="home-balance-head"><span>${esc(toText(type))}</span><b class="num">${balance.amount.toLocaleString(loc())} ${esc(toText(balance.unit))}</b></div><div class="home-balance-track" aria-hidden="true"><span style="width:${Math.round(balance.amount/max*100)}%"></span></div></li>`).join("")}</ul>
    <div class="home-upcoming"><h4>${esc(ht("upcomingRequests"))}</h4>${requests.length?`<ul class="home-upcoming-list">${requests.map(r=>`<li><span><b>${esc(toText(toType(r.type).label))}</b><small>${esc(toDateRange(r))}</small></span>${toBadge(r.status)}</li>`).join("")}</ul>`:`<p class="home-empty-note">${esc(ht("noUpcomingLeave"))}</p>`}</div>
    <button class="home-text-action" data-act="homeTimeOff" data-request="true">${esc(`${toText("new")} ${t("timeoff")}`)}${icon("right",15)}</button>
  </section>`;
}

function viewHome(){
  const P=persona();
  toInit();
  const rows=homeProjectData(), totalEstimate=rows.reduce((sum,row)=>sum+row.estimate,0), totalActual=rows.reduce((sum,row)=>sum+row.actual,0);
  const totalRemaining=totalEstimate-totalActual, pct=totalEstimate?Math.max(0,totalActual/totalEstimate*100):0;
  const showAll=!!UI.homeShowAll, visible=showAll?rows:rows.slice(0,4);
  const actions=homeQuickActions(P);
  const date=new Date().toLocaleDateString(loc(),{weekday:"long",month:"long",day:"numeric"});
  return `<div class="home-screen">
      <header class="home-welcome"><div><h2>${esc(ht("greeting"))}, ${esc(P.short)}</h2><p>${esc(ht("intro"))}</p></div><time class="home-date" datetime="${todayStr()}">${esc(date)}</time></header>
    <div class="home-layout">
      <section class="home-primary" aria-label="${esc(ht("hoursByProject"))}">
        <section class="panel home-budget" aria-labelledby="home-budget-title">
          <header class="home-budget-head"><div><h3 id="home-budget-title">${esc(ht("budgetTitle"))}</h3><p>${esc(S.persona==="oliver"?ht("managedProjects"):ht("assignedProjects"))} · ${rows.length} ${esc(ht("projects"))}</p></div><span class="home-data-context">${esc(ht("dataContext"))}</span></header>
          ${rows.length?`<div class="home-budget-summary"><div><span>${esc(ht("actualTotal"))}</span><b class="num">${homeFmtH(totalActual)} <small>h</small></b></div><span class="home-summary-divider" aria-hidden="true">/</span><div><span>${esc(ht("estimateTotal"))}</span><b class="num">${homeFmtH(totalEstimate)} <small>h</small></b></div><div class="home-remaining"><span>${totalRemaining>=0?esc(ht("remainingTotal")):esc(ht("overTotal"))}</span><b class="num">${homeFmtH(Math.abs(totalRemaining))} <small>h</small></b></div></div>
          <div class="home-portfolio-track" role="img" aria-label="${esc(`${homeFmtH(totalActual)} ${ht("hoursActualOf")} ${homeFmtH(totalEstimate)} ${ht("hoursEstimate")}. ${Math.round(pct)}%.`)}"><span style="width:${Math.min(100,pct)}%"></span><i class="home-budget-tick tick-75" aria-hidden="true"></i><i class="home-budget-tick tick-90" aria-hidden="true"></i></div>
          <div class="home-chart-caption"><span>${esc(ht("actualShare"))} <b class="num">${Math.round(pct)}%</b></span><span>${esc(ht("thresholdGuide"))}</span></div>
          <div class="home-project-heading"><h4>${esc(ht("hoursByProject"))}</h4><span>${esc(ht("actualShort"))} / ${esc(ht("estimateShort"))}</span></div>
          <ul class="home-project-list">${visible.map(homeProjectRow).join("")}</ul>
          ${rows.length>4?`<button class="home-show-projects" type="button" data-act="homeProjectsToggle" aria-expanded="${showAll}">${esc(ht(showAll?"showLess":"showAll"))}<span class="num">${showAll?"−":"+"}</span></button>`:""}
          <footer class="home-budget-foot"><span>${icon("info",15)}${esc(ht("estimateNote"))}</span><span class="home-sample-note">${esc(ht("sampleNote"))}</span></footer>
          `:`<div class="home-budget-empty"><h4>${esc(ht("noProjects"))}</h4><p>${esc(ht("noProjectsNote"))}</p><button type="button" class="btn" data-act="nav" data-view="${P.views.includes("grid")?"grid":P.views.includes("punch")?"punch":"kiosk"}">${esc(P.views.includes("grid")?t("grid"):P.views.includes("punch")?t("punch"):t("kiosk"))}${icon("right",16)}</button></div>`}
        </section>
      </section>
      <aside class="home-aside" aria-label="${esc(ht("supportingWork"))}">
        <section class="panel home-side-section home-quick"><header class="home-side-head"><div><h3>${esc(ht("quickActions"))}</h3><p>${esc(ht("quickActionsNote"))}</p></div></header>
          <ul class="home-action-list">${actions.map(action=>`<li><button type="button" class="home-action ${action.primary?"primary":""}" data-act="${action.team||action.request?"homeTimeOff":"nav"}" ${action.team?`data-team="true"`:action.request?`data-request="true"`:`data-view="${action.view}"`}><span class="home-action-icon">${icon(action.icon,18)}</span><span class="home-action-copy"><b>${esc(action.label)}</b>${action.detail?`<small>${esc(action.detail)}</small>`:""}</span>${icon("right",16)}</button></li>`).join("")}</ul>
        </section>
        ${homeTimeOffPanel()}
        ${S.persona==="oliver"?`<section class="home-approval-note"><span>${icon("info",16)}</span><p>${esc(ht("approvalScopeNote"))}</p><button type="button" data-act="nav" data-view="approvals">${esc(t("approvals"))}</button></section>`:""}
      </aside>
    </div>
  </div>`;
}

/* Punch */
function punchOdooProjectOptions(codes,selected,query){
  const q=(query||"").trim().toLocaleLowerCase();
  const matches=codes.filter(code=>{ const p=PROJECTS[code]; return !q||[code,p.name,p.client,p.show].filter(Boolean).join(" ").toLocaleLowerCase().includes(q); });
  return `<button type="button" class="punch-odoo-option ${selected?"":"is-selected"}" role="option" aria-selected="${selected?"false":"true"}" data-act="selectOdooPunchProject" data-code=""><span class="punch-odoo-option-check" aria-hidden="true">${selected?"":icon("check",15)}</span>${esc(t("noProject"))}</button>
    ${matches.map(code=>{const p=PROJECTS[code],isSelected=code===selected;return `<button type="button" class="punch-odoo-option ${isSelected?"is-selected":""}" role="option" aria-selected="${isSelected?"true":"false"}" data-act="selectOdooPunchProject" data-code="${esc(code)}"><span class="punch-odoo-option-check" aria-hidden="true">${isSelected?icon("check",15):""}</span><span class="punch-odoo-option-copy"><b>${esc(code)} · ${esc(p.name)}</b><small>${esc(p.client)}</small></span></button>`;}).join("")||`<p class="sub punch-odoo-empty">No matching active projects.</p>`}`;
}
function punchOdooProjectPicker(codes,selected){
  const p=selected&&PROJECTS[selected], label=p?`${selected} · ${p.name}`:t("noProject");
  return `<div class="field punch-project-field"><span id="punchOdooProjectLabel">${esc(t("odooProject"))} <small>${esc(t("optional"))}</small></span><div class="punch-project-picker">
    <button type="button" id="punchOdooProjectTrigger" class="select punch-project-trigger" role="combobox" aria-labelledby="punchOdooProjectLabel punchOdooProjectValue" aria-haspopup="listbox" aria-controls="punchOdooOptions" aria-expanded="${UI.punchOdooOpen?"true":"false"}" data-act="toggleOdooPunchProject"><span id="punchOdooProjectValue">${esc(label)}</span>${icon("down",16)}</button>
    ${UI.punchOdooOpen?`<div class="punch-project-menu" id="punchOdooProjectMenu"><input type="search" id="punchOdooSearch" class="input punch-project-search" data-act="punchOdooSearch" aria-label="Search active Odoo projects" placeholder="Search projects" autocomplete="off" value="${esc(UI.punchOdooQuery)}"><div class="punch-odoo-options" id="punchOdooOptions" role="listbox" aria-label="Active Odoo projects">${punchOdooProjectOptions(codes,selected,UI.punchOdooQuery)}</div><div class="punch-project-manage"><button type="button" class="linkish" data-act="manageOdooProjects">${icon("gear",16)}<span>Manage Odoo Project</span></button></div></div>`:""}
    </div></div>`;
}
function viewPunch(){
  const emp=S.persona, L=liveState(emp), A=assigned(emp).filter(c=>!isPunchOdooHidden(emp,c));
  const pending=(S.pendingPunchTransfers||{})[emp]||null;
  const selProj=S._selProj&&A.includes(S._selProj)?S._selProj:"";
  const tasks=selProj?PROJECTS[selProj].tasks:[];
  const selTask=S._selTask&&tasks.includes(S._selTask)?S._selTask:"";
  const history=[...S.punches[emp]].reverse().sort((a,b)=>b.t.localeCompare(a.t));
  const recent=history.slice(0,6);
  const recentTransfers=[], seenTransfers=new Set();
  history.filter(p=>{
    if(p.type!=="XFER"||!p.labor) return false;
    const cat=LABOR.opts.proj.find(x=>x.v===p.labor.project);
    return !!cat&&(!cat.taskReq||!!p.labor.task)&&(!p.labor.task||cat.tasks.includes(p.labor.task));
  }).forEach(p=>{
    const key=JSON.stringify([p.labor.project||"",p.labor.task||"",p.labor.tc||"",p.labor.func||""]);
    if(!seenTransfers.has(key)){seenTransfers.add(key);recentTransfers.push(p);}
  });
  const typeL={IN:t("punchIn"),OUT:t("punchOut"),BRK_S:t("startBreak"),BRK_E:t("endBreak"),XFER:t("transfer")};
  const laborText=p=>p.labor?[LABOR.opts.proj.find(x=>x.v===p.labor.project)?.l||p.labor.project,laborTaskName(p.labor.task),p.labor.tc,p.labor.func].filter(Boolean).join(" · "):"";
  const taskSel=`<select id="selTask" class="select" data-act="selTask" ${selProj?"":"disabled"}><option value="">${esc(t("noTask"))}</option>${tasks.map(x=>`<option value="${esc(x)}" ${x===selTask?"selected":""}>${esc(x)}</option>`).join("")}</select>`;
  const projectPicker=punchOdooProjectPicker(A,selProj);
  const last=recent[0];
  const pendingCategory=pending&&LABOR.opts.proj.find(x=>x.v===pending.project);
  const pendingLabel=pending?[pendingCategory?pendingCategory.l:pending.project,laborTaskName(pending.task),pending.tc,pending.func].filter(Boolean).join(" · "):"";
  const punchAction=L.st==="out"?"punchIn":"punchOut";
  const transferDisabled=L.st==="brk";
  const noRecentTransfers=recentTransfers.length===0;
  const recentTransferHint=transferDisabled?t("transferAfterBreak"):noRecentTransfers?t("noRecentTransfers"):"Choose a recent transfer to use now or with your next punch.";
  return `
  ${S.settings.simDuplicatePunchError?`<div class="banner err">${icon("x")}<div><b>UKG duplicate-punch error simulation is armed.</b> The next Punch In or Punch Out will display the error returned by UKG. ${uj("PU-08")}</div></div>`:""}
  <div class="punch-screen">
    <section class="panel punch-card" data-hl="punch-in">
      <div class="panel-head"><h2>${esc(t("punch"))}${uj("PU-01,PU-02,PU-06")}</h2></div>
      <div class="panel-body punch-tile-body">
        <div class="punch-last"><span>${esc(t("lastPunch"))}: <strong>${last?`${esc(fmtDay(tsDate(last.t)))} ${esc(fmtClock(tsTime(last.t)))}`:"—"}</strong></span><button class="icon-btn punch-info" type="button" title="The date and time of your most recent punch." aria-label="${esc(t("lastPunch"))} information">${icon("info",19)}</button></div>
        <div class="punch-transfer-row">
          <select id="recentTransfer" class="select punch-recent-transfer" data-act="recentTransfer" ${transferDisabled||noRecentTransfers?"disabled":""} ${transferDisabled?`title="${esc(t("transferAfterBreak"))}"`:noRecentTransfers?`title="${esc(t("noRecentTransfers"))}"`:""} aria-label="${esc(t("recentTransfers"))}">
            <option value="">${esc(noRecentTransfers?t("noRecentTransfers"):t("recentTransfers"))}</option>
            ${recentTransfers.map(p=>{const cat=LABOR.opts.proj.find(x=>x.v===p.labor.project), desc=[cat?cat.l:p.labor.project,laborTaskName(p.labor.task),p.labor.tc,p.labor.func].filter(Boolean).join(" · ")||t("transfer");return `<option value="${esc(p.id)}">${esc(desc)} · ${esc(fmtDay(tsDate(p.t)))}</option>`;}).join("")}
          </select>
          <button class="icon-btn punch-info" type="button" title="${esc(recentTransferHint)}" aria-label="${esc(t("recentTransfers"))} information">${icon("info",19)}</button>
        </div>
        <button class="punch-add-transfer" data-act="startXfer" data-hl="punch-transfer" ${transferDisabled?`disabled title="${esc(t("transferAfterBreak"))}"`:""}>${icon("plus",20)}<span>${esc(t("addTransfer"))}</span></button>
        ${pending?`<p class="punch-pending-note"><b>${esc(t("laborCategory"))}:</b> ${esc(pendingLabel||"—")}</p>`:""}
        ${L.st==="out"?`<div class="punch-odoo-section"><div class="two punch-optional-fields">${projectPicker}<label class="field"><span>${esc(t("odooTask"))} <small>${esc(t("optional"))}</small></span>${taskSel}</label></div>
          <div class="sub">Only active Odoo projects available to you are listed. ${uj("PU-05")}</div></div>`:""}
        <div class="punch-action-bar ${L.st!=="out"?"has-break":""}">
          <button class="btn punch-submit ${L.st==="brk"?"is-secondary":""}" data-act="${punchAction}" data-hl="${punchAction==="punchIn"?"punch-in":"punch-out"}" aria-label="${esc(t(punchAction))}">${esc(t(punchAction))}</button>
          ${L.st!=="out"?`<button class="btn punch-break ${L.st==="brk"?"is-primary":""}" data-act="${L.st==="brk"?"endBrk":"startBrk"}" data-hl="punch-break" aria-label="${esc(L.st==="brk"?t("endBreak"):t("startBreak"))}"><span>${esc(L.st==="brk"?t("endBreak"):t("startBreak"))}</span>${uj("PU-03")}</button>`:""}
        </div>
      </div>
    </section>
    <section class="panel punch-history" data-hl="recent-punches">
      <div class="panel-head"><h2>${esc(t("recent"))}${uj("PU-07")}</h2><button class="btn sm" data-act="nav" data-view="timecard">${icon("table",16)}${esc(t("viewTc"))}</button></div>
      <div class="panel-body"><ol class="punch-history-list">${recent.map(p=>`<li class="punch-history-item"><time class="punch-history-time" datetime="${esc(p.t.replace(" ","T"))}">${esc(fmtClock(tsTime(p.t)))}</time><div class="punch-history-copy"><div class="punch-history-heading"><strong>${esc(typeL[p.type])}</strong><span>${esc(fmtDay(tsDate(p.t)))}</span></div>${p.proj&&(p.type==="IN"||p.type==="XFER")?`<p class="punch-history-detail"><span>${esc(t("odooProject"))}:</span> ${esc(p.proj)}${p.task?`<br><span>${esc(t("odooTask"))}:</span> ${esc(p.task)}`:""}</p>`:""}${laborText(p)?`<p class="punch-history-detail"><span>${esc(t("laborCategory"))}:</span> ${esc(laborText(p))}</p>`:""}${p.src!=="Seed"&&p.src!=="Punch"?`<p class="punch-history-detail">${esc(p.src)}</p>`:""}</div></li>`).join("")}</ol>${recent.length?"":`<p class="sub">No punches yet.</p>`}</div>
      <div class="punch-history-footer"><span>Demo: <button class="linkish" data-act="armPunchError" data-hl="sim-punch-error">simulate a duplicate-punch error from UKG</button> ${uj("PU-08")}</span></div>
    </section>
  </div>`;
}

/* Timecard */
function viewTimecard(){
  const emp=S.persona, off=S.period, days=buildPeriod(emp,off), pk=periodKey(off), P=persona();
  const appr=(S.tcAppr[emp]||{})[pk]; const locked=!!appr;
  let rows="";
  days.forEach(d=>{
    const dow=parseYmd(d.date).getDay(), wk=dow===0||dow===6, isT=d.date===todayStr();
    const segs=d.segs.length?d.segs:[null];
    const excCodes=new Set(d.exc.map(e=>e.code));
    segs.forEach((s,i)=>{
      const first=i===0,last=i===segs.length-1;
      const inPunch=s&&s.in.p, outPunch=s&&s.out&&s.out.p;
      const lateCell=s&&first&&excCodes.has("LATE_IN")?"x-warn":"";
      const brkCell=s&&d.exc.find(e=>e.code==="SHORT_BREAK"&&inPunch&&e.pid===inPunch.id)?"x-warn":"";
      const earlyCell=s&&last&&excCodes.has("EARLY_OUT")&&outPunch&&d.exc.find(e=>e.code==="EARLY_OUT"&&e.pid===outPunch.id)?"x-warn":"";
      const projectCode=s&&s.proj||"", projectName=PROJECTS[projectCode]?.name||"", taskLabel=s&&s.task||"", labor=s&&(s.labor||laborDefaults(emp))||{};
      const lobLabel=labor.task?laborTaskName(labor.task):"", laborProject=LABOR.opts.proj.find(x=>x.v===labor.project)?.l||labor.project||"";
      const punchLabel=p=>({IN:t("punchIn"),OUT:t("punchOut"),XFER:t("transfer"),BRK_S:t("startBreak"),BRK_E:t("endBreak")}[p.type]||p.type);
      const punchAttrs=(p)=>{
        const time=fmtClock(tsTime(p.t)), kind=punchLabel(p);
        const exceptions=d.exc.filter(x=>x.pid===p.id||(!x.pid&&x.code==="UNSCHEDULED")).map(x=>x.label);
        return `data-act="tcPunchMenu" data-id="${esc(p.id)}" data-date="${esc(d.date)}" data-time="${esc(time)}" data-type="${esc(kind)}" data-exceptions="${esc(exceptions.join(", "))}" data-lc-project="${esc(laborProject)}" data-lc-task="${esc(lobLabel)}" data-lc-timecode="${esc(labor.tc||"")}" data-lc-function="${esc(labor.func||"")}" data-locked="${locked}" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(`${kind} at ${time}. Open punch details`)}" title="Open punch details"`;
      };
      const inBtn=s?`<button type="button" class="cell-btn tc-punch-cell ${lateCell||brkCell} ${inPunch.src==="Edit"||inPunch.edited?"edited":""}" ${punchAttrs(inPunch)}>${fmtClock(s.in.t)}${s.in.kind==="Break end"?' <span class="sub">(brk)</span>':""}</button>`:`<div class="c"></div>`;
      const transferLabel=[projectCode,taskLabel,lobLabel&&lobLabel!==taskLabel?lobLabel:""].filter(Boolean).join(" · ")||t("noProject");
      const xfer=s?`<button type="button" class="tc-transfer-cell" data-act="tcTransferMenu" data-date="${esc(d.date)}" data-id="${esc(inPunch&&inPunch.id||"")}" data-time-start="${esc(fmtClock(s.in.t))}" data-time-end="${esc(s.out?fmtClock(s.out.t):s.live?"In progress":s.missing?t("missed"):"—")}" data-project="${esc(projectCode)}" data-project-name="${esc(projectName)}" data-task="${esc(taskLabel)}" data-lob="${esc(lobLabel)}" data-lc-project="${esc(laborProject)}" data-lc-task="${esc(lobLabel)}" data-lc-timecode="${esc(labor.tc||"")}" data-lc-function="${esc(labor.func||"")}" data-locked="${locked}" aria-haspopup="dialog" aria-expanded="false" aria-label="Transfer details: ${esc(transferLabel)}"><span class="tc-transfer-line">${s.in.kind==="Transfer"?icon("xfer",15):""}<span class="tc-transfer-label">${esc(transferLabel)}</span></span></button>`:`<div class="c"></div>`;
      const outBtn=!s?`<div class="c"></div>`:s.live?`<div class="c"><span class="chip ok"><span class="dot"></span>In progress</span></div>`:s.missing?`<div class="c x-miss"><span>${esc(t("missed"))}</span></div>`:`<button type="button" class="cell-btn tc-punch-cell ${earlyCell} ${outPunch.src==="Edit"||outPunch.edited?"edited":""}" ${punchAttrs(outPunch)}>${fmtClock(s.out.t)}${s.out.kind==="Break"?' <span class="sub">(brk)</span>':""}</button>`;
      rows+=`<tr class="${first?"day-first":""} ${wk?"weekend":""} ${isT?"today":""} ${locked?"locked":""}">
        <td class="date-col">${first?`<div class="c"><b style="font-weight:600;white-space:nowrap">${esc(fmtDay(d.date))}</b></div>`:`<div class="c"></div>`}</td>
        <td>${inBtn}</td><td>${xfer}</td><td>${outBtn}</td>
        <td><div class="c tot num">${s&&s.hours?fmtH(s.hours):""}</div></td>
        <td><div class="c tot num">${last&&d.daily?fmtH(d.daily):""}</div></td>
        <td><div class="c tot num">${last&&d.cum&&(d.date<=todayStr())?fmtH(d.cum):""}</div></td>
      </tr>`;
    });
  });
  return `
  <div class="tc-screen">
    <div class="ukg-emp tc-emp">
      <div class="tc-emp-identity">
        <span class="avatar">${esc(P.initials)}</span>
        <b class="tc-emp-name">${esc(P.name)}</b>
        <span class="ukg-id">${icon("info",18)}${esc(P.role)}</span>
      </div>
      <div class="ukg-emp-r tc-load-meta">
        <span class="tc-load-period">${icon("cal",18)}<b class="num">${esc(fmtRange(off))}${uj("TC-01,TC-02")}</b></span>
        <span class="tc-loaded"><button type="button" class="tc-load-refresh" data-act="refreshTc" aria-label="Refresh timecard">${icon("refresh",18)}</button><span>Loaded ${esc(fmtClock(hm(new Date())))}</span></span>
      </div>
    </div>
    <div class="ukg-toolbar tc-toolbar">
      <div class="ukg-toolbar-group" role="group" aria-label="${esc(t("period"))}">
        <button class="ukg-tb" data-act="per" data-d="-1" aria-label="Previous period" ${off<=-1?"disabled":""}>${icon("left",20)}<span>Previous</span></button>
        <button class="ukg-tb" data-act="gToday" aria-label="Today" ${off===0?"disabled":""}>${icon("cal",20)}<span>${esc(t("today"))}</span></button>
        <button class="ukg-tb" data-act="per" data-d="1" aria-label="Next period" ${off>=0?"disabled":""}>${icon("right",20)}<span>Next</span></button>
      </div>
    </div>
    ${locked?`<div class="tc-state banner info" role="status">${icon("check")}<div>This timecard is approved and read-only.</div></div>`:""}
    <div class="scroll-x tc-table-wrap" data-hl="timecard-grid"><table class="tc ukg-tc ${locked?"approved-tc":""}"><thead><tr><th class="date-col" scope="col">${esc(t("date"))}</th><th scope="col">${esc(t("in"))}</th><th scope="col">${esc(t("transfer"))} (${esc(t("project"))} / ${esc(t("task"))})</th><th scope="col">${esc(t("out"))}</th><th class="r" scope="col">${esc(t("hours"))}</th><th class="r" scope="col">${esc(t("daily"))}</th><th class="r" scope="col">${esc(t("cum"))}</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${timecardTotals(emp,days)}
  </div>`;
}
function timecardTotals(emp,days){
  const by={}; days.forEach(d=>d.segs.forEach(s=>{ if(!s.hours) return; const k=`${s.proj||""}|${s.task||""}`; by[k]=(by[k]||0)+s.hours; }));
  const total=days[6].cum;
  return `<section class="tc-totals"><header class="tc-totals-head"><h2>${esc(t("totals"))}</h2><span class="sub">Project hours by project and task</span></header><div class="tc-total-grid" data-hl="totals"><div><h3>By project and task ${uj("TC-07")}</h3>
      <table class="plain"><thead><tr><th>${esc(t("project"))}</th><th>${esc(t("task"))}</th><th class="r">${esc(t("hours"))}</th></tr></thead><tbody>${Object.entries(by).map(([k,v])=>{const[p,tk]=k.split("|"), project=PROJECTS[p];return `<tr><td><b>${esc(p||t("noProject"))}</b>${project?` <span class="sub">${esc(project.name)}</span>`:""}</td><td>${esc(tk)}</td><td class="r num">${fmtH(v)}</td></tr>`}).join("")||`<tr><td colspan="3" class="sub">No hours in this period.</td></tr>`}</tbody><tfoot><tr><td colspan="2"><b>${esc(t("total"))}</b></td><td class="r num"><b>${fmtH(total)}</b></td></tr></tfoot></table></div></div></section>`;
}
function syncTable(tx){
  return `<div data-hl="sync" class="scroll-x"><table class="plain" style="min-width:680px"><thead><tr><th>When</th><th>Action</th><th>Endpoint</th><th>Payload</th><th>${esc(t("status"))} ${uj("PU-07,PU-08")}</th><th>Ref</th></tr></thead><tbody>${tx.map(x=>`<tr><td class="num" style="white-space:nowrap">${esc(x.ts.slice(11))}</td><td>${esc(x.action)}</td><td class="mono">${esc(x.endpoint)}</td><td class="mono">${esc(x.summary)}</td><td>${syncChip(x.id)}</td><td class="mono">${esc(x.ref)}</td></tr>`).join("")||`<tr><td colspan="6" class="sub">No transactions sent in this session yet. Punch, edit, submit or approve to see calls to UKG.</td></tr>`}</tbody></table></div>`;
}

/* Project hours grid */
const num = v => { if(v===""||v==null) return 0; const n=Number(String(v).trim().replace(",",".")); return isNaN(n)?NaN:n; };
function gridWeek(emp,off){
  const pk=periodKey(off); S.grid[emp]=S.grid[emp]||{};
  if(!S.grid[emp][pk]){ // GR-02 auto-populate from assignments
    S.grid[emp][pk]={rows:assigned(emp).filter(c=>!isHidden(emp,c)).map(c=>({id:uid("r"),proj:c,task:PROJECTS[c].taskReq?"":PROJECTS[c].tasks[0],h:Array(7).fill(""),status:"Draft",note:"",archived:false})),auto:true};
  }
  return S.grid[emp][pk];
}
function viewGrid(){
  const emp=S.persona, off=S.period, g=gridWeek(emp,off), days=periodDays(off), P=persona();
  const future=off>0, isSal=P.type==="salary", locked=off!==0;   // only the current pay period is editable
  const key=emp+":"+off; if(UI.gKey!==key){ UI.gKey=key; UI.gDirty.clear(); }
  const vis=g.rows.filter(r=>!r.archived);
  const editable=r=>!locked&&r.status!=="Approved"&&!r.archived;   // approved = signed off
  const missing=days.slice(0,5).filter((d,i)=>d<todayStr()&&g.rows.every(r=>!num(r.h[i]))).length;
  const dayHead=d=>{ const x=parseYmd(d); return `${x.toLocaleDateString(loc(),{weekday:"short"})} ${pad(x.getMonth()+1)}/${pad(x.getDate())}`; };
  const tb=(act,ico,label,o={})=>`<button class="ukg-tb ${o.cls||""} ${o.iconOnly?"icon-only":""}" data-act="${act}" ${o.hl?`data-hl="${o.hl}"`:""} ${o.dis?"disabled":""} ${o.hide?"hidden":""} ${o.iconOnly?`aria-label="${esc(label)}" title="${esc(label)}"`:""}><i class="ukg-ic">${icon(ico,26)}${o.badge?`<b class="ukg-badge" aria-label="${o.badge} hidden">${o.badge}</b>`:""}</i>${o.iconOnly?"":`<span>${esc(label)}</span>`}</button>`;
  return `
  <div class="ukg-emp"><span class="avatar">${esc(P.initials)}</span><b>${esc(P.name)}</b><span class="ukg-id">${icon("info",18)}${esc(P.role)}</span>
    <span class="ukg-emp-r">${icon("cal",20)}<b class="num">${esc(fmtRange(off))}</b>${icon("refresh",20)}<span id="savedAt">${g.savedAt?`Saved ${esc(g.savedAt)}`:`Loaded ${esc(fmtClock(hm(new Date())))}`}</span></span></div>
  <div class="ukg-toolbar">
    <div class="ukg-toolbar-group" role="group" aria-label="${esc(t("period"))}">
      ${tb("per","left","Previous",{dis:off<=-1}).replace('data-act="per"','data-act="per" data-d="-1"')}
      ${tb("gToday","cal",t("today"),{dis:off===0})}
      ${tb("per","right","Next",{dis:off>=1}).replace('data-act="per"','data-act="per" data-d="1"')}
    </div>
    <span class="ukg-sep" role="separator" aria-orientation="vertical"></span>
    <div class="ukg-toolbar-group" role="group" aria-label="${esc(t("manage"))}">
      ${tb("addRow","plusc",t("addNew"),{hl:"grid-add",dis:locked,cls:"blue"})}
      ${tb("mpOpen","eye","Projects",{badge:hiddenCount(emp),cls:"blue"})}
    </div>
    <span class="ukg-gap"></span>
    ${tb("saveGrid","save",t("save"),{hl:"grid-submit",cls:"ghost",hide:!UI.gDirty.size,iconOnly:true})}
  </div>
  ${!future&&missing&&S.period===0?`<div class="banner warn ukg-bn" data-hl="reminder">${icon("clock")}<div><b>Reminder:</b> ${missing} weekday${missing>1?"s":""} this week ${missing>1?"have":"has"} no hours yet. Time is due Friday at 17:00.</div></div>`:""}
  ${g.rows.some(r=>r.status==="Rejected")?`<div class="banner err ukg-bn">${icon("x")}<div><b>A Line Manager / Project Owner returned a line.</b> Read the note on the red row, fix it, then submit again.</div></div>`:""}
  <div class="scroll-x" data-hl="grid"><table class="hg ukg-grid"><thead><tr><th class="projh" scope="col">${esc(t("project"))}</th>${days.map(d=>`<th class="${d===todayStr()?"today":""}" scope="col">${esc(dayHead(d))}</th>`).join("")}<th scope="col">Week</th><th scope="col">Timeframe</th></tr></thead>
    <tbody>${vis.map(r=>{ const pr=PROJECTS[r.proj]; const ed=editable(r);
      return `<tr data-row="${r.id}" class="${r.status==="Rejected"?"row-rej":""}">
      <td class="proj"><div class="proj-top"><span><b>${r.proj}</b> ${esc(pr.name)}</span></div>
        ${r.note?`<div class="sub" style="color:var(--err);margin-top:4px"><b>Note from approver:</b> ${esc(r.note)}</div>`:""}</td>
      ${r.h.map((v,i)=>`<td class="c cell ${ed?"":"ro"} ${days[i]===todayStr()?"today":""}"><input class="h" inputmode="decimal" data-act="h" data-row="${r.id}" data-i="${i}" value="${esc(v===""?"":String(v).replace(/[.,]/,(1.5).toLocaleString(loc()).charAt(1)))}" aria-label="${esc(r.proj)} ${esc(fmtDay(days[i]))} ${esc(t("hours"))}" ${ed?"":"disabled"}></td>`).join("")}
      <td class="c num tot" data-rt="${r.id}"><b></b></td><td class="c num tot" data-rt="${r.id}"><b></b></td></tr>`;}).join("")||`<tr><td colspan="10" class="sub" style="padding:16px">No rows. Choose Add new to start.</td></tr>`}</tbody>
    <tfoot><tr><td>Daily total</td>${days.map((d,i)=>`<td class="c num" data-dt="${i}"></td>`).join("")}<td class="c num" data-gt></td><td class="c num" data-gt></td></tr></tfoot></table></div>
  <ul class="errs" id="gridErrs" hidden></ul>
  ${(()=>{ const all=assigned(emp).length, hid=hiddenCount(emp);
    return `<div class="vis-bar ${hid?"has":""}">${icon(hid?"eyeoff":"eye",18)}<span>${hid?`Showing <b>${all-hid} of ${all}</b> assigned projects. ${hid} hidden (upcoming or paused).`:`All <b>${all}</b> assigned projects are showing.`}</span><button class="btn sm" data-act="mpOpen">Manage projects</button>`; })()}</div>`;
}
function gridValidate(g,strict){
  const errs=[], bad=new Set(), badTask=new Set(), dayBad=new Set();
  const dayTot=Array(7).fill(0);
  g.rows.filter(r=>!r.archived).forEach(r=>{
    r.h.forEach((v,i)=>{ const n=num(v); if(v!==""&&(isNaN(n)||n<0)){ bad.add(r.id+":"+i); errs.push(`${r.proj}: "${v}" is not a valid number of hours.`);} else if(v!==""&&!/^\d+([.,]\d{1,2})?$/.test(String(v).trim())){ bad.add(r.id+":"+i); errs.push(`${r.proj}: use at most 2 decimals.`);} else dayTot[i]+=n||0; });
    const rt=r.h.reduce((a,v)=>a+(num(v)||0),0);
    if(strict&&rt>0&&PROJECTS[r.proj].taskReq&&!r.task&&r.status!=="Approved"){ badTask.add(r.id); errs.push(`${r.proj} needs a task. Choose one before submitting.`); }
  });
  dayTot.forEach((v,i)=>{ if(v>24){ dayBad.add(i); errs.push(`${fmtDayShort(periodDays(S.period)[i])}: day total cannot exceed 24 hours.`);} });
  return {errs:[...new Set(errs)],bad,badTask,dayBad,dayTot};
}
function updateGrid(){
  const g=gridWeek(S.persona,S.period), v=gridValidate(g,UI.submitTried);
  g.rows.forEach(r=>{ document.querySelectorAll(`[data-rt="${r.id}"] b`).forEach(c=>c.textContent=fmtH(r.h.reduce((a,x)=>a+(num(x)||0),0))); });
  v.dayTot.forEach((x,i)=>{ const c=document.querySelector(`[data-dt="${i}"]`); if(c){ c.textContent=fmtH(x); c.classList.toggle("daybad",v.dayBad.has(i)); } });
  document.querySelectorAll("[data-gt]").forEach(gt=>gt.textContent=fmtH(v.dayTot.reduce((a,b)=>a+b,0)));
  document.querySelectorAll("input.h").forEach(inp=>inp.classList.toggle("bad",v.bad.has(inp.dataset.row+":"+inp.dataset.i)||v.dayBad.has(+inp.dataset.i)&&inp.value!==""));
  document.querySelectorAll("select.task").forEach(s=>s.classList.toggle("bad",v.badTask.has(s.dataset.row)));
  const sb=document.querySelector('[data-act="saveGrid"]'); if(sb) sb.hidden=!UI.gDirty.size;
  const ul=$("#gridErrs"); if(ul){ ul.hidden=!v.errs.length; ul.innerHTML=v.errs.map(e=>`<li>${esc(e)}</li>`).join(""); }
  return v;
}

/* Approvals (Line Manager / Project Owner) */
function burn(code){
  const p=PROJECTS[code]; const appr=S.approvals.filter(a=>a.proj===code&&a.status==="Approved").reduce((x,a)=>x+a.hours,0);
  const pend=S.approvals.filter(a=>a.proj===code&&a.status==="Pending").reduce((x,a)=>x+a.hours,0);
  const used=p.used+appr; return {est:p.est,used,pend,pct:p.est?used/p.est*100:0,proj:p.est?(used+pend)/p.est*100:0};
}
function viewApprovals(){
  const mine=S.approvals.filter(a=>PROJECTS[a.proj].approver==="oliver");
  const list=mine.filter(a=>UI.apFilter==="All"||a.status===UI.apFilter);
  const groups={}; list.forEach(a=>(groups[a.proj]=groups[a.proj]||[]).push(a));
  const counts=s=>mine.filter(a=>s==="All"||a.status===s).length;
  const sel=[...UI.apSel].filter(id=>list.some(a=>a.id===id&&a.status==="Pending"));
  return `
  <div class="banner info">${icon("check")}<div>Showing hourly project time for projects where <b>you are the Line Manager / Project Owner</b>. This is separate from the HR reporting line and from UKG timecard sign-off.</div></div>
  <section class="panel" data-hl="approvals">
    <div class="tc-toolbar">
      <div class="tabs" style="border:0;padding:0">${["Pending","Approved","Rejected","All"].map(s=>`<button class="tab ${UI.apFilter===s?"active":""}" data-act="apFilter" data-f="${s}">${esc({Pending:t("pending"),Approved:t("approved"),Rejected:t("rejected"),All:"All"}[s])} (${counts(s)})</button>`).join("")}</div>
      <span style="margin-left:auto"></span>
      <span class="sub">${sel.length} selected</span>
      <button class="btn sm primary" data-act="apApprove" ${sel.length?"":"disabled"}>${icon("check",16)}${esc(t("approve"))}</button>
    </div>
    ${Object.keys(groups).length?Object.entries(groups).map(([code,items])=>{ const b=burn(code), p=PROJECTS[code];
      const cross=[75,90,100].filter(x=>b.pct<x&&b.proj>=x).pop();
      return `<div class="pgroup">
        <div class="pg-head" data-hl="budget"><label class="row" style="gap:8px"><input type="checkbox" data-act="apSelAll" data-proj="${code}" aria-label="Select all ${code}"><span><span class="name">${code} · ${esc(p.name)}</span><br><span class="sub">${esc(p.client)} · ${esc(p.show)}</span></span></label>
          ${p.est?`<div class="burn"><div class="burn-track"><div class="burn-used" style="width:${Math.min(100,b.pct)}%"></div><div class="burn-pend" style="left:${Math.min(100,b.pct)}%;width:${Math.max(0,Math.min(100,b.proj)-Math.min(100,b.pct))}%"></div>${[75,90,100].map(x=>`<span class="burn-tick" style="left:calc(${x}% - 1px)" title="${x}%"></span>`).join("")}</div>
          <div class="burn-lbl"><span>${fmtH(b.used)} of ${fmtH(b.est)} h used (${Math.round(b.pct)}%)</span><span>${b.pend?`+${fmtH(b.pend)} pending → ${Math.round(b.proj)}%`:""}</span></div></div>
          ${b.pct>=100?`<span class="chip err">Over estimate</span>`:cross?`<span class="chip warn">Pending time crosses ${cross}%</span>`:b.pct>=75?`<span class="chip warn">${b.pct>=90?"Over 90%":"Over 75%"}</span>`:`<span class="chip ok">On track</span>`}`:`<span class="chip">Non-billable</span>`}
        </div>
        <div class="scroll-x"><table class="plain" style="min-width:760px"><thead><tr><th style="width:34px"></th><th>Employee</th><th>${esc(t("task"))}</th><th>${esc(t("period"))}</th><th>Days</th><th class="r">${esc(t("hours"))}</th><th>Source</th><th>${esc(t("status"))}</th><th class="r">Actions</th></tr></thead><tbody>
        ${items.map(a=>`<tr><td>${a.status==="Pending"?`<input type="checkbox" data-act="apSel" data-id="${a.id}" ${UI.apSel.has(a.id)?"checked":""} aria-label="Select line">`:""}</td>
          <td style="white-space:nowrap"><b>${esc(a.empName)}</b></td><td>${esc(a.task||"—")}</td><td class="num" style="white-space:nowrap">${esc(fmtRange(a.period===periodKey(0)?0:-1))}</td>
          <td class="num sub" style="min-width:150px">${a.days.map((h,i)=>h?`${addDays(parseYmd(a.period),i).toLocaleDateString(loc(),{weekday:"short"})} ${fmtH(h)}`:"").filter(Boolean).join(" · ")}</td>
          <td class="r num"><b>${fmtH(a.hours)}</b>${a.edited?`<br><span class="sub" style="color:var(--edit)">was ${fmtH(a.edited.from)}</span>`:""}</td>
          <td><span class="chip">${esc(a.src)}</span></td>
          <td>${a.status==="Pending"?`<span class="chip warn">${esc(t("pending"))}</span>`:a.status==="Approved"?`<span class="chip ok">${esc(t("approved"))}</span>`:`<span class="chip err" title="${esc(a.note)}">${esc(t("rejected"))}</span>`}${a.note?`<br><span class="sub">${esc(a.note)}</span>`:""}</td>
          <td class="r" style="white-space:nowrap">${a.status==="Pending"?`<button class="btn sm" data-act="apOne" data-id="${a.id}">${esc(t("approve"))}</button> <button class="btn sm" data-act="apEdit" data-id="${a.id}">${esc(t("edit"))}</button> <button class="btn sm danger" data-act="apReject" data-id="${a.id}">${esc(t("reject"))}</button>`:""}</td></tr>`).join("")}
        </tbody></table></div></div>`; }).join(""):`<div class="panel-body sub">No ${UI.apFilter.toLowerCase()} lines.</div>`}
    <div class="legend"><span>Edit and Reject ask for a reason</span><span>Project-time decisions stay in CloudApper, separate from UKG sign-off</span></div>
  </section>
  <section class="panel"><div class="panel-head"><h2>${esc(t("sync"))}</h2></div><div class="panel-body">${syncTable(S.txns.filter(x=>x.emp==="oliver"))}</div></section>`;
}

/* Kiosk */
function viewKiosk(){
  const K=UI.kiosk, emp="lukas", P=PERSONAS[emp];
  const L=liveState(emp);
  const codes=["BER-1102","MUC-2077","DE-OPS","MUC-1999","PRJ-4821"];
  const now=new Date(), clockFormat=new Intl.DateTimeFormat(loc(),{hour:"2-digit",minute:"2-digit",second:"2-digit"}), clockParts=clockFormat.formatToParts(now), clockPart=type=>clockParts.find(part=>part.type===type)?.value||"", clock=clockFormat.format(now);
  const date=now.toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"long"});
  const msg=K.msg?`<div class="kiosk-feedback ${K.msg.cls}" role="status">${icon(K.msg.cls==="ok"?"check":"info",20)}<span>${esc(K.msg.text)}</span></div>`:"";
  const recent=[...(S.punches[emp]||[])].sort((a,b)=>b.t.localeCompare(a.t)).slice(0,6);
  const punchName={IN:t("punchIn"),OUT:t("punchOut"),BRK_S:t("startBreak"),BRK_E:t("endBreak"),XFER:t("transfer")};
  const recentRows=recent.map(p=>`<li class="kiosk-punch-row" data-punch="${esc(p.type)}"><span class="kiosk-punch-marker" aria-hidden="true"></span><time class="kiosk-punch-time" datetime="${esc(p.t)}">${fmtClock(tsTime(p.t))}</time><div class="kiosk-punch-detail"><b class="kiosk-punch-type">${esc(punchName[p.type]||p.type)}</b>${p.proj&&(p.type==="IN"||p.type==="XFER")?`<span>${esc(p.proj)} · ${esc(PROJECTS[p.proj]?.name||"")}</span>`:""}<small class="kiosk-punch-date">${fmtDay(tsDate(p.t))}</small></div></li>`).join("");
  const footer=["home","recent","auth"].includes(K.panel)?"":`<footer class="kiosk-footer"><span class="kiosk-footer-status">${icon("scan",17)} Shared timeclock kiosk</span><nav class="kiosk-footer-nav" aria-label="Timeclock navigation"><button type="button" class="kiosk-home-nav" data-act="kBack">${icon("home",18)} Home</button></nav><span class="kiosk-footer-time">${K.panel==="done"?"Home in":"Screen clears in"} <b data-live="kidle">${K.idle}</b> s</span></footer>`;
  const recentCounter=K.panel==="recent"?`<span class="kiosk-scan-countdown" role="timer" aria-label="${esc(t("returnClock"))}: ${K.idle} seconds"><b data-live="kidle">${K.idle}</b><span>s</span></span>`:"";
  const menuLanguages=[{code:"en",name:"English"},{code:"fr",name:"Français"},{code:"de",name:"Deutsch"},{code:"nl",name:"Nederlands"},{code:"pl",name:"Polski"}];
  const kioskMenu=`<details class="kiosk-menu" ${K.menuOpen?"open":""}><summary class="kiosk-menu-trigger" aria-label="${esc(K.menuOpen?t("closeMenu"):t("openMenu"))}" aria-expanded="${K.menuOpen}" aria-controls="kiosk-menu-popover">${icon("menu",22)}</summary><button type="button" class="kiosk-menu-scrim" data-act="kMenuClose" aria-label="${esc(t("closeMenu"))}" tabindex="-1"></button><div class="kiosk-menu-popover" id="kiosk-menu-popover" role="region" aria-labelledby="kiosk-menu-title"><h2 class="kiosk-menu-title" id="kiosk-menu-title">${esc(t("menu"))}</h2><label class="kiosk-menu-language" for="kioskLanguage"><span>${icon("globe",19)} ${esc(t("language"))}</span><select id="kioskLanguage" data-act="kioskLanguage" aria-label="${esc(t("language"))}">${menuLanguages.map(x=>`<option value="${x.code}" ${S.lang===x.code?"selected":""}>${x.name}</option>`).join("")}</select></label><details class="kiosk-menu-help"><summary>${icon("info",19)}<span>${esc(t("help"))}</span>${icon("down",16)}</summary><p>${esc(t("kioskHelp"))}</p></details><button type="button" class="kiosk-menu-exit" data-act="kExit">${icon("ext",18)} ${esc(t("exitPreview"))}</button></div></details>`;
  const back=`<button class="kiosk-back" data-act="kBack">${icon("left",18)} ${esc(t("backClock"))}</button>`;
  const home=`<section class="kiosk-stage kiosk-home" aria-labelledby="kiosk-title">
    <div class="kiosk-intro"><h1 id="kiosk-title">${esc(t("kioskChoose"))}</h1></div>
    <div class="kiosk-actions" data-hl="kiosk-badge">
      <button class="kiosk-action" data-act="kSelect" data-intent="in"><span class="kiosk-action-icon" aria-hidden="true">${icon("clock",28)}</span><span class="kiosk-action-copy"><b>${esc(t("punchIn"))}</b></span></button>
      <button class="kiosk-action" data-act="kSelect" data-intent="out"><span class="kiosk-action-icon" aria-hidden="true">${icon("ext",28)}</span><span class="kiosk-action-copy"><b>${esc(t("punchOut"))}</b></span></button>
      <button class="kiosk-action" data-act="kSelect" data-intent="recent"><span class="kiosk-action-icon" aria-hidden="true">${icon("table",28)}</span><span class="kiosk-action-copy"><b>${esc(t("recent"))}</b></span></button>
    </div>
  </section>`;
  const demoControls=K.showDemoControls?`<div class="kiosk-scan-demo"><div class="kiosk-scan-demo-actions"><button type="button" class="kiosk-demo-success" data-act="kDemoSuccess">${icon("check",17)} ${esc(t("previewSuccess"))}</button><button type="button" class="kiosk-demo-failure" data-act="kDemoFailure">${icon("info",17)} ${esc(t("previewFailure"))}</button></div><button type="button" class="kiosk-scan-demo-toggle" data-act="kDemoToggle" aria-expanded="true">${esc(t("hideDemoButtons"))}</button></div>`:`<div class="kiosk-scan-demo"><button type="button" class="kiosk-scan-demo-toggle" data-act="kDemoToggle" aria-expanded="false">${esc(t("showDemoButtons"))}</button></div>`;
  const auth=`<main class="kiosk-scan-page" aria-labelledby="kiosk-scan-ready"><div class="kiosk-scan-content"><h2 class="kiosk-scan-ready" id="kiosk-scan-ready">${esc(t("readyToScan"))}</h2><div class="kiosk-scan-target" aria-hidden="true"><span class="kiosk-scan-target-center">${icon("scan",58)}</span></div><p class="kiosk-scan-instruction">${esc(t("scanInstruction"))}</p>${msg}<button type="button" class="kiosk-scan-cancel" data-act="kBack">${esc(t("cancel"))}</button>${demoControls}<input id="badgeInput" class="kiosk-scanner-capture" data-act="badgeInput" aria-label="${esc(t("badgeId"))}" autocomplete="off" inputmode="none" tabindex="-1" autofocus></div></main>`;
  const project=`<section class="kiosk-stage kiosk-step" aria-labelledby="kiosk-title">
    ${back}<div class="kiosk-step-heading"><span class="kiosk-verified">${icon("check",17)} ${esc(t("verifiedBadge"))} · ${esc(P.name)}</span><h1 id="kiosk-title">${L.st==="out"?"Scan a job barcode to punch in":"Scan the next job barcode to change projects"}</h1><p>${L.st==="out"?"Your shift starts when the scanner reads a valid job barcode.":`You’re currently on ${esc(L.proj||"a job")}. Scan the next job barcode to switch.`} Project selection is recorded with your time entry.</p></div>
    <div class="kiosk-project-layout"><div class="kiosk-project-state"><span class="kiosk-project-label">Current status</span><b>${L.st==="out"?t("punchedOut"):L.st==="brk"?t("onBreak"):t("punchedIn")}</b><span>${L.st!=="out"&&L.proj?`${esc(L.proj)} · ${esc(PROJECTS[L.proj]?.name||"")}`:"Ready to start a shift"}</span>${L.st!=="out"?`<button class="kiosk-break-action" data-act="${L.st==="brk"?"kEndBrk":"kBrk"}">${esc(L.st==="brk"?t("endBreak"):t("startBreak"))}</button>`:""}</div><div class="kiosk-scan-panel kiosk-job-scan"><label class="kiosk-field" for="scanInput">Job barcode</label><div class="kiosk-input-wrap">${icon("scan",23)}<input id="scanInput" class="input mono" data-act="scanInput" placeholder="Waiting for job scan" autocomplete="off" autofocus></div><p class="kiosk-hint">Scan a job label or choose a sample code to preview.</p>${msg}<div class="kiosk-demo-scans"><span>Sample job labels</span>${codes.map(c=>`<button data-act="scan" data-code="${c}">${c}</button>`).join("")}</div></div></div>
  </section>`;
  const done=`<section class="kiosk-stage kiosk-result" aria-labelledby="kiosk-title"><div class="kiosk-result-mark ${K.msg?.cls||"ok"}">${icon(K.msg?.cls==="err"?"info":"check",34)}</div><h1 id="kiosk-title">${K.msg?.cls==="err"?"Punch not changed":"You’re all set"}</h1>${msg}<p class="kiosk-result-copy">Returning to the timeclock home screen in <b data-live="kidle">${K.idle}</b> seconds.</p><button class="kiosk-finish" data-act="kDone">Return now</button></section>`;
  const history=`<section class="kiosk-stage kiosk-recent" aria-labelledby="kiosk-title"><ol class="kiosk-history" aria-label="${esc(t("recent"))}">${recentRows||`<li class="kiosk-empty"><span class="kiosk-empty-mark" aria-hidden="true">${icon("table",23)}</span><span>${esc(t("emptyPunches"))}</span></li>`}</ol></section>`;
  let content=home;
  if(K.panel==="auth") content=auth;
  else if(K.panel==="project") content=project;
  else if(K.panel==="done") content=done;
  else if(K.panel==="recent") content=history;
  const recentMode=K.panel==="recent";
  const homeMode=K.panel==="home";
  const authMode=K.panel==="auth";
  const dateBand=recentMode||authMode?"":`<div class="kiosk-statusband" role="group" aria-label="Current date and time"><time class="kiosk-date" datetime="${now.toISOString().slice(0,10)}">${date}</time><time class="kiosk-clock" datetime="${now.toISOString()}" aria-label="${esc(clock)}"><span class="kiosk-clock-main" data-live="clock-main">${clockPart("hour")}:${clockPart("minute")}</span><span class="kiosk-clock-detail"><span aria-hidden="true">:</span><span class="kiosk-clock-seconds" data-live="clock-seconds">${clockPart("second")}</span>${clockPart("dayPeriod")?`<span class="kiosk-clock-period" data-live="clock-period">${esc(clockPart("dayPeriod"))}</span>`:""}</span></time></div>`;
  const scanCounter=authMode?`<span class="kiosk-scan-countdown" role="timer" aria-label="${esc(t("scanTimeout"))}: ${K.idle} seconds"><b data-live="kidle">${K.idle}</b><span>s</span></span>`:"";
  const header=authMode||recentMode?`<header class="kiosk-scan-header"><button type="button" class="kiosk-scan-back" data-act="kBack" aria-label="${esc(t("backClock"))}">${icon("left",24)}</button><h1 class="kiosk-scan-title"${recentMode?' id="kiosk-title"':""}>${esc(authMode?t("scanBadge"):t("recentPunchesTitle"))}</h1>${authMode?scanCounter:recentCounter}</header>`:`<header class="kiosk-header"><div class="kiosk-brand"><span class="kiosk-logo"><img src="${LOGO_SRC}" alt="Spiro" width="94" height="48"></span><span class="kiosk-brand-title">TimeClock</span></div><div class="kiosk-header-actions"><button type="button" class="kiosk-exit kiosk-exit--desktop" data-act="kExit">${esc(t("exitPreview"))}</button>${kioskMenu}</div></header>`;
  const screenMode=recentMode?"kiosk-screen--recent":homeMode?"kiosk-screen--home":authMode?"kiosk-screen--scan":"";
  const body=homeMode?`<main class="kiosk-home-layout"><div class="kiosk-home-group">${dateBand}${content}</div></main>`:authMode?content:`${dateBand}${content}`;
  return `<div class="kiosk-screen ${screenMode}">${header}${body}${footer}</div>`;
}

/* Journey screenshots: device grouping, labels, and the enlarged viewer with previous and next. */
const shotGroup = x => /Mobile/.test(x.caption) ? "mobile" : "desktop";
const shotLabel = x => x.caption.replace(/\s*·\s*(Desktop|Mobile)$/, "").replace(/^(Desktop|Mobile)$/, "Screen");
const shotList = (jid, group) => ((JOURNEYS.find(j => j.id === jid) || {}).shots || []).filter(x => shotGroup(x) === group);
function shotViewerHtml(jid, group, index){
  const list = shotList(jid, group);
  if(!list.length) return "";
  const i = Math.max(0, Math.min(list.length - 1, index)), x = list[i];
  const arrow = (to, dir) => `<button type="button" data-act="shotNav" data-jid="${esc(jid)}" data-group="${group}" data-index="${to}" aria-label="${dir==="prev"?"Previous":"Next"} screenshot" style="position:absolute;top:50%;${dir==="prev"?"left:16px":"right:16px"};transform:translateY(-50%);width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">${icon(dir==="prev"?"left":"right",22)}</button>`;
  return `<div class="shot-lightbox" role="dialog" aria-modal="true" aria-label="${esc(x.caption)} screenshot" data-jid="${esc(jid)}" data-group="${group}" data-index="${i}" data-act="shotClose" style="position:fixed;inset:0;z-index:60;background:rgba(10,12,14,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 72px 16px;box-sizing:border-box;cursor:zoom-out"><button type="button" class="btn" data-act="shotClose" style="position:absolute;top:16px;right:16px" aria-label="Close screenshot">Close</button>${i>0?arrow(i-1,"prev"):""}${i<list.length-1?arrow(i+1,"next"):""}<img src="${esc(x.src)}" alt="${esc(x.alt)}" data-act="shotKeep" style="display:block;max-width:100%;max-height:calc(100vh - 130px);width:auto;height:auto;border-radius:8px;background:#fff;cursor:default"><p style="margin:0;color:#fff;font-size:14px;text-align:center">${esc(x.caption)} · ${i+1} of ${list.length} · prototype</p></div>`;
}

const USE_CASES=[
  {id:"hourly",label:"Hourly employee: punch, Odoo projects, transfers, breaks, My Timecard (§5.1)",epics:["E1","E2"],scope:"Scope: hourly employee Punch, breaks, Odoo projects, transfers, and My Timecard (spec §5.1). Manager review (§5.4) is not on this screen until it is drafted."},
  {id:"project",label:"Project hours, salaried (§5.2)",epics:["E3"],scope:"Scope: salaried employee weekly project hours (spec §5.2). Project-time approval by managers (§5.4) is not included until it is drafted."},
  {id:"timeoff",label:"Time Off (§5.3)",epics:["E4"],scope:"Scope: Time Off requests, and the manager review of requests for employees they manage (spec §5.3)."},
  {id:"timeclock",label:"Timeclock, warehouse kiosk (§5.5)",epics:["E5"],scope:"Scope: warehouse kiosk punch and recent-punch flows (spec §5.5). The job-barcode step is out of scope; the main prototype still shows it until the kiosk branch is merged."}
];
/* Journeys */
function viewJourneys(){
  const F=UI.jFilter, q=F.q.toLowerCase(), UC=USE_CASES.find(u=>u.id===(F.use||"hourly"))||USE_CASES[0];
  const list=JOURNEYS.filter(j=>UC.epics.includes(j.epic)&&(!F.epic||j.epic===F.epic)&&(!F.ev||j.ev===F.ev)&&(!F.spec||j.specStatus===F.spec)&&(!q||[j.id,j.name,j.actor,j.story,j.specStatus,j.specRef,j.ev].join(" ").toLowerCase().includes(q)));
  const evs=[...new Set(JOURNEYS.map(j=>j.ev))];
  const specs=["Confirmed","Prototype","Proposed","Open decision","Out of scope"].filter(s=>JOURNEYS.some(j=>j.specStatus===s));
  const inUC=JOURNEYS.filter(j=>UC.epics.includes(j.epic)), ucIds=inUC.map(j=>j.id);
  const qFor=x=>{ const refs=(x[5].match(/[A-Z]{2}-\d\d/g)||[]); return !refs.length||refs.some(r=>ucIds.includes(r)); };
  const cnt=f=>inUC.filter(f).length;
  const evCls=e=>e.startsWith("Confirmed - Spiro")||e.startsWith("Confirmed - UI/UX")||e.startsWith("Confirmed - picker")?"ok":e.startsWith("Confirmed - UKG")||e.startsWith("Confirmed - current demo")||e.startsWith("Not documented")||e.startsWith("Out of scope")?"info":"warn";
  const specCls=s=>s==="Confirmed"?"ok":(s==="Prototype"||s==="Proposed")?"info":s==="Open decision"?"warn":"";
  let body="", lastEpic="";
  list.forEach(j=>{
    if(j.epic!==lastEpic){ body+=`<tr class="epic-h"><td colspan="8">${j.epic} · ${esc(EPICS[j.epic])}</td></tr>`; lastEpic=j.epic; }
    const open=UI.jOpen.has(j.id);
    body+=`<tr class="jrow" data-act="jToggle" data-id="${j.id}" id="j-${j.id}"><td class="mono"><b>${j.id}</b></td><td><b style="font-weight:600">${esc(j.name)}</b><br><span class="sub">${esc(j.actor)}</span></td><td><span class="chip ${specCls(j.specStatus)}">${esc(j.specStatus)}</span><br><span class="sub">${esc(j.specRef)}</span></td><td><span class="chip ${evCls(j.ev)}">${esc(j.ev.replace("Confirmed - ","").replace("Proposed - ",""))}</span></td><td>${esc(j.pri)}</td><td><span class="chip ${j.cov==="Covered"?"ok":j.cov==="Partial"?"warn":""}">${esc(j.cov)}</span></td><td class="mono">${esc(j.q||"—")}</td><td class="r">${j.cov==="Not prototyped"?`<span class="sub">Not prototyped</span>`:`<button class="btn sm" data-act="jRun" data-id="${j.id}">Open in demo</button>`}</td></tr>`;
    if(open) body+=`<tr class="jdet"><td colspan="8"><div class="jdet-grid">
      ${j.specStatus==="Out of scope"?`<div class="j-scope-note">This activity is explicitly outside the current specification scope.</div>`:""}
      <div><h4>Specification coverage</h4><p>${esc(j.specStatus)} · ${esc(j.specRef)}</p></div>
      <div><h4>User story</h4><p>${esc(j.story)}</p></div><div><h4>Trigger · Preconditions</h4><p>${esc(j.trigger)}. ${esc(j.pre)}</p></div>${j.currentState?`<div><h4>Current state</h4><p>${esc(j.currentState)}</p></div>`:""}
      <div><h4>Main flow</h4><p>${esc(j.flow.replace(/ (\d)\. /g,"\n$1. "))}</p></div>${j.gridFields?`<div style="grid-column:1/-1"><h4>Grid fields</h4><table class="plain" style="min-width:0"><thead><tr><th>Column</th><th>Display behavior</th></tr></thead><tbody>${j.gridFields.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table></div>`:""}<div><h4>Alternate / exception</h4><p>${esc(j.alt||"—")}</p></div>
      <div><h4>Business rules</h4><p>${esc(j.rules||"—")}</p></div><div><h4>Integration note</h4><p class="mono">${esc(j.api)}</p></div>
      <div style="grid-column:1/-1"><h4>Acceptance criteria</h4><ul class="j-ac-list">${j.ac.map(a=>`<li>${esc(a.join("; "))}</li>`).join("")}</ul></div>
      ${(j.shots||[]).length?`<div style="grid-column:1/-1"><h4>Screenshots</h4><p class="sub">Select a screenshot to enlarge it. Use the arrows or the left and right keys to move through a flow.</p>${["desktop","mobile"].map(g=>{const list=j.shots.filter(x=>shotGroup(x)===g);return list.length?`<div style="margin-top:10px"><div class="sub" style="margin-bottom:6px">${g==="desktop"?"Desktop":"Mobile"} · ${list.length}</div><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">${list.map((x,i)=>`<figure style="margin:0"><button type="button" data-act="shotOpen" data-jid="${esc(j.id)}" data-group="${g}" data-index="${i}" aria-label="Enlarge ${esc(x.caption)} screenshot" style="display:block;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:6px;background:none;cursor:zoom-in;overflow:hidden;line-height:0"><img src="${esc(x.src)}" alt="" loading="lazy" style="display:block;height:100px;width:${g==="mobile"?"64px":"160px"};object-fit:cover;object-position:top left"></button><figcaption class="sub" style="margin-top:4px">${esc(shotLabel(x))}</figcaption></figure>`).join("")}</div></div>`:""}).join("")}</div>`:""}<div><h4>Evidence</h4><p>${esc(j.ev)} · ${esc(j.src)}</p></div><div><h4>Demo path</h4><p>${esc(j.demo[3])}</p></div></div></td></tr>`;
  });
  return `<section class="panel j-summary"><h2>Specification coverage</h2><dl class="j-summary-list">
    <div><dt>Register entries</dt><dd>${inUC.length}</dd></div><div><dt>Confirmed</dt><dd>${cnt(j=>j.specStatus==="Confirmed")}</dd></div><div><dt>Prototype</dt><dd>${cnt(j=>j.specStatus==="Prototype")}</dd></div><div><dt>Proposed</dt><dd>${cnt(j=>j.specStatus==="Proposed")}</dd></div><div><dt>Open decisions</dt><dd>${cnt(j=>j.specStatus==="Open decision")}</dd></div><div><dt>Out of scope</dt><dd>${cnt(j=>j.specStatus==="Out of scope")}</dd></div>
  </dl><p class="sub">${esc(UC.scope)}</p><p class="sub">Prototype coverage is tracked separately on each journey.</p></section>
  <section class="panel">
    <div class="panel-head"><h2>User journeys</h2><select class="select" id="jUse" data-act="jUse" aria-label="Use case">${USE_CASES.map(u=>`<option value="${u.id}" ${u.id===UC.id?"selected":""}>${esc(u.label)}</option>`).join("")}</select>
      <select class="select" id="jEpic" data-act="jEpic" aria-label="Epic"><option value="">All epics</option>${Object.entries(EPICS).filter(([k])=>UC.epics.includes(k)).map(([k,v])=>`<option value="${k}" ${F.epic===k?"selected":""}>${k} · ${esc(v)}</option>`).join("")}</select>
      <select class="select" id="jSpec" data-act="jSpec" aria-label="Specification coverage"><option value="">All specification statuses</option>${specs.map(s=>`<option ${F.spec===s?"selected":""}>${esc(s)}</option>`).join("")}</select>
      <select class="select" id="jEv" data-act="jEv" aria-label="Evidence"><option value="">All evidence</option>${evs.map(e=>`<option ${F.ev===e?"selected":""}>${esc(e)}</option>`).join("")}</select>
      <input class="input" id="jQ" data-act="jQ" placeholder="Search journeys" value="${esc(F.q)}" aria-label="Search journeys">
      ${SHEET_URL.startsWith("http")?`<a class="btn primary" href="${esc(SHEET_URL)}" target="_blank" rel="noopener">${icon("ext",16)}Open tracker sheet</a>`:""}
    </div>
    <div class="panel-body sub" style="padding-bottom:0">Click a row for its specification reference, story, flow, and acceptance criteria. Specification status and prototype coverage are tracked separately. Priority remains as recorded in that register. Dashed tags such as ${uj("PU-01")} link each journey to its demo screen; turn them off in settings.</div>
    <div class="panel-body scroll-x"><table class="jt" style="min-width:1060px"><thead><tr><th>ID</th><th>Journey</th><th>Specification</th><th>Evidence</th><th>Register priority</th><th>Prototype</th><th>Open Q</th><th></th></tr></thead><tbody>${body||`<tr><td colspan="8" class="sub">No journeys match.</td></tr>`}</tbody></table></div>
  </section>
  <section class="panel"><div class="panel-head"><h2>Open questions for Spiro</h2><span class="sub">Open product, policy, and implementation decisions referenced by these journeys.</span></div>
    <div class="panel-body scroll-x"><table class="plain" style="min-width:700px"><thead><tr><th>ID</th><th>Area</th><th>Question</th><th>Journeys</th><th>Priority</th></tr></thead><tbody>${QUESTIONS.filter(qFor).map(x=>`<tr><td class="mono">${x[0]}</td><td>${esc(x[1])}</td><td>${esc(x[2])}<br><span class="sub">${esc(x[3])}</span></td><td class="mono">${esc(x[5])}</td><td>${esc(x[4])}</td></tr>`).join("")}</tbody></table></div></section>`;
}
