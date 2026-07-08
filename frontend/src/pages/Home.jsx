import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, TrophyIcon, CalendarIcon, UserGroupIcon, FlagIcon, MapPinIcon } from '@heroicons/react/24/outline';
import EventCard from '../components/EventCard';
import ChampionshipCard from '../components/ChampionshipCard';
import { eventsApi, championshipsApi, driversApi, mediaApi } from '../services/api';

const shuffle = items => [...items].sort(() => Math.random() - 0.5);

const formatDate = value => {
  if (!value) return 'Por confirmar';

  return new Date(value).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatTime = value => {
  if (!value) return '';

  return new Date(value).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [latestChampionships, setLatestChampionships] = useState([]);
  const [driversCount, setDriversCount] = useState(0);
  const [carouselImages, setCarouselImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);

  const nextEvent = upcomingEvents[0];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, champsRes, driversRes] = await Promise.all([
          eventsApi.getUpcoming(),
          championshipsApi.getAll(),
          driversApi.getAll(),
        ]);

        setUpcomingEvents(eventsRes.data.data?.slice(0, 3) ?? []);
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
        console.error('Error cargando imagenes del campeonato:', err);
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

  const heroBackground = carouselImages[activeImage] || nextEvent?.circuito_foto_url || '';
  const nextEventTitle = nextEvent
    ? `${nextEvent.categoria} - Temporada ${nextEvent.temporada}`
    : 'Liga CADPO';
  const location = nextEvent
    ? [nextEvent.localidad, nextEvent.provincia, nextEvent.pais].filter(Boolean).join(', ')
    : '';

  const stats = useMemo(() => [
    { icon: TrophyIcon, value: latestChampionships.length, label: 'Campeonatos' },
    { icon: UserGroupIcon, value: driversCount, label: 'Pilotos' },
    { icon: CalendarIcon, value: upcomingEvents.length, label: 'Proximas fechas' },
    { icon: FlagIcon, value: 'CADPO', label: 'Liga' },
  ], [driversCount, latestChampionships.length, upcomingEvents.length]);

  return (
    <div className="animate-fade-in">
      <section className="relative min-h-[86vh] overflow-hidden bg-racing-dark">
        {heroBackground && (
          <div
            key={heroBackground}
            className="absolute inset-0 bg-cover bg-center opacity-45 transition-opacity duration-700"
            style={{ backgroundImage: `url(${heroBackground})` }}
          />
        )}
        <div className="absolute inset-0 hero-pattern opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-racing-dark via-racing-dark/85 to-racing-dark/45" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-racing-dark to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[86vh] grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-center py-14 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-racing-red/15 border border-racing-red/35 rounded-lg px-4 py-2 mb-6 text-racing-red text-xs font-semibold uppercase tracking-widest">
              <span className="w-2 h-2 bg-racing-red rounded-full animate-pulse" />
              PROXIMA FECHA
            </div>

            <img
              src="/logo.png"
              alt="Logo CADPO"
              className="mb-6 h-20 w-20 sm:h-24 sm:w-24 object-contain"
              onError={event => { event.currentTarget.style.display = 'none'; }}
            />

            <h1 className="section-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-5 leading-none text-shadow-red">
              {nextEvent ? `Ronda ${nextEvent.ronda}` : 'LIGA'} <span className="gradient-text">CADPO</span>
            </h1>

            <p className="font-racing text-2xl sm:text-3xl text-white mb-4">
              {nextEventTitle}
            </p>

            {nextEvent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 max-w-2xl">
                <div className="bg-racing-card/80 border border-racing-border rounded-lg px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Fecha</p>
                  <p className="text-gray-100 font-medium capitalize">{formatDate(nextEvent.fecha)}</p>
                </div>
                <div className="bg-racing-card/80 border border-racing-border rounded-lg px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Hora</p>
                  <p className="text-gray-100 font-medium">{formatTime(nextEvent.fecha)} hs</p>
                </div>
                <div className="bg-racing-card/80 border border-racing-border rounded-lg px-4 py-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Circuito</p>
                  <p className="text-gray-100 font-medium flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-racing-red" />
                    {nextEvent.circuito}
                  </p>
                  {location && <p className="text-gray-500 text-sm mt-1">{location}</p>}
                </div>
              </div>
            ) : (
              <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed">
                Cuando cargues una fecha futura en calendario, este inicio va a mostrar automaticamente la proxima carrera.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/eventos" className="btn-primary text-base px-8 py-4">
                Ver calendario
              </Link>
              <Link to="/campeonatos" className="btn-secondary text-base px-8 py-4">
                Campeonatos
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-lg border border-racing-border bg-racing-card/70 min-h-[300px] sm:min-h-[360px]">
              {nextEvent?.circuito_foto_url && (
                <img
                  src={nextEvent.circuito_foto_url}
                  alt={`Foto de ${nextEvent.circuito}`}
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                  onError={event => { event.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-racing-dark via-racing-dark/45 to-racing-dark/10" />
              {nextEvent?.circuito_trazado_url && (
                <img
                  src={nextEvent.circuito_trazado_url}
                  alt={`Trazado de ${nextEvent.circuito}`}
                  className="relative z-10 h-full w-full object-contain p-8 sm:p-10 drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]"
                  onError={event => { event.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="absolute left-5 right-5 bottom-5 z-20">
                <p className="text-xs uppercase tracking-widest text-racing-red font-semibold mb-1">Circuito</p>
                <p className="font-racing text-3xl font-bold text-white">{nextEvent?.circuito || 'Por confirmar'}</p>
              </div>
            </div>
            {nextEvent?.campeonato_media_path && (
              <p className="mt-3 text-xs text-gray-500">
                Imagenes del carrusel: {nextEvent.campeonato_media_path}
              </p>
            )}
          </div>
        </div>
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
            <h2 className="section-title">Proximas <span className="gradient-text">Fechas</span></h2>
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
            <p>No hay fechas proximas por el momento.</p>
          </div>
        )}
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-racing-border">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Historia</p>
            <h2 className="section-title">Ultimos <span className="gradient-text">Campeonatos</span></h2>
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
            <p>No hay campeonatos registrados aun.</p>
          </div>
        )}
      </section>
    </div>
  );
}
