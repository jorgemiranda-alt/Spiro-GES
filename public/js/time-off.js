/* Time Off design prototype. Configuration, balances and requests are synthetic.
   Rule deadlines are returned by the sample configuration, not decided by the UI. */
const TO_DURATION = {'Full Day':'full','Hours':'hours','First Half Day':'first','Second Half Day':'second'};
const TO_STATUSES = ['Submitted','Approved','Refused','Cancelled'];
const TO_SAMPLE = {
 employees:{
  ava:{name:'Ava Mitchell',manager:'oliver',types:['pto','sick','personal']},maya:{name:'Maya Chen',manager:'oliver',types:['pto','sick','personal']},
  priya:{name:'Priya Shah',manager:'oliver',types:['pto','personal']},marcus:{name:'Marcus Lee',manager:'oliver',types:['pto','sick']},
  lukas:{name:'Lukas Weber',manager:'jonas',types:['pto','sick']},zofia:{name:'Zofia Kowalska',manager:'camille',types:['pto','sick']},
  oliver:{name:'Oliver Grant',manager:'camille',types:['pto','sick','personal']}
 },
 managers:{oliver:'Oliver Grant',jonas:'Jonas Richter',camille:'Camille Dubois'},
 types:[
  {id:'pto',label:'pto',durations:Object.keys(TO_DURATION),allowPast:false},
  {id:'sick',label:'sick',durations:Object.keys(TO_DURATION),allowPast:true},
  {id:'personal',label:'personal',durations:['Full Day','Hours'],allowPast:false}
 ],
 // Illustrative work calendar and rule configuration; these are not Spiro policy.
 workdays:[1,2,3,4,5],
 rules:{pto:{name:'ruleThree',delayMilliseconds:259200000}},
 balances:{pto:{amount:72,unit:'hours'},sick:{amount:40,unit:'hours'},personal:{amount:16,unit:'hours'}}
};
function toResetUI(){
 UI.to={owner:S.persona,scope:'mine',screen:'list',selected:null,detailOpen:false,filter:'all',typeFilter:'all',employeeFilter:'all',from:'',until:'',draft:null,errors:{},busy:false,refreshing:false,balance:null,confirmed:null,month:ymd(new Date()).slice(0,7),rangePicking:false};
}
toResetUI();
Object.values(PERSONAS).forEach(p=>{if(!p.views.includes('timeoff'))p.views.push('timeoff');});
VIEW_ICON.timeoff='cal';
function toType(id){return TO_SAMPLE.types.find(x=>x.id===id);}
function toEligibleTypes(emp=S.persona){return TO_SAMPLE.types.filter(t=>TO_SAMPLE.employees[emp]?.types.includes(t.id));}
function toName(id){return TO_SAMPLE.employees[id]?.name||TO_SAMPLE.managers[id]||id;}
function toManager(){return S.persona==='oliver';}
function toStamp(date,hour='10:00'){return `${date}T${hour}:00`;}
function toSeed(){
 const date=delta=>ymd(addDays(new Date(),delta));
 const request=(id,emp,type,start,end,duration,status,note,age,extra={})=>{
  const created=toStamp(date(-age));
  const r={id,emp,manager:TO_SAMPLE.employees[emp].manager,type,start:date(start),end:date(end),duration,hours:duration==='Hours'?3:null,startTime:duration==='Hours'?'09:00':'',status,note,created,updated:created,history:[{action:'Submitted',at:created,actor:emp}],...extra};
  if(status!=='Submitted'){
   const at=toStamp(date(-age+3),'10:05');
   r.history.push({action:status,at,actor:extra.automatic?'rule':status==='Cancelled'?emp:r.manager,reason:extra.reason||'',rule:extra.automatic?'ruleThree':null});
   r.updated=at;
  }else if(TO_SAMPLE.rules[type]) r.autoApproval={at:new Date(new Date(created).getTime()+TO_SAMPLE.rules[type].delayMilliseconds).toISOString(),rule:TO_SAMPLE.rules[type].name};
  return r;
 };
 return {v:1,lastUpdated:nowTs(),notifications:[],requests:[
  request('TO-1042','ava','pto',14,16,'Full Day','Submitted','Family trip planned for these dates.',1),
  request('TO-1031','ava','pto',-14,-13,'Full Day','Approved','',20,{automatic:true}),
  request('TO-1026','ava','personal',7,7,'Hours','Refused','A personal appointment in the morning.',23,{reason:'We need coverage for the client setup that morning. Please discuss another date with me.'}),
  request('TO-1015','ava','pto',-28,-27,'Full Day','Cancelled','Plans changed.',35),
  request('TO-1043','maya','pto',8,10,'Full Day','Submitted','Handover notes will be shared before I leave.',1),
  request('TO-1044','priya','personal',4,4,'Full Day','Submitted','',0),
  request('TO-1045','marcus','pto',3,3,'Second Half Day','Submitted','Leaving after the morning briefing.',0),
  request('TO-1046','lukas','pto',9,9,'Full Day','Submitted','',0),
  request('TO-1027','zofia','pto',11,12,'Full Day','Approved','',8),
  request('TO-1041','ava','sick',-5,-4,'Full Day','Submitted','Unable to work on these dates.',0)
 ]};
}
function toInit(){
 if(!S.timeOff||S.timeOff.v!==1)S.timeOff=toSeed();
 if(!UI.to||UI.to.owner!==S.persona)toResetUI();
 if(!toManager())UI.to.scope='mine';
 toApplyRules();
}
function toVisible(r){return UI.to.scope==='team'&&toManager()?r.manager===S.persona&&r.emp!==S.persona:r.emp===S.persona;}
function toAccessible(r){return !!r&&(r.emp===S.persona||(toManager()&&r.manager===S.persona&&r.emp!==S.persona));}
function toNotify(r){S.timeOff.notifications.unshift({id:r.id,emp:r.emp,status:r.status,reason:r.history.at(-1)?.reason||'',at:r.updated});}
function toApplyRules(at=Date.now()){
 if(!S.timeOff)return false;
 let changed=false;
 S.timeOff.requests.forEach(r=>{
  if(r.status==='Submitted'&&r.manager&&r.autoApproval&&new Date(r.autoApproval.at).getTime()<=at){
   r.status='Approved';r.updated=r.autoApproval.at;
   r.history.push({action:'Approved',at:r.updated,actor:'rule',rule:r.autoApproval.rule});toNotify(r);changed=true;
  }
 });
 if(changed)persist();
 return changed;
}
function toDate(date,long=false){return parseYmd(date).toLocaleDateString(loc(),{month:long?'long':'short',day:'numeric',year:'numeric'});}
function toDateRange(r){return r.start===r.end?toDate(r.start):`${toDate(r.start)} – ${toDate(r.end)}`;}
function toWhen(stamp){const d=new Date(stamp.replace(' ','T'));return Number.isNaN(d.getTime())?stamp:d.toLocaleString(loc(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function toQuantity(r){
 if(r.duration==='Hours')return `${Number(r.hours||0).toLocaleString(loc())} ${toText('hours').toLowerCase()}`;
 if(!r.start||!r.end||r.end<r.start)return toText(TO_DURATION[r.duration]);
 const start=parseYmd(r.start),total=Math.max(0,Math.round((parseYmd(r.end)-start)/86400000)+1);
 let days=Math.floor(total/7)*TO_SAMPLE.workdays.length;
 for(let i=0;i<total%7;i++)if(TO_SAMPLE.workdays.includes(addDays(start,i).getDay()))days++;
 const amount=days*(r.duration==='Full Day'?1:0.5);
 if(!amount)return toText('amountUnavailable');
 return `${amount.toLocaleString(loc())} ${toText(amount===1?'day':'days')}`;
}
function toBadge(status){return `<span class="to-status to-status-${status.toLowerCase()}">${icon(status==='Approved'?'check':status==='Refused'?'x':status==='Cancelled'?'x':'clock',14)}${esc(toText(status))}</span>`;}
function toStep(current){return `<ol class="to-steps" aria-label="${esc(toText('request'))}">${['request','review','confirmation'].map((s,i)=>`<li ${i===current?'aria-current="step"':''}><span class="to-step-dot">${i<current?icon('check',12):i+1}</span>${esc(toText(s))}</li>`).join('')}</ol>`;}
function toHeader(){
 const team=UI.to.scope==='team';
 return `<header class="to-page-head"><div><h2 id="to-screen-title" tabindex="-1">${esc(toText('title'))}</h2><p>${esc(toText(team?'teamIntro':'subtitle'))}</p></div><div class="to-head-actions"><button class="btn to-refresh" aria-label="${esc(toText(UI.to.refreshing?'refreshing':'refresh'))}" id="to-refresh-button" data-act="to-refresh" ${UI.to.refreshing?'aria-disabled="true"':''}>${icon('refresh',17)}<span>${esc(toText(UI.to.refreshing?'refreshing':'refresh'))}</span></button>${team?'':`<button class="btn primary" data-act="to-new">${icon('plus',17)}${esc(toText('new'))}</button>`}</div></header>
 ${toManager()?`<div class="to-scope" role="group" aria-label="${esc(toText('title'))}"><button data-act="to-scope" data-scope="mine" aria-pressed="${!team}">${esc(toText('my'))}</button><button data-act="to-scope" data-scope="team" aria-pressed="${team}">${esc(toText('team'))}<span class="to-queue-count">${S.timeOff.requests.filter(r=>r.manager===S.persona&&r.emp!==S.persona&&r.status==='Submitted').length}</span></button></div>`:''}`;
}
function toFiltered(){
 return S.timeOff.requests.filter(toVisible).filter(r=>
  (UI.to.filter==='all'||r.status===UI.to.filter)&&(UI.to.typeFilter==='all'||r.type===UI.to.typeFilter)&&
  (UI.to.employeeFilter==='all'||r.emp===UI.to.employeeFilter)&&(!UI.to.from||r.end>=UI.to.from)&&(!UI.to.until||r.start<=UI.to.until)
 ).sort((a,b)=>b.created.localeCompare(a.created)||b.id.localeCompare(a.id));
}
function toFilters(){
 const team=UI.to.scope==='team';
 const employees=[...new Set(S.timeOff.requests.filter(toVisible).map(r=>r.emp))];
 const options=(list,current)=>list.map(([v,label])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`).join('');
 return `<div class="to-filters"><label>${esc(toText('status'))}<select class="select" data-to-filter="filter" aria-label="${esc(toText('filter'))}">${options([['all',toText('all')],...TO_STATUSES.map(x=>[x,toText(x)])],UI.to.filter)}</select></label><label>${esc(toText('type'))}<select class="select" data-to-filter="typeFilter" aria-label="${esc(toText('typeFilter'))}">${options([['all',toText('allTypes')],...toEligibleTypes().map(x=>[x.id,toText(x.label)])],UI.to.typeFilter)}</select></label>
 ${team?`<label>${esc(toText('employee'))}<select class="select" data-to-filter="employeeFilter">${options([['all',toText('allEmployees')],...employees.map(id=>[id,toName(id)])],UI.to.employeeFilter)}</select></label>`:''}
 <details class="to-date-filter" id="to-filter-dates"><summary>${icon('cal',16)}${esc(toText('dates'))}${UI.to.from||UI.to.until?' · 1':''}</summary><div><label>${esc(toText('start'))}<input id="to-filter-from" class="input" type="date" value="${esc(UI.to.from)}" data-to-filter="from" aria-describedby="to-filter-from-preview"><span class="to-date-preview" id="to-filter-from-preview">${toDatePreview(UI.to.from)}</span></label><label>${esc(toText('end'))}<input id="to-filter-until" class="input" type="date" value="${esc(UI.to.until)}" data-to-filter="until" aria-describedby="to-filter-until-preview"><span class="to-date-preview" id="to-filter-until-preview">${toDatePreview(UI.to.until)}</span></label></div></details></div>`;
}
function toNotification(){
 const n=S.timeOff.notifications.find(x=>x.emp===S.persona);
 if(!n||UI.to.scope!=='mine')return '';
 const r=S.timeOff.requests.find(x=>x.id===n.id);if(!r)return '';
 return `<div class="to-notification" role="status"><div>${icon('info',20)}<div><b>${esc(toText('notification',{type:toText(toType(r.type).label),status:toText(n.status)}))}</b>${n.reason?`<p>${esc(n.reason)}</p>`:''}</div></div><button class="btn ghost" data-act="to-select" data-id="${r.id}">${esc(toText('viewRequest'))}</button><button class="icon-btn" data-act="to-dismiss" data-id="${r.id}" aria-label="${esc(toText('dismiss'))}">${icon('x',17)}</button></div>`;
}
function toDecisionNotice(){
 const id=UI.to.lastDecision,r=S.timeOff.requests.find(x=>x.id===id);
 if(!toAccessible(r))return '';
 return `<div class="to-notification" role="status"><div>${icon('check',20)}<div><b>${esc(toName(r.emp))} · ${esc(toText(r.status))}</b><p>${esc(toWhen(r.updated))}</p></div></div><button class="btn ghost" data-act="to-select" data-id="${r.id}">${esc(toText('viewRequest'))}</button></div>`;
}
function toEmpty(hasRequests){
 const team=UI.to.scope==='team';
 const key=hasRequests?'noMatches':team?'caughtUp':'empty';
 return `<div class="to-empty">${icon(team?'check':'cal',38)}<h3>${esc(toText(key))}</h3>${hasRequests?'':`<p>${esc(toText(team?'caughtUpHelp':'emptyHelp'))}</p>`}<button class="btn ${!team&&!hasRequests?'primary':''}" data-act="${hasRequests?'to-clear':team?'to-all':'to-new'}">${esc(toText(hasRequests?'clearFilters':team?'viewAll':'new'))}</button></div>`;
}
function toDetail(r){
 if(!r)return `<aside class="to-detail to-detail-empty"><p>${esc(toText('selectRequest'))}</p></aside>`;
 const mine=r.emp===S.persona,manager=toManager()&&r.manager===S.persona&&!mine;
 return `<aside class="to-detail" id="to-request-detail" aria-label="${esc(toText('viewRequest'))}" tabindex="-1"><button class="to-mobile-back" data-act="to-close-detail">${icon('left',17)}${esc(toText(UI.to.scope==='team'?'backTeam':'back'))}</button><header class="to-detail-head"><span>${esc(r.id)}</span>${toBadge(r.status)}</header><h3>${esc(toText(toType(r.type).label))}</h3><p class="to-detail-date">${esc(toDateRange(r))}</p><p class="to-detail-duration">${esc(toText(TO_DURATION[r.duration]))} · ${esc(toQuantity(r))}${r.duration==='Hours'&&r.startTime?` · ${esc(fmtClock(r.startTime))}`:''}</p><dl class="to-facts">${manager?`<div><dt>${esc(toText('employee'))}</dt><dd>${esc(toName(r.emp))}</dd></div>`:''}<div><dt>${esc(toText('manager'))}</dt><dd>${esc(TO_SAMPLE.managers[r.manager]||r.manager)}</dd></div>${r.status==='Submitted'&&r.autoApproval?`<div><dt>${esc(toText('autoDate'))}</dt><dd>${esc(toWhen(r.autoApproval.at))}</dd></div>`:''}</dl>
 ${r.note?`<section class="to-note"><h4>${esc(toText('employeeNote'))}</h4><p>${esc(r.note)}</p></section>`:''}
 <section class="to-history"><h4>${esc(toText('history'))}</h4><ol>${[...r.history].reverse().map(h=>`<li><span class="to-history-dot ${h.action.toLowerCase()}">${icon(h.action==='Approved'?'check':h.action==='Submitted'?'plus':'x',12)}</span><div><b>${esc(h.actor==='rule'?toText('automatic'):toText(h.action))}</b><small>${esc(h.actor==='rule'?toText(h.rule):toName(h.actor))} · ${esc(toWhen(h.at))}</small>${h.reason?`<p class="to-refusal-reason">${esc(h.reason)}</p>`:''}</div></li>`).join('')}</ol></section>
 ${r.status==='Submitted'?`<footer class="to-detail-actions">${mine?`<button class="btn" data-act="to-confirm" data-action="cancel" data-id="${r.id}">${esc(toText('cancelRequest'))}</button>`:manager?`<button class="btn" data-act="to-confirm" data-action="refuse" data-id="${r.id}">${esc(toText('refuse'))}</button><button class="btn primary" data-act="to-confirm" data-action="approve" data-id="${r.id}">${icon('check',16)}${esc(toText('approve'))}</button>`:''}</footer>`:''}</aside>`;
}
function toList(){
 const requests=toFiltered(),scopeRequests=S.timeOff.requests.filter(toVisible),team=UI.to.scope==='team';
 let r=requests.find(x=>x.id===UI.to.selected)||requests[0];UI.to.selected=r?.id||null;
 const caughtUp=team&&UI.to.filter==='Submitted'&&!scopeRequests.some(x=>x.status==='Submitted');
 return `${toHeader()}${toDecisionNotice()}${toNotification()}${toFilters()}
 <div class="to-workspace ${UI.to.detailOpen?'is-detail-open':''}"><section class="to-list" aria-label="${esc(toText(team?'team':'my'))}">${requests.length?`<div class="to-list-head" aria-hidden="true"><span>${esc(toText(team?'employee':'request'))}</span><span>${esc(toText('dates'))}</span><span>${esc(toText('status'))}</span></div><ul>${requests.map(x=>`<li><button class="to-request-row ${x.id===r?.id?'selected':''}" data-act="to-select" data-id="${x.id}" aria-pressed="${x.id===r?.id}" aria-controls="to-request-detail" aria-label="${esc([team?toName(x.emp):toText(toType(x.type).label),x.id,toDateRange(x),toText(x.status)].join(', '))}"><span class="to-row-type"><b>${esc(team?toName(x.emp):toText(toType(x.type).label))}</b><small>${esc(team?toText(toType(x.type).label):x.id)}</small></span><span class="to-row-dates"><b>${esc(toDateRange(x))}</b><small>${esc(toText(TO_DURATION[x.duration]))} · ${esc(toQuantity(x))}</small></span>${toBadge(x.status)}${icon('right',15)}</button></li>`).join('')}</ul>`:toEmpty(!caughtUp&&scopeRequests.length>0)}</section>${toDetail(r)}</div>`;
}
function toDraftSummary(r,heading=true){
 return `${heading?`<h3>${esc(toText('summary'))}</h3>`:''}<dl class="to-summary-facts"><div><dt>${esc(toText('type'))}</dt><dd>${esc(toText(toType(r.type).label))}</dd></div><div><dt>${esc(toText('dates'))}</dt><dd>${r.start&&r.end&&r.end>=r.start?esc(toDateRange(r)):esc(toText('chooseDates'))}</dd></div><div><dt>${esc(toText('duration'))}</dt><dd>${esc(toText(TO_DURATION[r.duration]))}${r.start&&r.end&&r.end>=r.start?`<small>${esc(toQuantity(r))}${r.startTime&&r.duration==='Hours'?` · ${esc(fmtClock(r.startTime))}`:''}</small>`:''}</dd></div></dl>`;
}
function toCalendar(){
 const d=UI.to.draft,single=d.duration!=='Full Day',month=parseYmd(UI.to.month+'-01'),offset=(month.getDay()+6)%7,total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const weekdays=Array.from({length:7},(_,i)=>addDays(new Date(2026,0,5),i).toLocaleDateString(loc(),{weekday:'narrow'}));
 return `<div class="to-calendar-head"><h3>${esc(month.toLocaleDateString(loc(),{month:'long',year:'numeric'}))}</h3><div><button type="button" class="icon-btn" data-act="to-month" data-delta="-1" aria-label="${esc(toText('previousMonth'))}">${icon('left',17)}</button><button type="button" class="icon-btn" data-act="to-month" data-delta="1" aria-label="${esc(toText('nextMonth'))}">${icon('right',17)}</button></div></div><div class="to-calendar-grid"><div class="to-weekdays" aria-hidden="true">${weekdays.map(w=>`<span>${esc(w)}</span>`).join('')}</div><div class="to-calendar-days">${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:total},(_,i)=>{const date=ymd(new Date(month.getFullYear(),month.getMonth(),i+1)),selected=date===d.start||(!single&&date===d.end),inRange=!single&&d.start&&d.end&&date>d.start&&date<d.end,disabled=!toType(d.type).allowPast&&date<todayStr();return `<button type="button" class="${selected?'selected ':''}${inRange?'in-range ':''}${date===todayStr()?'is-today':''}" data-act="to-date" data-date="${date}" aria-label="${esc(toDate(date,true))}" aria-pressed="${selected}" ${disabled?'disabled':''}>${i+1}</button>`;}).join('')}</div></div><p class="to-calendar-help">${esc(toText(single?'calendarSingleHelp':'calendarHelp'))}</p>`;
}
function toDatePreview(value){return toValidDate(value)?esc(toText('selectedDate',{date:toDate(value,true)})):'';}
function toField(label,key,type,value,extra=''){
 const error=UI.to.errors[key];
 return `<label class="to-field" for="to-${key}"><span>${esc(toText(label))}</span><input id="to-${key}" class="input" type="${type}" value="${esc(value)}" data-to-field="${key}" aria-label="${esc(toText(label))}" aria-describedby="to-${key}-error${type==='date'?` to-${key}-preview`:''}" ${error?'aria-invalid="true"':''} ${extra}>${type==='date'?`<span class="to-date-preview" id="to-${key}-preview">${toDatePreview(value)}</span>`:''}<span class="to-field-error" id="to-${key}-error">${error?esc(toText(error)):''}</span></label>`;
}
function toForm(){
 const d=UI.to.draft,type=toType(d.type),single=d.duration!=='Full Day',minimum=type.allowPast?'':`min="${todayStr()}"`,dateHelp=single?(type.allowPast?'sickSingleHelp':'singleDateHelp'):(type.allowPast?'sickHelp':'dateHelp');
 return `<div class="to-request-head"><div class="to-flow-topline"><button class="to-back" data-act="to-list">${icon('left',17)}${esc(toText('back'))}</button>${toStep(0)}</div><header class="to-flow-head"><h2 id="to-screen-title" tabindex="-1">${esc(toText('new'))}</h2><p>${esc(toText('requestIntro'))}</p></header></div>
 <form id="to-request-form" class="to-form-layout" novalidate><section class="to-form-main"><label class="to-field" for="to-type"><span>${esc(toText('type'))}</span><select id="to-type" aria-label="${esc(toText('type'))}" class="select" data-to-field="type">${toEligibleTypes().map(x=>`<option value="${x.id}" ${x.id===d.type?'selected':''}>${esc(toText(x.label))}</option>`).join('')}</select></label>
 <fieldset class="to-duration"><legend>${esc(toText('duration'))}</legend><div>${type.durations.map(duration=>`<label><input type="radio" name="to-duration" data-to-field="duration" value="${duration}" ${duration===d.duration?'checked':''}><span>${esc(toText(TO_DURATION[duration]))}</span></label>`).join('')}</div></fieldset>
 <div class="to-date-inputs ${single?'is-single':''}">${toField(single?'date':'start','start','date',d.start,`required ${minimum}`)}${single?'':toField('end','end','date',d.end,`required ${minimum}`)}</div><p class="to-help" id="to-date-help">${esc(toText(dateHelp))}</p>
 ${d.duration==='Hours'?`<div class="to-date-inputs">${toField('startTime','startTime','time',d.startTime,'required')}${toField('requestedHours','hours','number',d.hours,'required min="0.01" step="any" inputmode="decimal"')}</div>`:''}
 <details id="to-calendar-picker" class="to-calendar-wrap"><summary>${icon('cal',17)}${esc(toText('calendar'))}<span class="to-calendar-disclosure">${icon('down',17)}</span></summary><div class="to-calendar" id="to-calendar">${toCalendar()}</div></details>
 <label class="to-field to-note-field" for="to-note"><span>${esc(toText('note'))} <small>(${esc(toText('optional'))})</small></span><textarea class="input" id="to-note" aria-label="${esc(toText('note'))}" data-to-field="note" rows="3" aria-describedby="to-note-help">${esc(d.note)}</textarea><small id="to-note-help">${esc(toText('noteHelp'))}</small></label></section>
 <aside class="to-form-summary"><div id="to-live-summary">${toDraftSummary(d)}</div><div class="to-flow-actions"><button class="btn primary" type="submit">${esc(toText('reviewAction'))}${icon('right',17)}</button><button class="btn ghost" type="button" data-act="to-list">${esc(toText('discard'))}</button></div></aside></form>`;
}
function toReview(){
 const d=UI.to.draft,b=UI.to.balance;
 return `<button class="to-back" data-act="to-edit">${icon('left',17)}${esc(toText('change'))}</button><header class="to-flow-head"><h2>${esc(toText('reviewTitle'))}</h2><p>${esc(toText('reviewIntro'))}</p></header>${toStep(1)}<section class="to-review" aria-busy="${UI.to.busy}">${toDraftSummary(d)}<dl class="to-summary-facts"><div><dt>${esc(toText('manager'))}</dt><dd>${esc(TO_SAMPLE.managers[TO_SAMPLE.employees[S.persona].manager])}</dd></div><div><dt>${esc(toText('note'))}</dt><dd class="to-review-note">${esc(d.note||toText('noNote'))}</dd></div></dl><div class="to-balance"><h3>${esc(toText('balance'))}</h3>${b?`<p class="to-balance-amount">${b.amount.toLocaleString(loc())} <span>${esc(toText(b.unit))}</span></p><p class="to-help">${esc(toText('asOf',{time:toWhen(b.at)}))}</p>`:`<p><b>${esc(toText('balanceUnavailable'))}</b></p><p class="to-help">${esc(toText('balanceHelp'))}</p>`}</div><footer class="to-flow-actions"><button class="btn" data-act="to-edit" ${UI.to.busy?'disabled':''}>${esc(toText('change'))}</button><button class="btn primary" data-act="to-submit" ${UI.to.busy?'disabled':''}>${UI.to.busy?'':icon('check',17)}${esc(toText(UI.to.busy?'submitting':'submit'))}</button></footer></section>`;
}
function toConfirmation(){
 const r=S.timeOff.requests.find(x=>x.id===UI.to.confirmed&&x.emp===S.persona);
 if(!r){UI.to.screen='list';return toList();}
 return `<header class="to-flow-head"><span class="to-success-mark">${icon('check',25)}</span><h2 tabindex="-1" id="to-confirmation-title">${esc(toText('submittedTitle'))}</h2><p>${esc(toText('submittedIntro'))}</p></header>${toStep(2)}<section class="to-confirmation"><header><b>${esc(r.id)}</b>${toBadge(r.status)}</header>${toDraftSummary(r)}<footer class="to-flow-actions"><button class="btn" data-act="to-list">${esc(toText('back'))}</button><button class="btn primary" data-act="to-select" data-id="${r.id}">${esc(toText('viewRequest'))}${icon('right',17)}</button></footer></section>`;
}
function viewTimeOff(){
 toInit();
 const content={list:toList,form:toForm,review:toReview,confirmation:toConfirmation}[UI.to.screen]||toList;
 return `<div class="to-page">${content()}<footer class="to-preview-foot"><span>${esc(toText('sample'))}</span>${UI.to.screen==='list'?`<span>${esc(toText('latest',{time:toWhen(S.timeOff.lastUpdated)}))}</span>`:''}</footer></div>`;
}
function toCaptureFocus(){
 const el=document.activeElement;if(!el||el===document.body)return null;
 let selector=el.id?'#'+CSS.escape(el.id):el.tagName.toLowerCase();
 if(!el.id){
  ['act','id','action','scope','delta','date','toFilter','toField'].forEach(key=>{if(el.dataset[key])selector+='[data-'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+'="'+CSS.escape(el.dataset[key])+'"]';});
  if(el.name)selector+='[name="'+CSS.escape(el.name)+'"]';
  if(el.type==='radio')selector+='[value="'+CSS.escape(el.value)+'"]';
 }
 const details=el.closest('details');
 return {selector,value:['INPUT','TEXTAREA','SELECT'].includes(el.tagName)?el.value:null,start:el.selectionStart,end:el.selectionEnd,details:details?.id,open:details?.open};
}
function toRestoreFocus(token,id){
 if(token?.details){const details=document.getElementById(token.details);if(details)details.open=token.open;}
 let el=id?document.getElementById(id):token?document.querySelector(token.selector):null;
 if(!el||!el.getClientRects().length||el.disabled)el=document.getElementById('to-screen-title');
 if(!el)return;
 if(!id&&token?.value!==null&&token?.value!==undefined&&'value' in el)el.value=token.value;
 el.focus({preventScroll:!id});
 if(!id&&token?.start!==null&&token?.start!==undefined&&typeof el.setSelectionRange==='function')try{el.setSelectionRange(token.start,token.end);}catch{}
}
function toRenderFocus(id,token=toCaptureFocus()){render();toRestoreFocus(token,id);}
function toStart(){
 toInit();UI.to.scope='mine';UI.to.screen='form';UI.to.errors={};UI.to.draft={type:toEligibleTypes()[0].id,start:'',end:'',duration:'Full Day',hours:'',startTime:'09:00',note:''};UI.to.month=todayStr().slice(0,7);UI.to.rangePicking=false;toRenderFocus('to-type');window.scrollTo({top:0});
}
function toNextId(){return 'TO-'+(Math.max(1046,...S.timeOff.requests.map(r=>Number(r.id.replace('TO-',''))||0))+1);}
function toValidDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&ymd(parseYmd(value))===value;}
function toValidate(d){
 const errors={},type=toType(d.type);
 if(!type||!toEligibleTypes().some(x=>x.id===type.id)||!type.durations.includes(d.duration)){errors.type='checkFields';return errors;}
 const dates=d.duration==='Full Day'?['start','end']:['start'];
 dates.forEach(k=>{if(!toValidDate(d[k]))errors[k]='requiredDate';else if(!type.allowPast&&d[k]<todayStr())errors[k]='pastError';});
 if(d.duration==='Full Day'&&toValidDate(d.start)&&toValidDate(d.end)&&d.end<d.start)errors.end='invalidRange';
 if(d.duration==='Hours'){
  if(!Number.isFinite(Number(d.hours))||Number(d.hours)<=0)errors.hours='hoursError';
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime))errors.startTime='timeError';
 }
 return errors;
}
function toReviewDraft(){
 UI.to.errors=toValidate(UI.to.draft);
 if(Object.keys(UI.to.errors).length){toast(toText('checkFields'),'error');toRenderFocus('to-'+Object.keys(UI.to.errors)[0]);return;}
 if(UI.to.draft.duration!=='Full Day')UI.to.draft.end=UI.to.draft.start;
 UI.to.balance=S.settings.toBalanceUnavailable?null:{...TO_SAMPLE.balances[UI.to.draft.type],at:nowTs()};
 UI.to.screen='review';toRenderFocus();window.scrollTo({top:0});document.querySelector('.to-flow-head h2')?.setAttribute('tabindex','-1');document.querySelector('.to-flow-head h2')?.focus();
}
async function toSubmit(){
 if(UI.to.busy||UI.to.screen!=='review')return;
 if(Object.keys(toValidate(UI.to.draft)).length){UI.to.screen='form';toReviewDraft();return;}
 const owner=S.persona,draft={...UI.to.draft,hours:UI.to.draft.duration==='Hours'?Number(UI.to.draft.hours):null,startTime:UI.to.draft.duration==='Hours'?UI.to.draft.startTime:''},ui=UI.to,store=S.timeOff;
 ui.busy=true;toRenderFocus();await new Promise(resolve=>setTimeout(resolve,450));
 if(S.timeOff!==store){ui.busy=false;return;}
 if(S.settings.toFailSubmit){S.settings.toFailSubmit=false;ui.busy=false;persist();if(UI.to===ui&&S.view==='timeoff'&&S.persona===owner&&ui.screen==='review'){toRenderFocus();toast(toText('submitError'),'error');}return;}
 const created=nowTs().replace(' ','T')+':00',id=toNextId(),rule=TO_SAMPLE.rules[draft.type];
 const r={...draft,id,emp:owner,manager:TO_SAMPLE.employees[owner].manager,status:'Submitted',created,updated:created,history:[{action:'Submitted',at:created,actor:owner}]};
 if(rule)r.autoApproval={at:new Date(new Date(created).getTime()+rule.delayMilliseconds).toISOString(),rule:rule.name};
 S.timeOff.requests.unshift(r);S.timeOff.lastUpdated=nowTs();persist();
 ui.busy=false;ui.confirmed=id;ui.balance=null;ui.screen='confirmation';
 if(UI.to===ui&&S.persona===owner){toRenderFocus('to-confirmation-title');window.scrollTo({top:0});toast(toText('submittedTitle'),'success');}
}
let toDialogTrigger=null;
function toCloseDialog(){const d=document.getElementById('to-dialog');if(d){d.close();d.remove();}UI.to.dialog=null;const el=toDialogTrigger;toDialogTrigger=null;if(el?.isConnected)el.focus();}
function toOpenDecision(r,action,trigger){
 if(!['cancel','approve','refuse'].includes(action))return;
 if(!toAccessible(r)||r.status!=='Submitted')return;
 if(action==='cancel'&&r.emp!==S.persona)return;
 if(action!=='cancel'&&(!toManager()||r.manager!==S.persona||r.emp===S.persona))return;
 toDialogTrigger=trigger;UI.to.dialog={id:r.id,action,owner:S.persona};
 const key=action==='cancel'?'cancelQuestion':action==='approve'?'approveQuestion':'refuseQuestion';
 $('#layer').innerHTML=`<dialog class="to-dialog" id="to-dialog" aria-labelledby="to-dialog-title" aria-describedby="to-dialog-help"><header><h3 id="to-dialog-title">${esc(toText(key))}</h3><button type="button" class="icon-btn" data-act="to-close-dialog" aria-label="${esc(toText('close'))}">${icon('x',18)}</button></header><form id="to-decision-form"><div class="to-dialog-body"><p><b>${esc(toText(toType(r.type).label))}</b> · ${esc(toDateRange(r))}</p><p id="to-dialog-help">${esc(toText(action==='cancel'?'cancelHelp':'decisionHelp'))}</p>${action==='refuse'?`<label class="to-field" for="to-reason"><span>${esc(toText('reason'))}</span><textarea class="input" id="to-reason" aria-label="${esc(toText('reason'))}" rows="4" required aria-describedby="to-reason-help"></textarea><small id="to-reason-help">${esc(toText('reasonHelp'))}</small></label>`:''}</div><footer><button type="button" class="btn" data-act="to-close-dialog">${esc(toText(action==='cancel'?'keep':'close'))}</button><button id="to-decision-button" class="btn ${action==='refuse'?'danger':'primary'}" type="submit" ${action==='refuse'?'disabled':''}>${esc(toText(action==='cancel'?'cancelRequest':action))}</button></footer></form></dialog>`;
 const dialog=document.getElementById('to-dialog');dialog.addEventListener('cancel',e=>{e.preventDefault();toCloseDialog();});dialog.showModal();document.getElementById('to-reason')?.focus();
}
function toCommitDecision(){
 const context=UI.to.dialog;if(!context||context.owner!==S.persona)return;
 toApplyRules();const r=S.timeOff.requests.find(x=>x.id===context.id),reason=document.getElementById('to-reason')?.value.trim()||'';
 if(!toAccessible(r)||r.status!=='Submitted'){toCloseDialog();render();toast(toText('changed'),'error');return;}
 const mine=r.emp===S.persona,manager=toManager()&&r.manager===S.persona&&!mine;
 if(context.action==='cancel'&&!mine||context.action!=='cancel'&&!manager)return;
 if(context.action==='refuse'&&!reason)return;
 r.status={cancel:'Cancelled',approve:'Approved',refuse:'Refused'}[context.action];r.updated=nowTs().replace(' ','T')+':00';r.history.push({action:r.status,at:r.updated,actor:S.persona,reason});
 if(context.action!=='cancel')toNotify(r);
 UI.to.lastDecision=r.id;
 S.timeOff.lastUpdated=nowTs();toCloseDialog();persist();toRenderFocus('to-request-detail');toast(toText('updated'),'success');
}
async function toRefresh(){
 if(UI.to.refreshing)return;const ui=UI.to,focus=toCaptureFocus();ui.refreshing=true;toRenderFocus(null,focus);await new Promise(resolve=>setTimeout(resolve,350));
 ui.refreshing=false;
 const failed=S.settings.toFailRefresh;
 if(failed)S.settings.toFailRefresh=false;
 else{toApplyRules();S.timeOff.lastUpdated=nowTs();}
 persist();if(UI.to===ui&&S.view==='timeoff'){toRenderFocus(null,focus);if(failed)toast(toText('refreshError'),'error','bottom',{label:toText('retry'),act:'to-refresh'});}
}
function toAction(action,el){
 if(!action.startsWith('to-'))return false;
 toInit();
 switch(action){
  case 'to-new':toStart();break;
  case 'to-list':UI.to.screen='list';UI.to.detailOpen=false;toRenderFocus('to-screen-title');break;
  case 'to-edit':if(!UI.to.busy){UI.to.screen='form';UI.to.errors={};toRenderFocus('to-type');}break;
  case 'to-scope':UI.to.scope=el.dataset.scope==='team'&&toManager()?'team':'mine';UI.to.filter=UI.to.scope==='team'?'Submitted':'all';UI.to.typeFilter='all';UI.to.employeeFilter='all';UI.to.from='';UI.to.until='';UI.to.detailOpen=false;UI.to.selected=null;UI.to.screen='list';toRenderFocus();break;
  case 'to-select':{const r=S.timeOff.requests.find(x=>x.id===el.dataset.id);if(toAccessible(r)){const visible=UI.to.screen==='list'&&toFiltered().some(x=>x.id===r.id);UI.to.selected=r.id;UI.to.screen='list';UI.to.detailOpen=true;if(r.emp===S.persona)UI.to.scope='mine';if(!visible){UI.to.filter='all';UI.to.typeFilter='all';UI.to.employeeFilter='all';UI.to.from='';UI.to.until='';}toRenderFocus('to-request-detail');}break;}
  case 'to-close-detail':UI.to.detailOpen=false;toRenderFocus();document.querySelector(`.to-request-row[data-id="${UI.to.selected}"]`)?.focus();break;
  case 'to-clear':case 'to-all':UI.to.filter='all';UI.to.typeFilter='all';UI.to.employeeFilter='all';UI.to.from='';UI.to.until='';toRenderFocus();break;
  case 'to-submit':void toSubmit();break;
  case 'to-confirm':toOpenDecision(S.timeOff.requests.find(x=>x.id===el.dataset.id),el.dataset.action,el);break;
  case 'to-close-dialog':toCloseDialog();break;
  case 'to-refresh':void toRefresh();break;
  case 'to-demo-run':{const eligible=S.timeOff.requests.filter(r=>r.status==='Submitted'&&r.autoApproval).sort((a,b)=>a.autoApproval.at.localeCompare(b.autoApproval.at));if(eligible.length)toApplyRules(new Date(eligible[0].autoApproval.at).getTime());closeDialog();S.timeOff.lastUpdated=nowTs();persist();render();toast('Sample approval rule applied.','success');break;}
  case 'to-demo-reset':S.timeOff=toSeed();S.settings.toFailSubmit=false;S.settings.toFailRefresh=false;S.settings.toBalanceUnavailable=false;toResetUI();closeDialog();persist();render();break;
  case 'to-dismiss':S.timeOff.notifications=S.timeOff.notifications.filter(n=>!(n.emp===S.persona&&n.id===el.dataset.id));persist();render();break;
  case 'to-month':{const d=parseYmd(UI.to.month+'-01');d.setMonth(d.getMonth()+Number(el.dataset.delta));UI.to.month=ymd(d).slice(0,7);const focus=toCaptureFocus();document.getElementById('to-calendar').innerHTML=toCalendar();toRestoreFocus(focus);break;}
  case 'to-date':{const d=UI.to.draft,date=el.dataset.date;if(!toType(d.type).allowPast&&date<todayStr())break;if(d.duration!=='Full Day'){d.start=date;d.end=date;UI.to.rangePicking=false;}else if(!UI.to.rangePicking){d.start=date;d.end=date;UI.to.rangePicking=true;}else{d.end=date;if(d.end<d.start)[d.start,d.end]=[d.end,d.start];UI.to.rangePicking=false;}UI.to.errors={};toRenderFocus();document.querySelector(`[data-act="to-date"][data-date="${date}"]`)?.focus();break;}
 }
 return true;
}
document.addEventListener('submit',e=>{
 if(e.target.id==='to-request-form'){e.preventDefault();toReviewDraft();}
 if(e.target.id==='to-decision-form'){e.preventDefault();toCommitDecision();}
});
document.addEventListener('input',e=>{
 const filter=e.target.dataset.toFilter;if(filter){const preview=document.getElementById('to-filter-'+filter+'-preview');if(preview)preview.innerHTML=toDatePreview(e.target.value);}
 const key=e.target.dataset.toField;if(key&&UI.to.draft){UI.to.draft[key]=e.target.value;if(key==='start'&&UI.to.draft.duration!=='Full Day')UI.to.draft.end=e.target.value;delete UI.to.errors[key];const error=document.getElementById('to-'+key+'-error');if(error)error.textContent='';e.target.removeAttribute('aria-invalid');const preview=document.getElementById('to-'+key+'-preview');if(preview)preview.innerHTML=toDatePreview(e.target.value);const summary=document.getElementById('to-live-summary');if(summary)summary.innerHTML=toDraftSummary(UI.to.draft);}
 if(e.target.id==='to-reason'){document.getElementById('to-decision-button').disabled=!e.target.value.trim();}
});
document.addEventListener('change',e=>{
 const setting=e.target.dataset.toSetting;if(setting){S.settings[setting]=e.target.checked;persist();return;}
 const filter=e.target.dataset.toFilter;
 if(filter){UI.to[filter]=e.target.value;UI.to.detailOpen=false;UI.to.selected=null;render();document.querySelector(`[data-to-filter="${filter}"]`)?.focus();return;}
 const key=e.target.dataset.toField;if(!key||!UI.to.draft)return;
 UI.to.draft[key]=e.target.value;
 if(key==='type'||key==='duration'){
  const type=toType(UI.to.draft.type);if(!type.durations.includes(UI.to.draft.duration))UI.to.draft.duration=type.durations[0];if(UI.to.draft.duration!=='Full Day')UI.to.draft.end=UI.to.draft.start||'';UI.to.rangePicking=false;UI.to.errors={};render();document.querySelector(key==='type'?'#to-type':`input[name="to-duration"][value="${UI.to.draft.duration}"]`)?.focus();
 }else if(key==='start'||key==='end'){
  if(key==='start'&&toValidDate(e.target.value)){UI.to.month=e.target.value.slice(0,7);if(UI.to.draft.duration!=='Full Day'||!UI.to.draft.end||UI.to.draft.end<e.target.value){UI.to.draft.end=e.target.value;const end=document.getElementById('to-end'),preview=document.getElementById('to-end-preview');if(end)end.value=e.target.value;if(preview)preview.innerHTML=toDatePreview(e.target.value);}}
  UI.to.rangePicking=false;document.getElementById('to-calendar').innerHTML=toCalendar();document.getElementById('to-live-summary').innerHTML=toDraftSummary(UI.to.draft);
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('to-dialog')){e.preventDefault();e.stopImmediatePropagation();toCloseDialog();}},true);
toInit();
function toDemoSettings(){return `<div class="stack"><b>Time Off preview scenarios</b><label class="toggle"><input type="checkbox" data-to-setting="toFailSubmit" ${S.settings.toFailSubmit?'checked':''}><span><b>Next request cannot be submitted</b><small>Shows the recovery message and preserves entered details.</small></span></label><label class="toggle"><input type="checkbox" data-to-setting="toBalanceUnavailable" ${S.settings.toBalanceUnavailable?'checked':''}><span><b>Current balance is unavailable</b><small>Shows this state only on the review step.</small></span></label><label class="toggle"><input type="checkbox" data-to-setting="toFailRefresh" ${S.settings.toFailRefresh?'checked':''}><span><b>Next request refresh cannot finish</b><small>Retains the last confirmed statuses.</small></span></label><button class="btn" data-act="to-demo-run">Run sample approval rule</button><button class="btn" data-act="to-demo-reset">Reset Time Off sample data</button><small>Advances the sample rule to its next configured deadline. Sample data only.</small></div>`;}
setInterval(()=>{if(S.timeOff){const changed=toApplyRules();if(changed&&S.view==='timeoff'&&UI.to.screen==='list'&&!document.getElementById('to-dialog'))toRenderFocus();}},60000);
