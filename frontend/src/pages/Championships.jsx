import { useEffect, useMemo, useState } from 'react';
import {
  CheckBadgeIcon,
  ChevronDownIcon,
  ClockIcon,
  FireIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  TrophyIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import ChampionshipCard from '../components/ChampionshipCard';
import { championshipsApi, registrationFormsApi } from '../services/api';
import { getDatabaseDateParts } from '../utils/calendarDate';

const PAGE_SIZE = 10;

const sectionConfig = {
  registration: {
    title: 'Inscripciones abiertas',
    description: 'Campeonatos en los que podés reservar tu lugar ahora.',
    Icon: TicketIcon,
    accent: 'text-emerald-300',
    border: 'border-emerald-400/30',
    background: 'bg-emerald-500/5',
  },
  active: {
    title: 'Campeonatos en curso',
    description: 'Temporadas que ya comenzaron y se están disputando.',
    Icon: FireIcon,
    accent: 'text-red-300',
    border: 'border-red-400/30',
    background: 'bg-red-500/5',
  },
  upcoming: {
    title: 'Próximos campeonatos',
    description: 'Campeonatos anunciados que todavía no comenzaron.',
    Icon: ClockIcon,
    accent: 'text-amber-300',
    border: 'border-amber-400/30',
    background: 'bg-amber-500/5',
  },
  completed: {
    title: 'Campeonatos finalizados',
    description: 'Historial de temporadas cerradas, de la más reciente a la más antigua.',
    Icon: CheckBadgeIcon,
    accent: 'text-gray-300',
    border: 'border-white/15',
    background: 'bg-white/[0.025]',
  },
};

const sectionOrder = ['registration', 'active', 'upcoming', 'completed'];

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getSortValue = championship => {
  const parts = getDatabaseDateParts(championship.ultima_fecha || championship.primera_fecha);
  if (parts) {
    return Number(
      `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`,
    );
  }

  return Number(championship.anio || 0) * 10000 + Number(championship.id || 0);
};

const getDisplayStatus = (championship, registrationPhase) => {
  if (registrationPhase === 'open') return 'registration';
  if (championship.status === 'active') return 'active';
  if (championship.status === 'completed') return 'completed';
  return 'upcoming';
};

function ChampionshipSection({ status, championships }) {
  const [expandedCategories, setExpandedCategories] = useState({});
  if (!championships.length) return null;

  const config = sectionConfig[status];
  const { Icon } = config;
  const categories = [...championships.reduce((groups, championship) => {
    const key = String(championship.idcategoria || championship.categoria || 'sin-categoria');
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: championship.categoria || 'Sin categoría',
        logo: championship.categoria_logo,
        championships: [],
      });
    }
    groups.get(key).championships.push(championship);
    return groups;
  }, new Map()).values()];

  return (
    <section className={`border ${config.border} ${config.background} p-4 sm:p-6`}>
      <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={`mb-2 flex items-center gap-2 ${config.accent}`}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">Estado del campeonato</span>
          </div>
          <h2 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">{config.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{config.description}</p>
        </div>
        <span className={`font-racing text-sm font-bold uppercase ${config.accent}`}>
          {championships.length} campeonato{championships.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-8">
        {categories.map(category => (
          <div key={category.id}>
            <button
              type="button"
              onClick={() => setExpandedCategories(current => ({
                ...current,
                [category.id]: !current[category.id],
              }))}
              className={`flex w-full items-center justify-between gap-4 border-l-2 bg-black/20 px-4 py-4 text-left transition-colors duration-300 hover:bg-white/[0.055] ${expandedCategories[category.id] ? `${config.border} bg-white/[0.04]` : 'border-white/20'}`}
              aria-expanded={Boolean(expandedCategories[category.id])}
            >
              <span className="flex min-w-0 items-center gap-3">
                {category.logo ? <img src={category.logo} alt="" className="h-11 w-16 shrink-0 object-contain" /> : null}
                <span className="min-w-0">
                  <span className="block truncate font-racing text-xl font-bold uppercase text-white">{category.name}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {category.championships.length} temporada{category.championships.length === 1 ? '' : 's'}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="hidden sm:inline">{expandedCategories[category.id] ? 'Ocultar' : 'Ver temporadas'}</span>
                <ChevronDownIcon className={`h-5 w-5 transition-transform duration-500 ease-in-out ${expandedCategories[category.id] ? 'rotate-180' : 'rotate-0'}`} />
              </span>
            </button>
            <div className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-in-out ${expandedCategories[category.id] ? 'mt-5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}>
              <div className="min-h-0 overflow-hidden">
                <div className={`grid gap-5 ${status === 'completed' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                  {category.championships.map(championship => (
                    <ChampionshipCard
                      key={championship.id}
                      championship={championship}
                      wide={status !== 'completed'}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Championships({ initialStatus = '' }) {
  const [championships, setChampionships] = useState([]);
  const [registrationPhases, setRegistrationPhases] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchChampionships = async () => {
      setLoading(true);
      try {
        const [championshipResult, formsResult] = await Promise.allSettled([
          championshipsApi.getAll(),
          registrationFormsApi.getAll(),
        ]);

        if (championshipResult.status === 'rejected') throw championshipResult.reason;
        setChampionships(championshipResult.value.data.data ?? []);

        if (formsResult.status === 'fulfilled') {
          setRegistrationPhases(new Map(
            (formsResult.value.data.data ?? []).map(form => [Number(form.idcampeonato), form.phase]),
          ));
        } else {
          console.error(formsResult.reason);
          setRegistrationPhases(new Map());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchChampionships();
  }, []);

  const filteredChampionships = useMemo(() => {
    const term = normalize(search.trim());

    return championships
      .map(championship => ({
        ...championship,
        displayStatus: getDisplayStatus(
          championship,
          registrationPhases.get(Number(championship.id)),
        ),
      }))
      .filter(championship => {
        const searchableName = normalize([
          championship.nombre,
          championship.categoria,
          championship.temporada,
          championship.anio,
        ].filter(Boolean).join(' '));
        const allowedByRoute = initialStatus !== 'upcoming'
          || ['registration', 'upcoming'].includes(championship.displayStatus);

        return allowedByRoute
          && (!term || searchableName.includes(term));
      })
      .sort((a, b) => getSortValue(b) - getSortValue(a));
  }, [championships, registrationPhases, initialStatus, search]);

  const groupedChampionships = useMemo(() => sectionOrder.reduce((groups, status) => ({
    ...groups,
    [status]: filteredChampionships.filter(championship => championship.displayStatus === status),
  }), {}), [filteredChampionships]);

  const paginationItems = statusFilter === 'all'
    ? groupedChampionships.completed
    : groupedChampionships[statusFilter];
  const totalPages = Math.max(1, Math.ceil(paginationItems.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => paginationItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [paginationItems, page],
  );
  const filtersActive = Boolean(search || statusFilter !== 'all');

  const visibleGroups = useMemo(() => {
    if (statusFilter !== 'all') {
      return { [statusFilter]: pageItems };
    }

    return {
      registration: groupedChampionships.registration,
      active: groupedChampionships.active,
      upcoming: groupedChampionships.upcoming,
      completed: pageItems,
    };
  }, [groupedChampionships, pageItems, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  return (
    <div className="animate-fade-in">
      <div className="border-b border-racing-border bg-racing-gray px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-racing-red">Competición</p>
          <h1 className="section-title mb-2 text-4xl md:text-5xl">
            {initialStatus === 'upcoming' ? 'Próximos campeonatos' : 'Campeonatos'} <span className="gradient-text">CADPO</span>
          </h1>
          <p className="max-w-2xl text-gray-400">
            Consultá las inscripciones disponibles, los campeonatos en curso y el historial completo. En cada torneo también podés acceder a su reglamento cuando esté publicado.
          </p>
        </div>
      </div>

      <div className="sticky top-16 z-40 border-b border-racing-border bg-racing-dark/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <FunnelIcon className="h-4 w-4" />
            Filtros
          </div>

          <label className="relative block w-full md:max-w-xl">
            <span className="sr-only">Buscar campeonato</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full rounded-lg border border-racing-border bg-racing-card py-2.5 pl-9 pr-9 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-racing-red"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white" aria-label="Limpiar búsqueda">
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </label>

          {!initialStatus ? (
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-racing-border bg-racing-card px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-racing-red md:w-64" aria-label="Filtrar por estado">
              <option value="all">Todos los estados ({filteredChampionships.length})</option>
              {sectionOrder.map(status => <option key={status} value={status}>{sectionConfig[status].title} ({groupedChampionships[status].length})</option>)}
            </select>
          ) : null}

          {filtersActive && (
            <button type="button" onClick={clearFilters} className="btn-secondary justify-center text-xs">Limpiar filtros</button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div>
        ) : filteredChampionships.length === 0 || (statusFilter !== 'all' && paginationItems.length === 0) ? (
          <div className="card-glass p-16 text-center">
            <TrophyIcon className="mx-auto mb-4 h-14 w-14 text-gray-600" />
            <h3 className="mb-2 font-racing text-xl text-gray-300">Sin campeonatos</h3>
            <p className="text-sm text-gray-500">
              {statusFilter !== 'all'
                ? `No hay ${sectionConfig[statusFilter].title.toLowerCase()} que coincidan con los filtros seleccionados.`
                : 'No hay campeonatos que coincidan con los filtros seleccionados.'}
            </p>
            {filtersActive && <button type="button" onClick={clearFilters} className="btn-secondary mt-5 text-xs">Limpiar filtros</button>}
          </div>
        ) : (
          <>
            <div className="grid gap-10">
              {sectionOrder.map(status => (
                <ChampionshipSection key={status} status={status} championships={visibleGroups[status] || []} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-col gap-3 border-t border-racing-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, paginationItems.length)} de {paginationItems.length} en {statusFilter === 'all' ? 'campeonatos finalizados' : sectionConfig[statusFilter].title.toLowerCase()}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35">Anterior</button>
                  <span className="min-w-24 text-center font-racing text-sm text-white">Página {page} de {totalPages}</span>
                  <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35">Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
