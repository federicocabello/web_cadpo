import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FlagIcon,
  MapPinIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { driversApi, eventsApi, liveTimingApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import ServerJoinButton from '../components/ServerJoinButton';
import { getLiveTimingEvents } from '../utils/weeklyChampionships';

const REFRESH_INTERVAL_MS = 10000;
const REQUIRED_LAPS = 25;
const driverNameKey = value => String(value || '').trim().toLocaleLowerCase('es-AR');

const formatLapTime = nanoseconds => {
  if (!nanoseconds) return '--:--.---';
  const milliseconds = Math.round(nanoseconds / 1000000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const formatSectorTime = nanoseconds => {
  if (!nanoseconds) return '--.---';
  const milliseconds = Math.round(nanoseconds / 1000000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  const time = `${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  return minutes ? `${minutes}:${time}` : time;
};

const sessionLabel = value => {
  const session = String(value || '').trim();
  if (/pr[aá]ctica|practice/i.test(session)) return 'Práctica';
  if (/clasificaci[oó]n|qualifying|qualification|qualy/i.test(session)) return 'Clasificación';
  if (/carrera|race/i.test(session)) return 'Carrera';
  return session || 'Sin sesión activa';
};

const isQualifyingSession = value => /clasificaci[oó]n|qualifying|qualification|qualy/i.test(String(value || ''));
const isRaceSession = value => /carrera|race/i.test(String(value || ''));

const parseDate = value => new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);

const formatEventDate = value => parseDate(value).toLocaleString('es-AR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatCountdown = (value, now) => {
  if (!value) return '--:--:--';
  const difference = parseDate(value).getTime() - now;
  if (difference <= 0) return '00:00:00';

  const hours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference / 60000) % 60);
  const seconds = Math.floor((difference / 1000) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatSessionRemaining = (timing, now) => {
  if (!timing?.time) return '--:--:--';
  const fetchedAt = new Date(timing.updatedAt).getTime();
  const elapsedSinceFetch = Number.isNaN(fetchedAt) ? 0 : Math.max(0, now - fetchedAt);
  const remaining = Math.max(0, (timing.time * 60000) - timing.elapsedMilliseconds - elapsedSinceFetch);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining / 60000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatGap = (lap, leaderLap) => {
  if (!lap || !leaderLap) return '--';
  if (lap === leaderLap) return '';

  const milliseconds = Math.round((lap - leaderLap) / 1000000);
  return `+${(milliseconds / 1000).toFixed(3)}`;
};

export default function LiveTiming() {
  const [timing, setTiming] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(null);
  const [driverCountries, setDriverCountries] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const previousPositionsRef = useRef(new Map());
  const previousSessionRef = useRef('');
  const hasRenderedRowsRef = useRef(false);
  const weeklyEvents = useMemo(() => getLiveTimingEvents(calendarEvents, new Date(now)), [calendarEvents, now]);
  const raceEvent = weeklyEvents.find(event => event.idcampeonato === selectedChampionshipId) || weeklyEvents[0] || null;

  const loadTiming = useCallback(async (manual = false) => {
    if (!selectedChampionshipId) return;
    if (manual) setRefreshing(true);

    try {
      const response = await liveTimingApi.get(selectedChampionshipId);
      setTiming(response.data.data);
      setStale(Boolean(response.data.stale));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el servidor de tiempos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChampionshipId]);

  useEffect(() => {
    if (!selectedChampionshipId) return undefined;
    setTiming(null);
    setLoading(true);
    setError('');
    setStale(false);
    previousPositionsRef.current = new Map();
    previousSessionRef.current = '';
    hasRenderedRowsRef.current = false;
    loadTiming();
    const interval = window.setInterval(loadTiming, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadTiming, selectedChampionshipId]);

  useEffect(() => {
    const loadCalendarEvent = async () => {
      try {
        const response = await eventsApi.getAll();
        const loadedEvents = response.data.data || [];
        const activeEvents = getLiveTimingEvents(loadedEvents);
        setCalendarEvents(loadedEvents);
        setSelectedChampionshipId(current => current || activeEvents[0]?.idcampeonato || null);
        } catch (err) {
          console.error('No se pudo cargar la fecha del calendario:', err);
          setError('No se pudo consultar el calendario.');
          setLoading(false);
        } finally {
          setCalendarLoaded(true);
        }
    };

    loadCalendarEvent();
  }, []);

  useEffect(() => {
    if (weeklyEvents.length) {
      if (!weeklyEvents.some(event => event.idcampeonato === selectedChampionshipId)) {
        setSelectedChampionshipId(weeklyEvents[0].idcampeonato);
      }
      return;
    }

    if (calendarLoaded) {
      setSelectedChampionshipId(null);
      setTiming(null);
      setLoading(false);
    }
  }, [calendarLoaded, selectedChampionshipId, weeklyEvents]);

  useEffect(() => {
    const loadDriverCountries = async () => {
      try {
        const response = await driversApi.getAll();
        const countryMap = new Map();
        for (const driver of response.data.data || []) {
          if (driver.steam) countryMap.set(String(driver.steam).trim(), driver.nacionalidad);
          countryMap.set(driverNameKey(driver.nombre), driver.nacionalidad);
        }
        setDriverCountries(countryMap);
      } catch (err) {
        console.error('No se pudieron cargar las nacionalidades de los pilotos:', err);
      }
    };

    loadDriverCountries();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const drivers = useMemo(() => {
    const byDriver = new Map();

    for (const driver of timing?.stored || []) {
      byDriver.set(`${driver.guid}-${driver.carModel}`, driver);
    }

    for (const driver of timing?.connected || []) {
      const key = `${driver.guid}-${driver.carModel}`;
      const stored = byDriver.get(key);
      byDriver.set(key, {
        ...stored,
        ...driver,
        bestLap: driver.bestLap || stored?.bestLap || 0,
        lastLap: driver.lastLap || stored?.lastLap || 0,
        laps: Math.max(driver.laps || 0, stored?.laps || 0),
        topSpeed: Math.max(driver.topSpeed || 0, stored?.topSpeed || 0),
        bestSectors: driver.bestSectors?.length ? driver.bestSectors : stored?.bestSectors || [],
        connected: true,
      });
    }

    return [...byDriver.values()].sort((a, b) => {
      if (!a.bestLap) return 1;
      if (!b.bestLap) return -1;
      return a.bestLap - b.bestLap;
    });
  }, [timing]);

  const bestLap = useMemo(
    () => drivers.reduce((best, driver) => driver.bestLap && (!best || driver.bestLap < best) ? driver.bestLap : best, 0),
    [drivers],
  );
  const fastestSectors = useMemo(() => drivers.reduce((fastest, driver) => {
    for (const sector of driver.bestSectors || []) {
      if (sector.time && (!fastest[sector.index] || sector.time < fastest[sector.index])) {
        fastest[sector.index] = sector.time;
      }
    }
    return fastest;
  }, []), [drivers]);
  const positionChanges = useMemo(() => {
    const changes = new Map();
    if (!isQualifyingSession(timing?.session) || !isQualifyingSession(previousSessionRef.current)) {
      return changes;
    }

    drivers.forEach((driver, index) => {
      const key = `${driver.guid}-${driver.carModel}`;
      const previousPosition = previousPositionsRef.current.get(key);
      if (previousPosition !== undefined && previousPosition !== index) {
        changes.set(key, previousPosition - index);
      }
    });
    return changes;
  }, [drivers, timing?.session]);

  useEffect(() => {
    previousPositionsRef.current = new Map(
      drivers.map((driver, index) => [`${driver.guid}-${driver.carModel}`, index]),
    );
    previousSessionRef.current = timing?.session || '';
    if (drivers.length) hasRenderedRowsRef.current = true;
  }, [drivers, timing?.session]);

  const serviceUnavailable = !loading && (Boolean(error) || stale);
  const noAvailableDates = calendarLoaded && !raceEvent && !error;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-racing-dark pb-8">
      <header className="relative min-h-[190px] shrink-0 overflow-hidden border-b border-racing-border bg-black px-4 py-4 sm:px-6 lg:px-8">
        {raceEvent?.circuito_foto_url && (
          <img src={raceEvent.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/25" />

        <div className="relative z-10 mx-auto grid max-w-[1600px] items-center gap-5 lg:grid-cols-[1fr_420px]">
          <div className="max-w-4xl">
            {weeklyEvents.length > 1 && (
              <div className="mb-3 flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                {weeklyEvents.map(event => (
                  <button
                    key={event.idcampeonato}
                    type="button"
                    onClick={() => setSelectedChampionshipId(event.idcampeonato)}
                    className={`shrink-0 border px-3 py-1.5 font-racing text-[11px] font-bold uppercase transition-colors ${raceEvent?.idcampeonato === event.idcampeonato ? 'border-racing-red bg-racing-red text-white' : 'border-white/25 bg-black/60 text-gray-300 hover:border-racing-red'}`}
                  >
                    {event.categoria} · T{event.temporada}
                  </button>
                ))}
              </div>
            )}
            <div className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] ${noAvailableDates ? 'text-gray-500' : 'text-green-400'}`}>
              <SignalIcon className="h-4 w-4" /> {noAvailableDates ? 'Sin fechas disponibles' : 'Servidor funcionando'}
            </div>
            <h1 className="mt-3 font-racing text-3xl font-bold uppercase text-white sm:text-5xl">
              {raceEvent?.circuito || 'No hay próximas fechas aún'}
            </h1>
            {raceEvent?.variante && <p className="font-racing text-xl font-semibold uppercase text-racing-red">Variante {raceEvent.variante}</p>}

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300">
              {raceEvent && (
                <>
                  <span className="font-bold uppercase text-white">{raceEvent.categoria} · Fecha {raceEvent.ronda}</span>
                  <span className="flex items-center gap-1.5 capitalize"><CalendarDaysIcon className="h-4 w-4 text-racing-red" /> {formatEventDate(raceEvent.fecha)} H</span>
                  <span className="flex items-center gap-2"><CountryFlag country={raceEvent.pais} className="text-lg" /><MapPinIcon className="h-4 w-4 text-racing-red" /> {[raceEvent.localidad, raceEvent.provincia].filter(Boolean).join(', ')}</span>
                </>
              )}
            </div>

            {raceEvent && <div className="mt-5 flex flex-wrap items-center gap-2">
              <ServerJoinButton href={raceEvent?.servidor} className="h-9 px-3 py-0 text-xs" />
              <span className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold uppercase ${error ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-green-500/40 bg-green-500/10 text-green-300'}`}>
                <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-400' : 'animate-pulse bg-green-400'}`} />
                {error ? 'Sin conexión' : stale ? 'Datos guardados' : 'En línea'}
              </span>
              <button
                type="button"
                onClick={() => loadTiming(true)}
                disabled={refreshing}
                className="inline-flex h-9 items-center gap-2 border border-racing-border bg-black/70 px-3 font-racing text-xs font-bold uppercase text-gray-200 transition-colors hover:border-racing-red hover:text-racing-red disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
              </button>
            </div>}
          </div>

          <div className="hidden h-[160px] items-center justify-center lg:flex">
            {raceEvent?.circuito_trazado_url && (
              <img src={raceEvent.circuito_trazado_url} alt={`Trazado de ${raceEvent.circuito}`} className="h-full w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)]" />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 lg:px-8">
        {serviceUnavailable && (
          <section className="flex min-h-[500px] items-center justify-center border border-racing-border bg-black px-6 py-16 text-center">
            <div>
              <div className="relative mx-auto mb-7 flex h-40 w-40 items-center justify-center sm:h-52 sm:w-52">
                <div className="absolute inset-0 animate-pulse bg-racing-red/10 blur-3xl" />
                <img src="/logo.png" alt="CADPO" className="relative h-full w-full object-contain opacity-75 grayscale" />
              </div>
              <ExclamationTriangleIcon className="mx-auto mb-4 h-8 w-8 text-yellow-400" />
              <h2 className="font-racing text-3xl font-bold uppercase text-white sm:text-5xl">Servidor en mantenimiento</h2>
              <p className="mt-2 font-racing text-xl font-semibold uppercase tracking-wider text-racing-red sm:text-2xl">No disponible momentáneamente</p>
              <button type="button" onClick={() => loadTiming(true)} className="btn-secondary mt-7">
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Reintentar conexión
              </button>
            </div>
          </section>
        )}

        {noAvailableDates && (
          <section className="flex min-h-[360px] items-center justify-center border border-racing-border bg-black px-6 py-14 text-center">
            <div>
              <CalendarDaysIcon className="mx-auto mb-4 h-12 w-12 text-gray-700" />
              <h2 className="font-racing text-3xl font-bold uppercase text-white sm:text-4xl">No hay próximas fechas aún</h2>
              <p className="mx-auto mt-2 max-w-lg text-gray-500">Los tiempos en vivo estarán disponibles cuando exista una nueva fecha cargada en el calendario.</p>
            </div>
          </section>
        )}

        {!serviceUnavailable && !noAvailableDates && isRaceSession(timing?.session) && (
          <section className="race-session-panel relative flex min-h-[520px] items-center justify-center overflow-hidden border border-racing-border bg-black px-6 py-16 text-center">
            <div className="race-session-checker absolute inset-0 opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.88)_72%)]" />
            <div className="relative z-10">
              <div className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full border border-racing-red/40" />
                <FlagIcon className="race-session-flag h-20 w-20 text-white" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-racing-red">Sesión en curso</p>
              <h2 className="mt-3 font-racing text-4xl font-bold uppercase text-white sm:text-6xl">Están en carrera</h2>
              <p className="mx-auto mt-3 max-w-xl font-racing text-lg uppercase text-gray-400">Los tiempos en vivo volverán a mostrarse cuando finalice la tanda de carrera.</p>
            </div>
          </section>
        )}

        {!serviceUnavailable && !noAvailableDates && !isRaceSession(timing?.session) && <>
          <section className="mb-3 grid grid-cols-2 gap-px overflow-hidden border border-racing-border bg-racing-border sm:grid-cols-3">
            <div className="relative isolate overflow-hidden bg-racing-card p-3">
              {isQualifyingSession(timing?.session) ? (
                <div className="classification-checker absolute inset-y-0 right-0 -z-10 w-2/3 opacity-20" />
              ) : (
                <div className="session-country-flag absolute inset-y-0 right-0 -z-10 w-1/3 opacity-35">
                  <CountryFlag country={raceEvent?.pais} />
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sesión</p>
              <p className="mt-1 truncate font-racing text-xl font-bold uppercase text-white">{sessionLabel(timing?.session)}</p>
            </div>
            <div className="bg-racing-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pilotos en pista</p>
              <p className="mt-1 font-racing text-2xl font-bold text-white">{timing?.connected?.length ?? 0}</p>
            </div>
            <div className="relative isolate col-span-2 overflow-hidden bg-racing-card p-3 sm:col-span-1">
              <div className="classification-checker absolute inset-y-0 right-0 -z-10 w-2/3 opacity-30" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isQualifyingSession(timing?.session) ? 'Tiempo de clasificación' : 'Inicio de la clasificación'}</p>
              <p className="mt-1 font-racing text-2xl font-bold tabular-nums text-orange-400">
                {isQualifyingSession(timing?.session) ? formatSessionRemaining(timing, now) : formatCountdown(raceEvent?.fecha, now)}
              </p>
            </div>
          </section>

          <section className="overflow-hidden border border-racing-border bg-racing-card">
            <div className="divide-y divide-racing-border md:hidden">
              {drivers.map((driver, index) => {
                const driverKey = `${driver.guid}-${driver.carModel}`;
                const positionChange = positionChanges.get(driverKey) || 0;
                const animationClass = positionChange > 0
                  ? 'timing-driver-row-moved-up'
                  : positionChange < 0
                    ? 'timing-driver-row-moved-down'
                  : !hasRenderedRowsRef.current ? 'timing-driver-row-enter' : '';

                return (
                  <article
                    key={`mobile-${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}
                    className={`timing-driver-row relative p-3 ${animationClass} ${driver.laps >= REQUIRED_LAPS ? 'timing-driver-row-enabled' : 'timing-driver-row-pending'}`}
                    style={{ '--row-shift': `${positionChange * 88}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-0.5 bg-black px-1 font-racing text-xl font-bold text-white">
                        {index + 1}
                        {positionChange > 0 ? <ArrowUpIcon className="timing-position-arrow h-3.5 w-3.5 text-green-400" /> : null}
                        {positionChange < 0 ? <ArrowDownIcon className="timing-position-arrow h-3.5 w-3.5 text-red-400" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CountryFlag country={driverCountries.get(driver.guid) || driverCountries.get(driverNameKey(driver.name))} className="text-lg" />
                          <h3 className="truncate font-semibold text-white">{driver.name}</h3>
                          {driver.connected && (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-green-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                              </span>
                              Online
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{driver.car}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/5 pt-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Mejor vuelta</p>
                        <p className={`font-racing text-xl font-bold tabular-nums ${driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Diferencia</p>
                        <p className="font-racing text-xl font-bold tabular-nums text-racing-red">{formatGap(driver.bestLap, bestLap) || 'LÍDER'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Vueltas</p>
                        <p className="font-racing text-lg font-bold text-gray-200">{driver.laps}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Velocidad máxima</p>
                        <p className="font-racing text-lg font-bold text-gray-200">{driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '--'}</p>
                      </div>
                    </div>

                    {driver.bestSectors?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-3 font-racing text-[11px] font-semibold tabular-nums">
                        {driver.bestSectors.map(sector => (
                          <span key={sector.index} className={sector.time === fastestSectors[sector.index] ? 'text-[#c77dff]' : 'text-gray-500'}>
                            S{sector.index + 1} {formatSectorTime(sector.time)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3">
                      {driver.laps >= REQUIRED_LAPS ? (
                        <span className="inline-flex bg-green-500/15 px-3 py-1 text-xs font-bold uppercase text-green-400">Habilitado</span>
                      ) : (
                        <span className="inline-flex bg-yellow-500/15 px-3 py-1 text-xs font-bold uppercase text-yellow-300">Debe cumplir · faltan {REQUIRED_LAPS - driver.laps}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="scrollbar-hidden hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] border-collapse text-left text-base">
                <thead className="bg-black text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="w-16 px-4 py-3 text-center">Pos.</th>
                    <th className="px-4 py-3">Piloto</th>
                    <th className="px-4 py-3">Auto</th>
                    <th className="px-4 py-3 text-right">Mejor vuelta</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-center">Vueltas</th>
                    <th className="px-4 py-3 text-right">Vel. máx.</th>
                    <th className="px-4 py-3 text-center">Habilitación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {drivers.map((driver, index) => {
                    const driverKey = `${driver.guid}-${driver.carModel}`;
                    const positionChange = positionChanges.get(driverKey) || 0;
                    const animationClass = positionChange > 0
                      ? 'timing-driver-row-moved-up'
                      : positionChange < 0
                        ? 'timing-driver-row-moved-down'
                      : !hasRenderedRowsRef.current ? 'timing-driver-row-enter' : '';

                    return (
                      <tr
                        key={`${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}
                        className={`timing-driver-row ${animationClass} ${driver.laps >= REQUIRED_LAPS ? 'timing-driver-row-enabled' : 'timing-driver-row-pending'}`}
                        style={{ '--row-shift': `${positionChange * 54}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                      >
                        <td className="px-4 py-3 text-center font-racing text-xl font-bold text-white">
                          <span className="inline-flex items-center justify-center gap-1">
                            {index + 1}
                            {positionChange > 0 ? <ArrowUpIcon className="timing-position-arrow h-4 w-4 text-green-400" /> : null}
                            {positionChange < 0 ? <ArrowDownIcon className="timing-position-arrow h-4 w-4 text-red-400" /> : null}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-black font-racing text-sm font-bold text-racing-red">{driver.initials || driver.name.slice(0, 3).toUpperCase()}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <CountryFlag country={driverCountries.get(driver.guid) || driverCountries.get(driverNameKey(driver.name))} className="text-lg" />
                                <p className="font-semibold text-white">{driver.name}</p>
                                {driver.connected && (
                                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-green-400">
                                    <span className="relative flex h-2 w-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                                    </span>
                                    Online
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{driver.team || (driver.raceNumber ? `#${driver.raceNumber}` : '')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[280px] px-4 py-3 text-sm text-gray-300"><span className="block truncate">{driver.car}</span></td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-racing text-lg font-bold tabular-nums ${driver.bestLap && driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</p>
                          {driver.bestSectors?.length > 0 && (
                            <div className="mt-1 flex justify-end gap-2 font-racing text-[10px] font-semibold tabular-nums">
                              {driver.bestSectors.map(sector => (
                                <span key={sector.index} className={sector.time === fastestSectors[sector.index] ? 'text-[#c77dff]' : 'text-gray-500'}>
                                  S{sector.index + 1} {formatSectorTime(sector.time)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-racing text-lg font-bold tabular-nums text-racing-red">{formatGap(driver.bestLap, bestLap)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{driver.laps}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '--'}</td>
                        <td className="px-4 py-3 text-center">
                          {driver.laps >= REQUIRED_LAPS ? (
                            <span className="inline-flex bg-green-500/15 px-3 py-1 text-sm font-bold uppercase text-green-400">Habilitado</span>
                          ) : (
                            <span className="inline-flex bg-yellow-500/15 px-3 py-1 text-sm font-bold uppercase text-yellow-300">Debe cumplir · faltan {REQUIRED_LAPS - driver.laps}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && drivers.length === 0 && (
              <div className="px-6 py-16 text-center">
                <SignalIcon className="mx-auto mb-3 h-10 w-10 text-gray-700" />
                <p className="font-racing text-lg font-bold uppercase text-gray-400">No hay tiempos registrados</p>
              </div>
            )}

            {loading && (
              <div className="px-6 py-16 text-center">
                <ArrowPathIcon className="mx-auto mb-3 h-8 w-8 animate-spin text-racing-red" />
                <p className="text-sm text-gray-400">Conectando con el servidor...</p>
              </div>
            )}
          </section>
        </>}
      </div>
    </main>
  );
}
