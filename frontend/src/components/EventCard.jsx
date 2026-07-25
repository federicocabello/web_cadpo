import { Link } from 'react-router-dom';
import { CountryFlag } from './CountryFlag';
import { getCountryName } from '../data/countries';
import { CalendarIcon, MapPinIcon, TrophyIcon, FlagIcon, PlayCircleIcon } from '@heroicons/react/24/outline';

const statusConfig = {
  upcoming: { label: 'Próxima', className: 'badge-upcoming' },
  completed: { label: 'Finalizada', className: 'badge-completed' },
};

const formatDate = value => {
  if (!value) return 'Por confirmar';

  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function EventCard({ event }) {
  const cfg = statusConfig[event.status] || statusConfig.upcoming;
  const title = `${event.categoria || 'Categoría'} T${event.temporada || '-'} - Ronda ${event.ronda}`;
  const location = [event.localidad, event.provincia, getCountryName(event.pais)].filter(Boolean).join(', ');

  return (
    <article className="card-glass p-6 flex flex-col gap-4 animate-slide-up group">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-racing-red font-semibold mb-1">
            Campeonato {event.anio}
          </p>
          <h3 className="font-racing text-xl font-bold text-white group-hover:text-racing-red transition-colors duration-200 leading-tight">
            {title}
          </h3>
        </div>
        <span className={cfg.className}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <CalendarIcon className="w-4 h-4 text-racing-red flex-shrink-0" />
          <span>{formatDate(event.fecha)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <MapPinIcon className="w-4 h-4 text-racing-red flex-shrink-0" />
          <CountryFlag country={event.pais} className="text-base" />
          <span className="truncate">{event.circuito}</span>
        </div>
        {location && (
          <div className="text-xs text-gray-500 pl-6">{location}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {event.especial ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-racing-red/40 bg-racing-red/10 px-2 py-1 text-xs text-racing-highlight">
            <FlagIcon className="w-3 h-3" />
            {event.especialidad || 'Especial'}
          </span>
        ) : null}
        {event.coronacion ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-racing-red/40 bg-racing-red/10 px-2 py-1 text-xs text-racing-highlight">
            <TrophyIcon className="w-3 h-3" />
            Coronación
          </span>
        ) : null}
      </div>

      <div className="mt-auto grid gap-2">
        {event.transmision ? (
          <a href={event.transmision} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
            <PlayCircleIcon className="h-5 w-5" />
            Ver transmisión
          </a>
        ) : null}
        {event.status === 'upcoming' ? (
          <Link to="/inscripcion" className="btn-secondary w-full justify-center">
            Inscribirme
          </Link>
        ) : null}
      </div>
    </article>
  );
}
