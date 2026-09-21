import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon, FlagIcon, MapPinIcon, PlayCircleIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { eventsApi, mediaApi, registrationFormsApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';
import ServerJoinButton from '../components/ServerJoinButton';
import { getEventPhase, getFeaturedUpcomingEvents, getLiveTimingEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';
import { formatPrice } from '../utils/currency';

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
  return Number(form.inscriptos_actuales) >= Number(form.limite_inscriptos) ? 'full' : 'open';
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
};

function RegistrationPrompt({ registration }) {
  if (!registration) return null;
  return (
    <button type="button" onClick={() => document.getElementById(`inscripciones-campeonato-${registration.idcampeonato}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="group absolute bottom-5 right-4 z-30 flex items-stretch overflow-hidden border border-emerald-400/45 bg-black/85 text-left shadow-[0_14px_35px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-black/95 sm:bottom-7 sm:right-8 lg:right-12" aria-label="Ir al campeonato con inscripciones abiertas">
      <span className="w-1.5 shrink-0 bg-emerald-500 transition-all duration-300 group-hover:w-2.5"/>
      <span className="px-4 py-3"><span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Inscripciones abiertas</span><span className="block font-racing text-sm font-bold uppercase text-white sm:text-base">Nuevo campeonato</span></span>
      <span className="flex w-11 items-center justify-center border-l border-emerald-400/20 bg-emerald-500/15 transition-colors group-hover:bg-emerald-500"><ChevronDownIcon className="h-5 w-5 animate-bounce text-emerald-300 group-hover:text-white"/></span>
    </button>
  );
}

function EventSection({ event, now, onShowCalendar, registrationPrompt, showLiveTiming }) {
  const location = [event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ');
  const countdown = getCountdown(event.fecha, now);
  const phase = getEventPhase(event, new Date(now));
  const countdownParts = countdown ? [
    { value: countdown.days, label: 'Días' }, { value: countdown.hours, label: 'Horas' },
    { value: countdown.minutes, label: 'Minutos' }, { value: countdown.seconds, label: 'Segundos' },
  ] : [];

  return (
    <section className="race-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black">
      {event.circuito_foto_url ? <img src={event.circuito_foto_url} alt="" className="race-hero-background absolute inset-0 h-full w-full object-cover"/> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"/>
      <div className="race-hero-grid absolute inset-0 opacity-25"/>
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1600px] grid-cols-1 items-center gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] lg:gap-16 lg:px-14 lg:py-12 xl:gap-24 xl:px-20">
        <div className="race-hero-content order-2 max-w-3xl justify-self-start lg:order-1">
          <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-racing-red bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-racing-red"/>Próxima fecha</div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm"><span className="bg-racing-red px-3 py-1.5 text-white">{event.categoria}</span><span className="border border-racing-red/25 bg-black/45 px-3 py-1.5">Temporada {event.temporada}</span><span className="border border-racing-red/25 bg-black/45 px-3 py-1.5">Fecha {event.ronda}</span><button type="button" onClick={() => onShowCalendar(event)} className="inline-flex items-center gap-2 border border-gray-600 bg-black px-3 py-1.5 font-racing text-xs font-bold uppercase text-white shadow-lg transition-all hover:-translate-y-0.5 hover:border-gray-400 hover:bg-gray-950 active:scale-95"><CalendarIcon className="h-4 w-4"/>Ver calendario</button></div>
          <h1 className="font-racing text-5xl font-bold uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">{event.circuito}</h1>
          {event.variante ? <p className="mt-2 font-racing text-2xl font-semibold uppercase text-racing-red sm:text-3xl">Variante {event.variante}</p> : null}
          <div className="mt-6 flex flex-col gap-3 text-gray-100 sm:flex-row sm:flex-wrap sm:gap-6"><p className="flex items-center gap-2 text-sm font-medium capitalize sm:text-base"><CalendarIcon className="h-5 w-5 text-racing-red"/>{formatDate(event.fecha)}</p><p className="flex items-center gap-2 text-sm font-medium sm:text-base"><ClockIcon className="h-5 w-5 text-racing-red"/>{formatTime(event.fecha)} H</p>{location ? <p className="flex items-center gap-2 text-sm text-gray-300 sm:text-base"><CountryFlag country={event.pais} className="text-lg"/><MapPinIcon className="h-5 w-5 text-racing-red"/>{location}</p> : null}</div>
          <div className="mt-8 max-w-3xl"><p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">{phase === 'active' ? 'La actividad ya comenzó' : 'Faltan para el inicio'}</p>{phase === 'active' ? <div className="inline-flex items-center gap-3 border border-racing-red/60 bg-racing-red/15 px-5 py-4 font-racing text-2xl font-bold uppercase text-white"><FlagIcon className="h-7 w-7 text-racing-red"/>Actividad en curso</div> : <div className="grid grid-cols-4 gap-2 sm:gap-3">{countdownParts.map(part => <div key={part.label} className="countdown-block border border-racing-red/20 bg-black/55 px-2 py-3 text-center backdrop-blur-md sm:px-4 sm:py-4"><span className="block font-racing text-3xl font-bold tabular-nums text-white sm:text-5xl">{String(part.value).padStart(2, '0')}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-xs">{part.label}</span></div>)}</div>}</div>
          <div className="mt-7 flex flex-wrap gap-3 xl:flex-nowrap xl:gap-2"><ServerJoinButton href={event.servidor} className="w-full justify-center sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"/>{event.transmision ? <a href={event.transmision} target="_blank" rel="noreferrer" className="server-action-button server-action-red inline-flex w-full shrink-0 items-center justify-center gap-3 border border-red-400 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-racing transition-transform hover:-translate-y-0.5 active:scale-95 sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"><PlayCircleIcon className="h-5 w-7"/>Ver transmisión</a> : null}{showLiveTiming ? <Link to={`/tiempos-en-vivo?campeonato=${event.idcampeonato}`} className="server-action-button server-action-green inline-flex w-full shrink-0 items-center justify-center gap-3 border border-emerald-300 bg-emerald-600 px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-95 sm:w-auto xl:gap-2 xl:px-3 xl:text-xs"><ClockIcon className="h-5 w-7"/>Ver tiempos en vivo</Link> : null}</div>
        </div>
        <div className="order-1 flex min-h-[220px] w-full items-center justify-center lg:order-2 lg:min-h-[520px] lg:justify-end">{event.circuito_trazado_url ? <img src={event.circuito_trazado_url} alt={`Trazado de ${event.circuito}`} className="race-track-float max-h-[32vh] w-full max-w-[620px] object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.9)] lg:max-h-[62vh]" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : <FlagIcon className="h-28 w-28 text-white/15"/>}</div>
      </div>
      <RegistrationPrompt registration={registrationPrompt}/>
      <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-racing-red to-transparent"/>
    </section>
  );
}

function RegistrationSection({ registration, details, images, activeImage, now, events }) {
  const open = registration.phase === 'open';
  const full = registration.phase === 'full';
  const enrollmentStarted = open || full;
  const includesLiveBroadcast = Number(registration.precio || 0) > 10000;
  const theme = registrationThemes[enrollmentStarted ? 'open' : 'upcoming'];
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
  const realOccupiedPlaces = Number(registration.inscriptos_actuales || 0);
  const remainingPlaces = Math.max(0, registrationLimit - realOccupiedPlaces);
  const lowAvailability = open && registrationLimit > 0 && realOccupiedPlaces / registrationLimit >= 0.75 && remainingPlaces > 0;
  const background = images[activeImage] || '';

  return (
    <section id={`inscripciones-campeonato-${registration.idcampeonato}`} className="race-hero relative min-h-[calc(100vh-4rem)] scroll-mt-16 overflow-hidden bg-black">
      {background ? <img key={background} src={background} alt="" className="registration-background-transition absolute inset-0 h-full w-full object-cover"/> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10"/><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20"/><div className="race-hero-grid absolute inset-0 opacity-25"/>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1600px] flex-col items-start justify-center px-5 pb-44 pt-12 sm:px-8 sm:pb-48 lg:px-14 xl:px-20">
        <div className="race-hero-content w-full max-w-3xl xl:max-w-4xl">
          <div className={`mb-5 inline-flex items-center gap-3 border-l-2 bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md ${theme.border}`}><span className={`h-2 w-2 animate-pulse rounded-full ${theme.dot}`}/>{full ? 'Inscripciones cerradas • Cupos completos' : open ? 'Inscripciones abiertas' : 'Próximo campeonato'}</div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm"><span className={`px-3 py-1.5 ${theme.chip}`}>Temporada {registration.temporada}</span><span className={`border bg-black/45 px-3 py-1.5 ${theme.borderSoft}`}>{registration.plataforma}</span></div>
          <h2 className="font-anton text-5xl uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">
            <span className="block">Nuevo</span>
            <span className="block">Campeonato</span>
          </h2>
          <div className="mt-4 flex items-center gap-4 sm:gap-5">{registration.categoria_logo ? <img src={registration.categoria_logo} alt="" className="h-14 w-16 shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.8)] sm:h-20 sm:w-24 lg:h-24 lg:w-28"/> : null}<p className={`font-racing text-4xl font-bold uppercase leading-none tracking-wide drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-5xl lg:text-6xl ${theme.text}`}>{registration.categoria}</p></div>
          <p className="mt-6 max-w-2xl text-sm text-gray-300">Setup: {registration.setup_detalle}</p>
          <div className="mt-4 flex flex-wrap gap-3">{includesLiveBroadcast ? <a href="https://www.youtube.com/@alPodioEnVivo" target="_blank" rel="noreferrer" className={`group flex items-center gap-3 overflow-hidden border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-black/70 ${theme.border}`}><PlayCircleIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><strong className="block whitespace-nowrap text-sm font-bold uppercase tracking-wide text-white">Transmisión en vivo</strong><span className="max-w-0 -translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-28 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:max-w-28 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"><span className={`block px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${enrollmentStarted ? 'bg-green-600 text-white' : 'bg-yellow-400 text-black'}`}>Ir al canal</span></span></a> : <div className="flex items-center gap-3 border-l-2 border-gray-500 bg-black/50 px-4 py-3 backdrop-blur-sm"><PlayCircleIcon className="h-6 w-6 shrink-0 text-gray-500"/><strong className="block text-sm font-bold uppercase tracking-wide text-gray-300">Sin transmisión en vivo</strong></div>}</div>
          <div className="mt-5 grid max-w-md grid-cols-2 gap-3"><div className={`flex items-center gap-3 border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm ${theme.border}`}><CalendarIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><div><strong className="block font-racing text-xl uppercase text-white">{registration.cantidad_fechas} Fechas</strong>{firstEvent ? <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-wider ${theme.textSoft}`}>Días {raceDay} · {formatTime(firstEvent.fecha)} HS</span> : null}</div></div><div className={`flex items-center gap-3 border-l-2 bg-black/50 px-4 py-3 backdrop-blur-sm ${theme.border}`}><UserGroupIcon className={`h-6 w-6 shrink-0 ${theme.text}`}/><div><strong className="block font-racing text-xl text-white">{enrollmentStarted ? registration.cupos_ocupados : Number(registration.preinscriptos || 0)}/{registration.limite_inscriptos}</strong><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{enrollmentStarted ? 'Inscriptos' : 'Pre-inscriptos'}</span></div></div></div>
          {open && lowAvailability ? <div className="mt-5 flex flex-wrap gap-3"><div className="cta-attention flex items-center gap-3 border border-yellow-300/70 bg-yellow-400 px-4 py-3 text-black shadow-[0_0_26px_rgba(250,204,21,0.35)]"><UserGroupIcon className="h-5 w-5 shrink-0"/><strong className="font-racing text-sm uppercase tracking-wide">Quedan solo {remainingPlaces} lugares</strong></div></div> : null}
          <div className="mt-7 flex flex-wrap items-start gap-4">{full ? <span className="inline-flex min-h-14 cursor-not-allowed items-center gap-3 border border-gray-500 bg-gray-800 px-6 py-3 font-racing text-sm font-bold uppercase text-gray-300"><UserGroupIcon className="h-5 w-5"/>Cupos completos</span> : <div className="flex flex-col items-start gap-2"><Link to={`/inscripcion?campeonato=${registration.idcampeonato}`} className={`group ${open ? 'cta-attention' : ''} ${theme.button} server-action-button relative inline-flex min-h-14 items-center gap-3 overflow-hidden border px-6 py-3 font-racing text-sm font-bold uppercase transition-transform hover:-translate-y-0.5 active:scale-95`}><span className="flex items-center gap-3 transition-all duration-300 group-hover:scale-95 group-hover:opacity-0 group-focus-visible:scale-95 group-focus-visible:opacity-0"><span>{open ? 'Inscripciones' : formatRegistrationOpening(registration.fecha_apertura, now)}</span><ArrowRightIcon className="h-5 w-5 shrink-0"/></span><span className="pointer-events-none absolute inset-0 flex scale-95 items-center justify-center gap-3 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100" aria-hidden="true"><span className="registration-info-flag server-join-flag h-7 w-9 shrink-0 border border-black/50"/><span className="text-sm font-bold uppercase">{open ? 'Inscribirse ya' : 'Ver información'}</span></span></Link>{open && closingNotice ? <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-green-200"><ClockIcon className="h-3.5 w-3.5 shrink-0 text-green-300"/><span>{closingNotice.label} <strong className="font-racing text-xs text-white">{closingNotice.value}</strong></span></div> : null}</div>}<div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Inscripción desde</p><p className={`font-racing text-3xl font-bold ${theme.text}`}>{formatPrice(registration.precio)}</p></div></div>
        </div>
        {nextEvent ? <aside className={`relative mt-7 ml-auto min-h-32 w-full max-w-lg overflow-hidden border bg-black text-left shadow-[0_18px_45px_rgba(0,0,0,0.55)] md:w-[27rem] lg:w-[28rem] 2xl:absolute 2xl:right-20 2xl:top-12 2xl:mt-0 ${theme.borderSoft}`}>{nextEvent.circuito_foto_url ? <img src={nextEvent.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : null}<div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15"/><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/20"/><div className="relative z-10 flex min-h-32 flex-col p-4"><div className="flex items-center justify-between gap-4"><p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text}`}>Próxima fecha</p><span className={`shrink-0 px-2.5 py-1 font-racing text-sm font-bold uppercase ${theme.chip}`}>Fecha {nextEvent.ronda}</span></div><div className="mt-auto"><div className="flex items-center gap-2.5"><CountryFlag country={nextEvent.pais} className="shrink-0 text-lg"/><h3 className="font-racing text-lg font-bold uppercase leading-tight text-white drop-shadow-lg">{nextEvent.circuito}{nextEvent.variante ? ` · ${nextEvent.variante}` : ''}</h3></div><div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs text-gray-200"><span className="flex items-center gap-1.5 capitalize"><CalendarIcon className={`h-4 w-4 ${theme.text}`}/>{formatCalendarDate(nextEvent.fecha, { weekday: 'long', day: '2-digit', month: 'long' })}</span><span className="flex items-center gap-1.5"><ClockIcon className={`h-4 w-4 ${theme.text}`}/>{formatTime(nextEvent.fecha)} HS</span></div></div></div></aside> : null}
      </div>
      {details?.autos?.length ? <div className="absolute bottom-7 left-1/2 z-20 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 text-center sm:bottom-9"><p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.28em] sm:text-xs ${theme.text}`}>Modelos disponibles</p><div className="scrollbar-hidden flex items-stretch justify-start gap-2 overflow-x-auto sm:justify-center sm:gap-3">{details.autos.map(car => <div key={car.id} title={`${car.marca} ${car.modelo}`} className="flex min-w-28 shrink-0 items-center justify-center gap-2 border border-white/15 bg-black/60 px-3 py-2 backdrop-blur-md sm:min-w-32">{car.imagen || car.logo ? <img src={car.imagen || car.logo} alt="" className="h-9 w-12 shrink-0 object-contain sm:h-11 sm:w-14"/> : null}<span className="text-left text-[10px] font-semibold uppercase leading-tight text-gray-200"><strong className="block text-white">{car.modelo}</strong><span className="text-gray-500">{car.marca}</span></span></div>)}</div></div> : null}
      <div className={`absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent to-transparent ${theme.divider}`}/>
    </section>
  );
}

function BroadcastSection({ broadcasts, now }) {
  const [selectedRound, setSelectedRound] = useState(null);
  const [roundMenuOpen, setRoundMenuOpen] = useState(false);
  const broadcast = broadcasts.find(item => String(item.ronda) === String(selectedRound)) || broadcasts[0];
  const age = getDaysAgoLabel(broadcast.fecha, now);

  const selectRound = round => {
    setSelectedRound(round);
    setRoundMenuOpen(false);
  };

  return (
    <section className="race-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black">
      <img key={broadcast.youtubeId} src={`https://i.ytimg.com/vi/${broadcast.youtubeId}/maxresdefault.jpg`} alt="" className="animate-fade-in absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-sm"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-violet-950/65"/><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/45"/><div className="race-hero-grid absolute inset-0 opacity-20"/>
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1600px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(300px,0.65fr)_minmax(520px,1.35fr)] lg:gap-16 lg:px-14 xl:gap-24 xl:px-20">
        <div key={`${broadcast.idcampeonato}-${broadcast.ronda}`} className="race-hero-content max-w-xl justify-self-start animate-fade-in">
          <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-violet-400 bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-400"/>Última transmisión</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200">
            <span className="bg-violet-600 px-3 py-1.5 text-white">{broadcast.categoria}</span>
            <span className="border border-violet-400/25 bg-black/50 px-3 py-1.5">Temporada {broadcast.temporada}</span>
            <div className="relative">
              <button type="button" onClick={() => setRoundMenuOpen(current => !current)} className="group inline-flex items-center gap-2 border border-violet-400/25 bg-black/50 px-3 py-1.5 transition hover:border-violet-300 hover:bg-violet-500/15" aria-expanded={roundMenuOpen} aria-haspopup="listbox">
                <span>FECHA {broadcast.ronda}</span>
                {broadcasts.length > 1 ? <ChevronDownIcon className={`h-3.5 w-3.5 text-violet-300 transition-transform duration-300 ${roundMenuOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}/> : null}
              </button>
              {roundMenuOpen && broadcasts.length > 1 ? <div className="animate-fade-in absolute left-0 top-full z-40 mt-2 min-w-full overflow-hidden border border-violet-400/30 bg-black/95 py-1 shadow-[0_12px_30px_rgba(76,29,149,0.55)] backdrop-blur-md" role="listbox" aria-label="Seleccionar fecha transmitida">{broadcasts.map(item => <button key={`${item.idcampeonato}-${item.ronda}`} type="button" onClick={() => selectRound(item.ronda)} className={`block w-full whitespace-nowrap px-4 py-2 text-left transition hover:bg-violet-600 hover:text-white ${String(item.ronda) === String(broadcast.ronda) ? 'bg-violet-500/20 text-violet-300' : 'text-gray-300'}`} role="option" aria-selected={String(item.ronda) === String(broadcast.ronda)}>FECHA {item.ronda}</button>)}</div> : null}
            </div>
          </div>
          <h2 className="mt-5 font-anton text-5xl uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">{broadcast.circuito}</h2>
          {broadcast.variante ? <p className="mt-2 font-racing text-2xl font-semibold uppercase text-violet-300">Variante {broadcast.variante}</p> : null}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-gray-300"><p className="flex items-center gap-2 capitalize"><CalendarIcon className="h-5 w-5 text-violet-400"/>{formatDate(broadcast.fecha)}</p>{age ? <span className="border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-300">{age}</span> : null}</div>
          <a href={broadcast.transmision} target="_blank" rel="noreferrer" className="server-action-button server-action-violet mt-7 inline-flex items-center gap-3 border border-violet-300 bg-violet-600 px-5 py-3 font-racing text-sm font-bold uppercase text-white shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-violet-500 active:scale-95"><PlayCircleIcon className="h-6 w-6"/>Ver en YouTube</a>
        </div>
        <div key={broadcast.youtubeId} className="race-hero-content w-full max-w-[820px] justify-self-end animate-fade-in overflow-hidden border border-violet-400/25 bg-black shadow-[0_25px_70px_rgba(76,29,149,0.38)]"><div className="aspect-video w-full"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${broadcast.youtubeId}?rel=0`} title={`Última transmisión: ${broadcast.categoria} en ${broadcast.circuito}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/></div></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent"/>
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

  const upcomingEvents = useMemo(() => getFeaturedUpcomingEvents(events, new Date(now)), [events, now]);
  const liveTimingEventIds = useMemo(() => new Set(getLiveTimingEvents(events, new Date(now)).map(event => `${event.idcampeonato}-${event.ronda}`)), [events, now]);
  const registrations = useMemo(() => registrationForms.map(item => ({ ...item, phase: getRegistrationPhase(item, now) })).filter(item => item.phase === 'open' || item.phase === 'full' || item.phase === 'upcoming').sort((a, b) => {
    const order = { open: 0, full: 1, upcoming: 2 };
    return order[a.phase] - order[b.phase] || (parseCalendarDate(a.fecha_apertura)?.getTime() || 0) - (parseCalendarDate(b.fecha_apertura)?.getTime() || 0);
  }), [registrationForms, now]);
  const openRegistration = registrations.find(item => item.phase === 'open') || null;
  const championshipBroadcasts = useMemo(() => {
    const pastBroadcasts = events
      .map(event => ({ ...event, youtubeId: getYouTubeVideoId(event.transmision) }))
      .filter(event => event.youtubeId && (parseCalendarDate(event.fecha)?.getTime() || 0) <= now)
      .sort((a, b) => (parseCalendarDate(b.fecha)?.getTime() || 0) - (parseCalendarDate(a.fecha)?.getTime() || 0));
    const latest = pastBroadcasts[0];
    return latest ? pastBroadcasts.filter(event => String(event.idcampeonato) === String(latest.idcampeonato)) : [];
  }, [events, now]);
  const championshipEvents = useMemo(() => events.filter(event => String(event.idcampeonato) === String(calendarEvent?.idcampeonato)).filter(event => getEventPhase(event, new Date(now)) !== 'expired').sort((a, b) => (parseCalendarDate(a.fecha)?.getTime() || 0) - (parseCalendarDate(b.fecha)?.getTime() || 0)), [calendarEvent?.idcampeonato, events, now]);
  const registrationIds = registrations.map(item => item.idcampeonato).join(',');

  useEffect(() => {
    Promise.all([eventsApi.getAll(), registrationFormsApi.getAll()]).then(([eventsResponse, formsResponse]) => { setEvents(eventsResponse.data.data || []); setRegistrationForms(formsResponse.data.data || []); }).catch(error => console.error('Error cargando el inicio:', error)).finally(() => setLoading(false));
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
      {!loading ? upcomingEvents.map((event, index) => <EventSection key={`${event.idcampeonato}-${event.ronda}`} event={event} now={now} onShowCalendar={setCalendarEvent} registrationPrompt={index === upcomingEvents.length - 1 ? openRegistration : null} showLiveTiming={liveTimingEventIds.has(`${event.idcampeonato}-${event.ronda}`)}/>) : null}
      {!loading ? registrations.map(registration => <RegistrationSection key={registration.idcampeonato} registration={registration} details={registrationDetails[registration.idcampeonato]} images={registrationImages[registration.idcampeonato] || []} activeImage={activeRegistrationImages[registration.idcampeonato] || 0} now={now} events={events}/>) : null}
      {!loading && championshipBroadcasts.length ? <BroadcastSection key={championshipBroadcasts[0].idcampeonato} broadcasts={championshipBroadcasts} now={now}/> : null}

      {calendarEvent ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setCalendarEvent(null); }} role="presentation"><section className="max-h-[85vh] w-full max-w-3xl overflow-hidden border border-racing-border bg-racing-gray shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="calendar-title"><header className="flex items-start justify-between gap-4 border-b border-racing-border p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">{calendarEvent.categoria} · Temporada {calendarEvent.temporada}</p><h2 id="calendar-title" className="mt-1 font-racing text-3xl font-bold">Próximas fechas</h2></div><button type="button" onClick={() => setCalendarEvent(null)} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-400 transition hover:border-racing-red hover:text-white" aria-label="Cerrar calendario"><XMarkIcon className="h-5 w-5"/></button></header><div className="max-h-[65vh] space-y-3 overflow-y-auto p-5 sm:p-6">{championshipEvents.map(event => <article key={`${event.idcampeonato}-${event.ronda}`} className="grid gap-4 border border-racing-border bg-racing-dark p-4 sm:grid-cols-[60px_1fr_auto] sm:items-center"><div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-500">Ronda</p><p className="font-racing text-3xl font-bold text-racing-red">{event.ronda}</p></div><div><h3 className="font-racing text-xl font-bold text-white">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400"><p className="flex items-center gap-2 capitalize"><CalendarIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p><p className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p></div><p className="mt-2 text-xs text-gray-500">{[event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ')}</p></div><div className="flex flex-wrap gap-2 sm:justify-end">{event.especial ? <span className="border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-xs font-bold uppercase text-yellow-300">{event.especialidad || 'Especial'}</span> : null}{event.coronacion ? <span className="border border-racing-red/30 bg-racing-red/10 px-2 py-1 text-xs font-bold uppercase text-racing-red">Coronación</span> : null}</div></article>)}</div></section></div> : null}
    </div>
  );
}
