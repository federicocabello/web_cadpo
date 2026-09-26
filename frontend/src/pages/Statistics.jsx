import { useEffect, useState } from 'react';
import {
  ChartBarIcon,
  FlagIcon,
  IdentificationIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  TrophyIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';
import { statisticsApi } from '../services/api';
import { formatInstagramHandle, getInstagramUrl } from '../utils/instagram';

const summaryCards = [
  { key: 'carreras_disputadas', label: 'Carreras disputadas', icon: FlagIcon },
  { key: 'campeonatos_disputados', label: 'Campeonatos', icon: TrophyIcon },
  { key: 'pilotos_cargados', label: 'Pilotos cargados', icon: UserGroupIcon },
  { key: 'pilotos_ganadores', label: 'Ganadores distintos en finales', icon: StarIcon },
  { key: 'campeones_distintos', label: 'Campeones distintos', icon: ChartBarIcon },
];

const driverStatCards = [
  { key: 'carreras_disputadas', label: 'Carreras' },
  { key: 'campeonatos_disputados', label: 'Campeonatos' },
  { key: 'poles', label: 'Poles' },
  { key: 'victorias', label: 'Finales ganadas' },
  { key: 'podios', label: 'Podios' },
  { key: 'series_ganadas', label: 'Series ganadas' },
  { key: 'campeonatos_ganados', label: 'Títulos' },
  { key: 'puntos', label: 'Puntos' },
];

const formatNumber = value => Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const displayValue = value => String(value || '').trim() || 'Sin cargar';
const formatDate = value => value
  ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  : 'el primer campeonato registrado';

export default function Statistics() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverStats, setDriverStats] = useState(null);
  const [driverLoading, setDriverLoading] = useState(false);

  useEffect(() => {
    statisticsApi.getOverview()
      .then(response => setOverview(response.data.data))
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar las estadísticas.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedDriver || search.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      statisticsApi.searchDrivers(search)
        .then(response => setSuggestions(response.data.data || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, selectedDriver]);

  const selectDriver = driver => {
    setSelectedDriver(driver);
    setSearch(driver.nombre);
    setSuggestions([]);
    setDriverLoading(true);
    setDriverStats(null);
    statisticsApi.getDriver(driver.id)
      .then(response => setDriverStats(response.data.data))
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar los datos del piloto.'))
      .finally(() => setDriverLoading(false));
  };

  const clearDriver = () => {
    setSearch('');
    setSuggestions([]);
    setSelectedDriver(null);
    setDriverStats(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="w-full max-w-none space-y-10 px-4 py-8 sm:px-6 lg:px-10 2xl:px-12">
        {loading ? (
          <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div>
        ) : error && !overview ? (
          <div className="card-glass p-10 text-center text-gray-400">{error}</div>
        ) : overview ? (
          <>
            <section>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-racing-red">Historia CADPO</p>
                <h1 className="mt-1 font-racing text-2xl font-bold uppercase text-white sm:text-3xl">Estadísticas totales</h1>
                <p className="mt-1 text-sm text-gray-500">Desde {formatDate(overview.summary.fecha_inicio)} hasta hoy</p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {summaryCards.map(({ key, label, icon: Icon }) => (
                  <article key={key} className="card-glass p-5">
                    <Icon className="mb-4 h-7 w-7 text-racing-red" />
                    <p className="font-racing text-3xl font-bold text-white md:text-4xl">{formatNumber(overview.summary[key])}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-gray-500">{label}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="card-glass p-6 md:p-8">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Ficha individual</p>
                <h2 className="mt-1 font-racing text-3xl font-bold">Buscar piloto</h2>
                <p className="mt-2 text-sm text-gray-400">Buscá por nombre o usuario de Instagram y seleccioná al piloto.</p>
              </div>
              <div className="relative mt-6 max-w-2xl">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={event => { setSearch(event.target.value); setSelectedDriver(null); setDriverStats(null); }}
                  className="input-field pl-10 pr-10"
                  placeholder="Nombre del piloto o @instagram..."
                  autoComplete="off"
                />
                {search ? <button type="button" onClick={clearDriver} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" aria-label="Limpiar piloto"><XMarkIcon className="h-5 w-5" /></button> : null}
                {suggestions.length ? (
                  <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto border border-racing-border bg-racing-dark shadow-2xl">
                    {suggestions.map(driver => (
                      <button key={driver.id} type="button" onClick={() => selectDriver(driver)} className="flex w-full items-center gap-3 border-b border-racing-border px-4 py-3 text-left transition-colors hover:bg-racing-red/10">
                        <CountryFlag country={driver.nacionalidad} className="text-lg" />
                        <span className="min-w-0"><strong className="block truncate text-white">{driver.nombre}</strong><span className="text-xs text-gray-500">{[driver.localidad, driver.provincia].filter(Boolean).join(', ') || 'Sin localidad'}{driver.ig ? ` · ${formatInstagramHandle(driver.ig)}` : ''}</span></span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {driverLoading ? <div className="mt-8 flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div> : null}
              {driverStats && !driverLoading ? (
                <div className="mt-8 border-t border-racing-border pt-8">
                  <div className="flex flex-wrap items-center gap-4">
                    <CountryFlag country={driverStats.driver.nacionalidad} className="text-3xl" />
                    <div>
                      <h3 className="font-racing text-3xl font-bold text-white">{driverStats.driver.nombre}</h3>
                      <p className="text-sm text-gray-500">{[driverStats.driver.localidad, driverStats.driver.provincia].filter(Boolean).join(', ')}</p>
                      {driverStats.driver.ig ? <a href={getInstagramUrl(driverStats.driver.ig)} target="_blank" rel="noreferrer" className="text-sm text-racing-red hover:text-white">{formatInstagramHandle(driverStats.driver.ig)}</a> : null}
                    </div>
                  </div>
                  <div className="mt-6 grid overflow-hidden border border-racing-border bg-black/20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <div className="border-b border-racing-border p-4 sm:border-r lg:border-b-0">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><MapPinIcon className="h-4 w-4 text-racing-red"/>Localidad</span>
                      <p className="mt-2 break-words text-sm font-semibold text-white">{displayValue(driverStats.driver.localidad)}</p>
                    </div>
                    <div className="border-b border-racing-border p-4 lg:border-b-0 lg:border-r">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><MapPinIcon className="h-4 w-4 text-racing-red"/>Provincia</span>
                      <p className="mt-2 break-words text-sm font-semibold text-white">{displayValue(driverStats.driver.provincia)}</p>
                    </div>
                    <div className="border-b border-racing-border p-4 sm:border-r xl:border-b-0">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><FlagIcon className="h-4 w-4 text-racing-red"/>Nacionalidad</span>
                      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white"><CountryFlag country={driverStats.driver.nacionalidad} className="text-base"/>{driverStats.driver.nacionalidad ? getCountryName(driverStats.driver.nacionalidad) : 'Sin cargar'}</p>
                    </div>
                    <div className="border-b border-racing-border p-4 lg:border-b-0 lg:border-r">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><PhoneIcon className="h-4 w-4 text-racing-red"/>Teléfono</span>
                      {driverStats.driver.telefono ? <a href={`tel:${driverStats.driver.telefono}`} className="mt-2 block break-words text-sm font-semibold text-white hover:text-racing-red">{driverStats.driver.telefono}</a> : <p className="mt-2 text-sm text-gray-600">Sin cargar</p>}
                    </div>
                    <div className="border-b border-racing-border p-4 sm:border-b-0 sm:border-r">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><span className="text-sm leading-none text-racing-red">@</span>Instagram</span>
                      {driverStats.driver.ig ? <a href={getInstagramUrl(driverStats.driver.ig)} target="_blank" rel="noreferrer" className="mt-2 block break-words text-sm font-semibold text-white hover:text-racing-red">{formatInstagramHandle(driverStats.driver.ig)}</a> : <p className="mt-2 text-sm text-gray-600">Sin cargar</p>}
                    </div>
                    <div className="p-4">
                      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><IdentificationIcon className="h-4 w-4 text-racing-red"/>ID Steam</span>
                      <p className="mt-2 break-all text-sm font-semibold text-white">{displayValue(driverStats.driver.steam)}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                    {driverStatCards.map(item => (
                      <div key={item.key} className="border border-racing-border bg-racing-dark p-4 text-center">
                        <p className="font-racing text-2xl font-bold text-white">{formatNumber(driverStats.totals[item.key])}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 overflow-x-auto border border-racing-border">
                    <table className="w-full text-sm">
                      <thead className="bg-racing-dark text-xs uppercase tracking-wider text-gray-500">
                        <tr><th className="px-4 py-3 text-left">Campeonato</th><th className="px-4 py-3 text-center">Carreras</th><th className="px-4 py-3 text-center">Poles</th><th className="px-4 py-3 text-center">Finales</th><th className="px-4 py-3 text-center">Podios</th><th className="px-4 py-3 text-center">Series</th><th className="px-4 py-3 text-right">Puntos</th></tr>
                      </thead>
                      <tbody className="divide-y divide-racing-border">
                        {driverStats.championships.map(item => (
                          <tr key={item.idcampeonato} className="hover:bg-racing-card/60">
                            <td className="px-4 py-3"><div className="flex items-center gap-3">{item.categoria_logo ? <img src={item.categoria_logo} alt="" className="h-9 w-9 object-contain" /> : null}<div><p className="font-semibold text-white">{item.categoria} · T{item.temporada}</p><p className="text-xs text-gray-500">{item.anio}{item.campeon ? ' · Campeón' : ''}</p></div></div></td>
                            <td className="px-4 py-3 text-center">{item.carreras}</td><td className="px-4 py-3 text-center">{item.poles}</td><td className="px-4 py-3 text-center">{item.victorias}</td><td className="px-4 py-3 text-center">{item.podios}</td><td className="px-4 py-3 text-center">{item.series_ganadas}</td><td className="px-4 py-3 text-right font-racing font-bold text-yellow-300">{formatNumber(item.puntos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="card-glass overflow-hidden">
                <div className="border-b border-racing-border px-6 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Ranking histórico</p><h2 className="mt-1 font-racing text-2xl font-bold">Más victorias en finales</h2></div>
                <div className="divide-y divide-racing-border">
                  {overview.topWinners.map((driver, index) => (
                    <button key={driver.id} type="button" onClick={() => selectDriver(driver)} className="grid w-full grid-cols-[40px_1fr_auto] items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-racing-card/60">
                      <span className="font-racing text-xl font-bold text-racing-red">{index + 1}</span>
                      <span><strong className="block text-white">{driver.nombre}</strong><span className="text-xs text-gray-500">{driver.poles} poles · {driver.podios} podios · {driver.series_ganadas} series</span></span>
                      <span className="text-right"><strong className="block font-racing text-xl text-yellow-300">{driver.victorias}</strong><span className="text-[10px] uppercase text-gray-500">finales</span></span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="card-glass overflow-hidden">
                <div className="border-b border-racing-border px-6 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Ranking histórico</p><h2 className="mt-1 font-racing text-2xl font-bold">Más campeones</h2></div>
                <div className="divide-y divide-racing-border">
                  {(overview.topChampions || []).map((champion, index) => (
                    <button key={champion.id} type="button" onClick={() => selectDriver(champion)} className="grid w-full grid-cols-[40px_44px_1fr_auto] items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-racing-card/60">
                      <span className="font-racing text-xl font-bold text-racing-red">{index + 1}</span>
                      {champion.categoria_logo ? <img src={champion.categoria_logo} alt="" className="h-10 w-10 object-contain" /> : <TrophyIcon className="h-8 w-8 text-racing-red" />}
                      <span className="min-w-0"><strong className="block truncate text-white">{champion.nombre}</strong><span className="block truncate text-xs text-gray-500">Último título · {champion.categoria}</span></span>
                      <span className="text-right"><strong className="block font-racing text-xl text-yellow-300">{champion.titulos}</strong><span className="text-[10px] uppercase text-gray-500">títulos</span></span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="card-glass overflow-hidden">
                <div className="border-b border-racing-border px-6 py-5"><p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Últimos campeonatos</p><h2 className="mt-1 font-racing text-2xl font-bold">Campeones recientes</h2></div>
                <div className="max-h-[620px] divide-y divide-racing-border overflow-y-auto">
                  {overview.champions.map(champion => (
                    <button key={champion.idcampeonato} type="button" onClick={() => selectDriver({ ...champion, id: champion.idpiloto })} className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-racing-card/60">
                      {champion.categoria_logo ? <img src={champion.categoria_logo} alt="" className="h-11 w-11 object-contain" /> : <TrophyIcon className="h-8 w-8 text-racing-red" />}
                      <span className="min-w-0 flex-1"><strong className="block truncate text-white">{champion.nombre}</strong><span className="text-xs text-gray-500">{champion.categoria} · T{champion.temporada} · {champion.anio}</span></span>
                      <span className="font-racing font-bold text-yellow-300">{formatNumber(champion.puntos)} pts</span>
                    </button>
                  ))}
                </div>
                <p className="border-t border-racing-border px-6 py-3 text-xs text-gray-600">Se prioriza el campeón marcado en Resultados; si no existe, se toma el mayor puntaje del campeonato finalizado.</p>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
