import { parseCalendarDate } from './calendarDate';

const parseDate = value => parseCalendarDate(value);
const ACTIVE_WINDOW_MS = 60 * 60 * 1000;

export const getEventPhase = (event, now = new Date()) => {
  if (!event?.fecha) return 'expired';
  const start = parseDate(event.fecha).getTime();
  const current = now.getTime();
  if (current < start) return 'upcoming';
  if (current < start + ACTIVE_WINDOW_MS) return 'active';
  return 'expired';
};

const getWeekBounds = reference => {
  const start = new Date(reference);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return [start.getTime(), end.getTime()];
};

export const getWeeklyChampionshipEvents = (events, now = new Date()) => {
  const validEvents = (Array.isArray(events) ? events : [])
    .filter(event => !Number.isNaN(parseDate(event.fecha).getTime()))
    .filter(event => getEventPhase(event, now) !== 'expired');
  if (!validEvents.length) return [];

  const activeEvents = validEvents.filter(event => getEventPhase(event, now) === 'active');
  const referenceEvent = activeEvents[0] || [...validEvents].sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha))[0];
  const [weekStart, weekEnd] = getWeekBounds(parseDate(referenceEvent.fecha));
  const weeklyEvents = validEvents.filter(event => {
    const timestamp = parseDate(event.fecha).getTime();
    return timestamp >= weekStart && timestamp < weekEnd;
  });

  const byChampionship = new Map();
  weeklyEvents
    .sort((a, b) => Math.abs(parseDate(a.fecha) - now) - Math.abs(parseDate(b.fecha) - now))
    .forEach(event => {
      if (!byChampionship.has(event.idcampeonato)) byChampionship.set(event.idcampeonato, event);
    });

  return [...byChampionship.values()].sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha));
};

const hasLiveTimingConfiguration = event => {
  const hasPort = event?.puerto !== null
    && event?.puerto !== undefined
    && String(event.puerto).trim() !== '';
  const hasServerNumber = event?.n_server !== null
    && event?.n_server !== undefined
    && String(event.n_server).trim() !== '';

  return hasPort && hasServerNumber;
};

export const getLiveTimingEvents = (events, now = new Date()) =>
  getWeeklyChampionshipEvents(
    (Array.isArray(events) ? events : []).filter(hasLiveTimingConfiguration),
    now,
  );
