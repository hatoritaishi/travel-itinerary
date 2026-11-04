import {PET_ENTRY, PET_RETURN, duration, frameAt, idleMotion} from './mini-maro-motion.js';
import {createMaroFollower} from './mini-maro-space.js?v=follow-14';

const ROOT = new URL('./assets/mini-maro/', import.meta.url);
const SHEETS = {standing:'standing.webp', pet:'banzai.webp', heart:'heart.webp', 'high-five':'high-five.webp'};
const ENTRY_MS = duration(PET_ENTRY);

export function createMiniMaro({random = Math.random, idleDelay = () => 20000 + random() * 15000,
  blinkDelay = () => 3000 + random() * 4000} = {}) {
  // Decide once per document, including history restores. A page without Maro loads no artwork.
  const selected = random() < 0.35;
  const images = new Map();
  let button, canvas, ctx, host, home, events, follower, timer, raf, blinkTimer, blinkRaf, blinkImages, kind = 'standing';
  let walkImages, walkLoading, walkDirection='right';
  let generation = 0, mountGeneration = 0, inView = false, ready = false, started = 0, petHoldUntil = 0, motion;
  const image = path => {
    if (!images.has(path)) {
      const value = new Image(); value.decoding = 'async';
      images.set(path, new Promise((resolve, reject) => {
        value.onload = () => resolve(value);
        value.onerror = () => {images.delete(path); reject(new Error('Maro artwork unavailable'));};
        value.src = new URL(path, ROOT).href;
      }));
    }
    return images.get(path);
  };
  const active = () => ready && button?.isConnected && inView && !document.hidden;
  const draw = (state, frame = 0) => {
    if (!ctx) return;
    // Render once at the screen's actual pixel density. A large fixed canvas
    // shrunk again by CSS loses fine fur and face lines with low-quality sampling.
    const bounds = canvas.getBoundingClientRect();
    const density = Math.min(6, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(bounds.width * density));
    const height = Math.max(1, Math.round(bounds.height * density));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      ctx.setTransform(width / 512, 0, 0, height / 560, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.clearRect(0, 0, 512, 560);
    if (state === 'blink') {
      ctx.drawImage(blinkImages[frame], 0, 0, 512, 560);
    } else if (state === 'cheek') {
      // A fixed whole-body registration: same crown, face midpoint and soles as standing.
      ctx.drawImage(motion.images.get(frame), -35.208, 11.970, 554.991, 554.991);
    } else if (state === 'walk') {
      // Undo the native overlay's common registration margin, without warping the body.
      ctx.drawImage(walkImages[walkDirection][frame], -35.271111, -53.495935, 582.542222, 637.398374);
    } else {
      ctx.drawImage(motion?.image && state !== 'standing' ? motion.image : standingImage,
        frame * 512, 0, 512, 560, 0, 0, 512, 560);
    }
    button.dataset.motion = state;
    button.dataset.frame = String(frame);
  };
  let standingImage;
  const cancel = () => {
    clearTimeout(timer); cancelAnimationFrame(raf); clearTimeout(blinkTimer); cancelAnimationFrame(blinkRaf);
    blinkTimer = blinkRaf = 0; generation++;
  };
  const schedule = () => {
    clearTimeout(timer);
    if (active() && kind === 'standing') timer = setTimeout(() => {void play(idleMotion(random));}, idleDelay());
  };
  const scheduleBlink = () => {
    if (blinkTimer || blinkRaf || !active() || kind !== 'standing' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    blinkTimer = setTimeout(async () => {
      blinkTimer = 0;
      const token = generation;
      try {
        const [half, closed] = await Promise.all([image('standing-blink-half.webp'), image('standing-blink-closed.webp')]);
        if (token !== generation || !active() || kind !== 'standing') return;
        blinkImages = {half, closed};
        const began = performance.now();
        const step = now => {
          if (token !== generation || !active() || kind !== 'standing') return;
          const age = now - began;
          if (age >= 280) {blinkRaf = 0; draw('standing'); scheduleBlink(); return;}
          draw('blink', age < 65 || age >= 165 && age < 230 ? 'half' : age < 165 ? 'closed' : 'open');
          blinkRaf = requestAnimationFrame(step);
        };
        blinkImages.open = standingImage;
        blinkRaf = requestAnimationFrame(step);
      } catch {if (token === generation) scheduleBlink();}
    }, blinkDelay());
  };
  const rest = () => {
    cancel(); kind = 'standing'; motion = null;
    if (ready) draw('standing');
    schedule(); scheduleBlink();
  };
  const tick = now => {
    if (!active()) {rest(); return;}
    const elapsed = Math.max(0, now - started);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;
    if (kind === 'walk') frame = Math.floor(elapsed / 120) % 8;
    else if (reduced) frame = elapsed < 1800 ? ({pet:7, heart:5, 'high-five':5, cheek:'happy_full'})[kind] : null;
    else if (kind === 'pet') frame = elapsed < ENTRY_MS ? frameAt(PET_ENTRY, elapsed)
      : now < petHoldUntil ? 7 : frameAt(PET_RETURN, now - petHoldUntil);
    else frame = frameAt(motion.timeline, elapsed);
    if (frame === null) {rest(); follower?.refresh(); return;}
    draw(kind, frame); raf = requestAnimationFrame(tick);
  };
  async function play(next) {
    if (!active()) return;
    cancel(); kind = next.kind;
    const token = generation;
    try {
      let loaded;
      if (kind === 'cheek') {
        const names = [...new Set(next.timeline.map(([name]) => name))];
        loaded = {images:new Map(await Promise.all(names.map(async name => [name, await image(`cheek/${name}.webp`)])))};
      } else loaded = {image:await image(SHEETS[kind])};
      if (token !== generation || !active()) return;
      motion = {...next, ...loaded}; started = performance.now();
      petHoldUntil = started + ENTRY_MS + 3000;
      raf = requestAnimationFrame(tick);
    } catch {
      if (token === generation) rest();
    }
  }
  const activity = () => {
    if (kind !== 'standing' && kind !== 'pet' && kind !== 'walk') rest();
    else schedule();
  };
  const pet = () => {
    if (kind === 'pet' && motion) {
      petHoldUntil = Math.max(started + ENTRY_MS + 3000, performance.now() + 3000);
      return;
    }
    if (kind !== 'pet') void play({kind:'pet'});
  };
  async function prepareWalk() {
    if(walkImages||walkLoading)return;
    walkLoading=Promise.all(['left','right'].map(async direction=>[direction,await Promise.all(
      Array.from({length:8},(_,index)=>image(`walk/${direction}_${String(index+1).padStart(2,'0')}.webp`))
    )]));
    try {walkImages=Object.fromEntries(await walkLoading);}
    catch { /* Retry on a later scroll; standing artwork remains available. */ }
    finally {walkLoading=null;follower?.refresh();}
  }
  const walking = (moving,direction) => {
    if(!moving){if(kind==='walk')rest();return;}
    if(!walkImages||kind==='pet')return;
    walkDirection=direction;
    if(kind!=='walk'){cancel();kind='walk';motion=null;started=performance.now();raf=requestAnimationFrame(tick);}
  };
  function unmount() {
    mountGeneration++;
    cancel(); ready = false; inView = false; events?.abort(); follower?.destroy();follower=null;
    host?.classList.remove('mini-maro-host'); home?.remove();button?.remove();
    button = canvas = ctx = host = home = null; kind = 'standing'; motion = null;
  }
  async function mount(content) {
    unmount();
    if (!selected) return;
    host = content.querySelector('.route-strip, .guide-header');
    if (!host) return;
    const token = mountGeneration;
    button = document.createElement('button'); button.type = 'button'; button.className = 'mini-maro';
    button.setAttribute('aria-label', 'みにまろちゃんをなでなでする');
    button.dataset.motion = 'loading';
    canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 560; canvas.setAttribute('aria-hidden','true');
    home=document.createElement('span');home.className='mini-maro-home';home.setAttribute('aria-hidden','true');
    button.append(canvas);host.append(home);document.body.append(button);host.classList.add('mini-maro-host');
    ctx = canvas.getContext('2d');
    events = new AbortController();
    button.addEventListener('click', pet, {signal:events.signal});
    for (const event of ['pointerdown','pointermove','keydown','scroll'])
      window.addEventListener(event, activity, {passive:true, signal:events.signal});
    window.addEventListener('resize', () => {
      if (ready) draw(button.dataset.motion, kind === 'cheek' || button.dataset.motion === 'blink'
        ? button.dataset.frame : Number(button.dataset.frame));
    }, {signal:events.signal});
    document.addEventListener('visibilitychange', () => {if (document.hidden) rest(); else {schedule(); scheduleBlink();}}, {signal:events.signal});
    window.addEventListener('pagehide', rest, {signal:events.signal});
    try {
      standingImage = await image(SHEETS.standing);
      if (token !== mountGeneration) return;
      ready = true; button.dataset.ready = 'true'; draw('standing'); schedule(); scheduleBlink();
      follower=createMaroFollower({button,home,onNeedWalk:()=>{void prepareWalk();},canMove:()=>!!walkImages&&kind!=='pet',
        onMoving:walking,onVisibility:visible=>{inView=visible;if(!visible)rest();else{schedule();scheduleBlink();}}});
    } catch {if (token === mountGeneration) unmount();}
  }
  return {mount, unmount};
}
