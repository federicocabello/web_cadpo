import { useMemo, useState, useEffect } from 'react';
import { ArrowDownTrayIcon, CalendarDaysIcon, FilmIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { replaysApi } from '../services/api';
import { formatCalendarDate } from '../utils/calendarDate';

const formatFileSize = bytes => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.ceil(size / 1024).toLocaleString('es-AR')} KB`;
};

export default function Replays() {
  const [replays, setReplays] = useState([]);
  const [championshipId, setChampionshipId] = useState('');
  const [round, setRound] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    replaysApi.getAll()
      .then(response => setReplays(response.data.data || []))
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar los replays.'))
      .finally(() => setLoading(false));
  }, []);

  const championships = useMemo(() => {
    const unique = new Map();
    replays.forEach(replay => unique.set(String(replay.idcampeonato), replay));
    return [...unique.values()];
  }, [replays]);

  const rounds = useMemo(() => {
    const unique = new Map();
    replays.filter(replay => !championshipId || String(replay.idcampeonato) === championshipId)
      .forEach(replay => unique.set(String(replay.ronda), replay));
    return [...unique.values()].sort((a, b) => Number(b.ronda) - Number(a.ronda));
  }, [championshipId, replays]);

  const visibleReplays = useMemo(() => replays.filter(replay =>
    (!championshipId || String(replay.idcampeonato) === championshipId)
    && (!round || String(replay.ronda) === round)
  ), [championshipId, replays, round]);

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-7xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-racing-border pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">Descargas de carrera</p>
        <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Replays</h1>
        <p className="mt-2 max-w-2xl text-gray-400">Descargá las repeticiones oficiales organizadas por campeonato, fecha y tanda.</p>
      </header>

      {!loading && replays.length ? <section className="mt-6 grid gap-3 border border-racing-border bg-racing-gray p-4 sm:grid-cols-2">
        <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={championshipId} onChange={event => { setChampionshipId(event.target.value); setRound(''); }} className="input-field mt-1.5 py-2.5 text-sm"><option value="">Todos los campeonatos</option>{championships.map(item => <option key={item.idcampeonato} value={item.idcampeonato}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label>
        <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</span><select value={round} onChange={event => setRound(event.target.value)} className="input-field mt-1.5 py-2.5 text-sm"><option value="">Todas las fechas</option>{rounds.map(item => <option key={item.ronda} value={item.ronda}>Fecha {item.ronda} · {item.circuito || 'Circuito'}</option>)}</select></label>
      </section> : null}

      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">{error}</div> : !visibleReplays.length ? <div className="mt-8 border border-dashed border-racing-border py-16 text-center"><FilmIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">No hay replays disponibles</h2><p className="mt-2 text-sm text-gray-500">Cuando se publique una repetición aparecerá en esta sección.</p></div> : <section className="mt-8 space-y-4">{visibleReplays.map(replay => <article key={replay.id} className="grid gap-4 border border-racing-border bg-racing-card p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex h-14 w-14 items-center justify-center bg-racing-red/10 text-racing-red">{replay.categoria_logo ? <img src={replay.categoria_logo} alt="" className="h-11 w-11 object-contain"/> : <TrophyIcon className="h-7 w-7"/>}</div>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">{replay.categoria} · Temporada {replay.temporada}</p><h2 className="mt-1 font-racing text-xl font-bold uppercase text-white">Fecha {replay.ronda} · {replay.tanda}</h2><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span>{replay.circuito}{replay.variante ? ` · ${replay.variante}` : ''}</span>{replay.fecha ? <span className="inline-flex items-center gap-1"><CalendarDaysIcon className="h-4 w-4"/>{formatCalendarDate(replay.fecha, { day: '2-digit', month: 'long', year: 'numeric' })}</span> : null}<span>{formatFileSize(replay.tamano)}</span></div></div>
        <a href={replay.archivo} download={replay.nombre_original || undefined} className="inline-flex items-center justify-center gap-2 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-racing-red-dark"><ArrowDownTrayIcon className="h-5 w-5"/>Descargar</a>
      </article>)}</section>}
    </main>
  );
}
