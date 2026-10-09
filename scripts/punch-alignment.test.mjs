import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {ROOT} from './sync-journeys.mjs';
const sources=await Promise.all(['engine','actions','events'].map(n=>fs.readFile(`${ROOT}/public/js/${n}.js`,'utf8')));
function harness(){
  const listeners={},timers=[];
  const c=vm.createContext({S:{persona:'ava',view:'punch',seq:0,punches:{ava:[]},txns:[],audit:[],settings:{},pendingPunchTransfers:{ava:{project:'LC-1'}}},
    UI:{},PROJECTS:{VALID:{active:true,tasks:[]},OTHER:{active:true,tasks:[]}},PERSONAS:{ava:{name:'Ava',projects:['VALID']}},
    document:{addEventListener:(type,f)=>(listeners[type]||=[]).push(f)},$:()=>null,setTimeout:f=>(timers.push(f),timers.length),clearTimeout:()=>{},
    nowTs:()=> '2026-10-09 09:00',todayStr:()=> '2026-10-09',tsDate:s=>s.slice(0,10),tsTime:s=>s.slice(11),
    persist:()=>{},softRender:()=>{},render:()=>{},t:s=>s,fmtClock:s=>s,isPunchOdooHidden:()=>false,
    laborDefaults:()=>({}),toAction:()=>false,ntAction:()=>false,notices:[],go:()=>{},flash:()=>{}});
  vm.runInContext('function uid(p){return p+(++S.seq)}',c);
  for(const source of sources)vm.runInContext(source,c);
  vm.runInContext('showPunchNotice=(kind,text)=>notices.push({kind,text})',c);
  const click=act=>{
    const el={dataset:{act},tagName:'BUTTON',closest:()=>null};
    const target={closest:selector=>selector==='[data-act]'?el:null};
    for(const f of listeners.click||[])f({target,stopPropagation:()=>{}});
  };
  return {c,click,advance:()=>{const f=timers.shift();assert.ok(f,'expected pending response');f();}};
}
test('inactive, unassigned and unknown selections block rather than becoming No Project',()=>{
  for(const variant of ['inactive','unassigned','unknown']){
    const {c,click}=harness();c.S._selProj=variant==='unknown'?'MISSING':variant==='unassigned'?'OTHER':'VALID';
    if(variant==='inactive')c.PROJECTS.VALID.active=false;
    click('punchIn');assert.equal(c.S.punches.ava.length,0);assert.equal(c.S.txns.length,0);
    assert.equal(c.notices[0].kind,'error');assert.ok(c.S.pendingPunchTransfers.ava);
  }
});
test('deliberately blank project is accepted only after UKG acceptance; repeat clicks are blocked',()=>{
  const {c,click,advance}=harness();c.S._selProj='';
  click('punchIn');click('punchIn');assert.equal(c.S.txns.length,1);assert.equal(c.S.txns[0].status,'Submitted');
  assert.equal(c.S.punches.ava.length,0);assert.equal(c.notices.length,0);assert.ok(c.S.pendingPunchTransfers.ava);
  advance();assert.equal(c.S.txns[0].status,'Accepted');assert.equal(c.S.punches.ava[0].proj,null);
  assert.equal(c.notices[0].kind,'success');assert.ok(!c.S.pendingPunchTransfers.ava);assert.ok(!c.UI.punchBusy.has('ava'));
});
test('duplicate-punch UKG error leaves punches and staged transfer unchanged',()=>{
  const {c,click}=harness();c.S.settings.simDuplicatePunchError=true;
  click('punchIn');assert.equal(c.S.punches.ava.length,0);assert.equal(c.S.txns[0].status,'Failed');
  assert.equal(c.notices[0].kind,'error');assert.ok(c.S.pendingPunchTransfers.ava);
});
test('Punch Out during a break confirms only after both accepted punches, at the same timestamp',()=>{
  const {c,click,advance}=harness();c.S.punches.ava.push({type:'IN',t:'2026-10-09 08:00'},{type:'BRK_S',t:'2026-10-09 08:45'});
  click('punchOut');assert.equal(c.S.punches.ava.length,2);assert.equal(c.notices.length,0);
  advance();assert.equal(c.S.punches.ava.at(-1).type,'BRK_E');assert.equal(c.notices.length,0);
  advance();assert.equal(c.S.punches.ava.at(-1).type,'OUT');
  assert.equal(c.S.punches.ava.at(-1).t,c.S.punches.ava.at(-2).t);assert.equal(c.notices[0].kind,'success');
});
test('an old response cannot add a punch after demo state is replaced/reset',()=>{
  const {c,click,advance}=harness();click('punchIn');c.S={...c.S,punches:{ava:[]},txns:[],audit:[]};
  advance();assert.equal(c.S.punches.ava.length,0);assert.equal(c.notices.length,0);
});
