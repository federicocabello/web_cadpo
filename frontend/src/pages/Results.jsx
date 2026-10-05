import { useEffect, useMemo, useState } from 'react';
import { CalendarDaysIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, FlagIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { championshipsApi, eventsApi, resultsApi } from '../services/api';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';
import { buildAssettoSanctionLabel, getAssettoSanctionItems } from '../utils/assettoResults';

const pointsFields = ['presentismo', 'pts_qualy_sprint', 'pts_sprint', 'pts_qualy_final', 'pts_final'];
const getPoints = result => pointsFields.reduce((total, field) => {
  const value = Number(String(result[field] ?? 0).replace(',', '.'));
  return total + (Number.isFinite(value) ? value : 0);
}, 0);
const formatPoints = value => Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const parseBallast = value => {
  const ballast = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(ballast) ? ballast : 0;
};
const formatBallast = value => {
  const ballast = parseBallast(value);
  if (ballast === 0) return '—';
  return `${ballast > 0 ? '+' : ''}${formatPoints(ballast)} kg`;
};
const ballastColor = value => {
  const ballast = parseBallast(value);
  if (ballast < 0) return 'text-emerald-300';
  if (ballast > 0) return 'text-orange-300';
  return 'text-gray-600';
};
const numericPosition = value => {
  const position = Number.parseInt(value, 10);
  return Number.isFinite(position) && position > 0 ? position : null;
};
const resultOrder = result => numericPosition(result.pos_final)
  ?? numericPosition(result.pos_sprint)
  ?? numericPosition(result.pos_qualy_final)
  ?? numericPosition(result.pos_qualy_sprint)
  ?? Number.MAX_SAFE_INTEGER;
const normalizedPositionStatus = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleUpperCase('es-AR');
const positionStatusOrder = value => {
  const status = normalizedPositionStatus(value);
  if (!status) return 3;
  if (status === 'S/TIEMPO' || status === 'SIN TIEMPO') return 2;
  if (status === 'DQ' || status.includes('EXCLUSION')) return 4;
  if (status === 'NO LARGO' || status === 'NO LARGÓ') return 5;
  return 1;
};
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

const parseSanctionDetails = value => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
};

const SessionSection = ({ title, sessionKey, items, positionField, pointsField, sanctionField, achievementField, achievementLabel, selectedPilotId, onSelectPilot }) => {
  const sortedItems = [...items].sort((a, b) => {
    if (!positionField) return resultOrder(a) - resultOrder(b);
    const positionA = numericPosition(a[positionField]);
    const positionB = numericPosition(b[positionField]);
    if (positionA !== null && positionB !== null) return positionA - positionB;
    if (positionA !== null) return -1;
    if (positionB !== null) return 1;
    return positionStatusOrder(a[positionField]) - positionStatusOrder(b[positionField])
      || String(a.piloto || '').localeCompare(String(b.piloto || ''), 'es-AR', { sensitivity: 'base' });
  });

  return (
    <section className="overflow-hidden border border-racing-border bg-black/20">
      <header className="border-b border-racing-border bg-racing-red/[0.08] px-4 py-3">
        <h3 className="font-racing text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
      </header>
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-black/25 text-[9px] uppercase tracking-wider text-gray-500"><tr>{positionField ? <th className="w-14 px-2 py-2 text-center">Pos.</th> : null}<th className="px-3 py-2 text-left">Piloto</th><th className="w-20 px-3 py-2 text-right">Puntos</th></tr></thead>
        <tbody className="divide-y divide-racing-border">{sortedItems.map(result => {
          const selected = String(selectedPilotId) === String(result.idpiloto);
          const achievement = Boolean(Number(result[achievementField]));
          const position = numericPosition(result[positionField]);
          const legacySanction = String(result[sanctionField] || '').trim();
          const legacySanctions = legacySanction.split(/\s*\|\s*/).filter(Boolean);
          const sanctionItems = getAssettoSanctionItems({ items: parseSanctionDetails(result.sanciones_detalle)?.[sessionKey] || [] });
          const sanctioned = Boolean(legacySanction || sanctionItems.length);
          return <tr key={`${title}-${result.id}`} className={sanctioned ? 'bg-gradient-to-r from-red-500/20 via-red-500/[0.07] to-transparent' : selected ? 'bg-gradient-to-r from-green-500/20 via-green-500/[0.08] to-transparent' : ''}>
            {positionField ? <td className="px-2 py-2 text-center"><strong className={`font-racing text-base ${sanctioned ? 'text-red-400' : position === 1 ? 'text-yellow-300' : position === 2 ? 'text-gray-200' : position === 3 ? 'text-amber-600' : 'text-white'}`}>{displayPosition(result[positionField])}</strong></td> : null}
            <td className="p-0"><button type="button" onClick={() => onSelectPilot(result.idpiloto)} aria-pressed={selected} className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left">{result.auto_logo ? <img src={result.auto_logo} alt="" className="mt-0.5 h-6 w-8 shrink-0 object-contain"/> : null}<div className="min-w-0 flex-1"><span className={`block truncate font-semibold ${sanctioned ? 'text-red-400' : 'text-gray-200'}`}>{result.piloto}</span>{selected && sanctioned ? <div className="mt-2 border-l-2 border-red-500 pl-2 text-[10px] leading-relaxed text-red-200">{sanctionItems.length ? sanctionItems.map((sanction, index) => <p key={`${result.id}-${sessionKey}-sanction-${index}`} className={`${index ? 'mt-2 border-t border-red-500/20 pt-2' : ''}`}><strong className="text-red-400">Sanción {index + 1}: </strong>{buildAssettoSanctionLabel(sanction)}</p>) : legacySanctions.map((sanction, index) => <p key={`${result.id}-${sessionKey}-legacy-${index}`} className={`${index ? 'mt-2 border-t border-red-500/20 pt-2' : ''}`}><strong className="text-red-400">{legacySanctions.length > 1 ? `Sanción ${index + 1}: ` : 'Motivo: '}</strong>{sanction}</p>)}</div> : null}</div>{sanctioned ? <span className="shrink-0 border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-red-300">{sanctionItems.length > 1 ? `${sanctionItems.length} sanciones` : 'Sanción'}</span> : achievement ? <span className="shrink-0 border border-yellow-300/40 bg-yellow-300/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-yellow-200">{achievementLabel}</span> : null}</button></td>
            <td className={`px-3 py-2 text-right font-racing text-lg font-bold ${sanctioned ? 'text-red-300' : 'text-white'}`}>{displayPoints(result[pointsField])}</td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  );
};

const EventBannerCarousel = ({ banners = [], round }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [round, banners.length]);
  useEffect(() => {
    if (banners.length < 2) return undefined;
    const interval = window.setInterval(() => setIndex(current => (current + 1) % banners.length), 8000);
    return () => window.clearInterval(interval);
  }, [banners.length]);
  if (!banners.length) return null;
  const move = direction => setIndex(current => (current + direction + banners.length) % banners.length);
  return <div className="relative aspect-[16/7] max-h-[620px] min-h-56 overflow-hidden border-b border-racing-border bg-black sm:min-h-72">
    {banners.map((banner, bannerIndex) => <img key={banner.filename || banner.url} src={banner.url} alt={`Banner de la fecha ${round}`} className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${bannerIndex === index ? 'scale-100 opacity-100' : 'pointer-events-none scale-[1.03] opacity-0'}`}/>)}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20"/>
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">{banners.map((banner, bannerIndex) => <button key={`dot-${banner.filename || banner.url}`} type="button" onClick={() => setIndex(bannerIndex)} className={`h-1.5 transition-all ${bannerIndex === index ? 'w-8 bg-racing-red' : 'w-3 bg-white/50 hover:bg-white'}`} aria-label={`Mostrar banner ${bannerIndex + 1}`}/>)}</div>
    {banners.length > 1 ? <><button type="button" onClick={() => move(-1)} className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/60 text-white backdrop-blur-sm transition hover:border-racing-red hover:bg-racing-red" aria-label="Banner anterior"><ChevronLeftIcon className="h-6 w-6"/></button><button type="button" onClick={() => move(1)} className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/60 text-white backdrop-blur-sm transition hover:border-racing-red hover:bg-racing-red" aria-label="Banner siguiente"><ChevronRightIcon className="h-6 w-6"/></button></> : null}
    <span className="absolute left-4 top-4 border border-white/20 bg-black/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">Fecha {round}</span>
  </div>;
};

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedChampionshipId = searchParams.get('campeonato') || '';
  const [championships, setChampionships] = useState([]);
  const [results, setResults] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedPilotId, setSelectedPilotId] = useState(null);
  const [warningDrivers, setWarningDrivers] = useState([]);
  const [showBallastTable, setShowBallastTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([championshipsApi.getAll(), resultsApi.getAll(), eventsApi.getAll()])
      .then(([championshipsResponse, resultsResponse, eventsResponse]) => {
        if (!active) return;
        setChampionships(championshipsResponse.data.data || []);
        setResults(resultsResponse.data.data || []);
        setEvents(eventsResponse.data.data || []);
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

  useEffect(() => {
    let active = true;
    if (!selectedChampionship?.id) {
      setWarningDrivers([]);
      return undefined;
    }
    championshipsApi.getWarnings(selectedChampionship.id)
      .then(response => {
        if (active) setWarningDrivers(response.data.data?.pilotos || []);
      })
      .catch(() => {
        if (active) setWarningDrivers([]);
      });
    return () => { active = false; };
  }, [selectedChampionship?.id]);

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
  const selectedEvent = useMemo(() => events.find(event => selectedChampionship
    && String(event.idcampeonato) === String(selectedChampionship.id)
    && String(event.ronda) === String(selectedRoundData?.round)) || null, [events, selectedChampionship, selectedRoundData?.round]);

  useEffect(() => setSelectedPilotId(null), [selectedChampionship?.id, selectedRound]);
  useEffect(() => setShowBallastTable(false), [selectedChampionship?.id]);

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

  const ballastRounds = useMemo(() => {
    const orderedRounds = [...rounds].sort((a, b) => Number(a.round) - Number(b.round));
    const configuredLastRound = Number(selectedChampionship?.rondas) || 0;
    const lastRound = configuredLastRound || Math.max(0, ...orderedRounds.map(round => Number(round.round) || 0));
    return orderedRounds.filter(round => Number(round.round) !== lastRound);
  }, [rounds, selectedChampionship?.rondas]);

  const ballastStandings = useMemo(() => {
    return standings.map(standing => {
      const ballastByRound = {};
      let total = 0;
      ballastRounds.forEach(round => {
        const result = round.items.find(item => String(item.idpiloto) === String(standing.idpiloto));
        const sprint = parseBallast(result?.kg_sprint);
        const sprintSanction = parseBallast(result?.kg_sancion_sprint);
        const final = parseBallast(result?.kg_final);
        const finalSanction = parseBallast(result?.kg_sancion_final);
        const delta = Math.round((sprint + sprintSanction + final + finalSanction) * 100) / 100;
        total = Math.round((total + delta) * 100) / 100;
        ballastByRound[String(round.round)] = { sprint, sprintSanction, final, finalSanction, delta };
      });
      return { ...standing, ballastByRound, ballastTotal: total };
    });
  }, [ballastRounds, standings]);

  const pendingWarningsByDriver = useMemo(() => new Map(warningDrivers.map(driver => [
    String(driver.idpiloto),
    (driver.sanciones_alcanzadas || []).filter(sanction => !sanction.cumplida),
  ])), [warningDrivers]);
  const warningTotalsByDriver = useMemo(() => new Map(warningDrivers.map(driver => [
    String(driver.idpiloto),
    Number(driver.apercibimientos || 0),
  ])), [warningDrivers]);
  const ballastTotalsByDriver = useMemo(() => new Map(ballastStandings.map(standing => [
    String(standing.idpiloto),
    standing.ballastTotal,
  ])), [ballastStandings]);

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
          <EventBannerCarousel banners={selectedEvent?.banners || []} round={selectedRoundData.round}/>
          <div className="grid gap-5 p-4 md:grid-cols-2 sm:p-5 lg:gap-6">
            <SessionSection title="Clasificación Sprint" sessionKey="qualy_sprint" items={selectedRoundData.items} positionField="pos_qualy_sprint" pointsField="pts_qualy_sprint" sanctionField="desc_sancion_qualy_sprint" achievementField="pole_sprint" achievementLabel="Pole" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Sprint" sessionKey="sprint" items={selectedRoundData.items} positionField="pos_sprint" pointsField="pts_sprint" sanctionField="desc_sancion_sprint" achievementField="ganador_sprint" achievementLabel="Ganador" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Clasificación Final" sessionKey="qualy_final" items={selectedRoundData.items} positionField="pos_qualy_final" pointsField="pts_qualy_final" sanctionField="desc_sancion_qualy_final" achievementField="pole_final" achievementLabel="Pole" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
            <SessionSection title="Final" sessionKey="final" items={selectedRoundData.items} positionField="pos_final" pointsField="pts_final" sanctionField="desc_sancion_final" achievementField="ganador_final" achievementLabel="Ganador" selectedPilotId={selectedPilotId} onSelectPilot={togglePilot}/>
          </div>
        </section> : null}

        <section className="!mt-16 overflow-hidden rounded-lg border border-racing-border border-t-2 border-t-yellow-300/40 bg-racing-card">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-racing-border bg-racing-gray px-5 py-5 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-300">Posiciones del campeonato</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Tabla total</h2></div><div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400"><FlagIcon className="h-4 w-4 text-racing-red"/>{rounds.length} fecha{rounds.length === 1 ? '' : 's'} disputada{rounds.length === 1 ? '' : 's'}</span><span className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase ${championshipFinished ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'}`}>{championshipFinished ? 'Campeonato finalizado' : `${remainingRounds} fecha${remainingRounds === 1 ? '' : 's'} restante${remainingRounds === 1 ? '' : 's'}`}</span><span className="flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400"><UserGroupIcon className="h-4 w-4 text-racing-red"/>{standings.length} pilotos</span></div></header>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-black/35 text-[10px] uppercase tracking-wider text-gray-500"><tr><th className="w-20 px-4 py-3 text-center">Pos.</th><th className="min-w-72 px-4 py-3 text-left">Piloto</th>{totalRounds.map(round => <th key={round.round} title={`Fecha ${round.round} · ${round.items[0]?.circuito || ''}`} className="min-w-20 px-3 py-3 text-center">F{round.round}</th>)}<th className="min-w-24 px-4 py-3 text-right">Total</th><th className="min-w-28 px-4 py-3 text-center">Diferencia</th></tr></thead><tbody className="divide-y divide-racing-border">{standings.map(standing => {
            const difference = Math.max(0, (standings[0]?.puntos || 0) - standing.puntos);
            const selected = String(selectedPilotId) === String(standing.idpiloto);
            const pendingWarnings = pendingWarningsByDriver.get(String(standing.idpiloto)) || [];
            const warningTotal = warningTotalsByDriver.get(String(standing.idpiloto)) || 0;
            const ballastTotal = ballastTotalsByDriver.get(String(standing.idpiloto)) || 0;
            return <tr key={standing.idpiloto} className={pendingWarnings.length ? 'bg-gradient-to-r from-red-500/[0.09] to-transparent' : selected ? 'bg-gradient-to-r from-green-500/20 via-green-500/[0.08] to-transparent' : ''}><td className="px-4 py-3 text-center"><strong className={`font-racing text-2xl ${standing.posicion === 1 ? 'text-yellow-300' : standing.posicion === 2 ? 'text-gray-200' : standing.posicion === 3 ? 'text-amber-600' : 'text-racing-red'}`}>{standing.posicion}°</strong></td><td className="p-0"><button type="button" onClick={() => togglePilot(standing.idpiloto)} aria-pressed={selected} className="flex w-full items-center gap-3 px-4 py-3 text-left">{standing.auto_logo ? <img src={standing.auto_logo} alt={`Logo de ${standing.marca || 'la marca'}`} className="h-9 w-12 shrink-0 object-contain"/> : null}<div className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-white">{standing.piloto}</strong>{warningTotal ? <span className="shrink-0 border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{warningTotal} AP</span> : null}{ballastTotal ? <span className={`shrink-0 border border-orange-400/25 bg-orange-400/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase ${ballastColor(ballastTotal)}`}>{formatBallast(ballastTotal)}</span> : null}{standing.campeon ? <span className="shrink-0 bg-yellow-400 px-2 py-0.5 text-[8px] font-bold uppercase text-black">Campeón</span> : null}</span><span className="block truncate text-[11px] uppercase tracking-wide text-gray-500">{standing.modelo || '—'}</span>{pendingWarnings.map(sanction => <span key={sanction.cantidad} className="mt-1 block text-[10px] font-bold uppercase leading-relaxed text-red-400">Sanción pendiente ({sanction.cantidad} AP): <span className="font-normal normal-case text-red-300">{sanction.sancion}</span></span>)}</div></button></td>{totalRounds.map(round => { const points = standing.puntosPorFecha[String(round.round)]; return <td key={`${standing.idpiloto}-${round.round}`} className="px-3 py-3 text-center">{!points ? <strong className="text-xs font-bold uppercase text-racing-red">Ausente</strong> : <strong className="font-racing text-lg font-bold text-white">{formatPoints(points)}</strong>}</td>; })}<td className="px-4 py-3 text-right font-racing text-2xl font-bold text-yellow-300">{formatPoints(standing.puntos)}</td><td className="px-4 py-3 text-center">{difference === 0 ? <strong className="font-racing text-lg font-bold uppercase text-green-400">Líder</strong> : <><strong className="font-racing text-xl font-bold text-racing-red">{formatPoints(difference)}</strong><span className="ml-1 text-[10px] uppercase text-gray-500">pts</span></>}</td></tr>;
          })}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-lg border border-racing-border border-t-2 border-t-orange-400/50 bg-racing-card">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-racing-border bg-racing-gray px-5 py-5 sm:px-6">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">Control de peso</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Tabla de lastres</h2></div>
            <div className="flex flex-wrap items-center justify-end gap-4"><p className="max-w-xl text-xs text-gray-500">El total incluye los kilos de Sprint, Final y sanciones. La última fecha no aplica lastre y los valores negativos descuentan kilos.</p><button type="button" onClick={() => setShowBallastTable(current => !current)} className="inline-flex items-center gap-2 border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-orange-200 transition hover:border-orange-300 hover:bg-orange-400/20" aria-expanded={showBallastTable}>{showBallastTable ? <><ChevronUpIcon className="h-4 w-4"/>Ocultar tabla</> : <><ChevronDownIcon className="h-4 w-4"/>Mostrar tabla</>}</button></div>
          </header>
          {showBallastTable ? <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-black/35 text-[10px] uppercase tracking-wider text-gray-500">
                  <th rowSpan={2} className="min-w-60 border border-racing-border px-4 py-3 text-left">Piloto</th>
                  <th rowSpan={2} className="min-w-28 border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-center text-orange-200">Total de lastre</th>
                  {ballastRounds.map(round => <th key={`ballast-${round.round}`} colSpan={4} className="border border-racing-border px-3 py-3 text-center text-gray-300">Fecha {round.round}</th>)}
                </tr>
                <tr className="bg-black/25 text-[9px] uppercase tracking-wider text-gray-500">
                  {ballastRounds.flatMap(round => [
                    <th key={`${round.round}-s`} title="Lastre por Sprint" className="min-w-14 border border-racing-border px-2 py-2">S</th>,
                    <th key={`${round.round}-ss`} title="Sanción de lastre en Sprint" className="min-w-14 border border-red-500/30 bg-red-500/[0.06] px-2 py-2 text-red-400">Sanc. S</th>,
                    <th key={`${round.round}-f`} title="Lastre por Final" className="min-w-14 border border-racing-border px-2 py-2">F</th>,
                    <th key={`${round.round}-fs`} title="Sanción de lastre en Final" className="min-w-14 border border-red-500/30 bg-red-500/[0.06] px-2 py-2 text-red-400">Sanc. F</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {ballastStandings.map((standing, index) => <tr key={`ballast-${standing.idpiloto}`} className={index % 2 ? 'bg-black/10' : ''}>
                  <td className="border border-racing-border px-4 py-3"><div className="flex min-w-0 items-center gap-3">{standing.auto_logo ? <img src={standing.auto_logo} alt="" className="h-8 w-11 shrink-0 object-contain"/> : null}<div className="min-w-0"><strong className="block truncate text-white">{standing.piloto}</strong><span className="block truncate text-[10px] uppercase text-gray-500">{standing.modelo || '—'}</span></div></div></td>
                  <td className={`border border-orange-400/30 bg-orange-400/[0.09] px-4 py-3 text-center font-racing text-xl font-bold ${ballastColor(standing.ballastTotal)}`}>{formatBallast(standing.ballastTotal)}</td>
                  {ballastRounds.flatMap(round => {
                    const detail = standing.ballastByRound[String(round.round)];
                    return [
                      <td key={`${standing.idpiloto}-${round.round}-s`} className={`border border-racing-border px-2 py-3 text-center font-racing text-sm ${ballastColor(detail?.sprint)}`}>{formatBallast(detail?.sprint)}</td>,
                      <td key={`${standing.idpiloto}-${round.round}-ss`} className={`border px-2 py-3 text-center font-racing text-sm ${parseBallast(detail?.sprintSanction) !== 0 ? 'border-red-500/25 bg-red-500/[0.05] text-red-400' : 'border-racing-border text-gray-600'}`}>{formatBallast(detail?.sprintSanction)}</td>,
                      <td key={`${standing.idpiloto}-${round.round}-f`} className={`border border-racing-border px-2 py-3 text-center font-racing text-sm ${ballastColor(detail?.final)}`}>{formatBallast(detail?.final)}</td>,
                      <td key={`${standing.idpiloto}-${round.round}-fs`} className={`border px-2 py-3 text-center font-racing text-sm ${parseBallast(detail?.finalSanction) !== 0 ? 'border-red-500/25 bg-red-500/[0.05] text-red-400' : 'border-racing-border text-gray-600'}`}>{formatBallast(detail?.finalSanction)}</td>,
                    ];
                  })}
                </tr>)}
              </tbody>
            </table>
          </div> : null}
        </section>
      </div>}
    </main>
  );
}
