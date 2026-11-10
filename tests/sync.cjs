const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const core=require('../sync-core.js');
const blank=()=>({state:{projects:['neXus intern'],places:[],entries:[]},clock:null});
assert.equal(core.chooseAction({},null,blank(),'u1'),'initialize');
assert.equal(core.chooseAction({}, {version:2},blank(),'u1'),'pull');
assert.equal(core.chooseAction({},null,{...blank(),state:{...blank().state,entries:[{}]}},'u1'),'migration');
assert.equal(core.chooseAction({userId:'other'},{version:2},blank(),'u1'),'account');
assert.equal(core.chooseAction({userId:'u1',version:1,dirty:true},{version:2},blank(),'u1'),'push');
assert.equal(core.validClock({id:'clock',start:'2026-11-10T09:00',end:null}),true);
assert.equal(core.validClock({id:'clock',start:'2026-11-10T09:00',end:'bad'}),false);
assert.equal(core.safeConfig({url:'https://test.supabase.co',key:'sb_secret_no'}),false);
assert.equal(core.safeConfig({url:'https://evil.test',key:'sb_publishable_x'}),false);
assert.equal(core.safeConfig({url:'https://test.supabase.co',key:'sb_publishable_x'}),true);
function harness({meta={},remote=null,rpc}={}){
 const nodes=new Map(),storage=new Map([['zeitwerk-v1',JSON.stringify(blank().state)],['zeitwerk-v1-sync-meta',JSON.stringify(meta)]]),calls=[];
 const $=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'',value:'',hidden:false,innerHTML:'',disabled:false,onclick:null,onsubmit:null});return nodes.get(s)};
 const context=vm.createContext({console,window:{ZeitwerkSyncCore:core,ZEITWERK_CLOUD:{}},KEY:'zeitwerk-v1',CLOCK_KEY:'zeitwerk-v1-clock',state:blank().state,clock:null,$,structuredClone,crypto,URL,Date,JSON,Number,Object,Map,Set,Promise,navigator:{onLine:true},document:{hidden:false,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){},setInterval(){},validate:s=>s,options(){},reset(){},clockView(){},render(){},page(){},esc:s=>s,tell(){},download(){},confirm:()=>true});context.window.addEventListener=()=>{};
 let source=fs.readFileSync(__dirname+'/../sync.js','utf8').replace(' init();',' window.testSync={cycle,setMeta:m=>{meta={...meta,...m}},getMeta:()=>meta,getConflict:()=>conflict,setClient:(c,u)=>{client=c;user=u;}};');vm.runInContext(source,context);
 const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:remote,error:null})})})}),rpc:async(name,args)=>{calls.push(args);return rpc?rpc(name,args,calls.length):{data:{ok:true,version:1},error:null}}};context.window.testSync.setClient(client,{id:'u1',email:'test@example.test'});
 return {ctx:context,api:context.window.testSync,storage,nodes,calls};
}
(async()=>{
 const fresh=harness();await fresh.api.cycle();assert.equal(fresh.api.getMeta().version,1);assert.equal(fresh.api.getMeta().dirty,false);assert.equal(fresh.calls[0].p_expected,0);
 const race=harness({meta:{userId:'u1',version:1,dirty:true,generation:1},remote:{version:2,body:blank()},rpc:()=>({data:{ok:false,conflict:true},error:null})});await race.api.cycle();assert.equal(race.api.getConflict().kind,'conflict');assert.equal(race.api.getMeta().version,1);
 const retry=harness({meta:{userId:'u1',version:1,dirty:true,generation:1},rpc:(n,a,count)=>{if(count===1)throw Error('network');return {data:{ok:true,version:2},error:null}}});await retry.api.cycle();const id=retry.api.getMeta().operation.id;await retry.api.cycle();assert.equal(retry.calls[1].p_operation,id);assert.equal(retry.api.getMeta().dirty,false);
 const stale=harness({meta:{userId:'u1',version:1,dirty:true}});stale.storage.set('zeitwerk-v1',JSON.stringify({...blank().state,projects:['other tab']}));assert.equal(stale.ctx.window.zeitwerkSync.beforeSave(),false);await stale.api.cycle();assert.equal(stale.calls.length,0);
 console.log('Sync decision, key validation, initial save, conflict, idempotent retry and stale-tab checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
