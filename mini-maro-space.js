const MARGIN = 8;
const GRID = 24;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function canStand(point, obstacles, viewport, size) {
  if (!point || point.x < MARGIN || point.y < MARGIN || point.x + size.width > viewport.width - MARGIN || point.y + size.height > viewport.height - MARGIN) return false;
  return !obstacles.some(r => point.x < r.right && point.x + size.width > r.left && point.y < r.bottom && point.y + size.height > r.top);
}
export function clearPath(a, b, obstacles, viewport, size) {
  if (!canStand(a, obstacles, viewport, size) || !canStand(b, obstacles, viewport, size)) return false;
  // Sweep the entire character rectangle, including between animation frames.
  return !obstacles.some(r => {
    const box = {left:r.left - size.width, right:r.right, top:r.top - size.height, bottom:r.bottom};
    let enter = 0, leave = 1;
    for (const [axis, min, max] of [['x',box.left,box.right],['y',box.top,box.bottom]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 0.0001) {if (a[axis] <= min || a[axis] >= max) return false;}
      else {const one=(min-a[axis])/delta, two=(max-a[axis])/delta;enter=Math.max(enter,Math.min(one,two));leave=Math.min(leave,Math.max(one,two));if(enter>=leave)return false;}
    }
    return enter < leave;
  });
}
function axisPoints(max, extras) {
  if (max < MARGIN) return [];
  const points = [MARGIN,max,...extras.map(value => clamp(value,MARGIN,max))];
  for (let value=MARGIN+GRID; value<max; value+=GRID) points.push(value);
  return [...new Set(points)].sort((a,b)=>a-b);
}
export function safeRoute(start, preferred, obstacles, viewport, size) {
  const xs=axisPoints(viewport.width-size.width-MARGIN,[start.x,preferred.x]);
  const ys=axisPoints(viewport.height-size.height-MARGIN,[start.y,preferred.y]);
  const nodes=xs.flatMap((x,xi)=>ys.map((y,yi)=>({x,y,xi,yi})));
  const free=nodes.map(node=>canStand(node,obstacles,viewport,size));
  if(!canStand(start,obstacles,viewport,size)) {
    const available=nodes.filter((_,index)=>free[index]);
    available.sort((a,b)=>distance(a,start)-distance(b,start));
    return available.length?{position:available[0],path:[],relocated:true}:null;
  }
  const first=nodes.findIndex(node=>node.x===start.x&&node.y===start.y);
  if(first<0)return null;
  const parents=new Map([[first,-1]]),queue=[first];let best=first;
  for(let cursor=0;cursor<queue.length;cursor++){
    const id=queue[cursor],current=nodes[id];
    if(distance(current,preferred)<distance(nodes[best],preferred))best=id;
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]]){
      const xi=current.xi+dx,yi=current.yi+dy;
      if(xi<0||yi<0||xi>=xs.length||yi>=ys.length)continue;
      const next=xi*ys.length+yi;
      if(parents.has(next)||!free[next]||!clearPath(current,nodes[next],obstacles,viewport,size))continue;
      parents.set(next,id);queue.push(next);
    }
  }
  const path=[];
  for(let id=best;id!==first&&id!==-1;id=parents.get(id))path.unshift({x:nodes[id].x,y:nodes[id].y});
  // Remove grid corners when the direct, swept route is also clear.
  const smooth=[];let from=start;
  while(path.length){let far=path.length-1;while(far>0&&!clearPath(from,path[far],obstacles,viewport,size))far--;from=path[far];smooth.push(from);path.splice(0,far+1);}
  return {position:start,path:smooth,relocated:false};
}

export function collectObstacles(root, character, viewport) {
  const rectangles=[];
  const excluded=node=>character.contains(node)||node.closest?.('.mini-maro-home,script,style,noscript,template');
  const add=rect=>{if(rect.width<=0||rect.height<=0||rect.right<0||rect.left>viewport.width||rect.bottom<0||rect.top>viewport.height)return;
    rectangles.push({left:rect.left-6,right:rect.right+6,top:rect.top-6,bottom:rect.bottom+6});};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const range=document.createRange();
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.textContent.trim()||excluded(node.parentElement))continue;
    range.selectNodeContents(node);
    for(const rect of range.getClientRects())add(rect);
  }
  for(const node of root.querySelectorAll('img,video,canvas,iframe,svg,button,input,select,textarea,a,[role="button"],[role="tab"],[data-mini-maro-avoid],.guide-navigation')){
    if(excluded(node))continue;
    for(const rect of node.getClientRects())add(rect);
  }
  // Future photos may be CSS backgrounds rather than <img> elements.
  for(const node of root.querySelectorAll('*')){
    if(excluded(node))continue;
    const rect=node.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0||rect.right<0||rect.left>viewport.width||rect.bottom<0||rect.top>viewport.height)continue;
    if(getComputedStyle(node).backgroundImage!=='none')add(rect);
  }
  return rectangles;
}

export function createMaroFollower({button,home,onVisibility,onMoving,onNeedWalk,canMove}) {
  const size={width:80,height:88};
  const events=new AbortController();
  let position,obstacles=[],viewport,raf=0,wakeTimer=0,dirty=true,following=false,visible=false,destroyed=false;
  let path=[],speed=0,lastFrame=0,followAfter=0,lastScroll=-Infinity,lastScrollY=window.scrollY,scrollDirection='right';
  let scrollOffset=0,offsetUntil=0,blockedAt=null;
  const preferred=()=>({x:viewport.width-size.width-20,y:clamp(viewport.height-size.height-80+scrollOffset,8,viewport.height-size.height-8)});
  const show=value=>{button.dataset.safe=String(value);if(visible===value)return;visible=value;onVisibility(value);};
  const queue=()=>{if(!destroyed&&!raf)raf=requestAnimationFrame(step);};
  const refresh=()=>{dirty=true;button.dataset.safe='false';queue();};
  const place=()=>{
    const density=window.devicePixelRatio||1;
    button.style.left=`${Math.round(position.x*density)/density}px`;
    button.style.top=`${Math.round(position.y*density)/density}px`;
  };
  const later=delay=>{clearTimeout(wakeTimer);wakeTimer=setTimeout(queue,Math.max(16,delay));};
  function step(now) {
    raf=0;
    if(destroyed||document.hidden){show(false);onMoving(false);return;}
    viewport={width:document.documentElement.clientWidth,height:window.innerHeight};
    if(scrollOffset&&now>=offsetUntil){scrollOffset=0;path=[];}
    if(dirty){obstacles=collectObstacles(document.body,button,viewport);dirty=false;path=[];}
    if(!position){const rect=home.getBoundingClientRect();position={x:rect.left,y:rect.top};}
    const target=preferred();
    if(!canStand(position,obstacles,viewport,size)){
      show(false);onMoving(false);speed=0;
      if(blockedAt===null)blockedAt=now;
      if(now<blockedAt+180){later(blockedAt+180-now);return;}
      if(now<followAfter){later(followAfter-now);return;}
      const route=safeRoute(position,target,obstacles,viewport,size);
      if(!route)return;
      position={x:route.position.x,y:route.position.y};path=[];
    }
    blockedAt=null;
    place();show(true);
    if(!following){onMoving(false);return;}
    if(now<followAfter){onMoving(false);later(followAfter-now);return;}
    if(!canMove()){onMoving(false);return;}
    if(!path.length){const route=safeRoute(position,target,obstacles,viewport,size);path=route?.path||[];}
    if(!path.length){onMoving(false);speed=0;lastFrame=now;if(scrollOffset)later(offsetUntil-now);return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){show(false);onMoving(false);return;}
    const dt=lastFrame?Math.max(0,Math.min(0.04,(now-lastFrame)/1000)):1/60;lastFrame=now;
    speed=Math.min(115,speed+dt*380);
    const next=path[0],remaining=distance(position,next);
    const travel=Math.min(remaining,speed*dt);
    const candidate={x:position.x+(next.x-position.x)*travel/Math.max(remaining,0.001),y:position.y+(next.y-position.y)*travel/Math.max(remaining,0.001)};
    if(!clearPath(position,candidate,obstacles,viewport,size)){refresh();onMoving(false);return;}
    const direction=candidate.x<position.x-0.01?'left':candidate.x>position.x+0.01?'right':scrollDirection;
    position=candidate;place();onMoving(true,direction);
    if(remaining<=travel+0.01)path.shift();
    queue();
  }
  const scroll=()=>{
    const now=performance.now(),delta=window.scrollY-lastScrollY;lastScrollY=window.scrollY;
    if(delta)scrollDirection=delta<0?'left':'right';
    if(now-lastScroll>220)followAfter=now+180;
    lastScroll=now;following=true;onNeedWalk();
    scrollOffset=clamp(scrollOffset-delta*0.35,-96,96);offsetUntil=now+1000;
    refresh();
  };
  window.addEventListener('scroll',scroll,{capture:true,passive:true,signal:events.signal});
  window.addEventListener('resize',refresh,{passive:true,signal:events.signal});
  document.addEventListener('load',refresh,{capture:true,signal:events.signal});
  document.addEventListener('visibilitychange',refresh,{signal:events.signal});
  const mutations=new MutationObserver(records=>{if(records.some(record=>!button.contains(record.target)&&record.target!==home))refresh();});
  mutations.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','open','src','width','height']});
  const resize=new ResizeObserver(refresh);resize.observe(document.body);resize.observe(document.getElementById('content')||document.body);
  document.fonts?.addEventListener('loadingdone',refresh,{signal:events.signal});
  queue();
  return {refresh,destroy(){destroyed=true;cancelAnimationFrame(raf);clearTimeout(wakeTimer);events.abort();mutations.disconnect();resize.disconnect();show(false);}};
}
