// Whole-cel animation timings from the adopted Maro artwork. No walking frames.
export const IDLE_MOTIONS = ['heart', 'high-five', 'cheek'];
export const PET_ENTRY = [[0,500],[1,100],[2,110],[3,100],[4,120],[5,120],[6,130],[7,180],[8,100]];
export const PET_RETURN = [[7,80],[6,120],[5,120],[4,120],[3,100],[2,110],[1,100],[0,650]];
export const duration = timeline => timeline.reduce((total, [, ms]) => total + ms, 0);
export function frameAt(timeline, elapsed) {
  for (const [frame, ms] of timeline) {
    if (elapsed < ms) return frame;
    elapsed -= ms;
  }
  return null;
}
export function idleMotion(random = Math.random) {
  const kind = IDLE_MOTIONS[Math.min(2, Math.floor(random() * 3))];
  if (kind === 'heart') return {kind, timeline: [
    [0,600],[1,70],[2,70],[3,80],[4,90],[5,300],
    [5,10300],[6,150],[7,1600],[6,150],
    [5,10300],[6,150],[7,1600],[6,150],
    [5,5600],[5,300],[4,90],[3,80],[2,70],[1,70],[0,550]
  ]};
  if (kind === 'high-five') {
    const cycles = 2 + Math.floor(random() * 3);
    const hold = 1400 + Math.floor(random() * 1401);
    const timeline = [[0,600]];
    for (let i = 0; i < cycles; i++) timeline.push(
      [1,70],[2,70],[3,80],[4,90],[5,hold],
      [4,90],[3,80],[2,70],[1,70],[0,i === cycles - 1 ? 550 : 650]
    );
    return {kind, timeline};
  }
  const lift = Array.from({length:9}, (_, i) => `lift_${String(i + 1).padStart(2, '0')}`);
  const circle = ['circle_upper_in','circle_top','circle_upper_out','circle_outer','circle_lower_out','circle_bottom','circle_lower_in','circle_inner'];
  const ticks = [['standing',24], ...lift.map(name => [name,2]), ['contact',10]];
  const cycles = 3 + Math.floor(random() * 4);
  for (let i = 0; i < cycles; i++) ticks.push(...circle.map(name => [name,4]));
  ticks.push(['circle_upper_in',4],['circle_top',4],['happy_half',4],['happy_full',32],
    ['happy_half',4],['circle_top',4],['contact',4],
    ...[...lift].reverse().map(name => [name,2]), ['standing',18]);
  return {kind, timeline: ticks.map(([frame, count]) => [frame, count * 1000 / 30])};
}
