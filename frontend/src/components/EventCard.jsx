import { Link } from 'react-router-dom';
import { CountryFlag } from './CountryFlag';
import { getCountryName } from '../data/countries';
import { CalendarIcon, ClockIcon, MapPinIcon, TrophyIcon, FlagIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { formatCalendarDate } from '../utils/calendarDate';

const statusConfig = {
  upcoming: { label: 'Próxima', className: 'badge-upcoming' },
  completed: { label: 'Finalizada', className: 'badge-completed' },
};

const formatDate = value => {
  if (!value) return 'Por confirmar';

  const formatted = formatCalendarDate(value, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return `${formatted} H`;
};

export default function EventCard({ event, featured = false, showNearbyActions = false, showLiveTiming = false }) {
  const cfg = statusConfig[event.status] || statusConfig.upcoming;
  const title = `${event.categoria || 'Categoría'} · Temporada ${event.temporada || '-'}`;
  const location = [event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ');

  return (
    <article className={`card-glass group relative flex min-h-[25rem] animate-slide-up flex-col overflow-hidden bg-black ${featured ? 'md:col-span-2 lg:col-span-3 lg:min-h-[28rem]' : ''}`}>
      {event.circuito_foto_url ? (
        <img
          src={event.circuito_foto_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-[1.025] group-hover:opacity-70"
          onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/45" />

      <div className={`relative z-10 flex h-full flex-1 flex-col gap-5 p-5 sm:p-6 ${featured ? 'lg:p-9' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {event.categoria_logo ? (
              <div className={`flex shrink-0 items-center justify-center border border-white/15 bg-black/55 p-2 backdrop-blur-sm ${featured ? 'h-16 w-20 sm:h-20 sm:w-24' : 'h-14 w-16'}`}>
                <img src={event.categoria_logo} alt={`Logo de ${event.categoria}`} className="h-full w-full object-contain" />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-racing-red sm:text-xs">
                Campeonato {event.anio}
              </p>
              <h3 className={`font-racing font-bold uppercase leading-tight text-white transition-colors duration-200 group-hover:text-racing-red ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
                {title}
              </h3>
            </div>
          </div>
          <span className={`${cfg.className} shrink-0`}>{cfg.label}</span>
        </div>

        <div className="mt-auto max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="bg-racing-red px-3 py-1 font-racing text-sm font-bold uppercase text-white">Fecha {event.ronda}</span>
            {event.especial ? (
              <span className="inline-flex items-center gap-1 border border-racing-red/40 bg-black/60 px-2 py-1 text-xs text-racing-highlight backdrop-blur-sm">
                <FlagIcon className="h-3 w-3" />
                {event.especialidad || 'Especial'}
              </span>
            ) : null}
            {event.coronacion ? (
              <span className="inline-flex items-center gap-1 border border-yellow-400/40 bg-black/60 px-2 py-1 text-xs text-yellow-300 backdrop-blur-sm">
                <TrophyIcon className="h-3 w-3" />
                Coronación
              </span>
            ) : null}
          </div>
          <div className="flex items-start gap-2">
            <CountryFlag country={event.pais} className={`shrink-0 ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`} />
            <h4 className={`font-racing font-bold uppercase leading-none text-white drop-shadow-lg ${featured ? 'text-3xl sm:text-5xl' : 'text-2xl'}`}>
              {event.circuito}{event.variante ? ` · ${event.variante}` : ''}
            </h4>
          </div>
        </div>

        <div className={`border-t border-white/15 pt-4 ${featured ? 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' : ''}`}>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2 text-gray-200">
              <CalendarIcon className="h-4 w-4 shrink-0 text-racing-red" />
              <span>{formatDate(event.fecha)}</span>
            </div>
            {location ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MapPinIcon className="h-4 w-4 shrink-0 text-racing-red" />
                <span>{location}</span>
              </div>
            ) : null}
          </div>

          <div className={`grid gap-2 ${featured ? 'sm:min-w-56' : 'mt-4'}`}>
            {event.transmision ? (
              <a href={event.transmision} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
                <PlayCircleIcon className="h-5 w-5" />
                Ver transmisión
              </a>
            ) : null}
            {showNearbyActions && showLiveTiming ? (
              <Link to="/tiempos-en-vivo" className="btn-secondary w-full justify-center bg-black/50 backdrop-blur-sm">
                <ClockIcon className="h-5 w-5" />
                Tiempos online
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
