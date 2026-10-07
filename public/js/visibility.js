/* ---------- Project visibility: per-employee visible / hidden (display preference only) ---------- */
const HIDE_AHEAD_DAYS = 14;   // projects starting further out than this start hidden
function isHidden(emp,code){
  const ov=(S.hidden[emp]||{})[code]; if(ov!==undefined) return ov;
  const p=PROJECTS[code]; return !p.active||(p.startIn||0)>HIDE_AHEAD_DAYS;
}
function hiddenCount(emp){ return assigned(emp).filter(c=>isHidden(emp,c)).length; }
/* rows:true also tidies the current grid: hiding drops empty rows, showing adds one. */
function setHidden(emp,code,hide,rows){
  (S.hidden[emp]=S.hidden[emp]||{})[code]=hide;
  if(rows){ const g=gridWeek(emp,0), ex=g.rows.filter(r=>r.proj===code&&!r.archived);
    if(hide) ex.filter(r=>!r.h.some(x=>num(x))&&r.status!=="Approved").forEach(r=>r.archived=true);
    else if(!ex.length&&PROJECTS[code].active) g.rows.push({id:uid("r"),proj:code,task:PROJECTS[code].taskReq?"":PROJECTS[code].tasks[0],h:Array(7).fill(""),status:"Draft",note:"",archived:false}); }
  persist();
}
function startNote(code){ const d=PROJECTS[code].startIn||0; return !PROJECTS[code].active?"Completed":d>0?`Starts in ${d} days`:""; }

function manageProjects(){
  const emp=S.persona, list=assigned(emp);
  const vis=list.filter(c=>!isHidden(emp,c)), hid=list.filter(c=>isHidden(emp,c));
  const row=c=>{ const p=PROJECTS[c], on=!isHidden(emp,c), note=startNote(c);
    return `<label class="mp-row"><span class="what"><b>${c}</b> ${esc(p.name)}<small>${esc(p.client)}${note?` · ${esc(note)}`:""}</small></span>
      <span class="mp-state">${on?"Visible":"Hidden"}</span><input type="checkbox" class="sw" role="switch" data-act="mpToggle" data-code="${c}" aria-label="${on?"Hide":"Show"} ${c}" ${on?"checked":""}></label>`; };
  const group=(title,arr,empty)=>`<div class="mp-group"><h4>${title} <span class="chip">${arr.length}</span></h4>${arr.length?arr.map(row).join(""):`<p class="sub" style="margin:6px 0">${empty}</p>`}</div>`;
  openDialog("Manage projects",`<p class="sub" style="margin:0">Choose which assigned projects appear in your grid and at the top of Add new. Hidden projects stay assigned to you and are one click away under <b>All</b>.</p>
    ${group("Visible",vis,"No visible projects.")}${group("Hidden",hid,"Nothing is hidden.")}`,
    `<button class="btn primary" data-act="closeDlg">Done</button>`);
}

function isPunchOdooHidden(emp,code){
  const overrides=(S.punchOdooHidden||{})[emp]||{};
  if(Object.prototype.hasOwnProperty.call(overrides,code)) return overrides[code];
  const p=PROJECTS[code]; return !p||!p.active||(p.startIn||0)>HIDE_AHEAD_DAYS;
}
function setPunchOdooHidden(emp,code,hide){
  S.punchOdooHidden=S.punchOdooHidden||{}; S.punchOdooHidden[emp]=S.punchOdooHidden[emp]||{};
  S.punchOdooHidden[emp][code]=hide; persist();
}
function odooCatalogResults(emp,query){
  const q=(query||"").trim().toLocaleLowerCase(), inList=new Set(assigned(emp));
  const matches=Object.entries(PROJECTS).filter(([code,p])=>p.active&&!(p.startIn>HIDE_AHEAD_DAYS)&&!inList.has(code)&&(!q||[code,p.name,p.client,p.show,p.umbrella].filter(Boolean).join(" ").toLocaleLowerCase().includes(q)));
  return matches.length?matches.map(([code,p])=>`<div class="odoo-catalog-row"><span class="odoo-catalog-copy"><b>${esc(code)} · ${esc(p.name)}</b><small>${esc(p.client)}${p.show&&p.show!=="—"?` · ${esc(p.show)}`:""}</small></span><button type="button" class="btn" data-act="addOdooPunchProject" data-code="${esc(code)}">${icon("plus",15)}Add</button></div>`).join(""):`<p class="sub odoo-catalog-empty">${q?"No active projects match your search.":"No additional active projects are available in the demo catalog."}</p>`;
}
function manageOdooProjects(mode="manage",focusCode=""){
  const emp=S.persona, list=assigned(emp);
  UI.odooManageMode=mode;
  if(mode==="manage"){
    UI.odooCatalogNotice="";
    const vis=list.filter(code=>!isPunchOdooHidden(emp,code)), hid=list.filter(code=>isPunchOdooHidden(emp,code));
    const row=code=>{const p=PROJECTS[code],on=!isPunchOdooHidden(emp,code),note=startNote(code);return `<label class="mp-row"><span class="what"><b>${esc(code)}</b> ${esc(p.name)}<small>${esc(p.client)}${note?` · ${esc(note)}`:""}</small></span><span class="mp-state">${on?"Visible":"Hidden"}</span><input type="checkbox" class="sw" role="switch" data-act="punchOdooToggle" data-code="${esc(code)}" aria-label="${on?"Hide":"Show"} ${esc(code)} in Punch project list" ${on?"checked":""}></label>`;};
    const group=(title,codes,empty)=>`<div class="mp-group"><h4>${title} <span class="chip">${codes.length}</span></h4>${codes.length?codes.map(row).join(""):`<p class="sub" style="margin:6px 0">${empty}</p>`}</div>`;
    openDialog("Manage Odoo Project",`<p class="sub" style="margin:0">Choose which active Odoo projects appear in the Punch project list.</p><button type="button" class="btn odoo-catalog-launch" data-act="openOdooCatalog">${icon("plus",16)}Add projects from Odoo</button>${group("Visible",vis,"No visible projects.")}${group("Hidden",hid,"Nothing is hidden.")}`,
      `<button type="button" class="btn primary" data-act="closeDlg">Done</button>`);
    setTimeout(()=>{
      const switches=[...document.querySelectorAll('#layer input[data-act="punchOdooToggle"]')];
      const target=(focusCode&&switches.find(input=>input.dataset.code===focusCode))||document.querySelector('#layer [data-act="openOdooCatalog"]');
      target?.focus();
    },40);
  } else {
    openDialog("Add projects from Odoo",`<p class="sub" style="margin:0">Search the demo Odoo catalog for active projects. Added projects become available to this employee in the local prototype.</p>${UI.odooCatalogNotice?`<div class="banner punch-success" role="status">${icon("check")}<div>${esc(UI.odooCatalogNotice)}</div></div>`:""}<label class="field"><span>Search Odoo projects</span><input type="search" class="input odoo-catalog-search" id="odooCatalogSearch" data-act="odooCatalogSearch" placeholder="Project, name, client, or event" autocomplete="off" value="${esc(UI.odooCatalogQuery)}"></label><div class="odoo-catalog-results" id="odooCatalogResults">${odooCatalogResults(emp,UI.odooCatalogQuery)}</div>`,
      `<button type="button" class="btn" data-act="backToOdooProjects">Back</button><button type="button" class="btn primary" data-act="closeDlg">Done</button>`);
    setTimeout(()=>document.getElementById("odooCatalogSearch")?.focus(),40);
  }
}
function addOdooProjectToPunch(emp,code){
  const p=PROJECTS[code]; if(!p||!p.active||(p.startIn>HIDE_AHEAD_DAYS)||assigned(emp).includes(code)) return false;
  S.odooAssignments=S.odooAssignments||{}; S.odooAssignments[emp]=[...new Set([...(S.odooAssignments[emp]||[]),code])];
  S.punchOdooHidden=S.punchOdooHidden||{}; S.punchOdooHidden[emp]=S.punchOdooHidden[emp]||{}; S.punchOdooHidden[emp][code]=false;
  S._selProj=code; S._selTask=""; persist(); return true;
}
