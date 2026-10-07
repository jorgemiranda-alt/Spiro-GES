/* ---------- Reference data (simulated Odoo + UKG) ---------- */
const PROJECTS = {
 "PRJ-4821":{name:"Global Brand Activation",client:"Northwind Health",show:"HLTH 2026",umbrella:"Northwind Program",tasks:["Client delivery","Booth install","Project management"],taskReq:false,approver:"oliver",est:400,used:352,active:true},
 "PRJ-4908":{name:"Creative Production Support",client:"Contoso Retail",show:"Retail Summit",umbrella:"Contoso Retainer",tasks:["Production support","Graphics"],taskReq:false,approver:"oliver",est:220,used:120,active:true},
 "PRJ-5012":{name:"Internal Operations",client:"Spiro (non-billable)",show:"—",umbrella:"",tasks:["Operations","Training"],taskReq:false,approver:"camille",est:0,used:0,active:true,nonBill:true},
 "PRJ-4700":{name:"Spring Summit Build",client:"Northwind Health",show:"Spring Summit",umbrella:"Northwind Program",tasks:["Booth install"],taskReq:false,approver:"oliver",est:120,used:118,active:false},
 "BER-1102":{name:"Berlin Expo Build",client:"Fabrikam Auto",show:"IAA Berlin",umbrella:"",tasks:["Build","Load-out"],taskReq:false,approver:"jonas",est:900,used:610,active:true},
 "MUC-2077":{name:"Munich Client Kit",client:"Tailspin",show:"bauma",umbrella:"",tasks:["Kitting","Packing"],taskReq:false,approver:"jonas",est:300,used:140,active:true},
 "DE-OPS":{name:"Warehouse Operations",client:"Spiro (non-billable)",show:"—",umbrella:"",tasks:["Safety briefing","Cleaning"],taskReq:false,approver:"jonas",est:0,used:0,active:true,nonBill:true},
 "MUC-1999":{name:"Munich Auto Show",client:"Fabrikam Auto",show:"Auto Show 2025",umbrella:"",tasks:["Build"],taskReq:false,approver:"jonas",est:500,used:500,active:false},
 "PL-8804":{name:"Warsaw Retail Event",client:"Contoso Retail",show:"Warsaw Retail Days",umbrella:"Contoso Retainer",tasks:["Detailing","Install","Supervision"],taskReq:true,approver:"oliver",est:160,used:110,active:true},
 "PL-8810":{name:"Supplier Coordination",client:"Contoso Retail",show:"Warsaw Retail Days",umbrella:"Contoso Retainer",tasks:["Supplier calls","Quality checks"],taskReq:true,approver:"oliver",est:80,used:50,active:true},
 "PL-OPS":{name:"Production Operations",client:"Spiro (non-billable)",show:"—",umbrella:"",tasks:["Admin","Training"],taskReq:false,approver:"camille",est:0,used:0,active:true,nonBill:true},
 "PL-8650":{name:"Poznań Trade Fair",client:"Litware",show:"Poznań Fair",umbrella:"",tasks:["Install"],taskReq:true,approver:"oliver",est:90,used:88,active:false},
 "PRJ-5310":{name:"Retail Experience Refresh",client:"Contoso Retail",show:"Flagship refresh",umbrella:"Contoso Retainer",tasks:["Concept development","Client workshop"],taskReq:false,approver:"oliver",est:260,used:150,active:true},
 "PRJ-5266":{name:"EMEA Brand Strategy",client:"Northwind Health",show:"EMEA roadshow",umbrella:"Northwind Program",tasks:["Client workshop","Strategy"],taskReq:false,approver:"oliver",est:140,used:60,active:true},
 "PL-8920":{name:"Gdańsk Expo Prep",client:"Litware",show:"Gdańsk Expo",umbrella:"",tasks:["Planning","Supplier calls"],taskReq:true,approver:"oliver",est:120,used:0,active:true,startIn:60},
 "PL-8933":{name:"Łódź Pop-up Store",client:"Contoso Retail",show:"Łódź Pop-up",umbrella:"Contoso Retainer",tasks:["Concept","Install"],taskReq:false,approver:"oliver",est:90,used:0,active:true,startIn:45},
 "PRJ-5400":{name:"Q1 Campaign Planning",client:"Northwind Health",show:"Q1 launch",umbrella:"Northwind Program",tasks:["Strategy","Client workshop"],taskReq:false,approver:"oliver",est:200,used:0,active:true,startIn:90},
 "PRJ-5412":{name:"Summer Launch Concept",client:"Contoso Retail",show:"Summer launch",umbrella:"Contoso Retainer",tasks:["Concept development"],taskReq:false,approver:"oliver",est:110,used:0,active:true,startIn:30},
 "PRJ-5204":{name:"Leadership & Coaching",client:"Spiro (non-billable)",show:"—",umbrella:"",tasks:["Internal meeting","Coaching"],taskReq:false,approver:"camille",est:0,used:0,active:true,nonBill:true}
};
const APPROVERS = {oliver:"Oliver Grant",camille:"Camille Dubois",jonas:"Jonas Richter"};
const PERSONAS = {
 ava:{name:"Ava Mitchell",short:"Ava",initials:"AM",label:"Ava Mitchell · US · Hourly (punch)",role:"Client Production Coordinator",country:"US",type:"hourly",lang:"en",projects:["PRJ-4821","PRJ-4908","PRJ-5012","PRJ-4700"],sched:{start:"08:00",end:"17:00",brk:30,days:[1,2,3,4,5]},views:["home","punch","timecard"],land:"punch",ot:true},
 lukas:{name:"Lukas Weber",short:"Lukas",initials:"LW",label:"Lukas Weber · DE · Warehouse (kiosk)",role:"Warehouse Production Specialist",country:"DE",type:"hourly",lang:"de",projects:["BER-1102","MUC-2077","DE-OPS","MUC-1999"],badge:"40-2231",sched:{start:"07:00",end:"15:30",brk:30,days:[1,2,3,4,5]},views:["home","kiosk","timecard"],land:"kiosk",ot:false},
 zofia:{name:"Zofia Kowalska",short:"Zofia",initials:"ZK",label:"Zofia Kowalska · PL · Hourly (grid)",role:"Production Coordinator",country:"PL",type:"hourly",lang:"pl",projects:["PL-8804","PL-8810","PL-OPS","PL-8650","PL-8920","PL-8933"],sched:{start:"08:00",end:"16:00",brk:30,days:[1,2,3,4,5]},views:["home","grid"],land:"grid",ot:false},
 maya:{name:"Maya Chen",short:"Maya",initials:"MC",label:"Maya Chen · UK · Salaried",role:"Senior Creative Director",country:"UK",type:"salary",lang:"en",projects:["PRJ-5310","PRJ-5266","PRJ-5204","PRJ-5400","PRJ-5412"],sched:null,views:["home","grid"],land:"grid",ot:false},
 oliver:{name:"Oliver Grant",short:"Oliver",initials:"OG",label:"Oliver Grant · Manager",role:"Manager",country:"UK",type:"approver",lang:"en",projects:[],sched:null,views:["home","approvals"],land:"approvals",ot:false}
};
const REASONS = ["Forgot to punch","Wrong time recorded","Wrong project","Device or network issue","Approved by manager"];
const VIEW_ICON = {home:"home",punch:"clock",timecard:"table",grid:"grid",kiosk:"scan",approvals:"check",journeys:"route"};

/* ---------- UKG Pro WFM labor-category defaults (simulated) ---------- */
const PAYCODES = ["Hours Worked"];
const LABOR = {
 opts:{
  // Simulated UKG labor-category values. These are separate from the Odoo project/task lists below.
  proj:[
   {v:"LC-PROJ-01",l:"Client Services",taskReq:true,tasks:["LC-TASK-01 · Planning","LC-TASK-02 · Delivery"]},
   {v:"LC-PROJ-02",l:"Operations",taskReq:true,tasks:["LC-TASK-03 · Production","LC-TASK-04 · Quality Review"]},
   {v:"LC-PROJ-03",l:"Shared Services",taskReq:false,tasks:["LC-TASK-05 · Administration"]}
  ],
  tc:["Hourly - Standard","Hourly - Overtime eligible","Salaried - Exempt"],
  func:["Production Coordinator","Senior Creative Director","Warehouse Production Specialist","Project Manager"]
 },
 byPersona:{
  ava:{location:"US/SPR/NYC/Client Production Coordinator",project:"LC-PROJ-01",task:"LC-TASK-01 · Planning",tc:"Hourly - Standard",func:"Production Coordinator"},
  lukas:{location:"DE/SPR/BER/Warehouse Production Specialist",project:"LC-PROJ-02",task:"LC-TASK-03 · Production",tc:"Hourly - Standard",func:"Warehouse Production Specialist"},
  zofia:{location:"PL/SPR/WAW/Production Coordinator",project:"LC-PROJ-01",task:"LC-TASK-02 · Delivery",tc:"Hourly - Standard",func:"Production Coordinator"},
  maya:{location:"UK/SPR/LON/Senior Creative Director",project:"LC-PROJ-03",task:"LC-TASK-05 · Administration",tc:"Salaried - Exempt",func:"Senior Creative Director"},
  oliver:{location:"UK/SPR/LON/Project Manager",project:"LC-PROJ-03",task:"LC-TASK-05 · Administration",tc:"Salaried - Exempt",func:"Project Manager"}
 }
};
const laborTaskName = value => String(value||"").replace(/^LC-TASK-\d+\s*·\s*/,"");
