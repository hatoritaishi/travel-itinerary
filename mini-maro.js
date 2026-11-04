import {PET_ENTRY, PET_RETURN, duration, frameAt, idleMotion} from './mini-maro-motion.js';

const ROOT = new URL('./assets/mini-maro/', import.meta.url);
const SHEETS = {standing:'standing.webp', pet:'banzai.webp', heart:'heart.webp', 'high-five':'high-five.webp'};
const ENTRY_MS = duration(PET_ENTRY);

export function createMiniMaro({random = Math.random, idleDelay = () => 20000 + random() * 15000,
  blinkDelay = () => 3000 + random() * 4000} = {}) {
  // Decide once per document, including history restores. A page without Maro loads no artwork.
  const selected = random() < 0.35;
  const images = new Map();
  let button, canvas, ctx, host, events, observer, timer, raf, blinkTimer, blinkRaf, blinkImages, kind = 'standing';
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
    ctx.clearRect(0, 0, 512, 560);
    if (state === 'blink') {
      ctx.drawImage(blinkImages[frame], 0, 0, 512, 560);
    } else if (state === 'cheek') {
      // Same whole-cel registration as the adopted room animation, aligned to the 512px body.
      ctx.drawImage(motion.images.get(frame), -38, -2, 560, 560);
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
        const [half, closed] = await Promise.all([image('blink-half.webp'), image('blink-closed.webp')]);
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
    const elapsed = now - started;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;
    if (reduced) frame = elapsed < 1800 ? ({pet:7, heart:5, 'high-five':5, cheek:'happy_full'})[kind] : null;
    else if (kind === 'pet') frame = elapsed < ENTRY_MS ? frameAt(PET_ENTRY, elapsed)
      : now < petHoldUntil ? 7 : frameAt(PET_RETURN, now - petHoldUntil);
    else frame = frameAt(motion.timeline, elapsed);
    if (frame === null) {rest(); return;}
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
    if (kind !== 'standing' && kind !== 'pet') rest();
    else schedule();
  };
  const pet = () => {
    if (kind === 'pet' && motion) {
      petHoldUntil = Math.max(started + ENTRY_MS + 3000, performance.now() + 3000);
      return;
    }
    if (kind !== 'pet') void play({kind:'pet'});
  };
  function unmount() {
    mountGeneration++;
    cancel(); ready = false; inView = false; events?.abort(); observer?.disconnect();
    host?.classList.remove('mini-maro-host'); button?.remove();
    button = canvas = ctx = host = null; kind = 'standing'; motion = null;
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
    button.append(canvas); host.append(button); host.classList.add('mini-maro-host');
    ctx = canvas.getContext('2d');
    events = new AbortController();
    button.addEventListener('click', pet, {signal:events.signal});
    for (const event of ['pointerdown','pointermove','keydown','scroll'])
      window.addEventListener(event, activity, {passive:true, signal:events.signal});
    document.addEventListener('visibilitychange', () => {if (document.hidden) rest(); else {schedule(); scheduleBlink();}}, {signal:events.signal});
    window.addEventListener('pagehide', rest, {signal:events.signal});
    observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) rest(); else {schedule(); scheduleBlink();}
    });
    observer.observe(button);
    try {
      standingImage = await image(SHEETS.standing);
      if (token !== mountGeneration) return;
      ready = true; button.dataset.ready = 'true'; draw('standing'); schedule(); scheduleBlink();
    } catch {if (token === mountGeneration) unmount();}
  }
  return {mount, unmount};
}
