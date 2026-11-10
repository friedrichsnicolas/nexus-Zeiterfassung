'use strict';
const $=s=>document.querySelector(s), KEY='zeitwerk-v1';
let state={projects:['neXus intern'],places:[],entries:[]};
function validate(s){if(!s||!Array.isArray(s.projects)||!Array.isArray(s.places)||!Array.isArray(s.entries)||!s.projects.every(x=>typeof x==='string'&&x.length>0&&x.length<=120)||!s.places.every(x=>typeof x==='string'&&x.length>0&&x.length<=120))throw Error('Ungültige Stammdaten');const ids=new Set();for(const e of s.entries){if(typeof e.id!=='string'||ids.has(e.id)||typeof e.project!=='string'||!['Arbeitszeit','Reisezeit'].includes(e.kind)||!['Remote','Vor Ort'].includes(e.mode)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(e.start)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(e.end)||!Number.isFinite(+new Date(e.start))||!Number.isFinite(+new Date(e.end))||!Number.isInteger(e.pause)||e.pause<0||minutes(e)<=0||typeof e.place!=='string'||typeof e.note!=='string')throw Error('Ungültiger Zeiteintrag');ids.add(e.id)}return s}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const minutes=e=>(new Date(e.end)-new Date(e.start))/60000-Number(e.pause);
const hours=m=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(m/60)+' h';
const local=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw))}catch{alert('Gespeicherte Daten konnten nicht geladen werden. Bitte Sicherung importieren.');}
function save(next){try{localStorage.setItem(KEY,JSON.stringify(next));state=next;return true}catch{tell('Speichern fehlgeschlagen. Speicherplatz oder Browserberechtigung prüfen.');return false}}
function tell(t){$('#status').textContent=t;setTimeout(()=>{$('#status').textContent=''},6000)}
function page(p){for(const x of ['entry','dashboard','settings'])$('#'+x).hidden=x!==p;$('#nav').hidden=true;$('#menu').setAttribute('aria-expanded','false');if(p==='dashboard')render();}
$('#menu').onclick=()=>{const n=$('#nav');n.hidden=!n.hidden;$('#menu').setAttribute('aria-expanded',String(!n.hidden))};document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#nav').hidden=true;$('#menu').setAttribute('aria-expanded','false')}});
const form=$('#form'),field=n=>form.elements.namedItem(n);
function options(){const prev=field('project').value,fp=$('#filterProject').value;field('project').innerHTML=state.projects.map(p=>`<option>${esc(p)}</option>`).join('');if(state.projects.includes(prev))field('project').value=prev;$('#filterProject').innerHTML='<option value="">Alle Projekte</option>'+[...new Set([...state.projects,...state.entries.map(e=>e.project)])].map(p=>`<option>${esc(p)}</option>`).join('');$('#filterProject').value=fp;$('#places').innerHTML=state.places.map(p=>`<option value="${esc(p)}">`).join('');for(const [key,id]of [['projects','projectList'],['places','placeList']]){$('#'+id).innerHTML=state[key].map((p,i)=>`<div class="item"><span>${esc(p)}</span><button data-key="${key}" data-index="${i}">Entfernen</button></div>`).join('')||'<p class="hint">Noch keine Einträge.</p>';$('#'+id).querySelectorAll('button').forEach(b=>b.onclick=()=>{const next=structuredClone(state);next[b.dataset.key].splice(+b.dataset.index,1);if(save(next)){options();tell('Entfernt. Vorhandene Zeiteinträge bleiben erhalten.')}})}}
function reset(){HTMLFormElement.prototype.reset.call(form);field('id').value='';const d=new Date();d.setSeconds(0,0);field('start').value=local(d);d.setHours(d.getHours()+1);field('end').value=local(d);preview()}
function preview(){$('#placeLabel').hidden=field('mode').value!=='Vor Ort';const m=minutes({start:field('start').value,end:field('end').value,pause:field('pause').value});$('#duration').textContent=Number.isFinite(m)&&m>0?'Netto: '+hours(m):'Bitte Zeitraum prüfen'}form.oninput=preview;
form.onsubmit=e=>{e.preventDefault();if(!field('project').value)return tell('Bitte zuerst ein Projekt in den Einstellungen anlegen.');const entry=Object.fromEntries(new FormData(form));entry.pause=Number(entry.pause);entry.id=entry.id||crypto.randomUUID();entry.place=entry.mode==='Vor Ort'?entry.place.trim():'';if(!Number.isFinite(minutes(entry))||minutes(entry)<=0)return tell('Ende muss nach Start liegen und die Pause kürzer als der Zeitraum sein.');if(state.entries.some(x=>x.id!==entry.id&&new Date(entry.start)<new Date(x.end)&&new Date(entry.end)>new Date(x.start)))return tell('Dieser Zeitraum überschneidet sich mit einem bestehenden Eintrag.');const next=structuredClone(state),i=next.entries.findIndex(x=>x.id===entry.id);if(i<0)next.entries.push(entry);else next.entries[i]=entry;if(save(next)){reset();render();tell('Eintrag gespeichert.')}};$('#reset').onclick=reset;
for(const [id,key]of [['projectForm','projects'],['placeForm','places']])$('#'+id).onsubmit=e=>{e.preventDefault();const v=e.target.elements.namedItem('value').value.trim();if(!v)return;if(state[key].some(x=>x.toLowerCase()===v.toLowerCase()))return tell('Bereits vorhanden.');const next=structuredClone(state);next[key].push(v);if(save(next)){e.target.reset();options();tell('Hinzugefügt.')}};
function period(){const d=new Date(),p=$('#period').value;let a='',b='';if(p==='month'){a=local(new Date(d.getFullYear(),d.getMonth(),1)).slice(0,10);b=local(new Date(d.getFullYear(),d.getMonth()+1,0)).slice(0,10)}if(p==='week'){const w=new Date(d);w.setDate(w.getDate()-(w.getDay()+6)%7);a=local(w).slice(0,10);w.setDate(w.getDate()+6);b=local(w).slice(0,10)}if(p!=='custom'){$('#from').value=a;$('#to').value=b}render()}
function selected(){const a=$('#from').value,b=$('#to').value,p=$('#filterProject').value;return state.entries.filter(e=>(!a||e.start.slice(0,10)>=a)&&(!b||e.start.slice(0,10)<=b)&&(!p||e.project===p)).sort((x,y)=>y.start.localeCompare(x.start))}
function stamp(s){return new Date(s).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})}
function render(){const data=selected(),sum=k=>data.filter(e=>!k||e.kind===k).reduce((s,e)=>s+minutes(e),0);$('#stats').innerHTML=[['Arbeitszeit',sum('Arbeitszeit')],['Reisezeit',sum('Reisezeit')],['Gesamtzeit',sum()]].map(([k,v])=>`<div class="stat">${k}<strong>${hours(v)}</strong></div>`).join('');$('#rows').innerHTML=data.map(e=>`<tr><td>${stamp(e.start)}<small>bis ${stamp(e.end)}</small></td><td>${esc(e.project)}<small>${esc(e.note)}</small></td><td>${e.kind}<small>${esc(e.mode)}${e.place?' · '+esc(e.place):''}</small></td><td>${e.pause} min</td><td>${hours(minutes(e))}</td><td class="noprint"><button data-edit="${esc(e.id)}">Bearbeiten</button><button data-delete="${esc(e.id)}">Löschen</button></td></tr>`).join('');$('#empty').hidden=data.length>0;$('#rows').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const e=state.entries.find(x=>x.id===b.dataset.edit);options();if(!state.projects.includes(e.project))field('project').add(new Option(e.project,e.project));for(const [k,v]of Object.entries(e))if(field(k))field(k).value=v;preview();page('entry');window.scrollTo(0,0)});$('#rows').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Diesen Zeiteintrag löschen?')){const next=structuredClone(state);next.entries=next.entries.filter(x=>x.id!==b.dataset.delete);if(save(next))render()}});$('#projectsSummary').innerHTML=[...new Set(data.map(e=>e.project))].map(p=>`<div class="item"><span>${esc(p)}</span><strong>${hours(data.filter(e=>e.project===p).reduce((s,e)=>s+minutes(e),0))}</strong></div>`).join('')||'<p class="hint">Keine Projektzeiten vorhanden.</p>'}
$('#period').onchange=period;for(const id of ['from','to'])$('#'+id).onchange=()=>{$('#period').value='custom';if($('#from').value&&$('#to').value&&$('#from').value>$('#to').value)tell('Beginn des Filters liegt nach dem Ende.');render()};$('#filterProject').onchange=render;
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#backup').onclick=()=>download(JSON.stringify(state,null,2),'zeitwerk-sicherung-'+local(new Date()).slice(0,10)+'.json','application/json');
$('#restore').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const next=validate(JSON.parse(await f.text()));if(confirm(`${next.entries.length} Einträge importieren und aktuelle Daten ersetzen?`)&&save(next)){options();reset();render();tell('Sicherung wiederhergestellt.')}}catch{tell('Import fehlgeschlagen: keine gültige Zeitwerk-Sicherung.')}e.target.value=''};
$('#pdf').onclick=()=>window.print();
$('#excel').onclick=()=>{const xml=s=>esc(s),headers=['Projekt','Zeitart','Start','Ende','Pause (Minuten)','Netto (Stunden)','Arbeitsort','Ort','Notiz'];const rows=[headers,...selected().map(e=>[e.project,e.kind,e.start.replace('T',' '),e.end.replace('T',' '),e.pause,minutes(e)/60,e.mode,e.place,e.note])];const content='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Zeiterfassung"><Table>'+rows.map(r=>'<Row>'+r.map(v=>'<Cell><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>';download(content,'zeitwerk-export.xml','application/xml');tell('Excel-Datei exportiert. Die XML-Datei lässt sich in Excel öffnen.');};
options();reset();period();

const CLOCK_KEY=KEY+'-clock';
let clock=null;
try{clock=JSON.parse(localStorage.getItem(CLOCK_KEY)||'null')}catch{}
const clockCard=document.createElement('div');
clockCard.className='card';
clockCard.innerHTML='<h2>Stempeluhr</h2><p id="clockInfo"></p><div class="actions"><button type="button" class="primary" id="clockIn">Einstempeln</button><button type="button" id="clockOut">Ausstempeln</button><button type="button" id="clockFinish" hidden>Angaben ergänzen</button></div>';
form.before(clockCard);
function clockView(){
 $('#clockIn').disabled=!!clock;
 $('#clockOut').disabled=!clock||!!clock.end;
 $('#clockFinish').hidden=!clock||!clock.end;
 $('#clockInfo').textContent=!clock?'Bereit. Angaben zu Projekt und Arbeitsort ergänzt du beim Ausstempeln.':clock.end?'Ausgestempelt. Bitte Angaben ergänzen und den Eintrag speichern.':'Eingestempelt seit '+stamp(clock.start)+' · '+hours(Math.max(0,(Date.now()-new Date(clock.start))/60000));
}
function clockStore(next){
 try{localStorage.setItem(CLOCK_KEY,JSON.stringify(next));clock=next;clockView();return true}catch{tell('Stempelzeit konnte nicht gespeichert werden.');return false}
}
function finishClock(){
 if(!clock||!clock.end)return;
 page('entry');HTMLFormElement.prototype.reset.call(form);field('id').value=clock.id;
 field('start').value=clock.start;field('end').value=clock.end;
 field('project').selectedIndex=-1;
 preview();form.scrollIntoView({behavior:'smooth',block:'start'});
 tell('Bitte Projekt, Zeitart, Arbeitsort und Pause ergänzen und speichern.');
}
$('#clockIn').onclick=()=>{
 if(clock)return;
 if(clockStore({id:crypto.randomUUID(),start:local(new Date()),end:null}))tell('Eingestempelt. Du kannst die App schließen; die Startzeit bleibt gespeichert.');
};
$('#clockOut').onclick=()=>{
 if(!clock||clock.end)return;
 if(clockStore({...clock,end:local(new Date())}))finishClock();
};
$('#clockFinish').onclick=finishClock;
const originalSubmit=form.onsubmit;
form.onsubmit=e=>{
 if(clock&&field('id').value===clock.id&&!clock.end){e.preventDefault();return tell('Bitte zuerst ausstempeln.')}
 originalSubmit(e);
};
clockView();
setInterval(clockView,30000);
window.addEventListener('storage',e=>{if(e.key===CLOCK_KEY){try{clock=JSON.parse(e.newValue||'null');clockView()}catch{}}});
