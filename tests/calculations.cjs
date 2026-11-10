const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const names=['entriesOnDay','nrwHolidays','vacationData','quotaFor','vacationDays','vacationBalance','validDate','validateVacation','csvCell','groupTimes','totals'];
const lines=source.split('\n').filter(l=>names.some(n=>l.startsWith('function '+n+'('))||l.startsWith('const local=')||l.startsWith('const dateKey=')||l.startsWith('const minutes=')||l.startsWith('const sumMinutes='));
const ctx=vm.createContext({state:{vacation:{records:[],quotas:{}}},console});vm.runInContext(lines.join('\n'),ctx);
assert.equal(vm.runInContext("vacationDays({start:'2026-11-06',end:'2026-11-13'},'2026',[]).length",ctx),6);
assert.equal(vm.runInContext("vacationDays({start:'2026-12-30',end:'2027-01-05'},'2026',[]).length",ctx),2);
assert.equal(vm.runInContext("vacationDays({start:'2026-12-30',end:'2027-01-05'},'2027',['2027-01-01']).length",ctx),2);
vm.runInContext("state.vacation={records:[{id:'half',start:'2026-11-09',end:'2026-11-09',factor:0.5,note:''}],quotas:{'2026':{allowance:30,carry:2,free:[]}}}",ctx);
assert.equal(vm.runInContext("vacationBalance('2026','2026-11-10').remaining",ctx),31.5);
assert.equal(vm.runInContext("validDate('2026-02-30')",ctx),false);
assert.throws(()=>vm.runInContext("validateVacation({records:[{id:'bad',start:'2026-11-09',end:'2026-11-10',factor:0.5,note:''}],quotas:{}})",ctx));
assert.ok(vm.runInContext("csvCell('=1+1')",ctx).includes("'=1+1"));
assert.equal(vm.runInContext("totals([{start:'2026-11-10T09:00',end:'2026-11-10T17:30',pause:30,kind:'Arbeitszeit'}])[0][1]",ctx),480);
console.log('8 calculation, year-boundary, validation and CSV checks passed.');

assert.deepEqual(Array.from(vm.runInContext("nrwHolidays('2026').map(h=>h.date)",ctx)),['2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-06-04','2026-10-03','2026-11-01','2026-12-25','2026-12-26']);
assert.equal(vm.runInContext("nrwHolidays('2025').find(h=>h.name==='Karfreitag').date",ctx),'2025-04-18');
assert.equal(vm.runInContext("nrwHolidays('2027').find(h=>h.name==='Karfreitag').date",ctx),'2027-03-26');
assert.equal(vm.runInContext("vacationDays({start:'2026-12-24',end:'2026-12-28'},'2026',[]).length",ctx),2);
assert.equal(vm.runInContext("vacationDays({start:'2026-04-03',end:'2026-04-06'},'2026',[]).length",ctx),0);
assert.equal(vm.runInContext("vacationDays({start:'2026-04-02',end:'2026-04-07'},'2026',['2026-04-03']).length",ctx),2);
console.log('6 NRW holiday checks passed.');


vm.runInContext("state.vacation={records:[{id:'early',start:'2026-02-02',end:'2026-02-03',factor:1,note:''},{id:'late',start:'2026-04-07',end:'2026-04-07',factor:1,note:''}],quotas:{'2026':{allowance:30,carry:5,expiry:'2026-03-31',free:[]}}}",ctx);
assert.equal(vm.runInContext("vacationBalance('2026','2026-11-10').expired",ctx),3);
assert.equal(vm.runInContext("vacationBalance('2026','2026-11-10').remaining",ctx),29);
assert.equal(vm.runInContext("vacationBalance('2026','2026-03-31').expired",ctx),0);
assert.equal(vm.runInContext("vacationBalance('2026','2026-04-01').expired",ctx),3);
assert.equal(vm.runInContext("entriesOnDay([{start:'2026-11-10T22:00',end:'2026-11-11T00:00'}],'2026-11-11').length",ctx),0);
assert.equal(vm.runInContext("entriesOnDay([{start:'2026-11-10T22:00',end:'2026-11-11T01:00'}],'2026-11-11').length",ctx),1);
assert.throws(()=>vm.runInContext("validateVacation({records:[],quotas:{'2026':{allowance:30,carry:5,expiry:'2027-03-31',free:[]}}})",ctx));
console.log('7 carry expiry and calendar day checks passed.');

