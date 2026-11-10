(function(root){
 'use strict';
 function hasLocalData(body){const s=body.state;return !!(s.entries.length||s.places.length||s.projects.join('|')!=='neXus intern'||s.preferences||s.vacation);}
 function validClock(c){return c===null||!!(c&&typeof c.id==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(c.start)&&Number.isFinite(+new Date(c.start))&&(c.end===null||typeof c.end==='string'&&Number.isFinite(+new Date(c.end))&&c.end>=c.start));}
 function chooseAction(meta,remote,local,userId){if(meta.userId&&meta.userId!==userId)return 'account';if(!meta.userId){if(hasLocalData(local))return 'migration';return remote?'pull':'initialize';}if(meta.conflict)return 'conflict';if(meta.dirty)return 'push';return remote&&remote.version!==meta.version?'pull':'idle';}
 function safeConfig(c){if(!c||typeof c.key!=='string'||!c.key)return false;try{const u=new URL(c.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.pathname!=='/'||u.search||u.hash)return false;if(c.key.startsWith('sb_publishable_'))return true;if(c.key.startsWith('eyJ')){const part=c.key.split('.')[1];const decoded=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));return decoded.role==='anon';}return false;}catch{return false;}}
 const core={hasLocalData,validClock,chooseAction,safeConfig};if(typeof module!=='undefined')module.exports=core;else root.ZeitwerkSyncCore=core;
})(typeof window==='undefined'?globalThis:window);
