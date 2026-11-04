'use strict';
import { readRemembered, saveRemembered, forgetRemembered } from './remember.js';
const gate = document.getElementById('gate');
const content = document.getElementById('content');
const itinerary = document.getElementById('itinerary');
const form = document.getElementById('unlock-form');
const passwordInput = document.getElementById('password');
const unlockButton = document.getElementById('unlock-button');
const errorText = document.getElementById('unlock-error');
const showPassword = document.getElementById('show-password');
let opened = false;
let remembered = false;
let loading = false;
const lockButton = document.getElementById('lock');
const sessionStatus = document.getElementById('session-status');
const text = (tag, value, className) => {
  const node = document.createElement(tag); node.textContent = value;
  if (className) node.className = className; return node;
};
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
function sourceLink(source) {
  const url = new URL(source.url);
  if (url.protocol !== 'https:') throw new Error('Invalid source URL');
  const link = text('a', source.label); link.href = url.href;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function renderEvent(item) {
  const li = document.createElement('li'); li.className = `event ${item.kind}`;
  const time = text('div', item.time, 'event-time');
  if (item.timeNote) time.append(text('small', item.timeNote));
  const body = document.createElement('div'); body.className = 'event-body';
  body.append(text('p', item.label, 'event-label'), text('h3', item.title));
  if (item.from) {
    const line = document.createElement('div'); line.className = 'transport-line';
    const from = text('div', item.from, 'transport-place'); from.append(text('b', item.depart));
    const to = text('div', item.to, 'transport-place'); to.append(text('b', item.arrive));
    const arrow = text('span', '→', 'transport-arrow'); arrow.setAttribute('aria-hidden', 'true');
    line.append(from, arrow, to); body.append(line);
  }
  if (item.description) body.append(text('p', item.description, 'event-description'));
  if (item.source || item.detail) {
    const details = document.createElement('details');
    details.append(text('summary', item.source ? '時刻の根拠・乗車メモ' : '補足を見る'));
    if (item.detail) details.append(text('p', item.detail));
    if (item.source) { const p = document.createElement('p'); p.append(sourceLink(item.source)); details.append(p); }
    body.append(details);
  }
  li.append(time, body); return li;
}
function render(data) {
  content.replaceChildren();
  const hero = document.createElement('section'); hero.className = 'hero';
  const intro = document.createElement('div'); intro.append(text('p', data.kicker, 'eyebrow'), text('h1', data.title), text('p', data.subtitle, 'hero-sub'));
  const route = document.createElement('div'); route.className = 'route-strip'; route.setAttribute('aria-label','旅のルート');
  data.route.forEach((place, index) => { if (index) route.append(text('span', '→', 'arrow')); route.append(text('strong', place)); });
  intro.append(route);
  const note = document.createElement('div'); note.className = 'hero-note'; note.append(text('strong', '3日目の主案'), text('span', data.mainRoute));
  hero.append(intro, note); content.append(hero);
  const tabs = document.createElement('nav'); tabs.className = 'day-tabs'; tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','日程を選ぶ');
  const panels = document.createElement('div');
  data.days.forEach((day, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'day-tab'; button.id = `tab-${index}`;
    button.setAttribute('role','tab'); button.setAttribute('aria-controls',`day-${index}`); button.setAttribute('aria-selected', String(index===0)); button.tabIndex=index===0?0:-1;
    button.append(text('span', day.date), text('strong', day.shortTitle));
    button.addEventListener('click',()=>selectDay(index));
    button.addEventListener('keydown', event => {
      let next; if(event.key==='ArrowRight')next=(index+1)%data.days.length; if(event.key==='ArrowLeft')next=(index+data.days.length-1)%data.days.length;
      if(event.key==='Home')next=0;if(event.key==='End')next=data.days.length-1;
      if(next!==undefined){event.preventDefault();selectDay(next);tabs.children[next].focus();}
    });
    tabs.append(button);
    const panel=document.createElement('section'); panel.id=`day-${index}`;panel.className='day-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.hidden=index!==0;
    const heading=document.createElement('div');heading.className='day-head';const headingText=document.createElement('div');headingText.append(text('h2',day.title),text('p',day.subtitle));heading.append(headingText,text('span',`DAY 0${index+1}`,'day-count'));panel.append(heading);
    const legend=document.createElement('div');legend.className='legend';
    for(const [value,cls] of [['時刻表確認済み',''],['観光・徒歩の目安','estimate']]){const legendItem=text('span',value,cls);const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');legendItem.prepend(dot);legend.append(legendItem);}panel.append(legend);
    const timeline=document.createElement('ol');timeline.className='timeline';day.events.forEach(item=>timeline.append(renderEvent(item)));panel.append(timeline);
    if(day.notes?.length){const notes=document.createElement('aside');notes.className='notes';notes.append(text('h3','この日のメモ'));const ul=document.createElement('ul');day.notes.forEach(item=>ul.append(text('li',item)));notes.append(ul);panel.append(notes);}
    if(day.backup){const backup=document.createElement('details');backup.className='backup';backup.append(text('summary',day.backup.title),text('p',day.backup.description));for(const source of day.backup.sources){const p=document.createElement('p');p.append(sourceLink(source));backup.append(p);}panel.append(backup);}
    panels.append(panel);
  });
  content.append(tabs,panels);
  const allSources=document.createElement('details');allSources.className='backup';allSources.append(text('summary','時刻表・施設の公式案内'));const list=document.createElement('ul');list.className='source-list';data.sources.forEach(source=>{const li=document.createElement('li');li.append(sourceLink(source));list.append(li);});allSources.append(list);content.append(allSources);
}
function selectDay(index){
  content.querySelectorAll('[role=tab]').forEach((node,i)=>{node.setAttribute('aria-selected',String(i===index));node.tabIndex=i===index?0:-1;});
  content.querySelectorAll('[role=tabpanel]').forEach((node,i)=>node.hidden=i!==index);
}
function setNotice(message='') { sessionStatus.textContent=message; sessionStatus.hidden=!message; }
function setBusy(value, label='ひらいています…') {
  loading=value;unlockButton.disabled=value;passwordInput.disabled=value;
  if(value)unlockButton.textContent=label;
  else unlockButton.replaceChildren(document.createTextNode('しおりをひらく '),text('span','↗'));
}
async function loadPayload() {
  const response=await fetch('payload.json',{cache:'no-store'});
  if(!response.ok)throw new Error('network');
  return response.json();
}
async function decryptPayload(key,payload) {
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},key,decode(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}
function openViewer(data,focus=true) {
  render(data);opened=true;gate.hidden=true;itinerary.hidden=false;passwordInput.value='';
  passwordInput.type='password';showPassword.textContent='表示';showPassword.setAttribute('aria-pressed','false');
  if(focus)content.focus();window.scrollTo(0,0);
}
function closeViewer() {
  opened=false;content.replaceChildren();itinerary.hidden=true;gate.hidden=false;errorText.textContent='';passwordInput.value='';setNotice();window.scrollTo(0,0);
}
async function restoreRemembered() {
  if(loading||opened)return;
  setBusy(true,'ログイン状態を確認しています…');setNotice();
  try {
    const saved=await readRemembered();
    if(!saved?.key)return;
    if(!window.crypto?.subtle)throw new Error('unsupported');
    const payload=await loadPayload();
    if(saved.salt!==payload.salt||saved.iterations!==payload.iterations||saved.version!==payload.version) {
      await forgetRemembered();return;
    }
    let data;
    try { data=await decryptPayload(saved.key,payload); }
    catch { await forgetRemembered();return; }
    remembered=true;openViewer(data,false);
  } catch(error) {
    if(error.message==='network')errorText.textContent='予定を読み込めませんでした。通信を確認してページを開き直してください。';
  } finally { setBusy(false); }
}
showPassword.addEventListener('click',()=>{const visible=passwordInput.type==='password';passwordInput.type=visible?'text':'password';showPassword.textContent=visible?'隠す':'表示';showPassword.setAttribute('aria-pressed',String(visible));});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(loading)return;errorText.textContent='';setBusy(true);setNotice();
  try{
    if(!window.crypto?.subtle)throw new Error('unsupported');
    const payload=await loadPayload();
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passwordInput.value),'PBKDF2',false,['deriveKey']);passwordInput.value='';
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:decode(payload.salt),iterations:payload.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
    const data=await decryptPayload(key,payload);
    let notice='';
    try { await saveRemembered(key,payload);remembered=true; }
    catch { remembered=false;notice='このブラウザーではログイン状態を保存できませんでした。次回はパスワードを入力してください。'; }
    openViewer(data);setNotice(notice);
  }catch(error){passwordInput.value='';errorText.textContent=error.message==='network'?'読み込めませんでした。通信を確認してもう一度お試しください。':error.message==='unsupported'?'このブラウザーでは開けません。新しいブラウザーでお試しください。':'パスワードが違います。もう一度入力してください。';passwordInput.focus();}
  finally{setBusy(false);if(!opened)passwordInput.focus();}
});
lockButton.addEventListener('click',async()=>{
  lockButton.disabled=true;
  try {
    if(remembered)await forgetRemembered();
    remembered=false;closeViewer();passwordInput.focus();
  } catch { setNotice('ログイン状態を解除できませんでした。もう一度お試しください。'); }
  finally { lockButton.disabled=false; }
});
window.addEventListener('pageshow',event=>{if(event.persisted){closeViewer();void restoreRemembered();}});
void restoreRemembered();
