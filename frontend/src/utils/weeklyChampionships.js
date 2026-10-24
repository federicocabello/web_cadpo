import { parseCalendarDate } from './calendarDate';

const parseDate = value => parseCalendarDate(value);
const ACTIVE_WINDOW_MS = 60 * 60 * 1000;
// Una fecha completa puede extenderse bastante más que la hora informada en
// el calendario (práctica, clasificación y carreras). Esta ventana evita que
// Tiempos en vivo salte al circuito siguiente mientras la jornada sigue activa.
const LIVE_TIMING_ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
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

export const getWeeklyEvents = (events, now = new Date()) => {
  const validEvents = (Array.isArray(events) ? events : [])
    .filter(event => !Number.isNaN(parseDate(event.fecha).getTime()))
    .filter(event => getEventPhase(event, now) !== 'expired');
  if (!validEvents.length) return [];

  const activeEvents = validEvents.filter(event => getEventPhase(event, now) === 'active');
  const referenceEvent = activeEvents[0] || [...validEvents].sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha))[0];
  const [weekStart, weekEnd] = getWeekBounds(parseDate(referenceEvent.fecha));
  return validEvents.filter(event => {
    const timestamp = parseDate(event.fecha).getTime();
    return timestamp >= weekStart && timestamp < weekEnd;
  }).sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha));
};

export const getFeaturedUpcomingEvents = (events, now = new Date()) => {
  const current = now.getTime();
  return (Array.isArray(events) ? events : [])
    .filter(event => !Number.isNaN(parseDate(event.fecha).getTime()))
    .filter(event => getEventPhase(event, now) !== 'expired')
    .filter(event => Boolean(Number(event.mostrar_inicio)))
    .filter(event => !event.mostrar_desde || (parseDate(event.mostrar_desde)?.getTime() || 0) <= current)
    .sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha));
};

export const getWeeklyChampionshipEvents = (events, now = new Date()) => {
  const weeklyEvents = getWeeklyEvents(events, now);

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
  (() => {
    const current = now.getTime();
    const configuredEvents = (Array.isArray(events) ? events : [])
      .filter(hasLiveTimingConfiguration)
      .filter(event => Number.isFinite(parseDate(event.fecha)?.getTime()))
      .filter(event => parseDate(event.fecha).getTime() + LIVE_TIMING_ACTIVE_WINDOW_MS > current);

    if (!configuredEvents.length) return [];

    const isActive = event => {
      const start = parseDate(event.fecha).getTime();
      return start <= current && current < start + LIVE_TIMING_ACTIVE_WINDOW_MS;
    };
    const comparePriority = (a, b) => {
      const aActive = isActive(a);
      const bActive = isActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;

      // Si dos fechas se superponen, la que comenzó primero también es la
      // que está más cerca de terminar y debe conservar la prioridad.
      return parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime();
    };

    const orderedEvents = [...configuredEvents].sort(comparePriority);
    const byChampionship = new Map();
    // Cada campeonato puede usar un servidor diferente aunque sus fechas no
    // pertenezcan a la misma semana. Conservamos una sola fecha relevante por
    // campeonato: la que está en curso o, en su defecto, la próxima.
    orderedEvents.forEach(event => {
      if (!byChampionship.has(event.idcampeonato)) byChampionship.set(event.idcampeonato, event);
    });

    return [...byChampionship.values()].sort(comparePriority);
  })();
