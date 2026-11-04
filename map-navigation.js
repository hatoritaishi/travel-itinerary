export function eventAnchor(dayNumber, eventIndex) {
  return `event-${dayNumber}-${eventIndex}`;
}

export function visitedPlaces(data) {
  const seen = new Set(), places = [];
  data.days.forEach((day, dayIndex) => {
    day.events.forEach((event, eventIndex) => {
      for (const guideId of event.guideIds || []) {
        const guide = data.guides?.[guideId];
        if (!guide?.map || guide.kind === 'city' || seen.has(guideId)) continue;
        seen.add(guideId);
        places.push({guideId, guide, dayNumber:dayIndex+1, date:day.date,
          eventIndex, time:event.time, label:event.label, eventTitle:event.title});
      }
    });
  });
  return places;
}

export function visitTime(time) {
  return String(time || '').replace(/\s*\n\s*/g, '〜');
}

export function timelineUrl(base, place) {
  const url = new URL(base);
  url.search = '';
  url.searchParams.set('day', place.dayNumber);
  url.hash = eventAnchor(place.dayNumber, place.eventIndex);
  return url.href;
}

export function timelineTarget(data, hash) {
  const match = /^#event-([1-9]\d*)-(0|[1-9]\d*)$/.exec(hash);
  if (!match) return null;
  const dayIndex = Number(match[1])-1, eventIndex = Number(match[2]);
  if (!data.days[dayIndex]?.events[eventIndex]) return null;
  return {dayIndex, eventIndex, id:eventAnchor(dayIndex+1, eventIndex)};
}
