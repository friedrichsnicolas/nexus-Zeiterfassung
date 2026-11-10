(function(root){
 'use strict';
 function hasLocalData(body){const s=body.state;return !!(body.clock||s.entries.length||s.places.length||s.projects.join('|')!=='neXus intern'||s.preferences||s.vacation);}
 function validClock(c){return c===null||!!(c&&typeof c.id==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(c.start)&&Number.isFinite(+new Date(c.start))&&(c.end===null||typeof c.end==='string'&&Number.isFinite(+new Date(c.end))&&c.end>=c.start));}
 function chooseAction(meta,remote,local,userId){if(meta.userId&&meta.userId!==userId)return 'account';if(!meta.userId){if(!remote)return 'initialize';if(same(local,remote.body))return 'pull';if(hasLocalData(local))return 'migration';return 'pull';}if(meta.conflict)return 'conflict';if(meta.dirty)return 'push';return remote&&remote.version!==meta.version?'pull':'idle';}
 function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&same(a[k],b[k]))}
 function mergeSnapshots(base,local,remote){
  if(!base)return null;
  let state,clock;
  if(same(local.state,base.state))state=remote.state;
  else if(same(remote.state,base.state)||same(local.state,remote.state))state=local.state;
  else return null;
  if(same(local.clock,base.clock))clock=remote.clock;
  else if(same(remote.clock,base.clock)||same(local.clock,remote.clock))clock=local.clock;
  else if(local.clock&&!remote.clock&&remote.state.entries.some(e=>e.id===local.clock.id))clock=null;
  else if(remote.clock&&!local.clock&&local.state.entries.some(e=>e.id===remote.clock.id))clock=null;
  else if(local.clock&&remote.clock&&local.clock.id===remote.clock.id&&local.clock.start===remote.clock.start){
   if(local.clock.end&&remote.clock.end&&!same(local.clock,remote.clock))return null;
   clock=local.clock.end?local.clock:remote.clock;
  }else return null;
  // A completed entry always retires its own clock, including delayed retries.
  if(clock&&state.entries.some(e=>e.id===clock.id))clock=null;
  return {state,clock};
 }
 function safeConfig(c){if(!c||typeof c.key!=='string'||!c.key)return false;try{const u=new URL(c.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.pathname!=='/'||u.search||u.hash)return false;if(c.key.startsWith('sb_publishable_'))return true;if(c.key.startsWith('eyJ')){const part=c.key.split('.')[1];const decoded=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));return decoded.role==='anon';}return false;}catch{return false;}}
 const core={same,mergeSnapshots,hasLocalData,validClock,chooseAction,safeConfig};if(typeof module!=='undefined')module.exports=core;else root.ZeitwerkSyncCore=core;
})(typeof window==='undefined'?globalThis:window);


