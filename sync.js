(function(){
'use strict';
const core=window.ZeitwerkSyncCore, META=KEY+'-sync-meta', CONFIG=KEY+'-sync-config';
let meta={userId:null,version:0,dirty:false,generation:0,operation:null,conflict:false};
try{meta={...meta,...JSON.parse(localStorage.getItem(META)||'{}')}}catch{}
let client=null,user=null,busy=false,editing=false,conflict=null,paused=false,timer=null,realtime=null,realtimeUser=null,pendingCycle=false,authBusy=false;
let rawState=localStorage.getItem(KEY),rawClock=localStorage.getItem(CLOCK_KEY);
let config=window.ZEITWERK_CLOUD||{url:'',key:''};
try{const c=JSON.parse(localStorage.getItem(CONFIG)||'null');if(c)config=c}catch{}
function status(message){
 $('#syncStatus').textContent=message;
 const problem=message.startsWith('Noch nicht synchronisiert')||message.startsWith('Cloud noch nicht bereit');
 const badge=$('#syncBadge');if(badge){badge.textContent=conflict?'Datenstände prüfen':!user?'Nicht angemeldet':!navigator.onLine?'Offline':problem?'Sync prüfen':message.startsWith('Synchronisiert')?'Cloud aktuell':meta.dirty||message.startsWith('Synchronisierung läuft')?'Wird synchronisiert':'Cloud verbunden';badge.title=message;badge.classList.toggle('attention',!user||!!conflict||problem||meta.dirty);}
 if($('#clockSyncText')){
 $('#clockSyncText').textContent=!user?'Nur auf diesem Gerät. Für den gemeinsamen Timer bitte anmelden.':conflict?'Datenstände prüfen, damit der Timer auf allen Geräten übereinstimmt.':!navigator.onLine?'Offline gespeichert. Der gemeinsame Timer wird nach der Verbindung abgeglichen.':problem?'Cloud-Abgleich ausstehend. '+message:'Gemeinsamer Timer · '+user.email+(meta.dirty?' · Änderung wird übertragen.':'');
 $('#clockSyncAction').textContent=!user?'Anmelden':conflict||problem?'Sync prüfen':'Konto';}
 $('#syncUser').textContent=user?'Angemeldet: '+user.email:'';$('#syncNow').disabled=!user||busy;$('#syncLogout').disabled=!user||busy;$('#syncLoginForm').hidden=!!user;$('#syncLoginArea').hidden=!!user;$('#accountManage').hidden=!user;$('#accountEmail').textContent=user?.email||'';$('#accountLastLogin').textContent=user?.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString('de-DE'):'Aktive Anmeldung';updateAuthControls();
}
function persist(){try{localStorage.setItem(META,JSON.stringify(meta));return true}catch{paused=true;status('Synchronisierung pausiert: Gerätespeicher voll. Bitte Datensicherung erstellen.');return false}}
function snapshot(){return {state:structuredClone(state),clock:clock?structuredClone(clock):null}}
function checkBody(body){if(!body||!core.validClock(body.clock))throw Error('Ungültiger Stempelstatus in den Cloud-Daten.');validate(body.state);return body;}
function hasDraft(){return editing;}
function localBackup(){const body=snapshot();try{localStorage.setItem(KEY+'-before-cloud',JSON.stringify({savedAt:new Date().toISOString(),...body}));return true}catch{status('Keine Wiederherstellungskopie möglich. Bitte zuerst Gerätestand herunterladen.');return false}}
function apply(body,{preserveDraft=false}={}){checkBody(body);if(!localBackup())return false;localStorage.setItem(KEY,JSON.stringify(body.state));if(body.clock)localStorage.setItem(CLOCK_KEY,JSON.stringify(body.clock));else localStorage.removeItem(CLOCK_KEY);state=structuredClone(body.state);clock=body.clock?structuredClone(body.clock):null;rawState=localStorage.getItem(KEY);rawClock=localStorage.getItem(CLOCK_KEY);clockView();render();if(!preserveDraft){editing=false;options();reset();if(clock?.end)prefillStoppedClock();const active=[...document.querySelectorAll('main > section')].find(s=>!s.hidden)?.id;if(active)page(active);}return true;}
function summary(body){const s=body?.state;return s?`${s.entries.length} Zeiteinträge · ${s.vacation?.records?.length||0} Urlaubszeiträume · ${s.projects.length} Projekte · Stempeluhr: ${body.clock?(body.clock.end?'ausgestempelt':'läuft'):'bereit'}`:'Noch kein Cloud-Datensatz';}
function showConflict(kind,remote){conflict={kind,remote};meta.conflict=true;meta.operation=null;persist();$('#syncConflict').hidden=false;$('#syncConflictText').textContent=kind==='account'?'Dieses Gerät enthält Daten eines anderen Kontos. Bitte sichere sie vor dem Wechsel. Sie werden nicht in das neue Konto übertragen.':kind==='migration'?'Auf diesem Gerät gibt es bereits Daten. Wähle bewusst, welchen Stand du verwenden möchtest.':'Ein anderes Gerät hat inzwischen Änderungen gespeichert. Du kannst lokal weiter erfassen. Bitte wähle anschließend den gewünschten Datenstand. Bei Bedarf lade beide Stände vor der Entscheidung herunter.';$('#syncComparison').innerHTML='<div><h3>Dieses Gerät</h3><p>'+esc(summary(snapshot()))+'</p></div><div><h3>Cloud</h3><p>'+esc(summary(remote?.body))+'</p></div>';$('#syncUseLocal').hidden=kind==='account';$('#syncUseCloud').disabled=!remote;status('Auswahl erforderlich · keine automatische Überschreibung.');}
async function readRemote(){const {data,error}=await client.from('zeitwerk_documents').select('version,body,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(data){checkBody(data.body);if(!Number.isSafeInteger(data.version)||data.version<1)throw Error('Ungültige Cloud-Version.');}return data;}
async function push(){if(!meta.operation){meta.operation={id:crypto.randomUUID(),expected:meta.version,body:snapshot(),generation:meta.generation};if(!persist())return;}
 const op=meta.operation;
 const {data,error}=await client.rpc('zeitwerk_write',{p_expected:op.expected,p_body:op.body,p_operation:op.id});
 if(error)throw error;
 if(!data?.ok){if(data?.conflict){const remote=await readRemote();const merged=remote&&core.mergeSnapshots(meta.base,snapshot(),remote.body);
 if(merged&&(!hasDraft()||core.same(merged.state,state))){if(!apply(merged,{preserveDraft:hasDraft()}))return;meta.version=remote.version;meta.base=structuredClone(remote.body);meta.operation=null;meta.conflict=false;meta.dirty=!core.same(merged,remote.body);persist();if(meta.dirty)schedule();else status('Synchronisiert · '+new Date().toLocaleTimeString('de-DE'));return;}
 showConflict('conflict',remote);return;}throw Error('Cloud-Speicherung konnte nicht bestätigt werden.');}
 meta.version=data.version;meta.base=structuredClone(op.body);meta.operation=null;meta.dirty=meta.generation!==op.generation;meta.conflict=false;if(!persist())return;status(meta.dirty?'Weitere Änderungen vorgemerkt …':'Synchronisiert · '+new Date().toLocaleTimeString('de-DE'));
}
async function cycle(){if(!client||!user||busy||paused||conflict||document.hidden||!navigator.onLine)return;if(localStorage.getItem(KEY)!==rawState||localStorage.getItem(CLOCK_KEY)!==rawClock){status('Daten wurden in einem anderen Tab geändert. Bitte Seite neu laden.');return;}busy=true;const cycleUser=user.id;status('Synchronisierung läuft …');try{
 if(meta.userId===user.id&&meta.dirty){await push();return;}
 const readGeneration=meta.generation;const remote=await readRemote();if(user?.id!==cycleUser)return;if(meta.generation!==readGeneration){schedule();return;}const action=core.chooseAction(meta,remote,snapshot(),user.id);
 if(action==='migration'||action==='account'||action==='conflict'){showConflict(action,remote);return;}
 if(action==='initialize'){meta.userId=user.id;meta.version=0;meta.dirty=true;meta.generation++;persist();await push();return;}
 if(action==='pull'){if(localStorage.getItem(KEY)!==rawState||localStorage.getItem(CLOCK_KEY)!==rawClock){status('Lokale Daten wurden während des Abgleichs geändert. Bitte Seite neu laden.');return;}if(hasDraft()&&!core.same(remote.body.state,state)){status('Neuer Cloud-Stand verfügbar. Eingaben zuerst speichern oder Seite neu laden.');return;}if(!apply(remote.body,{preserveDraft:hasDraft()}))return;meta.userId=user.id;meta.version=remote.version;meta.base=structuredClone(remote.body);meta.dirty=false;meta.operation=null;meta.conflict=false;if(!persist())return;}
 if(remote&&action==='idle'&&!meta.dirty){meta.base=structuredClone(remote.body);persist();}
 status('Synchronisiert · '+new Date().toLocaleTimeString('de-DE'));
 }catch(error){status('Noch nicht synchronisiert · '+(error.message||'Verbindung prüfen.')+' Lokale Änderungen bleiben erhalten.');}finally{busy=false;$('#syncNow').disabled=!user;$('#syncLogout').disabled=!user;if(pendingCycle){pendingCycle=false;schedule();}}}
function schedule(delay=120){clearTimeout(timer);timer=setTimeout(()=>{if(busy){pendingCycle=true;return;}cycle()},delay);}
function bindRealtime(){
 if(realtimeUser===user?.id&&realtime)return;
 if(realtime){client.removeChannel(realtime).catch(()=>{});realtime=null;realtimeUser=null;}
 if(!user||!client?.channel)return;
 realtimeUser=user.id;
 realtime=client.channel('zeitwerk-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'zeitwerk_documents',filter:'user_id=eq.'+user.id},()=>schedule()).subscribe(event=>{if(event==='SUBSCRIBED')schedule(0)});
}
window.zeitwerkSync={beforeSave(){if(paused){tell('Gerätespeicher voll. Bitte zuerst eine Datensicherung erstellen.');return false;}if(localStorage.getItem(KEY)!==rawState||localStorage.getItem(CLOCK_KEY)!==rawClock){$('#syncReload').hidden=false;tell('Ein anderer Tab hat Daten geändert. Oben auf Aktualisieren klicken.');return false;}return true;},changed(preserveDraft=false){rawState=localStorage.getItem(KEY);rawClock=localStorage.getItem(CLOCK_KEY);if(!preserveDraft)editing=false;meta.dirty=true;meta.generation++;if(persist()){if(conflict){$('#syncComparison').innerHTML='<div><h3>Dieses Gerät</h3><p>'+esc(summary(snapshot()))+'</p></div><div><h3>Cloud</h3><p>'+esc(summary(conflict.remote?.body))+'</p></div>';status('Lokal gespeichert · Datenstände unter Konto & Sync prüfen.');}else if(user)status('Änderungen lokal gespeichert · Abgleich vorgemerkt.');schedule();}}};
document.addEventListener('input',e=>{if(e.target.closest('form')&&!e.target.closest('#account'))editing=true});
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{editing=false;if(user)schedule()}));
window.addEventListener('online',()=>{bindRealtime();schedule(0)});window.addEventListener('focus',()=>schedule(0));window.addEventListener('pageshow',()=>schedule(0));window.addEventListener('offline',()=>status('Offline · Änderungen bleiben lokal gespeichert.'));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});
window.addEventListener('storage',e=>{if([KEY,CLOCK_KEY,META].includes(e.key)){$('#syncReload').hidden=false;status('Daten wurden in einem anderen Tab geändert. Oben auf Aktualisieren klicken.');}});
function downloadLocal(){download(JSON.stringify({exportedAt:new Date().toISOString(),...snapshot()},null,2),'zeitwerk-geraetestand.json','application/json')}
$('#syncBackup').onclick=downloadLocal;
$('#syncBadge').onclick=()=>page('account');if($('#clockSyncAction'))$('#clockSyncAction').onclick=()=>page('account');$('#syncReload').onclick=()=>location.reload();
$('#syncUseCloud').onclick=async()=>{if(!conflict||busy)return;if(!confirm('Cloud-Stand auf diesem Gerät übernehmen? Der aktuelle Gerätestand wird vorher lokal gesichert.'))return;busy=true;const choiceGeneration=meta.generation;try{const remote=await readRemote();if(choiceGeneration!==meta.generation)throw Error('Seit deiner Auswahl wurden neue lokale Daten erfasst. Bitte Datenstände erneut prüfen.');if(!remote)throw Error('Kein Cloud-Stand vorhanden.');if(!apply(remote.body))return;meta={userId:user.id,version:remote.version,base:structuredClone(remote.body),dirty:false,generation:0,operation:null,conflict:false};conflict=null;persist();$('#syncConflict').hidden=true;status('Cloud-Stand übernommen.');}catch(e){status(e.message)}finally{busy=false;}};
$('#syncUseLocal').onclick=async()=>{if(!conflict||busy||conflict.kind==='account')return;if(!confirm('Diesen Gerätestand in die Cloud übernehmen? Vorhandene Cloud-Daten werden dadurch ersetzt.'))return;busy=true;const choiceGeneration=meta.generation;try{const remote=await readRemote();if(choiceGeneration!==meta.generation)throw Error('Seit deiner Auswahl wurden neue lokale Daten erfasst. Bitte Datenstände erneut prüfen.');if((remote?.version||0)!==(conflict.remote?.version||0)){showConflict('conflict',remote);return;}if(remote){localStorage.setItem(KEY+'-cloud-before-replace',JSON.stringify(remote.body));}meta.userId=user.id;meta.version=remote?.version||0;meta.operation=null;meta.conflict=false;meta.dirty=true;meta.generation++;if(!persist())return;conflict=null;$('#syncConflict').hidden=true;await push();}catch(e){status('Übernahme nicht abgeschlossen: '+e.message)}finally{busy=false;}};
$('#syncNow').onclick=()=>{if(hasDraft())tell('Offene Eingaben bitte zuerst speichern.');schedule()};
const EMAIL_COOLDOWN=KEY+'-email-cooldown';
let emailBlockedUntil=0;try{emailBlockedUntil=Number(localStorage.getItem(EMAIL_COOLDOWN))||0}catch{}
function accountNotice(message,error=false){$('#accountMessage').textContent=message;$('#accountMessage').classList.toggle('error',error);}
function authError(error){const code=error?.code||'',message=error?.message||'';
 if(code==='over_email_send_rate_limit'||/email.*rate limit/i.test(message))return 'Das E-Mail-Versandlimit ist erreicht. Bitte später erneut versuchen. Du kannst dich mit deinem Passwort anmelden oder auf einem bereits angemeldeten Gerät ein Passwort festlegen. Das Versandlimit lässt sich hier nicht aufheben.';
 if(error?.status===429||/rate limit/i.test(message))return 'Zu viele Anfragen. Bitte warte vor dem nächsten Versuch.';
 if(code==='invalid_credentials'||/invalid login credentials/i.test(message))return 'E-Mail-Adresse oder Passwort ist nicht korrekt. Wenn du noch kein Passwort hast, lege es auf einem bereits angemeldeten Gerät fest.';
 if(code==='password_too_long')return 'Das Passwort ist für den Anmeldedienst zu lang. Bitte verwende einen kürzeren Passwortsatz.';
 if(code==='email_not_confirmed')return 'Bitte bestätige zuerst deine E-Mail-Adresse über die Bestätigungsnachricht.';
 if(code==='same_password')return 'Bitte verwende ein anderes Passwort als bisher.';
 if(code==='weak_password')return 'Das Passwort erfüllt die Sicherheitsregeln nicht. Verwende einen längeren, einzigartigen Passwortsatz.';
 if(code==='reauthentication_needed'||code==='reauthentication_not_valid')return 'Bitte melde dich zur Sicherheit erneut an und ändere anschließend dein Passwort.';
 return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfe deine Verbindung und versuche es erneut.';
}
function updateAuthControls(){const seconds=Math.max(0,Math.ceil((emailBlockedUntil-Date.now())/1000));$('#syncLoginButton').disabled=!client||authBusy||seconds>0;$('#syncLoginButton').textContent=seconds?'Erneut in '+seconds+' s':'Anmeldelink senden';$('#passwordLoginButton').disabled=!client||authBusy;$('#passwordReset').disabled=!client||authBusy||seconds>0;$('#accountPasswordSave').disabled=!user||authBusy;$('#accountSignOutOthers').disabled=!user||authBusy;$('#emailCooldown').textContent=seconds?'Zum Schutz vor weiteren Anfragen ist der Versand auf diesem Gerät kurz pausiert. Ein serverseitiges Versandlimit kann länger gelten.':'';}
function blockEmail(){emailBlockedUntil=Date.now()+60000;try{localStorage.setItem(EMAIL_COOLDOWN,String(emailBlockedUntil))}catch{}updateAuthControls();}
async function requestEmail(reset=false){if(!client||authBusy||Date.now()<emailBlockedUntil)return;const input=reset?$('#passwordEmail'):$('#syncEmail');if(!input.checkValidity()){input.reportValidity();return;}authBusy=true;updateAuthControls();try{const email=input.value.trim(),redirect=location.origin+location.pathname;
 const {error}=reset?await client.auth.resetPasswordForEmail(email,{redirectTo:redirect}):await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect}});
 if(error)throw error;blockEmail();accountNotice(reset?'Falls das Konto besteht, wurde ein Link zum Zurücksetzen angefordert. Öffne ihn auf diesem Gerät und wähle anschließend ein neues Passwort.':'Anmeldelink angefordert. Bitte öffne die neueste E-Mail auf diesem Gerät im Browser der App.');
 }catch(error){if(error?.status===429||/rate limit/i.test(error?.message||''))blockEmail();accountNotice(authError(error),true);}finally{authBusy=false;updateAuthControls();}}
$('#syncLoginForm').onsubmit=e=>{e.preventDefault();return requestEmail()};
$('#passwordReset').onclick=()=>requestEmail(true);
$('#passwordEmail').addEventListener('input',()=>{$('#syncEmail').value=$('#passwordEmail').value});$('#syncEmail').addEventListener('input',()=>{$('#passwordEmail').value=$('#syncEmail').value});
$('#passwordLoginForm').onsubmit=async e=>{e.preventDefault();if(!client||authBusy)return;authBusy=true;updateAuthControls();try{const {error}=await client.auth.signInWithPassword({email:$('#passwordEmail').value.trim(),password:$('#loginPassword').value});if(error)throw error;accountNotice('Angemeldet. Deine Daten werden abgeglichen.');}catch(error){accountNotice(authError(error),true);}finally{$('#loginPassword').value='';authBusy=false;updateAuthControls();}};
$('#accountPasswordForm').onsubmit=async e=>{e.preventDefault();if(!user||!client||authBusy)return;const password=$('#accountPassword').value,confirmation=$('#accountPasswordConfirm').value;$('#passwordResult').textContent='';if(password.length<12)return $('#passwordResult').textContent='Bitte mindestens 12 Zeichen verwenden.';if(password!==confirmation)return $('#passwordResult').textContent='Die beiden Passwörter stimmen nicht überein.';authBusy=true;updateAuthControls();try{const {error}=await client.auth.updateUser({password});if(error)throw error;$('#passwordResult').textContent='Passwort gespeichert. Auf weiteren Geräten kannst du dich jetzt mit deiner E-Mail-Adresse und diesem Passwort anmelden.';}catch(error){$('#passwordResult').textContent=authError(error);}finally{$('#accountPassword').value='';$('#accountPasswordConfirm').value='';authBusy=false;updateAuthControls();}};
$('#accountSignOutOthers').onclick=async()=>{if(!user||!client||authBusy)return;if(!confirm('Andere Geräte abmelden? Bitte dort noch nicht synchronisierte Änderungen zuerst sichern. Dieses Gerät bleibt angemeldet.'))return;authBusy=true;updateAuthControls();try{const {error}=await client.auth.signOut({scope:'others'});if(error)throw error;$('#sessionResult').textContent='Andere Sitzungen wurden abgemeldet. Auf anderen Geräten kann die Abmeldung verzögert wirksam werden.';}catch(error){$('#sessionResult').textContent=authError(error);}finally{authBusy=false;updateAuthControls();}};
setInterval(()=>{if(emailBlockedUntil>Date.now()-2000)updateAuthControls()},1000);

$('#syncLogout').onclick=async()=>{if(!client||busy)return;if(meta.dirty&&!confirm('Es gibt noch nicht synchronisierte Änderungen. Abmelden und lokal behalten?'))return;const {error}=await client.auth.signOut({scope:'local'});if(error)status('Abmelden nicht möglich: '+error.message);else{user=null;bindRealtime();conflict=null;$('#syncConflict').hidden=true;status('Abgemeldet · Daten bleiben auf diesem Gerät.');}};
$('#syncConfigForm').onsubmit=e=>{e.preventDefault();if(user||meta.dirty&&meta.userId)return tell('Vor einem Verbindungswechsel bitte synchronisieren und abmelden.');const c={url:$('#syncUrl').value.trim().replace(/\/$/,''),key:$('#syncPublicKey').value.trim()};if(!core.safeConfig(c))return tell('Bitte gültige Supabase-URL und öffentlichen Publishable-/anon-Schlüssel eingeben.');try{localStorage.setItem(CONFIG,JSON.stringify(c));location.reload()}catch{tell('Verbindung konnte nicht gespeichert werden.')}};
async function init(){
 $('#syncUrl').value=config.url||'';$('#syncPublicKey').value=config.key||'';status('Lokal gespeichert · Cloud noch nicht eingerichtet.');
 if(!core.safeConfig(config))return;
 try{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='supabase-sdk.js?v=20261110-sync';s.onload=resolve;s.onerror=()=>reject(Error('Anmeldebibliothek konnte nicht geladen werden.'));document.head.append(s);});client=window.supabase.createClient(config.url,config.key,{auth:{storageKey:KEY+'-auth-'+new URL(config.url).hostname,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
 client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{user=session?.user||null;bindRealtime();if(!user){$('#loginPassword').value='';$('#accountPassword').value='';$('#accountPasswordConfirm').value='';status('Nicht angemeldet · Daten lokal verfügbar.');return;}if(event==='PASSWORD_RECOVERY'){page('account');accountNotice('Anmeldung zum Zurücksetzen bestätigt. Lege unten ein neues Passwort fest.');}status('Angemeldet · Datenstand wird geprüft.');schedule();},0)});
 const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;bindRealtime();status(user?'Angemeldet · Datenstand wird geprüft.':'Bereit zur Anmeldung per E-Mail-Link.');if(user)schedule();
 }catch(e){status('Cloud noch nicht bereit: '+e.message);}}
 setInterval(()=>{if(navigator.locks)navigator.locks.request(KEY+'-cloud-cycle',{ifAvailable:true},lock=>lock?cycle():undefined);else cycle();},3000);
 init();
})();



