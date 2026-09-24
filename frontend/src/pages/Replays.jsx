import { useMemo, useState, useEffect } from 'react';
import { ArrowDownTrayIcon, CalendarDaysIcon, FilmIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { replaysApi } from '../services/api';
import { formatCalendarDate } from '../utils/calendarDate';

const formatFileSize = bytes => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.ceil(size / 1024).toLocaleString('es-AR')} KB`;
};

const PAGE_SIZE = 10;

export default function Replays() {
  const [replays, setReplays] = useState([]);
  const [championshipId, setChampionshipId] = useState('');
  const [page, setPage] = useState(1);
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

  const filteredReplays = useMemo(() => replays.filter(replay =>
    !championshipId || String(replay.idcampeonato) === championshipId
  ), [championshipId, replays]);

  const totalPages = championshipId ? 1 : Math.max(1, Math.ceil(filteredReplays.length / PAGE_SIZE));
  const visibleReplays = championshipId
    ? filteredReplays
    : filteredReplays.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-7xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-racing-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">Descargas de carrera</p>
          <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Replays</h1>
          <p className="mt-2 max-w-2xl text-gray-400">Descargá las repeticiones oficiales organizadas por campeonato, fecha y tanda.</p>
        </div>
        {!loading && replays.length ? <label className="w-full shrink-0 md:w-80"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={championshipId} onChange={event => { setChampionshipId(event.target.value); setPage(1); }} className="input-field mt-1.5 py-2.5 text-sm"><option value="">Todos los campeonatos</option>{championships.map(item => <option key={item.idcampeonato} value={item.idcampeonato}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label> : null}
      </header>

      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">{error}</div> : !visibleReplays.length ? <div className="mt-8 border border-dashed border-racing-border py-16 text-center"><FilmIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">No hay replays disponibles</h2><p className="mt-2 text-sm text-gray-500">Cuando se publique una repetición aparecerá en esta sección.</p></div> : <section className="mt-8 space-y-4">{visibleReplays.map(replay => <article key={replay.id} className="grid gap-4 border border-racing-border bg-racing-card p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex h-20 w-24 items-center justify-center text-racing-red">{replay.categoria_logo ? <img src={replay.categoria_logo} alt={`Logo ${replay.categoria}`} className="h-20 w-24 object-contain"/> : <TrophyIcon className="h-10 w-10"/>}</div>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">{replay.categoria} · Temporada {replay.temporada}</p><h2 className="mt-1 font-racing text-xl font-bold uppercase text-white">Fecha {replay.ronda} · {replay.tanda}</h2><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span className="inline-flex items-center gap-1"><MapPinIcon className="h-4 w-4 shrink-0 text-racing-red"/>{replay.circuito}{replay.variante ? ` · ${replay.variante}` : ''}</span>{replay.fecha ? <span className="inline-flex items-center gap-1"><CalendarDaysIcon className="h-4 w-4"/>{formatCalendarDate(replay.fecha, { day: '2-digit', month: 'long', year: 'numeric' })}</span> : null}<span>{formatFileSize(replay.tamano)}</span></div></div>
        <a href={replay.archivo} download={replay.nombre_original || undefined} className="inline-flex items-center justify-center gap-2 bg-racing-red px-5 py-3 font-racing text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-racing-red-dark"><ArrowDownTrayIcon className="h-5 w-5"/>Descargar</a>
      </article>)}</section>}

      {!loading && !error && !championshipId && totalPages > 1 ? <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Paginación de replays">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="border border-racing-border px-4 py-2 text-xs font-bold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35">Anterior</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => <button key={number} type="button" onClick={() => setPage(number)} className={`h-9 min-w-9 border px-3 text-sm font-bold transition-colors ${page === number ? 'border-racing-red bg-racing-red text-white' : 'border-racing-border text-gray-400 hover:border-racing-red hover:text-white'}`} aria-current={page === number ? 'page' : undefined}>{number}</button>)}
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="border border-racing-border px-4 py-2 text-xs font-bold uppercase text-gray-300 transition-colors hover:border-racing-red hover:text-white disabled:cursor-not-allowed disabled:opacity-35">Siguiente</button>
      </nav> : null}
    </main>
  );
}
