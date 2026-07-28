import { Link } from 'react-router-dom';
import { TrophyIcon, CalendarIcon, FlagIcon, UserIcon } from '@heroicons/react/24/outline';
import { getDatabaseDateParts } from '../utils/calendarDate';

const statusConfig = {
  upcoming: { label: 'Próximo', className: 'badge-upcoming' },
  active: { label: 'En curso', className: 'badge-active' },
  completed: { label: 'Finalizado', className: 'badge-completed' },
};

const formatYear = value => {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}$/.test(str)) return Number(str);

  return getDatabaseDateParts(str)?.year || null;
};

export default function ChampionshipCard({ championship }) {
  const cfg = statusConfig[championship.status] || statusConfig.completed;
  const years = [formatYear(championship.primera_fecha), formatYear(championship.ultima_fecha)]
    .filter(Boolean);

  return (
    <article className="card-glass p-6 flex flex-col gap-4 animate-slide-up group relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-racing opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrophyIcon className="w-5 h-5 text-racing-red" />
            <span className="text-racing-red font-racing font-bold text-lg">
              {championship.anio}
            </span>
          </div>
          <h3 className="font-racing text-xl font-bold text-white group-hover:text-racing-red transition-colors duration-200">
            {championship.categoria} - Temporada {championship.temporada}
          </h3>
        </div>
        <span className={cfg.className}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <FlagIcon className="w-4 h-4 text-racing-red" />
          <span>{championship.rondas || 0} fechas</span>
        </div>
        {years.length > 0 && (
          <div className="flex items-center gap-2 text-gray-300">
            <CalendarIcon className="w-4 h-4 text-racing-red" />
            <span>{years.length === 2 ? `${years[0]} - ${years[1]}` : years[0]}</span>
          </div>
        )}
      </div>

      {championship.campeon_nombre && (
        <div className="flex items-center gap-2 bg-racing-red/10 border border-racing-red/25 rounded-lg px-4 py-2">
          <UserIcon className="w-4 h-4 text-racing-red" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Campeón</p>
            <p className="text-racing-highlight font-racing font-bold">{championship.campeon_nombre}</p>
          </div>
        </div>
      )}

      {championship.reglamento && (
        <a href={championship.reglamento} className="btn-secondary text-center text-xs justify-center mt-auto" target="_blank" rel="noreferrer">
          Ver reglamento
        </a>
      )}
      {!championship.reglamento && (
        <Link to="/campeonatos" className="btn-secondary text-center text-xs justify-center mt-auto">
          Ver campeonato
        </Link>
      )}
    </article>
  );
}
