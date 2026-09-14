import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarIcon, ClockIcon, FlagIcon, MapPinIcon, PlayCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { eventsApi, mediaApi, registrationFormsApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';
import ServerJoinButton from '../components/ServerJoinButton';
import { getEventPhase, getWeeklyChampionshipEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';

const shuffle = items => [...items].sort(() => Math.random() - 0.5);
const formatDate = value => value ? formatCalendarDate(value, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Por confirmar';
const formatTime = value => value ? formatCalendarDate(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
const getCountdown = (value, now) => {
  const eventDate = parseCalendarDate(value);
  if (!eventDate) return null;
  const difference = eventDate.getTime() - now;
  if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference / 3600000) % 24),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export default function Home() {
  const [events, setEvents] = useState([]);
  const [registrationForms, setRegistrationForms] = useState([]);
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(null);
  const [carouselImages, setCarouselImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showCalendar, setShowCalendar] = useState(false);

  const weeklyEvents = useMemo(() => getWeeklyChampionshipEvents(events, new Date(now)), [events, now]);
  const nextEvent = weeklyEvents.find(event => event.idcampeonato === selectedChampionshipId) || weeklyEvents[0];
  const nextRegistration = useMemo(() => registrationForms
    .filter(item => item.phase === 'open')
    .sort((a, b) => {
    const order = { open: 0, upcoming: 1, full: 2, closed: 3 };
    return (order[a.phase] ?? 4) - (order[b.phase] ?? 4)
      || (parseCalendarDate(a.fecha_apertura)?.getTime() || 0) - (parseCalendarDate(b.fecha_apertura)?.getTime() || 0);
  })[0] || null, [registrationForms]);
  const championshipEvents = useMemo(() => events
    .filter(event => String(event.idcampeonato) === String(nextEvent?.idcampeonato))
    .filter(event => (parseCalendarDate(event.fecha)?.getTime() || 0) >= now)
    .sort((a, b) => (parseCalendarDate(a.fecha)?.getTime() || 0) - (parseCalendarDate(b.fecha)?.getTime() || 0)),
  [events, nextEvent?.idcampeonato, now]);

  useEffect(() => {
    Promise.all([eventsApi.getAll(), registrationFormsApi.getAll()])
      .then(([eventsResponse, formsResponse]) => {
        setEvents(eventsResponse.data.data || []);
        setRegistrationForms(formsResponse.data.data || []);
      })
      .catch(error => console.error('Error cargando el inicio:', error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (weeklyEvents.length && !weeklyEvents.some(event => event.idcampeonato === selectedChampionshipId)) {
      setSelectedChampionshipId(weeklyEvents[0].idcampeonato);
    }
  }, [selectedChampionshipId, weeklyEvents]);

  useEffect(() => {
    if (!nextEvent?.categoria || !nextEvent?.temporada) { setCarouselImages([]); return; }
    mediaApi.getChampionshipImages({ categoria: nextEvent.categoria, temporada: nextEvent.temporada })
      .then(response => { setCarouselImages(shuffle(response.data.data || [])); setActiveImage(0); })
      .catch(() => setCarouselImages([]));
  }, [nextEvent?.categoria, nextEvent?.temporada]);

  useEffect(() => {
    if (carouselImages.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveImage(current => (current + 1) % carouselImages.length), 5500);
    return () => window.clearInterval(timer);
  }, [carouselImages.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showCalendar) return undefined;
    const close = event => { if (event.key === 'Escape') setShowCalendar(false); };
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [showCalendar]);

  const heroBackground = nextEvent?.circuito_foto_url || carouselImages[activeImage] || '';
  const location = nextEvent ? [nextEvent.localidad, nextEvent.provincia, getCountryName(nextEvent.pais)].filter(Boolean).join(', ') : '';
  const countdown = getCountdown(nextEvent?.fecha, now);
  const eventPhase = getEventPhase(nextEvent, new Date(now));
  const countdownParts = countdown ? [
    { value: countdown.days, label: 'Días' },
    { value: countdown.hours, label: 'Horas' },
    { value: countdown.minutes, label: 'Minutos' },
    { value: countdown.seconds, label: 'Segundos' },
  ] : [];

  return (
    <div className="animate-fade-in">
      <section className="race-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black">
        {heroBackground ? <img key={heroBackground} src={heroBackground} alt="" className="race-hero-background absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/35" />
        <div className="race-hero-grid absolute inset-0 opacity-25" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1600px] grid-cols-1 items-center gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-10 lg:px-14 lg:py-12 xl:px-20">
          <div className="race-hero-content order-2 max-w-4xl lg:order-1">
            {weeklyEvents.length > 1 ? <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hidden">{weeklyEvents.map(event => <button key={event.idcampeonato} type="button" onClick={() => setSelectedChampionshipId(event.idcampeonato)} className={`shrink-0 border px-3 py-1.5 font-racing text-[11px] font-bold uppercase transition-colors ${nextEvent?.idcampeonato === event.idcampeonato ? 'border-racing-red bg-racing-red text-white' : 'border-white/25 bg-black/60 text-gray-300 hover:border-racing-red'}`}>{event.categoria} · T{event.temporada}</button>)}</div> : null}
            <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-racing-red bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-racing-red" />Próxima fecha</div>

            {nextEvent ? <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm"><span className="bg-racing-red px-3 py-1.5 text-white">{nextEvent.categoria}</span><span className="border border-white/25 bg-black/45 px-3 py-1.5">Temporada {nextEvent.temporada}</span><span className="border border-white/25 bg-black/45 px-3 py-1.5">Ronda {nextEvent.ronda}</span></div>
              <h1 className="font-racing text-5xl font-bold uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">{nextEvent.circuito}</h1>
              {nextEvent.variante ? <p className="mt-2 font-racing text-2xl font-semibold uppercase text-racing-red sm:text-3xl">Variante {nextEvent.variante}</p> : null}
              <div className="mt-6 flex flex-col gap-3 text-gray-100 sm:flex-row sm:flex-wrap sm:gap-6"><p className="flex items-center gap-2 text-sm font-medium capitalize sm:text-base"><CalendarIcon className="h-5 w-5 text-racing-red"/>{formatDate(nextEvent.fecha)}</p><p className="flex items-center gap-2 text-sm font-medium sm:text-base"><ClockIcon className="h-5 w-5 text-racing-red"/>{formatTime(nextEvent.fecha)} H</p>{location ? <p className="flex items-center gap-2 text-sm text-gray-300 sm:text-base"><CountryFlag country={nextEvent.pais} className="text-lg"/><MapPinIcon className="h-5 w-5 text-racing-red"/>{location}</p> : null}</div>
              <div className="mt-8 max-w-3xl"><p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">{eventPhase === 'active' ? 'La actividad ya comenzó' : 'Faltan para el inicio'}</p>{eventPhase === 'active' ? <div className="inline-flex items-center gap-3 border border-racing-red/60 bg-racing-red/15 px-5 py-4 font-racing text-2xl font-bold uppercase text-white"><FlagIcon className="h-7 w-7 text-racing-red"/>Actividad en curso</div> : <div className="grid grid-cols-4 gap-2 sm:gap-3">{countdownParts.map(part => <div key={part.label} className="countdown-block border border-white/20 bg-black/55 px-2 py-3 text-center backdrop-blur-md sm:px-4 sm:py-4"><span className="block font-racing text-3xl font-bold tabular-nums text-white sm:text-5xl">{String(part.value).padStart(2, '0')}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-xs">{part.label}</span></div>)}</div>}</div>
              <div className="mt-7 flex flex-wrap gap-3"><ServerJoinButton href={nextEvent.servidor}/>{nextEvent.transmision ? <a href={nextEvent.transmision} target="_blank" rel="noreferrer" className="server-action-button server-action-red inline-flex items-center gap-3 border border-red-400 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-racing transition-transform hover:-translate-y-0.5 active:scale-95"><PlayCircleIcon className="h-5 w-7"/>Ver transmisión</a> : null}<button type="button" onClick={() => setShowCalendar(true)} className="server-action-button server-action-dark inline-flex items-center gap-3 border border-gray-600 bg-black px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:border-gray-400 active:scale-95"><CalendarIcon className="h-5 w-7"/>Ver calendario</button></div>
            </> : <><h1 className="font-racing text-5xl font-bold uppercase text-white sm:text-7xl">No hay próximas fechas aún</h1><p className="mt-5 max-w-xl text-lg text-gray-300">Cuando se cargue una fecha aparecerá automáticamente acá.</p></>}
          </div>

          <div className="order-1 flex min-h-[220px] items-center justify-center lg:order-2 lg:min-h-[520px]">{nextEvent?.circuito_trazado_url ? <img src={nextEvent.circuito_trazado_url} alt={`Trazado de ${nextEvent.circuito}`} className="race-track-float max-h-[32vh] w-full max-w-[620px] object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.9)] lg:max-h-[62vh]" onError={event => { event.currentTarget.style.display = 'none'; }}/> : <FlagIcon className="h-28 w-28 text-white/15"/>}</div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-racing-red to-transparent" />
      </section>

      {!loading && nextRegistration ? <section className="border-t border-racing-border bg-racing-gray px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Inscripciones</p>
          <h2 className="section-title mt-2">Próximo <span className="gradient-text">campeonato</span></h2>
          <article className="card-glass mt-10 overflow-hidden"><div className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10"><div><div className="flex flex-wrap items-center gap-3"><span className="bg-racing-red px-3 py-1 text-xs font-bold uppercase text-white">Inscripciones abiertas</span><span className="text-sm text-gray-400">{nextRegistration.plataforma}</span></div><h3 className="mt-4 font-racing text-4xl font-bold uppercase text-white md:text-5xl">{nextRegistration.categoria}</h3><p className="mt-2 text-xl text-gray-300">Temporada {nextRegistration.temporada} · {nextRegistration.anio}</p><p className="mt-4 max-w-2xl text-sm text-gray-400">Setup: {nextRegistration.setup_detalle}</p><div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-400"><span>{nextRegistration.cantidad_fechas} fechas</span><span>{nextRegistration.cupos_ocupados}/{nextRegistration.limite_inscriptos} cupos ocupados</span><span>{nextRegistration.lugares_disponibles} disponibles</span></div></div><div className="md:text-right"><p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Desde</p><p className="mt-1 font-racing text-3xl font-bold text-yellow-300">$ {Number(nextRegistration.precio || 0).toLocaleString('es-AR')}</p><Link to={`/inscripcion?campeonato=${nextRegistration.idcampeonato}`} className="cta-attention btn-primary mt-5 justify-center">Ir a inscribirme <ArrowRightIcon className="h-4 w-4"/></Link></div></div></article>
        </div>
      </section> : null}

      {showCalendar ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setShowCalendar(false); }} role="presentation"><section className="max-h-[85vh] w-full max-w-3xl overflow-hidden border border-racing-border bg-racing-gray shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="calendar-title"><header className="flex items-start justify-between gap-4 border-b border-racing-border p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">{nextEvent?.categoria} · Temporada {nextEvent?.temporada}</p><h2 id="calendar-title" className="mt-1 font-racing text-3xl font-bold">Próximas fechas</h2></div><button type="button" onClick={() => setShowCalendar(false)} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-400 transition hover:border-racing-red hover:text-white" aria-label="Cerrar calendario"><XMarkIcon className="h-5 w-5"/></button></header><div className="max-h-[65vh] space-y-3 overflow-y-auto p-5 sm:p-6">{championshipEvents.length ? championshipEvents.map(event => <article key={`${event.idcampeonato}-${event.ronda}`} className="grid gap-4 border border-racing-border bg-racing-dark p-4 sm:grid-cols-[60px_1fr_auto] sm:items-center"><div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-500">Ronda</p><p className="font-racing text-3xl font-bold text-racing-red">{event.ronda}</p></div><div><h3 className="font-racing text-xl font-bold text-white">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400"><p className="flex items-center gap-2 capitalize"><CalendarIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p><p className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p></div><p className="mt-2 text-xs text-gray-500">{[event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ')}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{event.especial ? <span className="border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-xs font-bold uppercase text-yellow-300">{event.especialidad || 'Especial'}</span> : null}{event.coronacion ? <span className="border border-racing-red/30 bg-racing-red/10 px-2 py-1 text-xs font-bold uppercase text-racing-red">Coronación</span> : null}</div></article>) : <div className="py-12 text-center text-gray-500"><CalendarIcon className="mx-auto h-12 w-12 opacity-30"/><p className="mt-3">No quedan fechas futuras cargadas para este campeonato.</p></div>}</div></section></div> : null}
    </div>
  );
}
