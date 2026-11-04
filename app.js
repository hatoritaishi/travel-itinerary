'use strict';
import { readRemembered, saveRemembered, forgetRemembered } from './remember.js';
import { createMiniMaro } from './mini-maro.js?v=appearance-19';
const miniMaro = createMiniMaro();
const gate = document.getElementById('gate');
const opening = document.getElementById('opening');
const openingMessage = document.getElementById('opening-message');
const retryOpening = document.getElementById('retry-opening');
const content = document.getElementById('content');
const itinerary = document.getElementById('itinerary');
const form = document.getElementById('unlock-form');
const passwordInput = document.getElementById('password');
const unlockButton = document.getElementById('unlock-button');
const errorText = document.getElementById('unlock-error');
const showPassword = document.getElementById('show-password');
let opened = false;
let loading = false;
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
function guideLink(id, label, dayNumber) {
  const link = text('a', label);
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('spot', id);
  if (dayNumber) url.searchParams.set('day', dayNumber);
  link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}
function renderDestinationGuides(data) {
  const section=document.createElement('section');section.id='destination-guides';section.className='destination-guides';section.setAttribute('aria-labelledby','destination-guides-title');
  const heading=text('h2','旅先ガイド','destination-guides-title');heading.append(text('span','写真と解説','destination-heading-cue'));section.append(heading);
  const cards=document.createElement('div');cards.className='destination-cards';
  for(const id of data.destinationGuideIds||[]) {
    const guide=data.guides[id];const card=guideLink(id,'',returnDay()||1);card.className='destination-card';
    card.setAttribute('aria-label',`${guide.cardName||guide.cityName}の写真と解説を開く`);
    card.append(text('span',guide.cardName||guide.cityName,'destination-name'),text('span',guide.summary,'destination-summary'),text('span','写真と解説を見る ↗','destination-cta'));
    cards.append(card);
  }
  section.append(cards);return section;
}
function renderCitySwitcher(data,currentId) {
  const nav=document.createElement('nav');nav.id='destination-guides';nav.className='city-switcher';nav.setAttribute('aria-label','旅先ガイドを切り替える');
  nav.append(text('span','旅先ガイド','city-switch-label'));
  for(const id of data.destinationGuideIds||[]) {
    const guide=data.guides[id],label=guide.navigationLabel||guide.name;
    const link=guideLink(id,'',returnDay());link.target='_self';link.className='city-switch-link';link.setAttribute('aria-label',label);
    link.append(text('span',label,'city-switch-full'),text('span',guide.cardName||guide.cityName,'city-switch-short'));
    if(id===currentId)link.setAttribute('aria-current','page');nav.append(link);
  }
  return nav;
}
function renderEvent(item, id, guides, dayNumber) {
  const li = document.createElement('li'); li.className = `event ${item.kind}`;
  const time = text(item.alternative ? 'button' : 'div', item.time, 'event-time');
  if (item.timeNote) time.append(text('small', item.timeNote));
  const body = document.createElement('div'); body.className = 'event-body';
  const heading = text('h3', item.title);
  if (item.guideIds?.length) {
    const guide = guides[item.guideIds[0]];
    const link = guideLink(item.guideIds.join(','), item.title, dayNumber); link.className = 'spot-title-link';
    link.append(text('span', guide.kind === 'souvenir' ? 'おみやげ ↗' : '解説 ↗', 'guide-cue'));
    heading.replaceChildren(link);
  }
  body.append(text('p', item.label, 'event-label'), heading);
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
  if (item.alternative) {
    time.type = 'button'; time.classList.add('time-toggle');
    time.setAttribute('aria-expanded', 'false'); time.setAttribute('aria-controls', id);
    time.setAttribute('aria-label', `${item.time.replaceAll('\n', '〜')}の別経路`);
    const cue = text('small', '別経路 ▾', 'time-toggle-cue'); time.append(cue);
    const alternative = document.createElement('section'); alternative.id = id;
    alternative.className = 'alternative-route'; alternative.hidden = true;
    alternative.append(text('h4', item.alternative.title), text('p', item.alternative.description));
    for (const source of item.alternative.sources || []) {
      const p = document.createElement('p'); p.append(sourceLink(source)); alternative.append(p);
    }
    time.addEventListener('click', () => {
      alternative.hidden = !alternative.hidden;
      time.setAttribute('aria-expanded', String(!alternative.hidden));
      cue.textContent = alternative.hidden ? '別経路 ▾' : '閉じる ▴';
    });
    body.append(alternative);
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
  hero.append(intro); content.append(hero,renderDestinationGuides(data));
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
    const timeline=document.createElement('ol');timeline.className='timeline';day.events.forEach((item,eventIndex)=>timeline.append(renderEvent(item,`alternative-${index}-${eventIndex}`,data.guides||{},index+1)));panel.append(timeline);
    panels.append(panel);
  });
  content.append(tabs,panels);
  const allSources=document.createElement('details');allSources.className='backup';allSources.append(text('summary','時刻表・施設の公式案内'));const list=document.createElement('ul');list.className='source-list';data.sources.forEach(source=>{const li=document.createElement('li');li.append(sourceLink(source));list.append(li);});allSources.append(list);content.append(allSources);
  content.append(renderDayJump(data.days));
}
function renderDayJump(days) {
  const nav=document.createElement('nav');nav.className='day-tabs day-jumps';nav.setAttribute('aria-label','日程を選んで上へ移動');
  days.forEach((day,index)=>{
    const button=document.createElement('button');button.type='button';button.className='day-tab day-jump';
    button.setAttribute('aria-pressed',String(index===0));button.setAttribute('aria-label',`${day.date} ${day.shortTitle}の上の日程へ移動`);
    button.append(text('span',day.date),text('strong',day.shortTitle));
    button.addEventListener('click',()=>{
      selectDay(index);content.querySelector('[role=tablist]').scrollIntoView({block:'start',behavior:'auto'});
      content.querySelector(`#tab-${index}`).focus({preventScroll:true});
    });
    nav.append(button);
  });
  return nav;
}
function returnDay() {
  const day=Number(new URL(window.location.href).searchParams.get('day'));
  return Number.isInteger(day)&&day>=1&&day<=3?day:null;
}
function itineraryUrl() {
  const url=new URL(window.location.pathname,window.location.origin);
  const day=returnDay();if(day)url.searchParams.set('day',day);
  return url.href;
}
function guideReturnLink() {
  const day=returnDay();
  const back=text('a',day?`← ${day}日目の旅程に戻る`:'← 旅程に戻る','guide-return');
  back.href=itineraryUrl();return back;
}
function renderGuide(data, id) {
  content.replaceChildren();
  const navigation=document.createElement('nav');navigation.className='guide-navigation';navigation.setAttribute('aria-label','旅程へ戻る');navigation.append(guideReturnLink());content.append(navigation,renderCitySwitcher(data,id));
  const ids = [...new Set(id.split(','))];
  if (!ids.length || ids.some(guideId => !Object.hasOwn(data.guides || {}, guideId))) {
    content.append(text('h1', 'この解説は見つかりませんでした。'), text('p', '旅のしおりからスポットを選んでください。')); return;
  }
  const guides = ids.map(guideId => data.guides[guideId]);
  const grouped = guides.length > 1;
  document.title = `${guides.map(guide=>guide.name).join('・')}｜旅のしおり`;
  if (grouped) {
    const group = document.createElement('header'); group.className = 'guide-group-header spot-guide';
    group.append(text('p','SPOT GUIDE','eyebrow'),text('h1',guides.map(guide=>guide.name).join('・')));
    const nav = document.createElement('nav'); nav.className = 'spot-links';
    guides.forEach((guide,index)=>{const link=text('a',guide.name,'spot-link');link.href=`#guide-${ids[index]}`;nav.append(link);});
    group.append(nav); content.append(group);
  }
  guides.forEach((guide,index)=>renderGuideArticle(guide,ids[index],grouped,data.guidesCheckedOn));
  const bottom=document.createElement('div');bottom.className='guide-return-bottom';bottom.append(guideReturnLink());content.append(bottom);
}
function renderGuideArticle(guide,id,grouped,checkedOn) {
  const article = document.createElement('article'); article.className = 'spot-guide';
  article.id = `guide-${id}`;
  const header = document.createElement('header'); header.className = 'guide-header';
  header.append(text('p', guide.area, 'eyebrow'), text(grouped?'h2':'h1', guide.name), text('p', guide.lead, 'guide-lead'));
  const actions=document.createElement('div');actions.className='guide-actions';
  if(guide.map){const link=text('a','地図を見る ↓','spot-link');link.href=`#map-${id}`;actions.append(link);}
  if(guide.official){const link=sourceLink({label:'公式サイト ↗',url:guide.official.url});link.className='spot-link';actions.append(link);}
  if(actions.childElementCount)header.append(actions);
  article.append(header);
  if (guide.photo) {
    const figure = document.createElement('figure'); figure.className = 'guide-figure';
    const image = document.createElement('img'); image.className = 'guide-photo';
    image.src = guide.photo.url; image.alt = guide.photo.alt; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    const caption = document.createElement('figcaption');
    caption.append(sourceLink({label:guide.photo.credit,url:guide.photo.source}));
    if (guide.photo.license) {
      caption.append(document.createTextNode(' / '));
      caption.append(guide.photo.licenseUrl ? sourceLink({label:guide.photo.license,url:guide.photo.licenseUrl}) : document.createTextNode(guide.photo.license));
    }
    figure.append(image,caption); article.append(figure);
  }
  for (const section of guide.sections) {
    const block = document.createElement('section'); block.className = 'guide-section';
    if(guide.kind==='hotel'&&section.heading==='今回の滞在')block.classList.add('stay-summary');
    block.append(text(grouped?'h3':'h2', section.heading));
    if (section.body) block.append(text('p', section.body));
    if (section.source) {const source=document.createElement('p');source.append(sourceLink(section.source));block.append(source);}
    if (section.items) {
      const list = document.createElement('ul');
      section.items.forEach(item => list.append(text('li', item))); block.append(list);
    }
    if(section.products?.length)block.append(renderProducts(section.products,grouped));
    article.append(block);
  }
  if(guide.map)article.append(renderPlaceMap(guide.map,id,grouped));
  if (guide.official) {
    const links = document.createElement('div'); links.className = 'guide-official';
    const link = sourceLink({label:'公式ホームページを開く ↗',url:guide.official.url});
    link.className = 'official-link'; links.append(link, text('p', guide.official.label)); article.append(links);
  }
  article.append(text('p', `案内確認：${checkedOn}`, 'guide-checked'));
  content.append(article);
}
function renderProducts(products,grouped) {
  const list=document.createElement('ul');list.className='product-list';
  for(const product of products){
    const item=document.createElement('li');item.className='product-item';
    const photo=sourceLink({label:'',url:product.url});photo.className='product-photo-link';photo.setAttribute('aria-label',`${product.name}の公式ページを開く`);
    const image=document.createElement('img');image.className='product-photo';image.src=product.image.url;image.alt=product.image.alt;
    image.width=80;image.height=80;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';photo.append(image);
    const copy=document.createElement('div');copy.className='product-copy';const heading=text(grouped?'h4':'h3','','product-heading');
    const link=sourceLink({label:`${product.name} ↗`,url:product.url});link.className='product-name';heading.append(link);
    const credit=text('p','画像：','product-credit');credit.append(sourceLink({label:product.image.credit,url:product.image.source}));
    copy.append(heading,text('p',product.description,'product-description'),credit);item.append(photo,copy);list.append(item);
  }
  return list;
}
function renderPlaceMap(map,id,grouped) {
  const url=new URL(map.embed);
  if(url.origin!=='https://map.yahoo.co.jp'||url.pathname!=='/embedmap/V3/embedmap')throw new Error('Invalid map URL');
  const block=document.createElement('section');block.className='guide-section guide-map';block.id=`map-${id}`;
  block.append(text(grouped?'h3':'h2','場所・Yahoo!マップ'),text('p',map.name,'map-place'));
  const frame=document.createElement('iframe');frame.className='guide-map-frame';frame.src=url.href;frame.title=`${map.name}のYahoo!マップ`;
  frame.loading='lazy';frame.width=600;frame.height=340;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups');
  block.append(frame);
  if(map.caption)block.append(text('p',map.caption,'map-caption'));
  const link=sourceLink({label:'Yahoo!マップを別タブで開く ↗',url:map.url});link.className='spot-link';block.append(link);
  return block;
}
function selectDay(index){
  content.querySelectorAll('[role=tab]').forEach((node,i)=>{node.setAttribute('aria-selected',String(i===index));node.tabIndex=i===index?0:-1;});
  content.querySelectorAll('[role=tabpanel]').forEach((node,i)=>node.hidden=i!==index);
  content.querySelectorAll('.day-jump').forEach((node,i)=>node.setAttribute('aria-pressed',String(i===index)));
  content.querySelectorAll('.destination-card').forEach(link=>{const url=new URL(link.href);url.searchParams.set('day',index+1);link.href=url.href;});
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
  const guideId = new URL(window.location.href).searchParams.get('spot');
  if (guideId) renderGuide(data, guideId); else {render(data);const day=returnDay();if(day)selectDay(day-1);}
  document.querySelector('.brand').href=guideId?itineraryUrl():'#content';
  opened=true;gate.hidden=true;opening.hidden=true;itinerary.hidden=false;passwordInput.value='';
  passwordInput.type='password';showPassword.textContent='表示';showPassword.setAttribute('aria-pressed','false');
  void miniMaro.mount(content);
  if(focus)content.focus();window.scrollTo(0,0);
}
function closeViewer(showGate=true) {
  miniMaro.unmount();
  opened=false;content.replaceChildren();itinerary.hidden=true;gate.hidden=!showGate;opening.hidden=showGate;errorText.textContent='';passwordInput.value='';setNotice();window.scrollTo(0,0);
}
async function restoreRemembered() {
  if(loading||opened)return;
  gate.hidden=true;opening.hidden=false;retryOpening.hidden=true;openingMessage.textContent='しおりをひらいています…';
  let needsUnlock=false;
  setBusy(true,'ログイン状態を確認しています…');setNotice();
  try {
    let saved;
    try { saved=await readRemembered(); }
    catch { needsUnlock=true;return; }
    if(!saved?.key){needsUnlock=true;return;}
    if(!window.crypto?.subtle)throw new Error('unsupported');
    const payload=await loadPayload();
    if(saved.salt!==payload.salt||saved.iterations!==payload.iterations||saved.version!==payload.version) {
      needsUnlock=true;await forgetRemembered();return;
    }
    let data;
    try { data=await decryptPayload(saved.key,payload); }
    catch { needsUnlock=true;await forgetRemembered();return; }
    openViewer(data,false);
  } catch(error) {
    openingMessage.textContent='しおりを読み込めませんでした。通信を確認して、もう一度お試しください。';retryOpening.hidden=false;
  } finally {
    setBusy(false);
    if(needsUnlock){opening.hidden=true;gate.hidden=false;}
  }
}
retryOpening.addEventListener('click',()=>{void restoreRemembered();});
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
    try { await saveRemembered(key,payload); }
    catch { notice='このブラウザーではログイン状態を保存できませんでした。次回はパスワードを入力してください。'; }
    openViewer(data);setNotice(notice);
  }catch(error){passwordInput.value='';errorText.textContent=error.message==='network'?'読み込めませんでした。通信を確認してもう一度お試しください。':error.message==='unsupported'?'このブラウザーでは開けません。新しいブラウザーでお試しください。':'パスワードが違います。もう一度入力してください。';passwordInput.focus();}
  finally{setBusy(false);if(!opened)passwordInput.focus();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){closeViewer(false);void restoreRemembered();}});
void restoreRemembered();
