import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowRightIcon, BuildingOffice2Icon, CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DocumentTextIcon, FlagIcon, GlobeAltIcon, MapIcon, MapPinIcon, MegaphoneIcon, PaintBrushIcon, PhoneIcon, PlayCircleIcon, UserGroupIcon, VideoCameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { complaintsApi, eventsApi, mediaApi, registrationFormsApi, sponsorsApi, templatesApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';
import ServerJoinButton from '../components/ServerJoinButton';
import { getEventPhase, getFeaturedUpcomingEvents, getLiveTimingEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';
import { formatPrice } from '../utils/currency';
import { formatComplaintCountdown } from '../utils/complaintCountdown';

const shuffle = items => [...items].sort(() => Math.random() - 0.5);
const formatDate = value => value ? formatCalendarDate(value, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Por confirmar';
const formatTime = value => value ? formatCalendarDate(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

const getDaysAgoLabel = (value, now) => {
  const date = parseCalendarDate(value);
  if (!date) return '';
  const today = new Date(now);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.max(0, Math.round((todayUtc - dateUtc) / 86400000));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
};

const getYouTubeVideoId = value => {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else id = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/)?.[1] || '';
    }
    return /^[\w-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
};

const getRegistrationPhase = (form, now) => {
  if ((parseCalendarDate(form.fecha_apertura)?.getTime() || 0) > now) return 'upcoming';
  if ((parseCalendarDate(form.fecha_cierre)?.getTime() || 0) <= now) return 'closed';
  const occupiedPlaces = Number(form.cupos_ocupados ?? (Number(form.inscriptos_actuales || 0) + Number(form.preinscriptos || 0)));
  return occupiedPlaces >= Number(form.limite_inscriptos) ? 'full' : 'open';
};

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

const formatCountdownHoursMinutes = countdown => [
  countdown.hours > 0 ? `${countdown.hours} HORAS` : '',
  `${String(countdown.minutes).padStart(2, '0')} min`,
].filter(Boolean).join(' ');

const formatRegistrationOpening = (value, now) => {
  const openingDate = parseCalendarDate(value);
  if (!openingDate) return 'Inscripciones próximamente';

  const currentDate = new Date(now);
  const currentDay = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const openingDay = Date.UTC(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());
  const calendarDays = Math.round((openingDay - currentDay) / 86400000);

  if (calendarDays > 1) return `Inscripciones abren en ${calendarDays} días`;
  if (calendarDays === 1) return 'Inscripciones abren mañana';

  const countdown = getCountdown(value, now);
  if (!countdown) return 'Inscripciones próximamente';
  return `Inscripciones abren en ${formatCountdownHoursMinutes(countdown)}`;
};

const formatRegistrationClosing = (value, now) => {
  const closingDate = parseCalendarDate(value);
  if (!closingDate) return null;

  const currentDate = new Date(now);
  const currentDay = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const closingDay = Date.UTC(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());
  const calendarDays = Math.round((closingDay - currentDay) / 86400000);

  if (calendarDays > 1) return { label: 'Inscripciones cierran en', value: `${calendarDays} días` };
  if (calendarDays === 1) return { label: 'Inscripciones cierran', value: 'mañana' };

  const countdown = getCountdown(value, now);
  if (!countdown) return null;
  return { label: 'Inscripciones cierran en', value: formatCountdownHoursMinutes(countdown) };
};

const registrationThemes = {
  open: {
    border: 'border-green-400', borderSoft: 'border-green-400/45', chip: 'bg-green-600 text-white',
    dot: 'bg-green-400', text: 'text-green-300', textSoft: 'text-green-200',
    button: 'server-action-green border-green-300 bg-green-600 text-white shadow-[0_0_32px_rgba(22,163,74,0.5)] hover:bg-green-500',
    divider: 'via-green-400',
  },
  upcoming: {
    border: 'border-yellow-400', borderSoft: 'border-yellow-400/35', chip: 'bg-yellow-400 text-black',
    dot: 'bg-yellow-400', text: 'text-yellow-300', textSoft: 'text-yellow-200',
    button: 'server-action-yellow border-yellow-300 bg-yellow-400 text-black shadow-[0_0_25px_rgba(250,204,21,0.25)] hover:bg-yellow-300',
    divider: 'via-yellow-400',
  },
  closed: {
    border: 'border-red-400', borderSoft: 'border-red-400/35', chip: 'bg-red-600 text-white',
    dot: 'bg-red-400', text: 'text-red-300', textSoft: 'text-red-200',
    button: 'server-action-red border-red-400 bg-red-700 text-white shadow-[0_0_25px_rgba(220,38,38,0.22)] hover:bg-red-600',
    divider: 'via-red-500',
  },
};

function RegistrationPrompt({ registration, mobile = false }) {
  if (!registration) return null;
  return (
    <button type="button" onClick={() => document.getElementById(`inscripciones-campeonato-${registration.idcampeonato}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={`group z-30 flex items-stretch overflow-hidden border border-emerald-400/45 bg-black/85 text-left shadow-[0_14px_35px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-black/95 ${mobile ? 'mt-3 w-full sm:hidden' : 'absolute bottom-7 right-8 hidden sm:flex lg:right-12'}`} aria-label="Ir al campeonato con inscripciones abiertas">
      <span className="w-1.5 shrink-0 bg-emerald-500 transition-all duration-300 group-hover:w-2.5"/>
      <span className="px-4 py-3"><span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Inscripciones abiertas</span><span className="block font-racing text-sm font-bold uppercase text-white sm:text-base">Nuevo campeonato</span></span>
      <span className="flex w-11 items-center justify-center border-l border-emerald-400/20 bg-emerald-500/15 transition-colors group-hover:bg-emerald-500"><ChevronDownIcon className="h-5 w-5 animate-bounce text-emerald-300 group-hover:text-white"/></span>
    </button>
  );
}

function ComplaintPrompt({ event, now }) {
  const countdown = formatComplaintCountdown(event?.cierre_denuncias, now);
  if (!event || !countdown) return null;
  return <Link to="/denuncias" className="group z-30 flex w-full overflow-hidden border border-orange-400/55 bg-black/90 text-left shadow-[0_16px_45px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 md:w-[22rem]" aria-label="Abrir formulario de denuncias">
    <span className="w-1.5 shrink-0 bg-orange-500 transition-all duration-300 group-hover:w-2.5" />
    <span className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3"><span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-orange-300">Formulario de denuncias habilitado</span><span className="mt-1 block truncate text-[10px] font-semibold uppercase text-gray-400">{event.categoria} · Fecha {event.ronda}</span></span><span className="shrink-0 text-right"><span className="block text-[8px] font-bold uppercase tracking-widest text-gray-500">Cierra en</span><strong className="mt-0.5 block font-racing text-sm font-bold uppercase text-white">{countdown}</strong></span><ArrowRightIcon className="h-5 w-5 shrink-0 text-orange-300 transition-transform group-hover:translate-x-1" /></span>
  </Link>;
}

function RulesModal({ event, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = keyboardEvent => {
      if (keyboardEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/90 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`rules-title-${event.idcampeonato}`}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar reglamento"/>
      <section className="relative z-10 flex h-[96dvh] w-full flex-col overflow-hidden border border-racing-red/45 bg-racing-dark shadow-[0_25px_90px_rgba(0,0,0,0.9)] sm:h-[92dvh] sm:max-w-6xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-racing-border bg-black/75 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-racing-red sm:text-[10px]">Reglamento del campeonato</p>
            <h2 id={`rules-title-${event.idcampeonato}`} className="truncate font-racing text-lg font-bold uppercase text-white sm:text-2xl">{event.categoria} · Temporada {event.temporada}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={event.reglamento} target="_blank" rel="noreferrer" className="hidden border border-gray-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:border-white hover:text-white sm:inline-flex">Abrir aparte</a>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-300 transition-colors hover:border-racing-red hover:bg-racing-red hover:text-white" aria-label="Cerrar reglamento"><XMarkIcon className="h-5 w-5"/></button>
          </div>
        </header>
        <iframe src={event.reglamento} title={`Reglamento de ${event.categoria}`} className="min-h-0 w-full flex-1 bg-white"/>
        <div className="shrink-0 border-t border-racing-border bg-black px-3 py-2 text-center sm:hidden">
          <a href={event.reglamento} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-300"><DocumentTextIcon className="h-4 w-4"/>Si no podés visualizarlo, abrir PDF</a>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function EventSection({ event, now, onShowCalendar, registrationPrompt, complaintPromptEvent, showLiveTiming }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const location = [event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ');
  const countdown = getCountdown(event.fecha, now);
  const phase = getEventPhase(event, new Date(now));
  const countdownParts = countdown ? [
    { key: 'days', value: countdown.days, label: 'Días' }, { key: 'hours', value: countdown.hours, label: 'Horas' },
    { key: 'minutes', value: countdown.minutes, label: 'Minutos' }, { key: 'seconds', value: countdown.seconds, label: 'Segundos' },
  ].filter(part => !['days', 'hours'].includes(part.key) || part.value > 0) : [];

  return (
    <section className="home-race-height race-hero relative overflow-hidden bg-black">
      {event.circuito_foto_url ? <img src={event.circuito_foto_url} alt="" className="race-hero-background absolute inset-0 h-full w-full object-cover"/> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"/>
      <div className="race-hero-grid absolute inset-0 opacity-25"/>
      <div className="home-race-height relative z-10 mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:gap-12 lg:px-14 lg:py-12 xl:gap-16 xl:px-20">
        <div className="race-hero-content order-2 w-full max-w-4xl justify-self-start lg:order-1">
          <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-racing-red bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-racing-red"/>Próxima fecha</div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm"><span className="bg-racing-red px-3 py-1.5 text-white">{event.categoria}</span><span className="border border-racing-red/25 bg-black/45 px-3 py-1.5">Temporada {event.temporada}</span><span className="border border-racing-red/25 bg-black/45 px-3 py-1.5">Fecha {event.ronda}</span><button type="button" onClick={() => onShowCalendar(event)} className="event-action-button server-action-button server-action-dark inline-flex items-center gap-2 border border-gray-600 bg-black px-3 py-1.5 font-racing text-xs font-bold uppercase text-white shadow-lg transition-colors hover:border-gray-300 hover:bg-gray-900"><CalendarIcon className="h-4 w-4"/>Ver calendario</button></div>
          <h1 className="font-racing text-5xl font-bold uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">{event.circuito}</h1>
          {event.variante ? <p className="mt-2 font-racing text-2xl font-semibold uppercase text-racing-red sm:text-3xl">Variante {event.variante}</p> : null}
          <div className="mt-6 flex flex-col gap-3 text-gray-100 sm:flex-row sm:flex-wrap sm:gap-6"><p className="flex items-center gap-2 text-sm font-medium capitalize sm:text-base"><CalendarIcon className="h-5 w-5 text-racing-red"/>{formatDate(event.fecha)}</p><p className="flex items-center gap-2 text-sm font-medium sm:text-base"><ClockIcon className="h-5 w-5 text-racing-red"/>{formatTime(event.fecha)} H</p>{location ? <p className="flex items-center gap-2 text-sm text-gray-300 sm:text-base"><CountryFlag country={event.pais} className="text-lg"/><MapPinIcon className="h-5 w-5 text-racing-red"/>{location}</p> : null}</div>
          <div className="mt-8 max-w-3xl"><p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">{phase === 'active' ? 'La actividad ya comenzó' : 'Faltan para el inicio'}</p>{phase === 'active' ? <div className="inline-flex items-center gap-3 border border-racing-red/60 bg-racing-red/15 px-5 py-4 font-racing text-2xl font-bold uppercase text-white"><FlagIcon className="h-7 w-7 text-racing-red"/>Actividad en curso</div> : <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${countdownParts.length}, minmax(0, 1fr))` }}>{countdownParts.map(part => <div key={part.key} className="countdown-block border border-racing-red/20 bg-black/55 px-2 py-3 text-center backdrop-blur-md sm:px-4 sm:py-4"><span className="block font-racing text-3xl font-bold tabular-nums text-white sm:text-5xl">{String(part.value).padStart(2, '0')}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-xs">{part.label}</span></div>)}</div>}</div>
          <div className="mt-7 flex flex-wrap gap-3 xl:flex-nowrap xl:gap-2"><ServerJoinButton href={event.servidor} variant="green" steady className="event-action-button w-full justify-center sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"/>{event.transmision ? <a href={event.transmision} target="_blank" rel="noreferrer" className="event-action-button server-action-button server-action-red inline-flex w-full shrink-0 items-center justify-center gap-3 border border-red-400 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-racing transition-colors hover:bg-red-600 sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"><PlayCircleIcon className="h-5 w-7"/>Ver transmisión</a> : null}{showLiveTiming ? <Link to={`/tiempos-en-vivo?campeonato=${event.idcampeonato}`} className="event-action-button server-action-button server-action-blue inline-flex w-full shrink-0 items-center justify-center gap-3 border border-blue-300 bg-blue-600 px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-[0_0_25px_rgba(37,99,235,0.34)] transition-colors hover:bg-blue-500 sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"><ClockIcon className="h-5 w-7"/>Ver tiempos en vivo</Link> : null}{event.reglamento ? <button type="button" onClick={() => setRulesOpen(true)} className="event-action-button server-action-button server-action-white inline-flex w-full shrink-0 items-center justify-center gap-3 border border-white bg-white px-5 py-3 font-racing text-sm font-bold uppercase text-black shadow-[0_0_22px_rgba(255,255,255,0.2)] transition-colors hover:bg-gray-200 sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"><DocumentTextIcon className="h-5 w-5"/>Ver reglamento</button> : null}</div>
          {complaintPromptEvent ? <div className="mt-4 md:hidden"><ComplaintPrompt event={complaintPromptEvent} now={now}/></div> : null}
          <RegistrationPrompt registration={registrationPrompt} mobile/>
        </div>
        <div className="order-1 flex min-h-[200px] w-full items-center justify-center lg:order-2 lg:min-h-[500px] lg:justify-end">{event.circuito_trazado_url ? <img src={event.circuito_trazado_url} alt={`Trazado de ${event.circuito}`} className="race-track-float max-h-[28vh] w-full max-w-[520px] object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.9)] lg:max-h-[54vh]" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : <FlagIcon className="h-28 w-28 text-white/15"/>}</div>
      </div>
      {complaintPromptEvent ? <div className="absolute right-8 top-12 z-30 hidden md:block lg:right-14 2xl:right-20"><ComplaintPrompt event={complaintPromptEvent} now={now}/></div> : null}
      <RegistrationPrompt registration={registrationPrompt}/>
      {rulesOpen ? <RulesModal event={event} onClose={() => setRulesOpen(false)}/> : null}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-racing-red to-transparent"/>
    </section>
  );
}

function RegistrationSection({ registration, details, images, activeImage, now, events, template }) {
  const open = registration.phase === 'open';
  const full = registration.phase === 'full';
  const closed = registration.phase === 'closed';
  const enrollmentStarted = open || full || closed;
  const includesLiveBroadcast = Number(registration.precio || 0) > 10000;
  const theme = registrationThemes[closed ? 'closed' : enrollmentStarted ? 'open' : 'upcoming'];
  const firstEvent = details?.calendario?.[0] || null;
  const nextCalendarEvent = [...(details?.calendario || [])]
    .filter(event => getEventPhase(event, new Date(now)) !== 'expired')
    .sort((a, b) => (parseCalendarDate(a.fecha)?.getTime() || 0) - (parseCalendarDate(b.fecha)?.getTime() || 0))[0] || null;
  const nextEventMedia = nextCalendarEvent ? events.find(event => String(event.idcampeonato) === String(registration.idcampeonato) && String(event.ronda) === String(nextCalendarEvent.ronda)) : null;
  const nextEvent = nextCalendarEvent ? {
    ...nextCalendarEvent,
    circuito_foto_url: nextCalendarEvent.circuito_foto_url || nextEventMedia?.circuito_foto_url || nextEventMedia?.imagen || '',
  } : null;
  const raceDay = firstEvent ? formatCalendarDate(firstEvent.fecha, { weekday: 'long' }).toLocaleUpperCase('es-AR') : '';
  const closingNotice = open ? formatRegistrationClosing(registration.fecha_cierre, now) : null;
  const registrationLimit = Number(registration.limite_inscriptos || 0);
  const occupiedPlaces = Number(registration.cupos_ocupados ?? (Number(registration.inscriptos_actuales || 0) + Number(registration.preinscriptos || 0)));
  const remainingPlaces = Math.max(0, registrationLimit - occupiedPlaces);
  const lowAvailability = open && registrationLimit > 0 && remainingPlaces > 0 && remainingPlaces < 5;
  const background = images[activeImage] || '';

  return (
    <section id={`inscripciones-campeonato-${registration.idcampeonato}`} className="home-race-anchor home-race-height race-hero relative overflow-hidden bg-black">
      {background ? <img key={background} src={background} alt="" className="registration-background-transition absolute inset-0 h-full w-full object-cover"/> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10"/><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"/><div className="race-hero-grid absolute inset-0 opacity-25"/>
      <div className="home-race-height relative z-10 mx-auto flex w-full max-w-[1600px] flex-col items-start justify-center px-5 pb-8 pt-12 sm:px-8 sm:pb-48 lg:px-14 xl:px-20">
        <div className="race-hero-content w-full max-w-3xl xl:max-w-4xl">
          <div className={`mb-5 inline-flex items-center gap-3 border-l-2 bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md ${theme.border}`}><span className={`h-2 w-2 animate-pulse rounded-full ${theme.dot}`}/>{full ? 'Inscripciones cerradas • Cupos completos' : closed ? 'Inscripciones cerradas' : open ? 'Inscripciones abiertas' : 'Próximo campeonato'}</div>
          <div className="mb-3 flex flex-wrap items-stretch gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm"><span className={`flex items-center px-3 py-1.5 ${theme.chip}`}>Temporada {registration.temporada}</span><span className={`flex items-center border bg-black/45 px-3 py-1.5 ${theme.borderSoft}`}>{registration.plataforma}</span>{template ? <a href={`/api/templates/${template.id}/download`} className="group inline-flex items-center gap-2 border border-cyan-300/60 bg-cyan-300/15 px-3 py-1.5 font-racing text-[10px] font-bold uppercase tracking-wider text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)] transition-colors hover:bg-cyan-300 hover:text-black sm:text-xs" title={`Descargar plantilla de ${registration.categoria}`}><ArrowDownTrayIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-y-0.5"/><span>Descargar plantilla</span></a> : null}</div>
          <h2 className="font-anton text-5xl uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">
            <span className="block">Nuevo</span>
            <span className="block">Campeonato</span>
          </h2>
          <div className="mt-4 flex items-center gap-4 sm:gap-5">{registration.categoria_logo ? <img src={registration.categoria_logo} alt="" className="h-14 w-16 shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.8)] sm:h-20 sm:w-24 lg:h-24 lg:w-28"/> : null}<p className={`font-racing text-4xl font-bold uppercase leading-none tracking-wide drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-5xl lg:text-6xl ${theme.text}`}>{registration.categoria}</p></div>
          <p className="mt-6 max-w-2xl text-sm text-gray-300">Setup: {registration.setup_detalle}</p>
          <div className="mt-4 flex flex-wrap gap-3">{includesLiveBroadcast ? <a href="https://www.youtube.com/@alPodioEnVivo" target="_blank" rel="noreferrer" className={`group flex items-center gap-3 overflow-hidden border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-black/70 ${theme.border}`}><PlayCircleIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><strong className="block whitespace-nowrap text-sm font-bold uppercase tracking-wide text-white">Transmisión en vivo</strong><span className="max-w-0 -translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-28 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:max-w-28 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"><span className={`block px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${enrollmentStarted ? 'bg-green-600 text-white' : 'bg-yellow-400 text-black'}`}>Ir al canal</span></span></a> : <div className="flex items-center gap-3 border-l-2 border-gray-500 bg-black/50 px-4 py-3 backdrop-blur-sm"><PlayCircleIcon className="h-6 w-6 shrink-0 text-gray-500"/><strong className="block text-sm font-bold uppercase tracking-wide text-gray-300">Sin transmisión en vivo</strong></div>}</div>
          <div className="mt-5 grid max-w-lg grid-cols-2 gap-3"><div className={`flex items-center gap-3 border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm ${theme.border}`}><CalendarIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><div><strong className="block font-racing text-xl uppercase text-white">{registration.cantidad_fechas} Fechas</strong>{firstEvent ? <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-wider ${theme.textSoft}`}>Días {raceDay} · {formatTime(firstEvent.fecha)} HS</span> : null}</div></div><div className={`flex min-w-0 items-center gap-3 border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm ${theme.border}`}><UserGroupIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-racing text-xl text-white">{enrollmentStarted ? occupiedPlaces : Number(registration.preinscriptos || 0)}/{registration.limite_inscriptos}</strong>{lowAvailability ? <span className="cta-attention whitespace-nowrap border border-yellow-300/70 bg-yellow-400 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-black shadow-[0_0_18px_rgba(250,204,21,0.3)]">{remainingPlaces === 1 ? 'Queda solo 1 lugar' : `Quedan solo ${remainingPlaces} lugares`}</span> : null}</div><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{enrollmentStarted ? 'Inscriptos' : 'Pre-inscriptos'}</span></div></div></div>
          <div className="mt-7 flex flex-wrap items-start gap-4"><div className="flex flex-col items-start gap-2"><Link to={`/inscripcion?campeonato=${registration.idcampeonato}`} className={`event-action-button group ${full ? 'border-gray-500 bg-gray-700 text-gray-100 shadow-[0_0_22px_rgba(107,114,128,0.2)] hover:border-gray-300 hover:bg-gray-600' : theme.button} server-action-button relative inline-flex min-h-14 items-center gap-3 overflow-hidden border px-6 py-3 font-racing text-sm font-bold uppercase transition-colors`}><span className="flex items-center gap-3 transition-all duration-300 group-hover:scale-95 group-hover:opacity-0 group-focus-visible:scale-95 group-focus-visible:opacity-0"><span>{open ? 'Inscripciones' : full ? 'Cupos completos' : closed ? 'Inscripciones cerradas' : formatRegistrationOpening(registration.fecha_apertura, now)}</span><ArrowRightIcon className="h-5 w-5 shrink-0"/></span><span className="pointer-events-none absolute inset-0 flex scale-95 items-center justify-center gap-3 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100" aria-hidden="true"><span className="registration-info-flag server-join-flag h-7 w-9 shrink-0 border border-black/50"/><span className="text-sm font-bold uppercase">{open ? 'Inscribirse ya' : 'Ver información'}</span></span></Link>{open && closingNotice ? <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-green-200"><ClockIcon className="h-3.5 w-3.5 shrink-0 text-green-300"/><span>{closingNotice.label} <strong className="font-racing text-xs text-white">{closingNotice.value}</strong></span></div> : null}</div><div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Inscripción desde</p><p className={`font-racing text-3xl font-bold ${theme.text}`}>{formatPrice(registration.precio)}</p></div></div>
        </div>
        {nextEvent ? <aside className={`relative mt-7 ml-auto min-h-32 w-full max-w-lg overflow-hidden border bg-black text-left shadow-[0_18px_45px_rgba(0,0,0,0.55)] md:w-[27rem] lg:w-[28rem] 2xl:absolute 2xl:right-20 2xl:top-12 2xl:mt-0 ${theme.borderSoft}`}>{nextEvent.circuito_foto_url ? <img src={nextEvent.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : null}<div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15"/><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20"/><div className="relative z-10 flex min-h-32 flex-col p-4"><div className="flex items-center justify-between gap-4"><p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text}`}>Próxima fecha</p><span className={`shrink-0 px-2.5 py-1 font-racing text-sm font-bold uppercase ${theme.chip}`}>Fecha {nextEvent.ronda}</span></div><div className="mt-auto"><div className="flex items-center gap-2.5"><CountryFlag country={nextEvent.pais} className="shrink-0 text-lg"/><h3 className="font-racing text-lg font-bold uppercase leading-tight text-white drop-shadow-lg">{nextEvent.circuito}{nextEvent.variante ? ` · ${nextEvent.variante}` : ''}</h3></div><div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-gray-200"><span className="flex items-center gap-1.5 capitalize"><CalendarIcon className={`h-4 w-4 ${theme.text}`}/>{formatCalendarDate(nextEvent.fecha, { weekday: 'long', day: '2-digit', month: 'long' })}</span><span className="flex items-center gap-1.5"><ClockIcon className={`h-4 w-4 ${theme.text}`}/>{formatTime(nextEvent.fecha)} HS</span></div></div></div></aside> : null}
      </div>
      {details?.autos?.length ? <div className="relative z-20 mx-auto w-full max-w-5xl px-5 pb-7 text-center sm:absolute sm:bottom-9 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:px-0 sm:pb-0"><p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.28em] sm:text-xs ${theme.text}`}>Modelos disponibles</p><div className="scrollbar-hidden grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:justify-center sm:gap-3 sm:overflow-x-auto">{details.autos.map(car => <div key={car.id} title={`${car.marca} ${car.modelo}`} className="flex min-w-0 items-center justify-start gap-2 border border-white/15 bg-black/60 px-2 py-2 backdrop-blur-md sm:min-w-32 sm:shrink-0 sm:justify-center sm:px-3">{car.logo ? <img src={car.logo} alt={`Logo de ${car.marca}`} className="h-8 w-10 shrink-0 object-contain sm:h-11 sm:w-14"/> : null}<span className="min-w-0 text-left text-[9px] font-semibold uppercase leading-tight text-gray-200 sm:text-[10px]"><strong className="block break-words text-white">{car.modelo}</strong><span className="break-words text-gray-500">{car.marca}</span></span></div>)}</div></div> : null}
      <div className={`absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent to-transparent ${theme.divider}`}/>
    </section>
  );
}

function BroadcastSection({ broadcasts, now }) {
  const championships = useMemo(() => {
    const unique = new Map();
    broadcasts.forEach(item => {
      if (!unique.has(String(item.idcampeonato))) unique.set(String(item.idcampeonato), item);
    });
    return [...unique.values()];
  }, [broadcasts]);
  const [selectedChampionship, setSelectedChampionship] = useState(() => String(broadcasts[0]?.idcampeonato || ''));
  const [selectedRound, setSelectedRound] = useState(null);
  const [roundMenuOpen, setRoundMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const activeBroadcasts = broadcasts.filter(item => String(item.idcampeonato) === selectedChampionship);
  const broadcast = activeBroadcasts.find(item => String(item.ronda) === String(selectedRound)) || activeBroadcasts[0] || broadcasts[0];
  const age = getDaysAgoLabel(broadcast.fecha, now);

  const selectRound = round => {
    setSelectedRound(round);
    setRoundMenuOpen(false);
  };

  const selectChampionship = id => {
    setSelectedChampionship(String(id));
    setSelectedRound(null);
    setCategoryMenuOpen(false);
    setRoundMenuOpen(false);
  };

  return (
    <section className="home-race-height race-hero relative overflow-hidden bg-black">
      <img key={broadcast.youtubeId} src={`https://i.ytimg.com/vi/${broadcast.youtubeId}/maxresdefault.jpg`} alt="" className="animate-fade-in absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-sm"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-violet-950/65"/><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/45"/><div className="race-hero-grid absolute inset-0 opacity-20"/>
      <div className="home-race-height relative z-10 mx-auto grid w-full max-w-[1600px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(300px,0.65fr)_minmax(520px,1.35fr)] lg:gap-16 lg:px-14 xl:gap-24 xl:px-20">
        <div key={`${broadcast.idcampeonato}-${broadcast.ronda}`} className="race-hero-content max-w-xl justify-self-start animate-fade-in">
          <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-violet-400 bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-400"/>Última transmisión</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200">
            <div className="relative">
              <button type="button" onClick={() => { setCategoryMenuOpen(current => !current); setRoundMenuOpen(false); }} className="group inline-flex items-center gap-2 bg-violet-600 px-3 py-1.5 text-white transition hover:bg-violet-500" aria-expanded={categoryMenuOpen} aria-haspopup="listbox"><span>{broadcast.categoria}</span>{championships.length > 1 ? <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-300 ${categoryMenuOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}/> : null}</button>
              {categoryMenuOpen && championships.length > 1 ? <div className="animate-fade-in absolute left-0 top-full z-40 mt-2 max-h-64 min-w-64 overflow-y-auto border border-violet-400/30 bg-black/95 py-1 shadow-[0_12px_30px_rgba(76,29,149,0.55)] backdrop-blur-md" role="listbox" aria-label="Seleccionar categoría">{championships.map(item => <button key={item.idcampeonato} type="button" onClick={() => selectChampionship(item.idcampeonato)} className={`block w-full whitespace-nowrap px-4 py-2 text-left transition hover:bg-violet-600 hover:text-white ${String(item.idcampeonato) === String(broadcast.idcampeonato) ? 'bg-violet-500/20 text-violet-300' : 'text-gray-300'}`} role="option" aria-selected={String(item.idcampeonato) === String(broadcast.idcampeonato)}>{item.categoria} · TEMPORADA {item.temporada}</button>)}</div> : null}
            </div>
            <span className="border border-violet-400/25 bg-black/50 px-3 py-1.5">Temporada {broadcast.temporada}</span>
            <div className="relative">
              <button type="button" onClick={() => setRoundMenuOpen(current => !current)} className="group inline-flex items-center gap-2 border border-violet-400/25 bg-black/50 px-3 py-1.5 transition hover:border-violet-300 hover:bg-violet-500/15" aria-expanded={roundMenuOpen} aria-haspopup="listbox">
                <span>FECHA {broadcast.ronda}</span>
                {activeBroadcasts.length > 1 ? <ChevronDownIcon className={`h-3.5 w-3.5 text-violet-300 transition-transform duration-300 ${roundMenuOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}/> : null}
              </button>
              {roundMenuOpen && activeBroadcasts.length > 1 ? <div className="animate-fade-in absolute left-0 top-full z-40 mt-2 min-w-full overflow-hidden border border-violet-400/30 bg-black/95 py-1 shadow-[0_12px_30px_rgba(76,29,149,0.55)] backdrop-blur-md" role="listbox" aria-label="Seleccionar fecha transmitida">{activeBroadcasts.map(item => <button key={`${item.idcampeonato}-${item.ronda}`} type="button" onClick={() => selectRound(item.ronda)} className={`block w-full whitespace-nowrap px-4 py-2 text-left transition hover:bg-violet-600 hover:text-white ${String(item.ronda) === String(broadcast.ronda) ? 'bg-violet-500/20 text-violet-300' : 'text-gray-300'}`} role="option" aria-selected={String(item.ronda) === String(broadcast.ronda)}>FECHA {item.ronda}</button>)}</div> : null}
            </div>
          </div>
          <h2 className="mt-5 font-anton text-5xl uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">{broadcast.circuito}</h2>
          {broadcast.variante ? <p className="mt-2 font-racing text-2xl font-semibold uppercase text-violet-300">Variante {broadcast.variante}</p> : null}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-gray-300"><p className="flex items-center gap-2 capitalize"><CalendarIcon className="h-5 w-5 text-violet-400"/>{formatDate(broadcast.fecha)}</p>{age ? <span className="border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-300">{age}</span> : null}</div>
          <a href={broadcast.transmision} target="_blank" rel="noreferrer" className="event-action-button server-action-button server-action-violet mt-7 inline-flex items-center gap-3 border border-violet-300 bg-violet-600 px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-colors hover:bg-violet-500"><PlayCircleIcon className="h-6 w-6"/>Ver en YouTube</a>
        </div>
        <div key={broadcast.youtubeId} className="race-hero-content w-full max-w-[820px] justify-self-end animate-fade-in overflow-hidden border border-violet-400/25 bg-black shadow-[0_25px_70px_rgba(76,29,149,0.38)]"><div className="aspect-video w-full"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${broadcast.youtubeId}?rel=0`} title={`Última transmisión: ${broadcast.categoria} en ${broadcast.circuito}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/></div></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent"/>
    </section>
  );
}

const sponsorLink = value => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(normalized)) return `https://${normalized}`;
  return '';
};

function SponsorGalleryModal({ sponsor, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const photos = sponsor.fotos || [];
  const showPrevious = () => setIndex(current => (current - 1 + photos.length) % photos.length);
  const showNext = () => setIndex(current => (current + 1) % photos.length);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && photos.length > 1) setIndex(current => (current - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight' && photos.length > 1) setIndex(current => (current + 1) % photos.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose, photos.length]);

  if (!photos[index]) return null;
  return createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-0 sm:p-5" role="dialog" aria-modal="true" aria-label={`Galería de ${sponsor.empresa}`}>
    <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar galería"/>
    <div className="relative z-10 flex h-[100dvh] w-full max-w-7xl flex-col sm:h-[92dvh]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black px-4 py-3 sm:px-5"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#00ffcd]">Sponsor</p><h3 className="truncate font-racing text-xl font-bold uppercase text-white sm:text-2xl">{sponsor.empresa}</h3></div><div className="flex items-center gap-3"><span className="font-racing text-sm text-gray-400">{index + 1}/{photos.length}</span><button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center border border-white/15 text-gray-300 hover:border-[#00ffcd] hover:text-[#00ffcd]" aria-label="Cerrar"><XMarkIcon className="h-5 w-5"/></button></div></header>
      <div className="relative min-h-0 flex-1 bg-black"><img src={photos[index].imagen} alt={`${sponsor.empresa} · foto ${index + 1}`} className="h-full w-full object-contain"/>{photos.length > 1 ? <><button type="button" onClick={showPrevious} className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/70 text-white backdrop-blur-sm hover:border-[#00ffcd] hover:text-[#00ffcd] sm:left-5 sm:h-14 sm:w-14" aria-label="Foto anterior"><ChevronLeftIcon className="h-7 w-7"/></button><button type="button" onClick={showNext} className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/70 text-white backdrop-blur-sm hover:border-[#00ffcd] hover:text-[#00ffcd] sm:right-5 sm:h-14 sm:w-14" aria-label="Foto siguiente"><ChevronRightIcon className="h-7 w-7"/></button></> : null}</div>
    </div>
  </div>, document.body);
}

function AdvertisingSection({ sponsors }) {
  const [galleryView, setGalleryView] = useState(null);
  return (
    <section className="relative overflow-hidden border-t border-cyan-300/15 bg-[#050909] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(0,255,205,0.14),transparent_32%),radial-gradient(circle_at_88%_75%,rgba(6,182,212,0.1),transparent_30%)]"/>
      <div className="race-hero-grid absolute inset-0 opacity-10"/>
      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 py-14 sm:px-8 sm:py-18 lg:px-14 lg:py-20 xl:px-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1.15fr)] lg:items-center lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-3 border-l-2 border-[#00ffcd] bg-black/55 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white sm:text-xs"><MegaphoneIcon className="h-5 w-5 text-[#00ffcd]"/>Publicidad en CADPO</div>
            <h2 className="mt-6 max-w-3xl font-anton text-5xl uppercase leading-[0.9] text-white sm:text-6xl lg:text-7xl">Hacé que tu marca también corra con nosotros</h2>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">Si tenés una empresa o emprendimiento, podés formar parte de la liga y llegar a nuestra comunidad dentro y fuera de la pista. Creamos propuestas de presencia visual adaptadas a cada marca.</p>
            <a href="https://wa.me/5492604659499" target="_blank" rel="noreferrer" className="event-action-button server-action-button server-action-turquoise mt-7 inline-flex min-h-12 w-full items-center justify-center gap-3 border border-[#00ffcd] bg-[#00ffcd] px-6 py-3 font-racing text-sm font-bold uppercase text-black shadow-[0_0_30px_rgba(0,255,205,0.2)] transition-colors hover:bg-[#00d9af] sm:w-auto"><MegaphoneIcon className="h-5 w-5"/>Quiero publicitar</a>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[{
              icon: PaintBrushIcon, title: 'En los autos', text: 'Tu identidad aplicada en diseños y pinturas de los vehículos de competición.'
            }, {
              icon: VideoCameraIcon, title: 'En transmisiones', text: 'Presencia durante las carreras, placas, menciones y contenido audiovisual.'
            }, {
              icon: MapIcon, title: 'En los circuitos', text: 'Cartelería de pista y espacios publicitarios visibles durante cada fecha.'
            }].map(item => { const Icon = item.icon; return <article key={item.title} className="group border border-white/10 bg-black/45 p-5 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#00ffcd]/55 hover:bg-[#00ffcd]/[0.06]"><span className="flex h-12 w-12 items-center justify-center border border-[#00ffcd]/35 bg-[#00ffcd]/10 text-[#00ffcd] transition group-hover:bg-[#00ffcd] group-hover:text-black"><Icon className="h-6 w-6"/></span><h3 className="mt-5 font-racing text-xl font-bold uppercase text-white">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-gray-400">{item.text}</p></article>; })}
          </div>
        </div>

        {sponsors.length ? <div className="mt-14 border-t border-white/10 pt-10 sm:mt-16 sm:pt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00ffcd]">Acompañan a la liga</p><h3 className="mt-2 font-racing text-3xl font-bold uppercase text-white sm:text-4xl">Nuestros sponsors</h3></div><p className="max-w-xl text-sm text-gray-500">Empresas y emprendimientos que impulsan el crecimiento de la comunidad CADPO.</p></div>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">{sponsors.map(sponsor => {
            const website = sponsorLink(sponsor.sitio);
            return <article key={sponsor.id} className="overflow-hidden border border-white/10 bg-black/45 transition hover:border-[#00ffcd]/35">
              <div className="grid gap-6 p-5 sm:grid-cols-[190px_1fr] sm:items-center sm:p-6">
                {sponsor.logo ? <img src={sponsor.logo} alt={`Logo de ${sponsor.empresa}`} loading="lazy" className="h-36 w-full object-contain sm:h-44"/> : <BuildingOffice2Icon className="mx-auto h-20 w-20 text-gray-700"/>}
                <div className="min-w-0"><h4 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">{sponsor.empresa}</h4>{sponsor.descripcion ? <p className="mt-2 text-sm leading-relaxed text-gray-400">{sponsor.descripcion}</p> : null}<div className="mt-4 space-y-2 text-xs">{sponsor.ubicacion ? <p className="flex items-start gap-2 text-gray-300"><MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00ffcd]"/><span>{sponsor.ubicacion}</span></p> : null}{sponsor.contacto ? <p className="flex items-start gap-2 text-gray-300"><PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00ffcd]"/><span>{sponsor.contacto}</span></p> : null}{sponsor.sitio ? website ? <a href={website} target="_blank" rel="noreferrer" className="flex max-w-full items-start gap-2 break-all font-semibold text-[#00ffcd] hover:text-white"><GlobeAltIcon className="mt-0.5 h-4 w-4 shrink-0"/><span>{sponsor.sitio}</span></a> : <p className="flex items-start gap-2 break-all text-gray-300"><GlobeAltIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00ffcd]"/><span>{sponsor.sitio}</span></p> : null}</div></div>
              </div>
              {sponsor.fotos?.length ? <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">{sponsor.fotos.slice(0, 6).map((photo, index) => <button type="button" key={photo.id} onClick={() => setGalleryView({ sponsor, index })} className={`relative overflow-hidden bg-black ${index === 0 && sponsor.fotos.length < 3 ? 'col-span-2' : ''}`} aria-label={`Ver foto ${index + 1} de ${sponsor.empresa}`}><img src={photo.imagen} alt={`${sponsor.empresa} · foto ${index + 1}`} loading="lazy" className="aspect-video h-full w-full object-cover opacity-80 transition duration-500 hover:scale-105 hover:opacity-100"/>{index === 5 && sponsor.fotos.length > 6 ? <span className="absolute inset-0 flex items-center justify-center bg-black/65 font-racing text-xl font-bold text-white">+{sponsor.fotos.length - 6}</span> : null}</button>)}</div> : null}
            </article>;
          })}</div>
        </div> : null}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00ffcd] to-transparent"/>
      {galleryView ? <SponsorGalleryModal sponsor={galleryView.sponsor} initialIndex={galleryView.index} onClose={() => setGalleryView(null)}/> : null}
    </section>
  );
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [registrationForms, setRegistrationForms] = useState([]);
  const [registrationDetails, setRegistrationDetails] = useState({});
  const [registrationImages, setRegistrationImages] = useState({});
  const [activeRegistrationImages, setActiveRegistrationImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [calendarEvent, setCalendarEvent] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [complaintContext, setComplaintContext] = useState({ eventos: [], proxima: null });

  const upcomingEvents = useMemo(() => getFeaturedUpcomingEvents(events, new Date(now)), [events, now]);
  const liveTimingEventIds = useMemo(() => new Set(getLiveTimingEvents(events, new Date(now)).map(event => `${event.idcampeonato}-${event.ronda}`)), [events, now]);
  const registrations = useMemo(() => registrationForms.filter(item => item.visible !== false).map(item => ({ ...item, phase: getRegistrationPhase(item, now) })).filter(item => item.phase === 'open' || item.phase === 'full' || item.phase === 'upcoming' || (item.phase === 'closed' && (parseCalendarDate(item.primera_fecha)?.getTime() || 0) > now)).sort((a, b) => {
    const order = { open: 0, full: 1, closed: 2, upcoming: 3 };
    return order[a.phase] - order[b.phase] || (parseCalendarDate(a.fecha_apertura)?.getTime() || 0) - (parseCalendarDate(b.fecha_apertura)?.getTime() || 0);
  }), [registrationForms, now]);
  const openRegistration = registrations.find(item => item.phase === 'open') || null;
  const openComplaintEvent = complaintContext.eventos.find(event => (parseCalendarDate(event.cierre_denuncias)?.getTime() || 0) > now) || null;
  const championshipBroadcasts = useMemo(() => {
    const pastBroadcasts = events
      .map(event => ({ ...event, youtubeId: getYouTubeVideoId(event.transmision) }))
      .filter(event => event.youtubeId && (parseCalendarDate(event.fecha)?.getTime() || 0) <= now)
      .sort((a, b) => (parseCalendarDate(b.fecha)?.getTime() || 0) - (parseCalendarDate(a.fecha)?.getTime() || 0));
    return pastBroadcasts;
  }, [events, now]);
  const championshipEvents = useMemo(() => events.filter(event => String(event.idcampeonato) === String(calendarEvent?.idcampeonato)).filter(event => getEventPhase(event, new Date(now)) !== 'expired').sort((a, b) => (parseCalendarDate(a.fecha)?.getTime() || 0) - (parseCalendarDate(b.fecha)?.getTime() || 0)), [calendarEvent?.idcampeonato, events, now]);
  const registrationIds = registrations.map(item => item.idcampeonato).join(',');

  useEffect(() => {
    Promise.all([eventsApi.getAll(), registrationFormsApi.getAll(), templatesApi.getAll()]).then(([eventsResponse, formsResponse, templatesResponse]) => { setEvents(eventsResponse.data.data || []); setRegistrationForms(formsResponse.data.data || []); setTemplates(templatesResponse.data.data || []); }).catch(error => console.error('Error cargando el inicio:', error)).finally(() => setLoading(false));
    sponsorsApi.getAll().then(response => setSponsors(response.data.data || [])).catch(error => console.error('Error cargando sponsors:', error));
  }, []);

  useEffect(() => {
    let active = true;
    const loadComplaintContext = () => complaintsApi.getContext()
      .then(response => { if (active) setComplaintContext(response.data.data || { eventos: [], proxima: null }); })
      .catch(error => console.error('Error cargando denuncias habilitadas:', error));
    loadComplaintContext();
    const interval = window.setInterval(loadComplaintContext, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = new Set(registrationIds.split(',').filter(Boolean));
    const formsToLoad = registrationForms.filter(registration => ids.has(String(registration.idcampeonato)));
    Promise.all(formsToLoad.map(async registration => {
      const [detailsResponse, imagesResponse] = await Promise.allSettled([registrationFormsApi.getById(registration.idcampeonato), mediaApi.getRegistrationImages({ categoria: registration.categoria, temporada: registration.temporada })]);
      return [registration.idcampeonato, detailsResponse.status === 'fulfilled' ? detailsResponse.value.data.data : null, imagesResponse.status === 'fulfilled' ? shuffle(imagesResponse.value.data.data || []) : []];
    })).then(results => {
      if (cancelled) return;
      setRegistrationDetails(Object.fromEntries(results.map(([id, details]) => [id, details])));
      setRegistrationImages(Object.fromEntries(results.map(([id, , images]) => [id, images])));
      setActiveRegistrationImages(Object.fromEntries(results.map(([id]) => [id, 0])));
    });
    return () => { cancelled = true; };
  }, [registrationForms, registrationIds]);

  useEffect(() => {
    const ids = registrationIds.split(',').filter(Boolean);
    if (!ids.some(id => (registrationImages[id]?.length || 0) > 1)) return undefined;
    const timer = window.setInterval(() => setActiveRegistrationImages(current => {
      const next = { ...current };
      ids.forEach(id => {
        const images = registrationImages[id] || [];
        if (images.length < 2) return;
        let index = next[id] || 0;
        while (index === (next[id] || 0)) index = Math.floor(Math.random() * images.length);
        next[id] = index;
      });
      return next;
    }), 9000);
    return () => window.clearInterval(timer);
  }, [registrationIds, registrationImages]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!calendarEvent) return undefined;
    const close = event => { if (event.key === 'Escape') setCalendarEvent(null); };
    document.addEventListener('keydown', close); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [calendarEvent]);

  return (
    <div className="animate-fade-in">
      {!loading ? upcomingEvents.map((event, index) => <EventSection key={`${event.idcampeonato}-${event.ronda}`} event={event} now={now} onShowCalendar={setCalendarEvent} registrationPrompt={index === upcomingEvents.length - 1 ? openRegistration : null} complaintPromptEvent={index === Math.max(0, upcomingEvents.findIndex(item => String(item.idcampeonato) === String(openComplaintEvent?.idcampeonato) && String(item.ronda) === String(openComplaintEvent?.ronda))) ? openComplaintEvent : null} showLiveTiming={liveTimingEventIds.has(`${event.idcampeonato}-${event.ronda}`)}/>) : null}
      {!loading && !upcomingEvents.length && openComplaintEvent ? <div className="mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-8 lg:px-14 xl:px-20"><ComplaintPrompt event={openComplaintEvent} now={now}/></div> : null}
      {!loading ? registrations.map(registration => <RegistrationSection key={registration.idcampeonato} registration={registration} details={registrationDetails[registration.idcampeonato]} images={registrationImages[registration.idcampeonato] || []} activeImage={activeRegistrationImages[registration.idcampeonato] || 0} now={now} events={events} template={templates.find(item => String(item.idcampeonato) === String(registration.idcampeonato)) || null}/>) : null}
      {!loading && championshipBroadcasts.length ? <BroadcastSection key={championshipBroadcasts[0].idcampeonato} broadcasts={championshipBroadcasts} now={now}/> : null}
      {!loading ? <AdvertisingSection sponsors={sponsors}/> : null}

      {calendarEvent ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setCalendarEvent(null); }} role="presentation"><section className="max-h-[85vh] w-full max-w-3xl overflow-hidden border border-racing-border bg-racing-gray shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="calendar-title"><header className="flex items-start justify-between gap-4 border-b border-racing-border p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">{calendarEvent.categoria} · Temporada {calendarEvent.temporada}</p><h2 id="calendar-title" className="mt-1 font-racing text-3xl font-bold">Próximas fechas</h2></div><button type="button" onClick={() => setCalendarEvent(null)} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-400 transition hover:border-racing-red hover:text-white" aria-label="Cerrar calendario"><XMarkIcon className="h-5 w-5"/></button></header><div className="max-h-[65vh] space-y-3 overflow-y-auto p-5 sm:p-6">{championshipEvents.map(event => <article key={`${event.idcampeonato}-${event.ronda}`} className="grid gap-4 border border-racing-border bg-racing-dark p-4 sm:grid-cols-[60px_1fr_auto] sm:items-center"><div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-500">Ronda</p><p className="font-racing text-3xl font-bold text-racing-red">{event.ronda}</p></div><div><h3 className="font-racing text-xl font-bold text-white">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400"><p className="flex items-center gap-2 capitalize"><CalendarIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p><p className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p></div><p className="mt-2 text-xs text-gray-500">{[event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ')}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{event.especial ? <span className="border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-xs font-bold uppercase text-yellow-300">{event.especialidad || 'Especial'}</span> : null}{event.coronacion ? <span className="border border-racing-red/30 bg-racing-red/10 px-2 py-1 text-xs font-bold uppercase text-racing-red">Coronación</span> : null}</div></article>)}</div></section></div> : null}
    </div>
  );
}
