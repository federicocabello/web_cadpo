import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { driversApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export default function Drivers() {
  const pageSize = 15;
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await driversApi.getAll();
        setDrivers(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return drivers;

    return drivers.filter(driver => (
      normalize(driver.nombre).includes(term)
      || normalize(driver.localidad).includes(term)
    ));
  }, [drivers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / pageSize));
  const visibleDrivers = useMemo(
    () => filteredDrivers.slice((page - 1) * pageSize, page * pageSize),
    [filteredDrivers, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Comunidad</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Pilotos <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Listado general de pilotos registrados y cantidad de campeonatos disputados.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!loading && drivers.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Buscar piloto</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar piloto por nombre o localidad..."
                className="w-full rounded-lg border border-racing-border bg-racing-card py-3 pl-10 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-racing-red"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </label>
            <p className="text-sm text-gray-500">
              {filteredDrivers.length} piloto{filteredDrivers.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDrivers.length > 0 ? (
          <div className="card-glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Piloto</th>
                    <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Localidad</th>
                    <th className="px-4 py-3 text-right text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Campeonatos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {visibleDrivers.map(driver => (
                    <tr key={driver.id} className="hover:bg-racing-card/60 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">
                        <span className="flex items-center gap-2">
                          <CountryFlag country={driver.nacionalidad} className="text-lg" />
                          {driver.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{driver.localidad || '-'}</td>
                      <td className="px-4 py-3 text-right font-racing text-white">{driver.campeonatos_disputados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-racing-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredDrivers.length)} de {filteredDrivers.length}
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
                  <span className="min-w-20 text-center font-racing text-sm text-white">
                    {page} / {totalPages}
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
          </div>
        ) : (
          <div className="card-glass p-16 text-center">
            <UserGroupIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">{search ? 'Sin coincidencias' : 'Sin pilotos'}</h3>
            <p className="text-gray-500 text-sm">
              {search ? 'No hay pilotos que coincidan con la búsqueda.' : 'Todavía no hay pilotos registrados.'}
            </p>
            {search && (
              <button type="button" onClick={() => setSearch('')} className="btn-secondary mt-5 text-xs">
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
