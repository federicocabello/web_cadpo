import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { Link, useSearchParams } from 'react-router-dom';
import { championshipsApi, resultsApi } from '../services/api';
import ChampionshipPrizes from '../components/ChampionshipPrizes';
import { formatCalendarDate } from '../utils/calendarDate';
import { formatInstagramHandle, getInstagramUrl } from '../utils/instagram';

const pointsFields = ['presentismo', 'pts_qualy_sprint', 'pts_sprint', 'pts_qualy_final', 'pts_final'];
const getPoints = result => pointsFields.reduce((total, field) => {
  const value = Number(String(result[field] ?? 0).replace(',', '.'));
  return total + (Number.isFinite(value) ? value : 0);
}, 0);
const formatPoints = value => Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default function Results() {
  const [searchParams] = useSearchParams();
  const championshipId = searchParams.get('campeonato');
  const [championship, setChampionship] = useState(null);
  const [results, setResults] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!championshipId) {
      setLoading(false);
      setError('Seleccioná un campeonato para consultar sus resultados.');
      return;
    }

    setLoading(true);
    setError('');
    Promise.all([
      championshipsApi.getById(championshipId),
      resultsApi.getAll({ idcampeonato: championshipId }),
      championshipsApi.getPrizes(championshipId),
    ])
      .then(([championshipResponse, resultsResponse, prizesResponse]) => {
        setChampionship(championshipResponse.data.data);
        setResults(resultsResponse.data.data || []);
        setPrizes(prizesResponse.data.data || []);
      })
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar los resultados.'))
      .finally(() => setLoading(false));
  }, [championshipId]);

  const rounds = useMemo(() => {
    const grouped = new Map();
    results.forEach(result => {
      const key = String(result.ronda);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(result);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, items]) => ({
        round,
        items: [...items].sort((a, b) => {
          const positionA = Number.parseInt(a.pos_final, 10);
          const positionB = Number.parseInt(b.pos_final, 10);
          if (Number.isFinite(positionA) && Number.isFinite(positionB)) return positionA - positionB;
          if (Number.isFinite(positionA)) return -1;
          if (Number.isFinite(positionB)) return 1;
          return String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es');
        }),
      }));
  }, [results]);

  return (
    <div className="animate-fade-in">
      <div className="border-b border-racing-border bg-racing-gray px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <Link to="/campeonatos" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white">
            <ArrowLeftIcon className="h-4 w-4" /> Volver a campeonatos
          </Link>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-racing-red">Resultados del campeonato</p>
          <div className="flex flex-wrap items-center gap-4">
            {championship?.categoria_logo ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-racing-border bg-black/60 p-2">
                <img src={championship.categoria_logo} alt={`Logo de ${championship.categoria}`} className="h-full w-full object-contain" />
              </div>
            ) : null}
            <div>
              <h1 className="section-title text-4xl md:text-5xl">
                {championship ? championship.categoria : 'Resultados'} <span className="gradient-text">{championship ? `T${championship.temporada}` : 'CADPO'}</span>
              </h1>
              {championship ? <p className="mt-2 text-gray-400">Temporada {championship.temporada} · {championship.anio}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        {!loading && !error ? <ChampionshipPrizes prizes={prizes} /> : null}
        {loading ? (
          <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div>
        ) : error ? (
          <div className="card-glass p-12 text-center">
            <TrophyIcon className="mx-auto mb-4 h-14 w-14 text-gray-600" />
            <p className="text-gray-400">{error}</p>
          </div>
        ) : rounds.length === 0 ? (
          <div className="card-glass p-12 text-center">
            <TrophyIcon className="mx-auto mb-4 h-14 w-14 text-racing-red" />
            <h2 className="font-racing text-2xl font-bold">Resultados pendientes</h2>
            <p className="mt-2 text-gray-400">Todavía no se cargaron resultados para este campeonato.</p>
          </div>
        ) : rounds.map(({ round, items }) => {
          const first = items[0];
          return (
            <section key={round} className="card-glass overflow-hidden">
              <div className="border-b border-racing-border bg-racing-gray px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-racing-red">Ronda {round}</p>
                <h2 className="mt-1 font-racing text-2xl font-bold">{first.circuito}{first.variante ? ` · ${first.variante}` : ''}</h2>
                <p className="mt-1 text-sm text-gray-500">{formatCalendarDate(first.fecha, { dateStyle: 'long' })}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-racing-dark text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Piloto</th>
                      <th className="px-4 py-3 text-center">Sprint</th>
                      <th className="px-4 py-3 text-center">Final</th>
                      <th className="px-4 py-3 text-right">Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-racing-border">
                    {items.map(result => (
                      <tr key={result.id} className="transition-colors hover:bg-racing-card/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{result.piloto}</p>
                          {result.ig ? <a href={getInstagramUrl(result.ig)} target="_blank" rel="noreferrer" className="text-xs text-racing-red hover:text-white">{formatInstagramHandle(result.ig)}</a> : null}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{result.pos_sprint || '-'}</td>
                        <td className="px-4 py-3 text-center font-racing text-base text-white">{result.pos_final || '-'}</td>
                        <td className="px-4 py-3 text-right font-racing text-lg font-bold text-yellow-300">{formatPoints(getPoints(result))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
