// Runs the real application against a DOM with disposable, isolated storage.
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
let now=Date.parse('2026-11-10T09:00:00');
const errors=[],files=[],blobs=new Map();
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://zeitwerk.test/',runScripts:'outside-only'});
const w=dom.window,d=w.document,$=s=>d.querySelector(s);
w.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};
w.structuredClone=structuredClone;w.alert=x=>errors.push(x);w.confirm=()=>true;w.setTimeout=()=>0;w.setInterval=()=>0;w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=()=>{};
w.Blob=Blob;w.URL.createObjectURL=b=>{const u='blob:'+blobs.size;blobs.set(u,b);return u};w.URL.revokeObjectURL=()=>{};
w.HTMLAnchorElement.prototype.click=function(){files.push({name:this.download,blob:blobs.get(this.href)})};
for(const file of ['sync-core.js','app.js','sync.js'])require('node:vm').runInContext(fs.readFileSync(path.join(root,file),'utf8'),dom.getInternalVMContext());
const submit=id=>$(id).dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
const change=id=>$(id).dispatchEvent(new w.Event('change',{bubbles:true}));
const input=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new w.Event('input',{bubbles:true}))};
const click=id=>$(id).click();
const state=()=>JSON.parse(w.localStorage.getItem('zeitwerk-v1'));
const clock=()=>JSON.parse(w.localStorage.getItem('zeitwerk-v1-clock'));
let checks=0;function check(name,f){f();checks++;console.log('PASS '+name)}
(async()=>{
check('Entry details are collapsed initially and clock remains outside',()=>{assert.equal($('#entryDetails').open,false);assert.equal($('#entryDetails').contains($('#clockIn')),false)});
check('All seven pages open through navigation',()=>{for(const id of ['entry','dashboard','daily','reports','vacation','account','settings']){click('[data-page="'+id+'"]');assert.equal($('#'+id).hidden,false);assert.equal(d.querySelectorAll('main>section:not([hidden])').length,1)}});
check('Projects and locations save; duplicates rejected',()=>{input('#projectForm input','Client Alpha');submit('#projectForm');input('#projectForm input','client alpha');submit('#projectForm');input('#placeForm input','Düsseldorf');submit('#placeForm');assert.equal(state().projects.length,2);assert.deepEqual(state().places,['Düsseldorf'])});
check('Weekly target persists',()=>{input('#weeklyGoal','38');input('#goalBasis','all');submit('#goalForm');assert.equal(state().preferences.weeklyHours,38)});
check('Clock starts once and persists',()=>{click('[data-page="entry"]');click('#clockIn');const id=clock().id;click('#clockIn');assert.equal(clock().id,id);assert.equal($('#clockOut').disabled,false)});
check('Live timer starts at zero and advances by seconds',()=>{assert.equal($('#clockTimer').textContent,'00:00:00');assert.equal($('#clockDisplay').hidden,false);now+=23*1000;w.updateClockTimer();assert.equal($('#clockTimer').textContent,'00:00:23')});
now+=90*60000;
check('Clock stops and requests details',()=>{click('#clockOut');assert.ok(clock().end);assert.equal($('#form [name=project]').value,'');assert.equal($('#form [name=start]').value.slice(11),'09:00');assert.equal($('#form [name=end]').value.slice(11),'10:30')});
check('Stopped timer freezes its exact elapsed time',()=>{assert.equal($('#clockTimer').textContent,'01:30:23');now+=60000;w.updateClockTimer();assert.equal($('#clockTimer').textContent,'01:30:23');assert.equal($('#clockTimerLabel').textContent,'ERFASSTE ZEIT')});
check('Stopped clock is restored into the form on a fresh load',()=>{const fresh=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://zeitwerk.test/',runScripts:'outside-only'}),fw=fresh.window;fw.localStorage.setItem('zeitwerk-v1',w.localStorage.getItem('zeitwerk-v1'));fw.localStorage.setItem('zeitwerk-v1-clock',w.localStorage.getItem('zeitwerk-v1-clock'));fw.structuredClone=structuredClone;fw.alert=x=>{throw Error(x)};fw.setInterval=()=>0;for(const file of ['sync-core.js','app.js'])require('node:vm').runInContext(fs.readFileSync(path.join(root,file),'utf8'),fresh.getInternalVMContext());assert.equal(fw.document.querySelector('#form [name=id]').value,clock().id);assert.equal(fw.document.querySelector('#form [name=end]').value,clock().end);assert.equal(fw.document.querySelector('#clockFinish').hidden,false);fresh.window.close()});
check('Stopping opens details automatically',()=>assert.equal($('#entryDetails').open,true));
check('Clock details save atomically and release clock',()=>{input('#form [name=project]','Client Alpha');input('#form [name=mode]','Vor Ort');input('#form [name=place]','Düsseldorf');input('#form [name=pause]','15');input('#form [name=note]','Review');submit('#form');assert.equal(state().entries.length,1);assert.equal(clock(),null);assert.equal($('#clockIn').disabled,false)});
check('Timer hides and details collapse after completed entry',()=>{assert.equal($('#clockDisplay').hidden,true);assert.equal($('#entryDetails').open,false)});
check('Overlapping entries are rejected',()=>{input('#form [name=start]','2026-11-10T09:30');input('#form [name=end]','2026-11-10T10:45');submit('#form');assert.equal(state().entries.length,1)});
check('Travel entry and optional location persist',()=>{input('#form [name=start]','2026-11-10T11:00');input('#form [name=end]','2026-11-10T12:00');input('#form [name=project]','Client Alpha');input('#form [name=kind]','Reisezeit');input('#form [name=mode]','Remote');submit('#form');assert.equal(state().entries.length,2);assert.equal(state().entries[1].place,'')});
check('Dashboard filters and net totals',()=>{click('[data-page="dashboard"]');input('#period','all');change('#period');assert.equal($('#rows').children.length,2);assert.ok($('#stats').textContent.includes('2,25 h'));input('#filterKind','Arbeitszeit');assert.equal($('#rows').children.length,1);input('#filterKind','');input('#filterSearch','Düsseldorf');assert.equal($('#rows').children.length,1);input('#filterSearch','')});
check('Edit existing entry without duplicate',()=>{click('#rows [data-edit]');assert.equal($('#entryDetails').open,true);input('#form [name=note]','Updated');submit('#form');assert.equal(state().entries.length,2);assert.ok(state().entries.some(e=>e.note==='Updated'))});
check('Day, weekly and year reports',()=>{click('[data-page="daily"]');assert.equal($('#dayEntries').children.length,2);assert.ok($('#weekText').textContent.includes('2,25 h'));click('#nextDay');assert.ok($('#dayEntries').textContent.includes('Noch keine'));click('#prevDay');click('[data-page="reports"]');assert.equal($('#monthRows').children.length,12);assert.ok($('#reportProjects').textContent.includes('Client Alpha'))});
check('Vacation quota, carryover and free dates save',()=>{click('[data-page="settings"]');input('#vacAllowance','30');input('#vacCarry','5');input('#vacExpiry','2026-03-31');input('#vacFree','2026-12-24');submit('#quotaForm');assert.equal(state().vacation.quotas['2026'].carry,5)});
check('Vacation excludes NRW holidays and weekends',()=>{click('[data-page="vacation"]');input('#vacForm [name=vacStart]','2026-12-24');input('#vacForm [name=vacEnd]','2026-12-28');submit('#vacForm');assert.equal(state().vacation.records.length,1);assert.ok($('#vacRows').textContent.includes('1 Tag'));assert.equal($('#nrwHolidayList').children.length,11)});
check('Calendar marks vacation, projects and location',()=>{input('#calMonth','2026-11');change('#calMonth');assert.ok($('#vacCalendar').textContent.includes('Client Alpha'));assert.ok($('#vacCalendar').textContent.includes('Düsseldorf'));input('#calMonth','2026-12');change('#calMonth');assert.ok($('#vacCalendar').textContent.includes('Urlaub'));click('#calNext');assert.equal($('#calMonth').value,'2027-01');click('#calPrev');assert.equal($('#calMonth').value,'2026-12')});
check('Half-day vacation and overlap validation',()=>{input('#vacForm [name=vacStart]','2026-11-11');input('#vacForm [name=vacEnd]','2026-11-11');input('#vacForm [name=vacFactor]','0.5');submit('#vacForm');assert.equal(state().vacation.records.length,2);input('#vacForm [name=vacStart]','2026-11-11');input('#vacForm [name=vacEnd]','2026-11-11');submit('#vacForm');assert.equal(state().vacation.records.length,2)});
check('Excel, CSV, PDF and JSON export actions',()=>{click('[data-page="dashboard"]');let printed=false;w.print=()=>{printed=true};click('#excel');click('#csv');click('#pdf');click('#backup');assert.equal(files.length,3);assert.ok(printed)});
const xml=await files[0].blob.text(),csv=await files[1].blob.text(),backup=JSON.parse(await files[2].blob.text());
check('Export payloads contain actual records and clock',()=>{assert.ok(xml.includes('Client Alpha'));assert.ok(csv.includes('Reisezeit'));assert.equal(backup.state.entries.length,2);assert.equal(backup.clock,null)});
await $('#restore').onchange({target:{files:[{text:async()=>JSON.stringify(backup)}],value:'file'}});
check('Restored data matches',()=>assert.deepEqual(state(),backup.state));
check('Invalid backup is rejected',()=>{assert.equal(errors.length,0)});
await $('#restore').onchange({target:{files:[{text:async()=>'{"bad":true}'}],value:'file'}});
assert.deepEqual(state(),backup.state);
check('Delete vacation and entry in disposable storage',()=>{click('[data-page="vacation"]');click('#vacRows [data-vac-delete]');assert.equal(state().vacation.records.length,1);click('[data-page="dashboard"]');click('#rows [data-delete]');assert.equal(state().entries.length,1)});
check('Storage failure keeps prior entry and clock',()=>{click('[data-page="entry"]');const old=JSON.stringify(state());const proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem;let fail=true;proto.setItem=function(k,v){if(k==='zeitwerk-v1-clock'&&fail){fail=false;throw Error('quota')}return original.call(this,k,v)};click('#clockIn');proto.setItem=original;assert.equal(clock(),null);assert.equal(JSON.stringify(state()),old);assert.equal($('#clockIn').disabled,false)});
check('Legacy clocks, multi-day hours and negative clock drift',()=>{const ctx=require('node:vm').createContext({clock:{start:'2026-11-10T09:00',end:null},Date,Number,Math});const src=fs.readFileSync(path.join(root,'app.js'),'utf8');require('node:vm').runInContext(src.slice(src.indexOf('function clockElapsed('),src.indexOf('function updateClockTimer(')),ctx);assert.equal(require('node:vm').runInContext("clockElapsed(+new Date('2026-11-12T10:00'))",ctx),49*3600);assert.equal(require('node:vm').runInContext("clockElapsed(+new Date('2026-11-10T08:00'))",ctx),0)});
console.log(checks+' application flow checks passed.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});


