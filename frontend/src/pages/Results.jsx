import { useEffect, useMemo, useState } from 'react';
import { CalendarDaysIcon, FlagIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { championshipsApi, resultsApi } from '../services/api';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';

const pointsFields = ['presentismo', 'pts_qualy_sprint', 'pts_sprint', 'pts_qualy_final', 'pts_final'];
const getPoints = result => pointsFields.reduce((total, field) => {
  const value = Number(String(result[field] ?? 0).replace(',', '.'));
  return total + (Number.isFinite(value) ? value : 0);
}, 0);
const formatPoints = value => Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const numericPosition = value => {
  const position = Number.parseInt(value, 10);
  return Number.isFinite(position) && position > 0 ? position : null;
};
const resultOrder = result => numericPosition(result.pos_final)
  ?? numericPosition(result.pos_sprint)
  ?? numericPosition(result.pos_qualy_final)
  ?? numericPosition(result.pos_qualy_sprint)
  ?? Number.MAX_SAFE_INTEGER;
const displayPosition = value => {
  const position = numericPosition(value);
  if (position) return `${position}°`;
  return String(value ?? '').trim() || '—';
};
const displayPoints = value => {
  const points = Number(String(value ?? 0).replace(',', '.')) || 0;
  return points ? formatPoints(points) : '—';
};
const hasResultData = result => [
  result.pos_qualy_sprint,
  result.pos_sprint,
  result.pos_qualy_final,
  result.pos_final,
].some(value => String(value ?? '').trim())
  || ['desc_sancion_qualy_sprint', 'desc_sancion_sprint', 'desc_sancion_qualy_final', 'desc_sancion_final'].some(field => String(result[field] || '').trim())
  || pointsFields.some(field => Number(String(result[field] ?? 0).replace(',', '.')) !== 0)
  || ['pole_sprint', 'ganador_sprint', 'pole_final', 'ganador_final', 'campeon'].some(field => Boolean(Number(result[field])));

const SessionSection = ({ title, items, positionField, pointsField, sanctionField, achievementField, achievementLabel, selectedPilotId, onSelectPilot }) => {
  const sortedItems = [...items].sort((a, b) => {
    if (!positionField) return resultOrder(a) - resultOrder(b);
    return (numericPosition(a[positionField]) ?? Number.MAX_SAFE_INTEGER)
      - (numericPosition(b[positionField]) ?? Number.MAX_SAFE_INTEGER)
      || String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es-AR', { sensitivity: 'base' });
  });

  return (
    <section className="overflow-hidden border border-racing-border bg-black/20">
      <header className="border-b border-racing-border bg-racing-red/[0.08] px-4 py-3">
        <h3 className="font-racing text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
      </header>
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-black/25 text-[9px] uppercase tracking-wider text-gray-500"><tr>{positionField ? <th className="w-14 px-2 py-2 text-center">Pos.</th> : null}<th className="px-3 py-2 text-left">Piloto</th><th className="w-20 px-3 py-2 text-right">Puntos</th></tr></thead>
        <tbody className="divide-y divide-racing-border">{sortedItems.map(result => { const selected = String(selectedPilotId) === String(result.idpiloto); const achievement = Boolean(Number(result[achievementField])); const position = numericPosition(result[positionField]); const sanction = String(result[sanctionField] || '').trim(); return <tr key={`${title}-${result.id}`} className={sanction ? 'bg-gradient-to-r from-red-500/20 via-red-500/[0.07] to-transparent' : selected ? 'bg-gradient-to-r from-green-500/20 via-green-500/[0.08] to-transparent' : ''}>{positionField ? <td className="px-2 py-2 text-center"><strong className={`font-racing text-base ${sanction ? 'text-red-400' : position === 1 ? 'text-yellow-300' : position === 2 ? 'text-gray-200' : position === 3 ? 'text-amber-600' : 'text-white'}`}>{displayPosition(result[positionField])}</strong></td> : null}<td className="p-0"><button type="button" onClick={() => onSelectPilot(result.idpiloto)} aria-pressed={selected} className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left">{result.auto_logo ? <img src={result.auto_logo} alt="" className="mt-0.5 h-6 w-8 shrink-0 object-contain"/> : null}<span className="min-w-0 flex-1"><span className={`block truncate font-semibold ${sanction ? 'text-red-400' : 'text-gray-200'}`}>{result.piloto}</span>{selected && sanction ? <span className="mt-1 block whitespace-normal border-l-2 border-red-500 pl-2 text-[10px] leading-relaxed text-red-200"><strong className="uppercase tracking-wider text-red-400">Motivo: </strong>{sanction}</span> : null}</span>{sanction ? <span className="shrink-0 border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-red-300">Sanción</span> : achievement ? <span className="shrink-0 border border-yellow-300/40 bg-yellow-300/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-yellow-200">{achievementLabel}</span> : null}</button></td><td className={`px-3 py-2 text-right font-racing text-lg font-bold ${sanction ? 'text-red-300' : 'text-white'}`}>{displayPoints(result[pointsField])}</td></tr>; })}</tbody>
      </table>
    </section>
  );
};

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedChampionshipId = searchParams.get('campeonato') || '';
  const [championships, setChampionships] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([championshipsApi.getAll(), resultsApi.getAll()])
      .then(([championshipsResponse, resultsResponse]) => {
        if (!active) return;
        setChampionships(championshipsResponse.data.data || []);
        setResults(resultsResponse.data.data || []);
        setError('');
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.error || 'No se pudieron cargar los resultados.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const championshipsWithResults = useMemo(() => championships
    .map(championship => {
      const championshipResults = results.filter(result => String(result.idcampeonato) === String(championship.id));
      const latestResultDate = championshipResults.reduce((latest, result) =>
        Math.max(latest, parseCalendarDate(result.fecha)?.getTime() || 0), 0);
      return {
        ...championship,
        resultCount: championshipResults.length,
        resultRounds: new Set(championshipResults.map(result => String(result.ronda))).size,
        latestResultDate,
      };
    })
    .filter(championship => championship.resultCount > 0)
    .sort((a, b) => b.latestResultDate - a.latestResultDate || Number(b.id) - Number(a.id)), [championships, results]);

  useEffect(() => {
    if (loading || !championshipsWithResults.length) return;
    const requestedExists = championshipsWithResults.some(championship => String(championship.id) === String(requestedChampionshipId));
    if (!requestedExists) setSearchParams({ campeonato: String(championshipsWithResults[0].id) }, { replace: true });
  }, [championshipsWithResults, loading, requestedChampionshipId, setSearchParams]);

  const selectedChampionship = championshipsWithResults.find(championship =>
    String(championship.id) === String(requestedChampionshipId)) || championshipsWithResults[0] || null;

  const selectedResults = useMemo(() => selectedChampionship
    ? results.filter(result => String(result.idcampeonato) === String(selectedChampionship.id))
    : [], [results, selectedChampionship]);

  const rounds = useMemo(() => {
    const grouped = new Map();
    selectedResults.forEach(result => {
      const key = String(result.ronda);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(result);
    });
    return [...grouped.entries()]
      .filter(([, items]) => items.some(hasResultData))
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([round, items]) => ({
        round,
        items: [...items].sort((a, b) => resultOrder(a) - resultOrder(b)
          || String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es-AR', { sensitivity: 'base' })),
      }));
  }, [selectedResults]);

  useEffect(() => {
    if (!rounds.length) { setSelectedRound(''); return; }
    if (!rounds.some(item => String(item.round) === String(selectedRound))) setSelectedRound(String(rounds[0].round));
  }, [rounds, selectedRound]);

  const selectedRoundData = rounds.find(item => String(item.round) === String(selectedRound)) || rounds[0] || null;

  useEffect(() => setSelectedPilotId(null), [selectedChampionship?.id, selectedRound]);

  const standings = useMemo(() => {
    const totals = new Map();
    rounds.flatMap(round => round.items).forEach(result => {
      const key = String(result.idpiloto);
      const current = totals.get(key) || {
        idpiloto: result.idpiloto,
        piloto: result.piloto,
        ig: result.ig,
        auto_logo: result.auto_logo,
        marca: result.marca,
        modelo: result.modelo,
        puntos: 0,
        fechas: 0,
        puntosPorFecha: {},
        campeon: false,
      };
      const roundPoints = getPoints(result);
      current.puntos += roundPoints;
      current.fechas += 1;
      current.puntosPorFecha[String(result.ronda)] = (current.puntosPorFecha[String(result.ronda)] || 0) + roundPoints;
      current.campeon = current.campeon || Boolean(Number(result.campeon));
      totals.set(key, current);
    });
    return [...totals.values()]
      .sort((a, b) => b.puntos - a.puntos || String(a.piloto).localeCompare(String(b.piloto), 'es-AR', { sensitivity: 'base' }))
      .map((standing, index) => ({ ...standing, posicion: index + 1 }));
  }, [rounds]);

  const totalRounds = useMemo(() => [...rounds].sort((a, b) => Number(a.round) - Number(b.round)), [rounds]);
  const remainingRounds = Math.max(0, Number(selectedChampionship?.rondas || 0) - rounds.length);
  const championshipFinished = selectedChampionship?.status === 'completed' || (Number(selectedChampionship?.rondas || 0) > 0 && remainingRounds === 0);
  const togglePilot = pilotId => setSelectedPilotId(current => String(current) === String(pilotId) ? null : pilotId);

  const changeChampionship = event => {
    setSelectedRound('');
    setSearchParams({ campeonato: event.target.value });
  };

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center"><div className="h-11 w-11 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div>;

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-[1500px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
      {error ? <div className="card-glass p-12 text-center"><TrophyIcon className="mx-auto h-14 w-14 text-gray-600"/><p className="mt-4 text-gray-400">{error}</p></div> : !championshipsWithResults.length ? (
        <div className="card-glass p-12 text-center"><TrophyIcon className="mx-auto h-14 w-14 text-racing-red"/><h1 className="mt-4 font-racing text-2xl font-bold uppercase">Todavía no hay resultados publicados</h1><p className="mt-2 text-gray-400">Cuando se guarde una fecha desde administración aparecerá automáticamente aquí.</p></div>
      ) : <div className="space-y-7">
        <section className="border border-racing-border bg-racing-gray px-4 py-4 sm:px-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,340px)_minmax(210px,300px)] md:items-end">
            <div className="flex min-w-0 items-center gap-3">
              {selectedChampionship?.categoria_logo ? <img src={selectedChampionship.categoria_logo} alt="" className="h-12 w-14 shrink-0 object-contain"/> : <TrophyIcon className="h-9 w-9 shrink-0 text-racing-red"/>}
              <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-racing-red">Resultados oficiales</p><h1 className="truncate font-racing text-xl font-bold uppercase text-white sm:text-2xl">{selectedChampionship?.categoria}</h1><p className="text-xs text-gray-500">Temporada {selectedChampionship?.temporada} · {selectedChampionship?.anio}</p></div>
            </div>
            <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={selectedChampionship?.id || ''} onChange={changeChampionship} className="input-field mt-1.5 py-2.5 text-sm">{championshipsWithResults.map(championship => <option key={championship.id} value={championship.id}>{championship.categoria} · T{championship.temporada} · {championship.anio}</option>)}</select></label>
            <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</span><select value={selectedRoundData?.round || ''} onChange={event => setSelectedRound(event.target.value)} className="input-field mt-1.5 py-2.5 text-sm">{rounds.map(item => { const first = item.items[0]; return <option key={item.round} value={item.round}>Fecha {item.round} · {first.circuito}</option>; })}</select></label>
          </div>
        </section>

        {selectedRoundData ? <section className="overflow-hidden rounded-lg border border-racing-border border-t-2 border-t-racing-red/60 bg-racing-card">
          <header className="relative min-h-40 overflow-hidden border-b border-racing-border bg-racing-gray px-5 py-6 sm:min-h-44 sm:px-6">
            {selectedRoundData.items[0].circuito_imagen ? <img src={selectedRoundData.items[0].circuito_imagen} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" onError={event => { event.currentTarget.style.display = 'none'; }}/> : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"/>
            <div className="relative z-10 flex min-h-28 items-center justify-between gap-5 sm:min-h-32">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-racing-red">Resultado de la fecha {selectedRoundData.round}</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)] sm:text-3xl">{selectedRoundData.items[0].circuito}{selectedRoundData.items[0].variante ? ` · ${selectedRoundData.items[0].variante}` : ''}</h2><div className="mt-3 flex items-center gap-2 text-sm text-gray-200"><CalendarDaysIcon className="h-5 w-5 text-racing-red"/>{formatCalendarDate(selectedRoundData.items[0].fecha, { day: '2-digit', month: 'long', year: 'numeric' })}</div></div>
              {selectedRoundData.items[0].circuito_trazado ? <img src={selectedRoundData.items[0].circuito_trazado} alt={`Trazado de ${selectedRoundData.items[0].circuito}`} className="h-24 w-28 shrink-0 object-contain drop-shadow-[0_12px_25px_rgba(0,0,0,0.95)] sm:h-32 sm:w-44" onError={event => { event.currentTarget.style.display = 'none'; }}/> : null}
            </div>
          </header>
          <div className="grid gap-5 p-4 md:grid-cols-2 sm:p-5 lg:gap-6">
            <SessionSection title="Clasificación Sprint" items={selectedRoundData.items} positionField="pos_qualy_sprint" pointsField="pts_qualy_sprint" sanctionField="desc_sancion_qualy_sprint" achievementField="pole_sprint" achievementLabel="Pole" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Sprint" items={selectedRoundData.items} positionField="pos_sprint" pointsField="pts_sprint" sanctionField="desc_sancion_sprint" achievementField="ganador_sprint" achievementLabel="Ganador" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Clasificación Final" items={selectedRoundData.items} positionField="pos_qualy_final" pointsField="pts_qualy_final" sanctionField="desc_sancion_qualy_final" achievementField="pole_final" achievementLabel="Pole" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Final" items={selectedRoundData.items} positionField="pos_final" pointsField="pts_final" sanctionField="desc_sancion_final" achievementField="ganador_final" achievementLabel="Ganador" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
          </div>
        </section> : null}

        <section className="!mt-16 overflow-hidden rounded-lg border border-racing-border border-t-2 border-t-yellow-300/40 bg-racing-card">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-racing-border bg-racing-gray px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-300">Posiciones del campeonato</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Tabla total</h2></div><div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400"><FlagIcon className="h-4 w-4 text-racing-red"/>{rounds.length} fecha{rounds.length === 1 ? '' : 's'} disputada{rounds.length === 1 ? '' : 's'}</span><span className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase ${championshipFinished ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'}`}>{championshipFinished ? 'Campeonato finalizado' : `${remainingRounds} fecha${remainingRounds === 1 ? '' : 's'} restante${remainingRounds === 1 ? '' : 's'}`}</span><span className="flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400"><UserGroupIcon className="h-4 w-4 text-racing-red"/>{standings.length} pilotos</span></div></header>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-black/35 text-[10px] uppercase tracking-wider text-gray-500"><tr><th className="w-20 px-4 py-3 text-center">Pos.</th><th className="min-w-60 px-4 py-3 text-left">Piloto</th>{totalRounds.map(round => <th key={round.round} title={`Fecha ${round.round} · ${round.items[0]?.circuito || ''}`} className="min-w-20 px-3 py-3 text-center">F{round.round}</th>)}<th className="min-w-24 px-4 py-3 text-right">Total</th><th className="min-w-28 px-4 py-3 text-center">Diferencia</th></tr></thead><tbody className="divide-y divide-racing-border">{standings.map(standing => { const difference = Math.max(0, (standings[0]?.puntos || 0) - standing.puntos); const selected = String(selectedPilotId) === String(standing.idpiloto); return <tr key={standing.idpiloto} className={selected ? 'bg-gradient-to-r from-green-500/20 via-green-500/[0.08] to-transparent' : ''}><td className="px-4 py-3 text-center"><strong className={`font-racing text-2xl ${standing.posicion === 1 ? 'text-yellow-300' : standing.posicion === 2 ? 'text-gray-200' : standing.posicion === 3 ? 'text-amber-600' : 'text-racing-red'}`}>{standing.posicion}°</strong></td><td className="p-0"><button type="button" onClick={() => togglePilot(standing.idpiloto)} aria-pressed={selected} className="flex w-full items-center gap-3 px-4 py-3 text-left">{standing.auto_logo ? <img src={standing.auto_logo} alt={`Logo de ${standing.marca || 'la marca'}`} className="h-9 w-12 shrink-0 object-contain"/> : null}<div className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-white">{standing.piloto}</strong>{standing.campeon ? <span className="shrink-0 bg-yellow-400 px-2 py-0.5 text-[8px] font-bold uppercase text-black">Campeón</span> : null}</span><span className="block truncate text-[11px] uppercase tracking-wide text-gray-500">{standing.modelo || '—'}</span></div></button></td>{totalRounds.map(round => { const points = standing.puntosPorFecha[String(round.round)]; return <td key={`${standing.idpiloto}-${round.round}`} className="px-3 py-3 text-center">{!points ? <strong className="text-xs font-bold uppercase text-racing-red">Ausente</strong> : <strong className="font-racing text-lg font-bold text-white">{formatPoints(points)}</strong>}</td>; })}<td className="px-4 py-3 text-right font-racing text-2xl font-bold text-yellow-300">{formatPoints(standing.puntos)}</td><td className="px-4 py-3 text-center">{difference === 0 ? <strong className="font-racing text-lg font-bold uppercase text-green-400">Líder</strong> : <><strong className="font-racing text-xl font-bold text-racing-red">{formatPoints(difference)}</strong><span className="ml-1 text-[10px] uppercase text-gray-500">pts</span></>}</td></tr>; })}</tbody></table></div>
        </section>
      </div>}
    </main>
  );
}
