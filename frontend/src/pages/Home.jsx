import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, TrophyIcon, CalendarIcon, UserGroupIcon, FlagIcon, MapPinIcon, ClockIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import EventCard from '../components/EventCard';
import ChampionshipCard from '../components/ChampionshipCard';
import { eventsApi, championshipsApi, driversApi, mediaApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';
import ServerJoinButton from '../components/ServerJoinButton';
import { getEventPhase, getWeeklyChampionshipEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';

const shuffle = items => [...items].sort(() => Math.random() - 0.5);

const formatDate = value => {
  if (!value) return 'Por confirmar';

  return formatCalendarDate(value, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatTime = value => {
  if (!value) return '';

  return formatCalendarDate(value, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
};

const getCountdown = (value, now) => {
  const eventDate = parseCalendarDate(value);
  if (!eventDate) return null;

  const difference = eventDate.getTime() - now;
  if (difference <= 0) return { started: true, days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    started: false,
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference / 3600000) % 24),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(null);
  const [latestChampionships, setLatestChampionships] = useState([]);
  const [driversCount, setDriversCount] = useState(0);
  const [carouselImages, setCarouselImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const weeklyEvents = useMemo(() => getWeeklyChampionshipEvents(allEvents, new Date(now)), [allEvents, now]);
  const nextEvent = weeklyEvents.find(event => event.idcampeonato === selectedChampionshipId)
    || weeklyEvents[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, champsRes, driversRes] = await Promise.all([
          eventsApi.getAll(),
          championshipsApi.getAll(),
          driversApi.getAll(),
        ]);

        const loadedEvents = eventsRes.data.data ?? [];
        setAllEvents(loadedEvents);
        setUpcomingEvents(loadedEvents.filter(event => event.status === 'upcoming').slice(0, 3));
        setLatestChampionships(champsRes.data.data?.slice(0, 3) ?? []);
        setDriversCount(driversRes.data.total ?? 0);
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (weeklyEvents.length && !weeklyEvents.some(event => event.idcampeonato === selectedChampionshipId)) {
      setSelectedChampionshipId(weeklyEvents[0].idcampeonato);
    }
  }, [selectedChampionshipId, weeklyEvents]);

  useEffect(() => {
    const fetchCarouselImages = async () => {
      if (!nextEvent?.categoria || !nextEvent?.temporada) {
        setCarouselImages([]);
        return;
      }

      try {
        const res = await mediaApi.getChampionshipImages({
          categoria: nextEvent.categoria,
          temporada: nextEvent.temporada,
        });
        setCarouselImages(shuffle(res.data.data ?? []));
        setActiveImage(0);
      } catch (err) {
        console.error('Error cargando imágenes del campeonato:', err);
        setCarouselImages([]);
      }
    };

    fetchCarouselImages();
  }, [nextEvent?.categoria, nextEvent?.temporada]);

  useEffect(() => {
    if (carouselImages.length < 2) return undefined;

    const interval = window.setInterval(() => {
      setActiveImage(current => (current + 1) % carouselImages.length);
    }, 5500);

    return () => window.clearInterval(interval);
  }, [carouselImages.length]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const heroBackground = nextEvent?.circuito_foto_url || carouselImages[activeImage] || '';
  const location = nextEvent
    ? [nextEvent.localidad, nextEvent.provincia, getCountryName(nextEvent.pais)].filter(Boolean).join(', ')
    : '';
  const countdown = getCountdown(nextEvent?.fecha, now);
  const eventPhase = getEventPhase(nextEvent, new Date(now));
  const countdownParts = countdown ? [
    { value: countdown.days, label: 'Días' },
    { value: countdown.hours, label: 'Horas' },
    { value: countdown.minutes, label: 'Minutos' },
    { value: countdown.seconds, label: 'Segundos' },
  ] : [];

  const stats = useMemo(() => [
    { icon: TrophyIcon, value: latestChampionships.length, label: 'Campeonatos' },
    { icon: UserGroupIcon, value: driversCount, label: 'Pilotos' },
    { icon: CalendarIcon, value: upcomingEvents.length, label: 'Próximas fechas' },
    { icon: FlagIcon, value: 'CADPO', label: 'Liga' },
  ], [driversCount, latestChampionships.length, upcomingEvents.length]);

  return (
    <div className="animate-fade-in">
      <section className="race-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black">
        {heroBackground && (
          <img
            key={heroBackground}
            src={heroBackground}
            alt=""
            className="race-hero-background absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/35" />
        <div className="race-hero-grid absolute inset-0 opacity-25" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1600px] grid-cols-1 items-center gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-10 lg:px-14 lg:py-12 xl:px-20">
          <div className="race-hero-content order-2 max-w-4xl lg:order-1">
            {weeklyEvents.length > 1 && (
              <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                {weeklyEvents.map(event => (
                  <button
                    key={event.idcampeonato}
                    type="button"
                    onClick={() => setSelectedChampionshipId(event.idcampeonato)}
                    className={`shrink-0 border px-3 py-1.5 font-racing text-[11px] font-bold uppercase transition-colors ${nextEvent?.idcampeonato === event.idcampeonato ? 'border-racing-red bg-racing-red text-white' : 'border-white/25 bg-black/60 text-gray-300 hover:border-racing-red'}`}
                  >
                    {event.categoria} · T{event.temporada}
                  </button>
                ))}
              </div>
            )}
            <div className="mb-5 inline-flex items-center gap-3 border-l-2 border-racing-red bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md">
              <span className="w-2 h-2 bg-racing-red rounded-full animate-pulse" />
              Próxima fecha
            </div>

            {nextEvent ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-200 sm:text-sm">
                  <span className="bg-racing-red px-3 py-1.5 text-white">{nextEvent.categoria}</span>
                  <span className="border border-white/25 bg-black/45 px-3 py-1.5">Temporada {nextEvent.temporada}</span>
                  <span className="border border-white/25 bg-black/45 px-3 py-1.5">Ronda {nextEvent.ronda}</span>
                </div>

                <h1 className="font-racing text-5xl font-bold uppercase leading-[0.92] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">
                  {nextEvent.circuito}
                </h1>
                {nextEvent.variante && (
                  <p className="mt-2 font-racing text-2xl font-semibold uppercase text-racing-red sm:text-3xl">Variante {nextEvent.variante}</p>
                )}

                <div className="mt-6 flex flex-col gap-3 text-gray-100 sm:flex-row sm:flex-wrap sm:gap-6">
                  <p className="flex items-center gap-2 text-sm font-medium capitalize sm:text-base">
                    <CalendarIcon className="h-5 w-5 shrink-0 text-racing-red" /> {formatDate(nextEvent.fecha)}
                  </p>
                  <p className="flex items-center gap-2 text-sm font-medium sm:text-base">
                    <ClockIcon className="h-5 w-5 shrink-0 text-racing-red" /> {formatTime(nextEvent.fecha)} H
                  </p>
                  {location && (
                    <p className="flex items-center gap-2 text-sm text-gray-300 sm:text-base">
                      <CountryFlag country={nextEvent.pais} className="text-lg" />
                      <MapPinIcon className="h-5 w-5 shrink-0 text-racing-red" /> {location}
                    </p>
                  )}
                </div>

                <div className="mt-8 max-w-3xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                    {eventPhase === 'active' ? 'La actividad ya comenzó' : 'Faltan para el inicio'}
                  </p>
                  {eventPhase === 'active' ? (
                    <div className="inline-flex items-center gap-3 border border-racing-red/60 bg-racing-red/15 px-5 py-4 font-racing text-2xl font-bold uppercase text-white backdrop-blur-md">
                      <FlagIcon className="h-7 w-7 text-racing-red" /> Actividad en curso
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {countdownParts.map(part => (
                        <div key={part.label} className="countdown-block relative overflow-hidden border border-white/20 bg-black/55 px-2 py-3 text-center backdrop-blur-md sm:px-4 sm:py-4">
                          <span className="block font-racing text-3xl font-bold tabular-nums text-white sm:text-5xl">{String(part.value).padStart(2, '0')}</span>
                          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-xs">{part.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <ServerJoinButton href={nextEvent.servidor} />
                  {nextEvent.transmision ? (
                    <a
                      href={nextEvent.transmision}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary px-7 py-3.5"
                    >
                      <PlayCircleIcon className="h-5 w-5" />
                      Ver transmisión
                    </a>
                  ) : null}
                  <Link to="/eventos" className="btn-secondary px-7 py-3.5">Ver calendario <ArrowRightIcon className="h-4 w-4" /></Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-racing text-5xl font-bold uppercase text-white sm:text-7xl">No hay próximas fechas aún</h1>
                <p className="mt-5 max-w-xl text-lg text-gray-300">Cuando se cargue una nueva fecha en el calendario aparecerá automáticamente en este espacio.</p>
              </>
            )}
          </div>

          <div className="order-1 flex min-h-[220px] items-center justify-center lg:order-2 lg:min-h-[520px]">
            {nextEvent?.circuito_trazado_url ? (
              <img
                src={nextEvent.circuito_trazado_url}
                alt={`Trazado de ${nextEvent.circuito}${nextEvent.variante ? `, variante ${nextEvent.variante}` : ''}`}
                className="race-track-float max-h-[32vh] w-full max-w-[620px] object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.9)] lg:max-h-[62vh]"
                onError={event => { event.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <FlagIcon className="h-28 w-28 text-white/15" />
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-racing-red to-transparent" />
      </section>

      <section className="bg-racing-gray border-y border-racing-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center group">
                <Icon className="w-7 h-7 text-racing-red mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
                <div className="font-racing text-4xl font-bold gradient-text mb-1">{value}</div>
                <div className="text-gray-400 text-sm uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Calendario</p>
            <h2 className="section-title">Próximas <span className="gradient-text">Fechas</span></h2>
          </div>
          <Link to="/eventos" className="btn-secondary !py-2 !px-4 !text-xs hidden sm:flex">
            Ver todas <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="card-glass p-12 text-center text-gray-400">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay fechas próximas por el momento.</p>
          </div>
        )}
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-racing-border">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Historia</p>
            <h2 className="section-title">Últimos <span className="gradient-text">Campeonatos</span></h2>
          </div>
          <Link to="/campeonatos" className="btn-secondary !py-2 !px-4 !text-xs hidden sm:flex">
            Ver todos <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : latestChampionships.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestChampionships.map(champ => <ChampionshipCard key={champ.id} championship={champ} />)}
          </div>
        ) : (
          <div className="card-glass p-12 text-center text-gray-400">
            <TrophyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay campeonatos registrados aún.</p>
          </div>
        )}
      </section>
    </div>
  );
}
