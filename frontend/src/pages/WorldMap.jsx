import { useEffect, useMemo, useState } from 'react';
import worldMap from '@svg-maps/world';
import {
  FlagIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { circuitsApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import { getCountryName } from '../data/countries';

const metrics = [
  { id: 'fechas_disputadas', label: 'Fechas disputadas' },
  { id: 'circuitos', label: 'Autódromos' },
];

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [metric, setMetric] = useState('fechas_disputadas');
  const [selectedCode, setSelectedCode] = useState('');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    circuitsApi.getGeography()
      .then(response => setCountries(response.data.data || []))
      .catch(() => setError('No se pudieron cargar las estadísticas geográficas.'))
      .finally(() => setLoading(false));
  }, []);

  const byCode = useMemo(
    () => new Map(countries.map(country => [country.pais, country])),
    [countries],
  );
  const maxValue = Math.max(1, ...countries.map(country => country[metric] || 0));
  const rankedCountries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es-AR');
    return [...countries]
      .filter(country => !normalizedSearch || getCountryName(country.pais).toLocaleLowerCase('es-AR').includes(normalizedSearch))
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
  }, [countries, metric, search]);
  const selected = selectedCode ? byCode.get(selectedCode) : rankedCountries[0];
  const totals = countries.reduce((result, country) => ({
    circuitos: result.circuitos + country.circuitos,
    fechas: result.fechas + country.fechas,
    fechas_disputadas: result.fechas_disputadas + country.fechas_disputadas,
  }), { circuitos: 0, fechas: 0, fechas_disputadas: 0 });

  const countryFill = code => {
    const country = byCode.get(code);
    if (!country) return '#171717';
    if (code === selected?.pais) return '#ffffff';
    const intensity = 0.22 + ((country[metric] || 0) / maxValue) * 0.78;
    return `rgba(230, 57, 70, ${intensity})`;
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-racing-dark">
      <header className="border-b border-racing-border bg-black px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1700px]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">Geografía CADPO</p>
          <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Circuitos del mundo</h1>
          <div className="mt-5 grid max-w-3xl grid-cols-3 gap-px border border-racing-border bg-racing-border">
            <div className="bg-racing-card p-3"><p className="text-[10px] uppercase text-gray-500">Países</p><p className="font-racing text-2xl font-bold">{countries.length}</p></div>
            <div className="bg-racing-card p-3"><p className="text-[10px] uppercase text-gray-500">Autódromos</p><p className="font-racing text-2xl font-bold">{totals.circuitos}</p></div>
            <div className="bg-racing-card p-3"><p className="text-[10px] uppercase text-gray-500">Fechas disputadas</p><p className="font-racing text-2xl font-bold">{totals.fechas_disputadas}</p></div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <section className="min-w-0 border border-racing-border bg-black">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-racing-border p-3">
            <div className="inline-flex border border-racing-border bg-racing-dark p-1">
              {metrics.map(option => (
                <button key={option.id} type="button" onClick={() => setMetric(option.id)} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${metric === option.id ? 'bg-racing-red text-white' : 'text-gray-400 hover:text-white'}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setZoom(current => Math.max(1, current - 0.25))} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red" aria-label="Alejar"><MinusIcon className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom(current => Math.min(2.5, current + 0.25))} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-racing-red" aria-label="Acercar"><PlusIcon className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="world-map-scroll overflow-auto">
            {loading ? (
              <div className="flex min-h-[520px] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div>
            ) : error ? (
              <div className="flex min-h-[520px] items-center justify-center px-6 text-center font-semibold text-gray-400">{error}</div>
            ) : (
              <svg viewBox={worldMap.viewBox} role="img" aria-label="Mapa mundial de circuitos CADPO" className="block min-h-[430px] transition-[width] duration-300" style={{ width: `${zoom * 100}%` }}>
                <rect width="1010" height="666" fill="#050505" />
                {worldMap.locations.map(location => {
                  const data = byCode.get(location.id);
                  return (
                    <path
                      key={location.id}
                      d={location.path}
                      fill={countryFill(location.id)}
                      stroke={data ? '#e63946' : '#343434'}
                      strokeWidth={data ? 0.9 : 0.45}
                      className={data ? 'cursor-pointer transition-colors hover:fill-red-300' : ''}
                      onClick={() => data && setSelectedCode(location.id)}
                    >
                      <title>{data ? `${getCountryName(location.id)}: ${data.circuitos} autódromos, ${data.fechas_disputadas} fechas disputadas` : location.name}</title>
                    </path>
                  );
                })}
              </svg>
            )}
          </div>

          {selected && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-racing-border bg-racing-card px-4 py-3">
              <span className="flex items-center gap-2 font-racing text-lg font-bold uppercase text-white"><CountryFlag country={selected.pais} className="text-2xl" />{getCountryName(selected.pais)}</span>
              <span className="text-sm text-gray-400"><strong className="text-white">{selected.circuitos}</strong> autódromos</span>
              <span className="text-sm text-gray-400"><strong className="text-white">{selected.fechas_disputadas}</strong> fechas disputadas</span>
            </div>
          )}
        </section>

        <aside className="border border-racing-border bg-racing-card">
          <div className="border-b border-racing-border p-4">
            <h2 className="flex items-center gap-2 font-racing text-xl font-bold uppercase"><FlagIcon className="h-5 w-5 text-racing-red" />Ranking por país</h2>
            <div className="relative mt-3">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} className="input-field h-10 pl-9 text-sm" placeholder="Buscar país..." />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {rankedCountries.map((country, index) => (
              <button key={country.pais} type="button" onClick={() => setSelectedCode(country.pais)} className={`flex w-full items-center gap-3 border-b border-racing-border px-4 py-3 text-left transition-colors hover:bg-white/5 ${selected?.pais === country.pais ? 'bg-racing-red/10' : ''}`}>
                <span className="w-6 font-racing text-sm font-bold text-gray-600">{index + 1}</span>
                <CountryFlag country={country.pais} className="text-xl" />
                <span className="min-w-0 flex-1 truncate font-semibold text-white">{getCountryName(country.pais)}</span>
                <span className="flex items-center gap-1 font-racing text-lg font-bold text-racing-red"><MapPinIcon className="h-4 w-4" />{country[metric]}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
