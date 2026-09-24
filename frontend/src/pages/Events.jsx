import { useEffect, useMemo, useState } from 'react';
import { CalendarIcon, CheckCircleIcon, ClockIcon, FunnelIcon } from '@heroicons/react/24/outline';
import EventCard from '../components/EventCard';
import { eventsApi } from '../services/api';
import { parseCalendarDate } from '../utils/calendarDate';
import { getLiveTimingEvents, getWeeklyChampionshipEvents } from '../utils/weeklyChampionships';

const STATUSES = [
  { value: '', label: 'Todas' },
  { value: 'upcoming', label: 'Próximas' },
  { value: 'completed', label: 'Pasadas' },
];
const PAST_PAGE_SIZE = 10;

const eventTime = event => parseCalendarDate(event.fecha)?.getTime() || 0;

function EventSection({ title, description, events, totalCount, upcoming, nearbyEventIds, liveTimingEventIds }) {
  if (!events.length) return null;

  const Icon = upcoming ? ClockIcon : CheckCircleIcon;

  return (
    <section>
      <header className={`mb-5 flex flex-col gap-2 border-l-2 pl-4 sm:flex-row sm:items-end sm:justify-between ${upcoming ? 'border-racing-red' : 'border-white/25'}`}>
        <div>
          <div className={`mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] ${upcoming ? 'text-racing-red' : 'text-gray-400'}`}>
            <Icon className="h-4 w-4" />
            {upcoming ? 'Lo que viene' : 'Lo que ya pasó'}
          </div>
          <h2 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span className="font-racing text-sm font-bold uppercase text-gray-500">
          {totalCount ?? events.length} fecha{(totalCount ?? events.length) === 1 ? '' : 's'}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            featured={index === 0}
            showNearbyActions={nearbyEventIds.has(String(event.id))}
            showLiveTiming={liveTimingEventIds.has(String(event.id))}
          />
        ))}
      </div>
    </section>
  );
}

export default function Events({ initialStatus = '' }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [pastPage, setPastPage] = useState(1);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = statusFilter ? { status: statusFilter } : {};
        const res = await eventsApi.getAll(params);
        setEvents(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [statusFilter]);

  const nearbyEventIds = useMemo(() => new Set(
    getWeeklyChampionshipEvents(events).map(event => String(event.id)),
  ), [events]);
  const liveTimingEventIds = useMemo(() => new Set(
    getLiveTimingEvents(events).map(event => String(event.id)),
  ), [events]);
  const upcomingEvents = useMemo(() => events
    .filter(event => event.status === 'upcoming')
    .sort((a, b) => eventTime(a) - eventTime(b)), [events]);
  const completedEvents = useMemo(() => events
    .filter(event => event.status === 'completed')
    .sort((a, b) => eventTime(b) - eventTime(a)), [events]);
  const pastPageCount = Math.max(1, Math.ceil(completedEvents.length / PAST_PAGE_SIZE));
  const visibleCompletedEvents = useMemo(
    () => completedEvents.slice((pastPage - 1) * PAST_PAGE_SIZE, pastPage * PAST_PAGE_SIZE),
    [completedEvents, pastPage],
  );

  useEffect(() => {
    setPastPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (pastPage > pastPageCount) setPastPage(pastPageCount);
  }, [pastPage, pastPageCount]);

  return (
    <div className="animate-fade-in">
      <div className="sticky top-16 z-40 bg-racing-dark/95 backdrop-blur-md border-b border-racing-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-3 items-center">
          <FunnelIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-all duration-200 ${
                  statusFilter === value
                    ? 'bg-racing-red border-racing-red text-white'
                    : 'border-racing-border text-gray-400 hover:border-racing-red/50 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length > 0 ? (
          <div className="grid gap-12">
            <EventSection
              title="Próximas fechas"
              description="La fecha más cercana aparece destacada primero."
              events={upcomingEvents}
              upcoming
              nearbyEventIds={nearbyEventIds}
              liveTimingEventIds={liveTimingEventIds}
            />
            <EventSection
              title="Fechas disputadas"
              description="La última carrera realizada aparece primero."
              events={visibleCompletedEvents}
              totalCount={completedEvents.length}
              nearbyEventIds={nearbyEventIds}
              liveTimingEventIds={liveTimingEventIds}
            />
            {completedEvents.length > PAST_PAGE_SIZE ? (
              <div className="flex flex-col gap-3 border-t border-racing-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  Mostrando {(pastPage - 1) * PAST_PAGE_SIZE + 1}–{Math.min(pastPage * PAST_PAGE_SIZE, completedEvents.length)} de {completedEvents.length} fechas disputadas
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPastPage(current => Math.max(1, current - 1))}
                    disabled={pastPage === 1}
                    className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Anterior
                  </button>
                  <span className="min-w-24 text-center font-racing text-sm text-white">
                    Página {pastPage} de {pastPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPastPage(current => Math.min(pastPageCount, current + 1))}
                    disabled={pastPage === pastPageCount}
                    className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card-glass p-16 text-center">
            <CalendarIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">Sin fechas</h3>
            <p className="text-gray-500 text-sm">No hay fechas que coincidan con el filtro seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
