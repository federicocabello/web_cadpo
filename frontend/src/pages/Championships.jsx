import { useEffect, useMemo, useState } from 'react';
import { FunnelIcon, MagnifyingGlassIcon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ChampionshipCard from '../components/ChampionshipCard';
import { championshipsApi } from '../services/api';
import { getDatabaseDateParts } from '../utils/calendarDate';

const PAGE_SIZE = 10;

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

export default function Championships({ initialStatus = '' }) {
  const [championships, setChampionships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchChampionships = async () => {
      setLoading(true);
      try {
        const params = initialStatus ? { status: initialStatus } : {};
        const res = await championshipsApi.getAll(params);
        setChampionships(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchChampionships();
  }, [initialStatus]);

  const years = useMemo(() => [...new Set(championships.map(item => String(item.anio || '')).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a)), [championships]);

  const categories = useMemo(() => [...new Set(championships.map(item => item.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es')), [championships]);

  const filteredChampionships = useMemo(() => {
    const term = normalize(search.trim());

    return championships
      .filter(championship => {
        const searchableName = normalize([
          championship.nombre,
          championship.categoria,
          championship.temporada,
          championship.anio,
        ].filter(Boolean).join(' '));

        return (!term || searchableName.includes(term))
          && (!year || String(championship.anio) === year)
          && (!category || championship.categoria === category);
      })
      .sort((a, b) => getSortValue(b) - getSortValue(a));
  }, [championships, search, year, category]);

  const totalPages = Math.max(1, Math.ceil(filteredChampionships.length / PAGE_SIZE));
  const visibleChampionships = useMemo(
    () => filteredChampionships.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredChampionships, page],
  );
  const filtersActive = Boolean(search || year || category);

  useEffect(() => {
    setPage(1);
  }, [search, year, category]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearch('');
    setYear('');
    setCategory('');
  };

  return (
    <div className="animate-fade-in">
      <div className="border-b border-racing-border bg-racing-gray px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-racing-red">Competición</p>
          <h1 className="section-title mb-2 text-4xl md:text-5xl">
            {initialStatus === 'upcoming' ? 'Próximos campeonatos' : 'Campeonatos'} <span className="gradient-text">CADPO</span>
          </h1>
          <p className="max-w-xl text-gray-400">
            {initialStatus === 'upcoming'
              ? 'Campeonatos que comenzarán próximamente.'
              : 'Todos los campeonatos ordenados desde el más reciente hasta el más antiguo.'}
          </p>
        </div>
      </div>

      <div className="sticky top-16 z-40 border-b border-racing-border bg-racing-dark/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <FunnelIcon className="h-4 w-4" />
            Filtros
          </div>

          <label className="relative block w-full lg:max-w-md">
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
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                aria-label="Limpiar búsqueda"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </label>

          <select
            value={year}
            onChange={event => setYear(event.target.value)}
            className="w-full rounded-lg border border-racing-border bg-racing-card px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-racing-red lg:w-40"
            aria-label="Filtrar por año"
          >
            <option value="">Todos los años</option>
            {years.map(item => <option key={item} value={item}>{item}</option>)}
          </select>

          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="w-full rounded-lg border border-racing-border bg-racing-card px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-racing-red lg:w-64"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>

          {filtersActive && (
            <button type="button" onClick={clearFilters} className="btn-secondary justify-center text-xs">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" />
          </div>
        ) : filteredChampionships.length === 0 ? (
          <div className="card-glass p-16 text-center">
            <TrophyIcon className="mx-auto mb-4 h-14 w-14 text-gray-600" />
            <h3 className="mb-2 font-racing text-xl text-gray-300">Sin campeonatos</h3>
            <p className="text-sm text-gray-500">No hay campeonatos que coincidan con los filtros seleccionados.</p>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="btn-secondary mt-5 text-xs">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-racing text-2xl font-bold">
                {initialStatus === 'upcoming' ? 'Próximos campeonatos' : 'Todos los campeonatos'}
              </h2>
              <p className="text-sm text-gray-500">
                {filteredChampionships.length} campeonato{filteredChampionships.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleChampionships.map(championship => (
                <ChampionshipCard key={championship.id} championship={championship} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-col gap-3 border-t border-racing-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredChampionships.length)} de {filteredChampionships.length}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(current => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Anterior
                  </button>
                  <span className="min-w-24 text-center font-racing text-sm text-white">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-racing-border px-3 py-2 text-xs font-semibold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
