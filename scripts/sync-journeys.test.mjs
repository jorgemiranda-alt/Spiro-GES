import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {ROOT,validate,parseSheet,renderJourneySection,artifacts} from './sync-journeys.mjs';
const snapshot=JSON.parse(await fs.readFile(`${ROOT}/data/journeys.snapshot.json`,'utf8'));
const copy=()=>structuredClone(snapshot);

test('reviewed inventory validates, with separate journey and requirement IDs',()=>{
  validate(snapshot);
  assert.equal(snapshot.journeys.length,39);
  assert.equal(snapshot.questions.length,18);
  assert.equal(snapshot.requirements.length,12);
  assert.ok(snapshot.requirements.every(r=>r.id.startsWith('REQ-TO-')));
});
test('duplicate IDs, broken question references and contradictory crosswalks are rejected',()=>{
  let s=copy();s.journeys[1].id=s.journeys[0].id;assert.throws(()=>validate(s),/Duplicate/);
  s=copy();s.journeys[0].q='UNKNOWN';assert.throws(()=>validate(s),/unknown question/);
  s=copy();s.requirements[0].journeyIds=[];assert.throws(()=>validate(s),/crosswalk/);
});
test('read-only timecard baseline and safe DOM IDs are enforced',()=>{
  let s=copy();s.journeys.find(j=>j.id==='TC-01').currentState='Editable';assert.throws(()=>validate(s),/read-only/);
  s=copy();s.journeys[0].id='"><script>';assert.throws(()=>validate(s),/invalid/);
});
test('all registered journeys reach the specification, including a newly added journey',()=>{
  const s=copy(),j=structuredClone(s.journeys.find(j=>j.id==='TO-01'));
  j.id='TO-08';j.requirementIds=[];s.journeys.push(j);
  const text=renderJourneySection(s);
  for(const j of s.journeys)assert.equal(text.split(`##### ${j.id} —`).length-1,1,j.id);
  assert.match(text,/5\.9 Additional journeys/);
});
test('generated demo contains every journey, question, revision, and no private feedback',async()=>{
  const s=copy();s.journeys[0].workflow.comments='PRIVATE_REVIEW';
  s.questions[0].answer='PRIVATE_ANSWER';s.questions[0].owner='PRIVATE_OWNER';
  const spec='## 5. User journeys\n<!-- journey-sync:start -->\n## 6. Other\n## 9. Open decisions\n<!-- question-sync:start -->\n## 10. References\n';
  const out=await artifacts(s,spec),js=out.get('public/js/journeys-data.js');
  assert.doesNotMatch(js,/PRIVATE_REVIEW|PRIVATE_ANSWER|PRIVATE_OWNER/);
  assert.match(js,new RegExp(s.metadata.revision));
  const c=vm.createContext({});vm.runInContext(js+'\nthis.data={journeys:JOURNEYS,metadata:JOURNEY_SYNC};',c);
  assert.equal(c.data.journeys.length,s.journeys.length);assert.equal(c.data.metadata.questionCount,s.questions.length);
  assert.doesNotMatch(js,/QUESTION_DETAILS|const QUESTIONS/);
  assert.match(out.get('public/index.html'),new RegExp('journeys-data.js\\?v='+s.metadata.revision));
});
test('journey screen renders the full inventory and blocks excluded/future routes',async()=>{
  const c=vm.createContext({UI:{jFilter:{q:'',epic:'',ev:'',spec:''},jOpen:new Set()},S:{},SHEET_URL:snapshot.source.url,
    esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'',uj:()=>''});
  vm.runInContext(await fs.readFile(`${ROOT}/public/js/journeys-data.js`,'utf8'),c);
  vm.runInContext(await fs.readFile(`${ROOT}/public/js/views.js`,'utf8'),c);
  const html=vm.runInContext('viewJourneys()',c);
  for(const j of snapshot.journeys){
    assert.ok(html.includes(`id="j-${j.id}"`),j.id);
    if(['Future','Out of scope'].includes(j.scope))assert.ok(!html.includes(`data-act="jRun" data-id="${j.id}"`),j.id);
  }
  assert.doesNotMatch(html,/Questions for Spiro|Answer in the sheet|Requirement IDs and questions/);
  assert.doesNotMatch(html,/E6|Manager project-time review/);
  c.UI.jFilter.q='REQ-TO-12';assert.match(vm.runInContext('viewJourneys()',c),/id="j-TO-02"/);
});
// The native connector export is private and stays in outputs/. This local test
// also checks the actual saved Sheets format when the export is available.
const exportPath=`${ROOT}/outputs/journey-sync/sheet-final.json`;
let raw;try{raw=JSON.parse(await fs.readFile(exportPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
test('native Sheets import strips private review data and rejects malformed acceptance criteria',{skip:!raw},()=>{
  const s=parseSheet(raw,'2026-10-09T00:00:00Z');
  assert.equal(s.journeys.length,snapshot.journeys.length);assert.equal(s.questions.length,snapshot.questions.length);
  assert.ok(!Object.hasOwn(s.journeys[0].workflow,'comments'));
  assert.ok(!Object.hasOwn(s.questions[0],'answer'));
  const bad=structuredClone(raw),sheet=bad.sheets.find(s=>s.properties.title==='Journeys');
  const cell=sheet.data[0].rowData[4].values[12];cell.effectiveValue={stringValue:'Not a Given/When/Then criterion'};
  assert.throws(()=>parseSheet(bad),/malformed acceptance/);
});
test('requested timecard journeys and their references are absent from current artifacts',async()=>{
  const spec=await fs.readFile(`${ROOT}/outputs/Spiro_Global_Time_Entry_UI_UX_Specification.md`,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
  const js=await fs.readFile(`${ROOT}/public/js/journeys-data.js`,'utf8');
  const assets=await fs.readFile(`${ROOT}/data/journey-assets.json`,'utf8');
  for(const text of [JSON.stringify(snapshot),spec,js,assets])assert.doesNotMatch(text,/\b(?:TC-(?:05|06|08|09|10)|PU-11|GR-01|PA-0[1-6])\b/);
  assert.ok(!Object.hasOwn(snapshot.epics,'E6'));
});
test('project-time review navigation is removed while Time Off manager access remains',async()=>{
  const c=vm.createContext({S:{persona:'oliver',view:'home',lang:'en',timeOff:{requests:[]}},UI:{to:{scope:'team'}},location:{hash:'#/approvals?persona=oliver'},URLSearchParams,
    t:s=>s,toText:s=>s,HOME_COPY:{en:{requestsWaiting:'requests waiting'}},history:{replaceState:()=>{},pushState:()=>{}}});
  vm.runInContext(await fs.readFile(`${ROOT}/public/js/reference-data.js`,'utf8'),c);
  vm.runInContext(await fs.readFile(`${ROOT}/public/js/views.js`,'utf8'),c);
  vm.runInContext(await fs.readFile(`${ROOT}/public/js/router.js`,'utf8'),c);
  assert.equal(vm.runInContext('APP_ROUTE_VIEWS.has("approvals")',c),false);
  assert.equal(vm.runInContext('PERSONAS.oliver.views.includes("approvals")',c),false);
  assert.equal(vm.runInContext('PERSONAS.oliver.land',c),'home');
  const actions=vm.runInContext('homeQuickActions(PERSONAS.oliver)',c);
  assert.equal(actions.length,1);assert.equal(actions[0].view,'timeoff');assert.equal(actions[0].team,true);
  assert.equal(vm.runInContext('appRouteForState("timeoff")',c),'#/timeoff-team');
});
