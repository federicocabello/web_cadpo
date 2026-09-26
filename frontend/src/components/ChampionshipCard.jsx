import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  DocumentTextIcon,
  FlagIcon,
  TrophyIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  registration: { label: 'Inscripciones abiertas', className: 'inline-flex shrink-0 items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300' },
  upcoming: { label: 'Próximo', className: 'badge-upcoming shrink-0' },
  active: { label: 'En curso', className: 'badge-active shrink-0' },
  completed: { label: 'Finalizado', className: 'badge-completed shrink-0' },
};

export default function ChampionshipCard({ championship, wide = false }) {
  const displayStatus = championship.displayStatus || championship.status;
  const cfg = statusConfig[displayStatus] || statusConfig.completed;

  return (
    <article className={`card-glass group relative flex animate-slide-up flex-col gap-5 overflow-hidden p-5 sm:p-6 ${wide ? 'lg:flex-row lg:items-center lg:gap-8 lg:p-8' : ''}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-racing opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

      <div className={`min-w-0 flex-1 ${wide ? 'lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(12rem,0.7fr)] lg:items-center lg:gap-x-10' : ''}`}>
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-start gap-3">
          {!wide && championship.categoria_logo ? (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-racing-border bg-black/60 p-2">
              <img src={championship.categoria_logo} alt={`Logo de ${championship.categoria}`} className="h-full w-full object-contain" />
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TrophyIcon className="w-5 h-5 text-racing-red" />
              <span className="text-racing-red font-racing font-bold text-lg">
                {championship.anio}
              </span>
            </div>
            <h3 className="font-racing text-xl font-bold text-white group-hover:text-racing-red transition-colors duration-200">
              {wide ? `Temporada ${championship.temporada}` : `${championship.categoria} - Temporada ${championship.temporada}`}
            </h3>
          </div>
        </div>
        <span className={cfg.className}>{cfg.label}</span>
      </div>

      <div className={`grid grid-cols-1 gap-2 text-sm ${wide ? 'mt-4 border-t border-white/10 pt-4 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0' : 'mt-4'}`}>
        <div className="flex items-center gap-2 text-gray-300">
          <FlagIcon className="w-4 h-4 text-racing-red" />
          <span>{championship.rondas || 0} fechas</span>
        </div>
      </div>

      {championship.campeon_nombre && (
        <div className={`flex items-center gap-2 bg-racing-red/10 border border-racing-red/25 rounded-lg px-4 py-2 ${wide ? 'mt-4 lg:col-span-2' : 'mt-4'}`}>
          <UserIcon className="w-4 h-4 text-racing-red" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Campeón</p>
            <p className="text-racing-highlight font-racing font-bold">{championship.campeon_nombre}</p>
          </div>
        </div>
      )}
      </div>

      <div className={`mt-auto grid gap-2 ${wide ? 'lg:mt-0 lg:w-64 lg:shrink-0' : ''}`}>
        {championship.hasRegistrationForm ? (
          <Link
            to={`/inscripcion?campeonato=${championship.id}`}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 font-racing text-xs font-bold uppercase tracking-widest transition-all ${championship.registrationPhase === 'open' ? 'border-emerald-400/50 bg-emerald-500 text-black hover:bg-emerald-300 hover:shadow-[0_0_24px_rgba(52,211,153,0.25)]' : 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:border-amber-300 hover:bg-amber-400 hover:text-black'}`}
          >
            {championship.registrationPhase === 'open' ? 'Inscribirse ahora' : 'Ver información'}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ) : null}

        <div className={`grid gap-2 ${wide ? '' : 'sm:grid-cols-2'}`}>
          <Link to={`/resultados?campeonato=${championship.id}`} className="btn-primary justify-center text-center text-xs">
            Ver resultados
          </Link>
          {championship.reglamento ? (
            <a
              href={championship.reglamento}
              className="btn-secondary justify-center border-amber-400/40 text-center text-xs text-amber-200 hover:border-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
              target="_blank"
              rel="noreferrer"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Ver reglamento
            </a>
          ) : (
            <span className="flex items-center justify-center gap-2 rounded-lg border border-racing-border px-4 py-3 text-center font-racing text-xs font-semibold uppercase tracking-wider text-gray-600">
              <DocumentTextIcon className="h-4 w-4" />
              Sin reglamento
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
