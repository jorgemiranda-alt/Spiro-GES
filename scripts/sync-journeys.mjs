import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SHEET_ID = '1ZjEKU21p1VmP_A28lCFzTqQwOlINSt22Tutgm2t55J8';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const SNAPSHOT = path.join(ROOT,'data/journeys.snapshot.json');
const SPEC = path.join(ROOT,'outputs/Spiro_Global_Time_Entry_UI_UX_Specification.md');
const EPICS = {
  E1:'Punch screen and punch actions (spec §5.1.1–5.1.9)', E2:'My Timecard (spec §5.1.10)',
  E3:'Project hours, salaried (spec §5.2)', E4:'Time Off (spec §5.3)',
  E5:'Timeclock, warehouse kiosk (spec §5.5)',
  E7:'Shared access, localization and mobile (spec §3, §7, §9)'
};
const HEADERS=['ID','Epic','Journey','Actor','Population','User story','Trigger','Preconditions','Main flow','Alternate / exception','Business rules','UKG / Odoo touchpoint','Acceptance criteria (Given / When / Then)','Evidence level','Sources','Open Q','Priority','Demo','Demo path','Sprint','Points','Delivery status','Validation status','Validator','Validated on','Acceptance test','Leadership decision','Decision date','Comments','Specification status','Specification reference','Requirement IDs','Scope','Demo persona','Demo view','Demo highlight','Content revision','Current state','Grid fields (JSON)'];
const QHEADERS=['Question ID','Area','Question for Spiro','Why it matters','Priority','Linked journeys','Owner (Spiro)','Status','Answer','Answered on'];
const RHEADERS=['Requirement ID','Legacy document ID','Requirement','Documented status','Linked journey IDs','Specification','Notes','Content revision'];
const val=c=>c?.effectiveValue?.stringValue??c?.effectiveValue?.numberValue??c?.userEnteredValue?.stringValue??c?.userEnteredValue?.numberValue??c?.formattedValue??'';
const split=s=>String(s||'').split(',').map(x=>x.trim()).filter(x=>x && x!=='—' && x!=='-');
function table(sheet, row, headers){
  const data=sheet.data||[];const matrix=[];
  for(const block of data)for(const [i,r] of (block.rowData||[]).entries()){
    const nr=(block.startRow||0)+i;matrix[nr] ||= [];
    for(const [c,v] of (r.values||[]).entries())matrix[nr][(block.startColumn||0)+c]=val(v);
  }
  for(const [i,h] of headers.entries())if(matrix[row]?.[i]!==h)throw new Error(`${sheet.properties.title}: expected header ${h} in column ${i+1}`);
  const rows=matrix.slice(row+1);
  for(const [i,r] of rows.entries())if(r&&!r[0]&&r.some(v=>String(v??'').trim()))throw new Error(`${sheet.properties.title}: missing ID in row ${row+i+2}`);
  return rows.filter(r=>r?.[0]).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function parseSheet(exported, importedAt=new Date().toISOString()){
  const raw=exported.structuredContent||exported;
  if(raw.spreadsheetId!==SHEET_ID)throw new Error('Wrong spreadsheet ID; refusing import');
  const find=name=>{const s=raw.sheets?.find(s=>s.properties.title===name);if(!s)throw new Error(`Missing ${name} tab`);return s;};
  const journeys=table(find('Journeys'),3,HEADERS).map(r=>{
    const ac=String(r[HEADERS[12]]).split(/\n+/).filter(Boolean).map(l=>{const m=l.match(/^(?:AC\d+:\s*)?GIVEN (.*?); WHEN (.*?); THEN (.*)$/i);if(!m)throw new Error(`${r.ID}: malformed acceptance criterion`);return m.slice(1);});
    let gridFields;
    if(r['Grid fields (JSON)']){gridFields=JSON.parse(r['Grid fields (JSON)']);if(!Array.isArray(gridFields)||gridFields.some(x=>!Array.isArray(x)||x.length!==2||x.some(v=>typeof v!=='string')))throw new Error(`${r.ID}: invalid grid-field metadata`);}
    return {id:r.ID,epic:r.Epic,name:r.Journey,actor:r.Actor,population:r.Population,story:r['User story'],trigger:r.Trigger,pre:r.Preconditions,flow:r['Main flow'],alt:r['Alternate / exception'],rules:r['Business rules'],api:r['UKG / Odoo touchpoint'],ac,ev:r['Evidence level'],src:r.Sources,q:r['Open Q'],pri:r.Priority,cov:r.Demo,demo:[r['Demo persona'],r['Demo view'],r['Demo highlight'],r['Demo path']],specStatus:r['Specification status'],specRef:r['Specification reference'],requirementIds:split(r['Requirement IDs']),scope:r.Scope,contentRevision:r['Content revision'],currentState:r['Current state'],...(gridFields?{gridFields}:{}),workflow:{sprint:r.Sprint,points:r.Points,delivery:r['Delivery status'],validation:r['Validation status'],validator:r.Validator,validatedOn:r['Validated on'],acceptanceTest:r['Acceptance test'],decision:r['Leadership decision'],decisionDate:r['Decision date'],comments:r.Comments}};
  });
  const questions=table(find('OpenQuestions'),3,QHEADERS).map(r=>({id:r['Question ID'],area:r.Area,question:r['Question for Spiro'],why:r['Why it matters'],priority:r.Priority,journeyIds:split(r['Linked journeys']),owner:r['Owner (Spiro)'],status:r.Status,answer:r.Answer,answeredOn:r['Answered on']}));
  const requirements=table(find('Requirements'),0,RHEADERS).map(r=>({id:r['Requirement ID'],legacyId:r['Legacy document ID'],text:r.Requirement,status:r['Documented status'],journeyIds:split(r['Linked journey IDs']),specRef:r.Specification,notes:r.Notes,contentRevision:r['Content revision']}));
  // The committed snapshot can be published with the demo. Keep private review
  // comments, answers, reviewer names and planning fields in the source sheet.
  for(const j of journeys){const w=j.workflow;j.workflow={delivery:w.delivery,validation:w.validation,acceptanceTest:w.acceptanceTest,decision:w.decision};}
  for(const q of questions){delete q.owner;delete q.answer;delete q.answeredOn;}
  const body={schemaVersion:1,source:{spreadsheetId:SHEET_ID,url:URL,journeySheetId:find('Journeys').properties.sheetId,questionSheetId:find('OpenQuestions').properties.sheetId,requirementSheetId:find('Requirements').properties.sheetId},epics:EPICS,journeys,questions,requirements};
  const revision=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0,12);
  const snapshot={...body,metadata:{revision,importedAt,contentRevision:[...new Set(journeys.map(j=>j.contentRevision))].join(', ')}};
  validate(snapshot);return snapshot;
}
export function validate(s){
  const unique=(rows,label)=>{const ids=new Set();for(const r of rows){if(!/^[A-Z][A-Z0-9-]*$/.test(r.id||'')||ids.has(r.id))throw new Error(`Duplicate/missing/invalid ${label} ID: ${r.id}`);ids.add(r.id);}return ids;};
  if(s.schemaVersion!==1||s.source?.spreadsheetId!==SHEET_ID)throw new Error('Unsupported snapshot/source');
  const js=unique(s.journeys,'journey'),qs=unique(s.questions,'question'),rs=unique(s.requirements,'requirement');
  const status=new Set(['Confirmed','Prototype','Proposed','Open decision','Out of scope']);
  const scope=new Set(['Current','Draft','Future','Out of scope']);
  const coverage=new Set(['Covered','Partial','Prototype differs','Not prototyped']);
  const people=new Set(['ava','maya','zofia','lukas','oliver']);
  const views=new Set(['home','punch','timecard','grid','approvals','kiosk','timeoff']);
  for(const j of s.journeys){
    if(!s.epics[j.epic]||!status.has(j.specStatus)||!scope.has(j.scope)||!coverage.has(j.cov))throw new Error(`${j.id}: invalid epic/status/scope/coverage`);
    for(const k of ['name','actor','story','flow','rules','specRef','contentRevision'])if(!String(j[k]||'').trim())throw new Error(`${j.id}: missing ${k}`);
    if(!j.ac.length)throw new Error(`${j.id}: missing acceptance criteria`);
    for(const id of split(j.q))if(!qs.has(id))throw new Error(`${j.id}: unknown question ${id}`);
    for(const id of j.requirementIds)if(!rs.has(id))throw new Error(`${j.id}: unknown requirement ${id}`);
    if(j.demo[0]||j.demo[1])if(!people.has(j.demo[0])||!views.has(j.demo[1]))throw new Error(`${j.id}: invalid demo route`);
  }
  for(const q of s.questions){if(!['Open','Asked','Answered','Deferred'].includes(q.status))throw new Error(`${q.id}: invalid question status`);for(const id of q.journeyIds)if(!js.has(id))throw new Error(`${q.id}: unknown journey ${id}`);}
  for(const r of s.requirements){for(const id of r.journeyIds)if(!js.has(id))throw new Error(`${r.id}: unknown journey ${id}`);const linked=s.journeys.filter(j=>j.requirementIds.includes(r.id)).map(j=>j.id).sort();if(JSON.stringify(linked)!==JSON.stringify([...r.journeyIds].sort()))throw new Error(`${r.id}: requirement/journey crosswalk does not agree`);}
  if(!s.journeys.find(j=>j.id==='TC-01')?.currentState.includes('Read-only'))throw new Error('TC-01 must retain read-only baseline');
}
const md=s=>String(s||'—').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
const ordered=s=>[...s.journeys].sort((a,b)=>a.epic.localeCompare(b.epic));
function journey(j){
  const draft=j.scope!=='Current'?`\n> **${j.scope}:** This retained journey is not an approved current-release requirement. ${j.currentState||''}\n`:'';
  const fields=j.gridFields?`\n**Grid fields**\n\n| Column | Display behavior |\n|---|---|\n${j.gridFields.map(r=>`| ${md(r[0])} | ${md(r[1])} |`).join('\n')}\n`:'';
  return `\n##### ${j.id} — ${j.name}\n\n**Actor:** ${j.actor}  \n**Specification status:** ${j.specStatus} · ${j.specRef}  \n**Scope:** ${j.scope} · **Prototype:** ${j.cov} · **Client decision:** ${j.workflow.decision||'Pending'}  \n**Requirement IDs:** ${j.requirementIds.join(', ')||'—'} · **Questions:** ${j.q||'—'}\n${draft}\n**User story:** ${j.story}\n\n**Trigger:** ${j.trigger}  \n**Preconditions:** ${j.pre}\n${j.currentState?`\n**Current state:** ${j.currentState}\n`:''}\n**Main flow:**\n\n${j.flow.replace(/\s+(\d+)\. /g,'\n$1. ')}\n\n**Alternative / exception:** ${j.alt||'—'}\n\n**Rules:** ${j.rules}\n${fields}\n**Acceptance criteria:**\n\n${j.ac.map(a=>`- Given ${a[0]}; when ${a[1]}; then ${a[2]}.`).join('\n')}\n\n**Integration note:** ${j.api}  \n**Evidence / source:** ${j.ev} · ${j.src}\n`;
}
export function renderJourneySection(s){
  const lookup=new Map(s.journeys.map(j=>[j.id,j])),used=new Set();
  const items=ids=>ids.map(id=>{const j=lookup.get(id);if(!j)return '';used.add(id);return journey(j);}).join('\n');
  const intro=`## 5. User journeys\n\n<!-- journey-sync:start -->\nGenerated from the [Google Sheet journey register](${URL}). **Snapshot ${s.metadata.revision}**, imported ${s.metadata.importedAt}. Edit journey wording, requirements and questions in the sheet, then regenerate. Evidence, prototype coverage, validation and client approval are separate. Historical draft/future journeys are retained without enabling employee actions.\n`;
  const groups=[['5.1 Hourly employee: Punch and My Timecard',null],['5.1.1 Punch screen and Odoo/UKG separation',['PU-06','CC-04']],['5.1.2 Punch in',['PU-01']],['5.1.3 Manage Odoo projects',['PU-12']],['5.1.4 Start and end a break',['PU-03']],['5.1.5 Stage or change a UKG transfer',['PU-04']],['5.1.6 Punch out',['PU-02']],['5.1.7 Blocked punches',['PU-05']],['5.1.8 UKG feedback',['PU-07','PU-08']],['5.1.9 Punch populations',['PU-11']],['5.1.10 My Timecard: hourly read-only review',s.journeys.filter(j=>j.epic==='E2').map(j=>j.id)],['5.2 Project Hours: salaried weekly entry',null],['5.2.1 Weekly grid and project selection',['GR-01','GR-02','GR-03','GR-04','GR-07']],['5.2.2 Validate and save',['GR-05','GR-08','GR-09','GR-11']],['5.2.3 Future or draft hourly variants',['GR-06','GR-10']],['5.3 Employee Time Off',null],['5.3.1 Overview and request progress',['TO-01','TO-04']],['5.3.2 Request and cancellation',['TO-02','TO-03','TO-07']]];
  let out=intro;
  for(const [heading,ids] of groups){if(ids&&!ids.some(id=>lookup.has(id)))continue;out+=`\n${/^5\.\d+ /.test(heading)?'###':'####'} ${heading}\n${ids?items(ids):''}`;}
  out+='\n#### 5.3.3 Time Off requirement crosswalk\n\nRequirement IDs are separate from journey IDs; legacy document IDs are retained for reference.\n\n| Requirement ID | Legacy ID | Requirement | Documented status | Journeys |\n|---|---|---|---|---|\n'+s.requirements.map(r=>`| ${r.id} | ${r.legacyId} | ${md(r.text)} | ${md(r.status)} | ${r.journeyIds.join(', ')} |`).join('\n')+'\n';
  out+='\n#### 5.3.4 Request states\n\nSubmitted, Approved, Refused and Cancelled are the request states. Automatic approval remains Approved, with its rule and decision timestamp recorded in history.\n';
  out+='\n#### 5.3.5 Assigned Manager Time Off review\n'+items(['TO-05']);
  out+='\n#### 5.3.6 Automatic approval and policy boundaries\n'+items(['TO-06']);
  out+='\n#### 5.3.7 Accessibility and responsive acceptance\n\nThe TO-02/TO-03/TO-04 criteria and REQ-TO-08/REQ-TO-12 cover form/list alternatives, accessible feedback, localization, request-date preservation and desktop/mobile layout. WCAG 2.2 AA and full browser/device conformance require validation. Formal UKG Leave cases and team availability planning remain outside first-release scope.\n';
  out+='\n### 5.5 Warehouse Kiosk / Timeclock\n\nAction-first badge-only authentication and 60-second scan/history countdowns are the current baseline; production provisioning, lookup and outage behavior remain open.\n';
  out+='\n#### 5.5.1 Select an action and authenticate\n'+items(['PU-09']);
  out+='\n#### 5.5.2 Excluded project barcode flow\n'+items(['PU-10']);
  out+='\n#### 5.5.3 Recent punches\n'+items(['KI-01']);
  out+='\n#### 5.5.4 Timeout, cancel and return home\n'+items(['KI-02']);
  out+='\n### 5.6 Administrator configuration dependency\n\nAdministrators configure access, labor profiles and approval rules in the CloudApper platform. Platform screens remain outside the custom-page scope.\n\n### 5.7 Reporting\n\nReporting scope is not finalized.\n\n### 5.8 Shared access, localization and mobile — validation proposals\n'+items(s.journeys.filter(j=>j.epic==='E7').map(j=>j.id));
  const additional=ordered(s).filter(j=>!used.has(j.id));
  if(additional.length)out+='\n### 5.9 Additional journeys registered in the sheet\n'+items(additional.map(j=>j.id));
  return out+'\n<!-- journey-sync:end -->\n\n';
}
export function renderQuestions(s){
  return `## 9. Open decisions\n\n<!-- question-sync:start -->\nGenerated from [OpenQuestions](${URL}#gid=${s.source.questionSheetId}) · snapshot ${s.metadata.revision}. Client answers and review comments are retained in the sheet and incorporated into journey wording after review.\n\n`+s.questions.map(q=>`### ${q.id} — ${q.area}\n\n**Status:** ${q.status} · **Priority:** ${q.priority} · **Journeys:** ${q.journeyIds.join(', ')||'—'}\n\n${q.question}\n\n**Why it matters:** ${q.why}\n`).join('\n')+'\n<!-- question-sync:end -->\n\n';
}
export async function artifacts(s, oldSpec){
  validate(s);
  const assets=JSON.parse(await fs.readFile(path.join(ROOT,'data/journey-assets.json'),'utf8'));
  for(const [id,a] of Object.entries(assets))for(const shot of a.shots||[]){if(path.isAbsolute(shot.src)||shot.src.includes('..')||!shot.src.startsWith('journeys/prototype/'))throw new Error(`${id}: unsafe screenshot path`);await fs.access(path.join(ROOT,'public',shot.src));}
  const publicJourneys=ordered(s).map(j=>{const {workflow,...content}=j;return {...content,reviewStatus:workflow.validation,deliveryStatus:workflow.delivery,clientDecision:workflow.decision,...assets[j.id]};});
  const js='// GENERATED from data/journeys.snapshot.json. Edit the Google Sheet and run scripts/sync-journeys.mjs.\n'+`const JOURNEY_SYNC = ${JSON.stringify({...s.metadata,sheetUrl:URL,journeyCount:s.journeys.length,questionCount:s.questions.length,requirementsCount:s.requirements.length})};\nconst JOURNEYS = ${JSON.stringify(publicJourneys)};\nconst EPICS = ${JSON.stringify(s.epics)};\n`;
  if(!oldSpec.includes('<!-- journey-sync:start -->')||!oldSpec.includes('<!-- question-sync:start -->'))throw new Error('Specification needs --initialize-spec before first synchronization');
  let spec=oldSpec.replace(/## 5\. User journeys\r?\n[\s\S]*?(?=## 6\.)/,renderJourneySection(s)).replace(/## 9\. Open decisions\r?\n[\s\S]*?(?=## 10\.)/,renderQuestions(s));
  if(!spec.includes(`Snapshot ${s.metadata.revision}`)||!spec.includes(`snapshot ${s.metadata.revision}`))throw new Error('Specification block replacement failed');
  const index=await fs.readFile(path.join(ROOT,'public/index.html'),'utf8');
  if(!/js\/journeys-data\.js\?v=[^" ]+/.test(index))throw new Error('Missing journey data script/cache version in index.html');
  const versionedIndex=index.replace(/js\/journeys-data\.js\?v=[^" ]+/,`js/journeys-data.js?v=${s.metadata.revision}`);
  return new Map([['public/js/journeys-data.js',js],['public/index.html',versionedIndex],['outputs/Spiro_Global_Time_Entry_UI_UX_Specification.md',spec],['data/time-off-requirements.json',JSON.stringify(s.requirements,null,2)+'\n']]);
}
export async function pull(){
  const token=process.env.GOOGLE_ACCESS_TOKEN;
  if(!token)throw new Error('GOOGLE_ACCESS_TOKEN is not configured. Import an authenticated connector get_spreadsheet_cells export with --import-sheet instead.');
  const api=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
  const read=async query=>{const r=await fetch(api+'?'+query,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error(`Google Sheets read failed (HTTP ${r.status})`);return r.json();};
  const meta=await read(new URLSearchParams({fields:'spreadsheetId,sheets(properties(title))'}));
  for(const name of ['Journeys','OpenQuestions','Requirements'])if(!meta.sheets.some(s=>s.properties.title===name))throw new Error(`Missing ${name} tab`);
  const params=new URLSearchParams({includeGridData:'true',fields:'spreadsheetId,properties(title),sheets(properties(title,sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue))))'});
  for(const r of ['Journeys!A1:AM500','OpenQuestions!A1:J500','Requirements!A1:H100'])params.append('ranges',r);
  return read(params);
}
async function main(){
  const args=process.argv.slice(2);let s;
  if(args.includes('--demo-only')&&!args.includes('--check'))throw new Error('--demo-only is only supported with --check');
  const index=args.indexOf('--import-sheet');
  if(args.includes('--pull'))s=parseSheet(await pull());
  else if(index>=0){if(!args[index+1])throw new Error('Provide the connector export path');s=parseSheet(JSON.parse(await fs.readFile(path.resolve(args[index+1]),'utf8')));}
  else s=JSON.parse(await fs.readFile(SNAPSHOT,'utf8'));
  let spec=args.includes('--demo-only')?'## 5. User journeys\n<!-- journey-sync:start -->\n## 6. Other\n## 9. Open decisions\n<!-- question-sync:start -->\n## 10. References\n':await fs.readFile(SPEC,'utf8');
  if(args.includes('--initialize-spec')){
    if(args.includes('--check'))throw new Error('--initialize-spec cannot be combined with --check');
    spec=spec.replace(/## 5\. User journeys\r?\n[\s\S]*?(?=## 6\.)/,'## 5. User journeys\n\n<!-- journey-sync:start -->\n<!-- journey-sync:end -->\n\n').replace(/## 9\. Open decisions\r?\n[\s\S]*?(?=## 10\.)/,'## 9. Open decisions\n\n<!-- question-sync:start -->\n<!-- question-sync:end -->\n\n').replace(/^\*\*Document status:\*\*.*$/m,'**Document status:** Initial draft — version 0.25 (journeys and open questions generated from the collaborative Google Sheet; Manager project-time journeys remain draft)').replace(/^\*\*Date:\*\*.*$/m,'**Date:** October 9, 2026');
  }
  const output=await artifacts(s,spec);
  if(args.includes('--check')){
    for(const [name,expected] of output){if(args.includes('--demo-only')&&name.startsWith('outputs/'))continue;if(await fs.readFile(path.join(ROOT,name),'utf8')!==expected)throw new Error(`Generated file is stale or edited manually: ${name}`);}
    console.log(`PASS: ${s.journeys.length} journeys, ${s.questions.length} questions and ${s.requirements.length} requirements share snapshot ${s.metadata.revision}`);return;
  }
  await fs.mkdir(path.dirname(SNAPSHOT),{recursive:true});await fs.writeFile(SNAPSHOT,JSON.stringify(s,null,2)+'\n');
  for(const [name,value] of output)await fs.writeFile(path.join(ROOT,name),value);
  console.log(`Synchronized ${s.journeys.length} journeys, ${s.questions.length} questions and ${s.requirements.length} requirements; revision ${s.metadata.revision}. No deployment or production transaction performed.`);
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
