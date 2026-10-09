import { useEffect, useState } from 'react';
import { ChartBarIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { pollsApi } from '../services/api';
import { formatCalendarDate } from '../utils/calendarDate';

const formatDate = value => formatCalendarDate(value, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', ' ·');
const pollTime = value => new Date(String(value || '').replace(' ', 'T')).getTime();
const normalizeOptionIds = values => [...new Set((values || []).map(value => String(value)))].sort();
const sameOptionIds = (first, second) => JSON.stringify(normalizeOptionIds(first)) === JSON.stringify(normalizeOptionIds(second));

function PollOptionCarousel({ images, title }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
    if (images.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex(current => (current + 1) % images.length), 6000);
    return () => window.clearInterval(timer);
  }, [images]);
  const activeImage = images[activeIndex] || '';
  const changeImage = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex(current => (current + direction + images.length) % images.length);
  };
  return <>
    {activeImage ? <img key={activeImage} src={activeImage} alt={`${title} · imagen ${activeIndex + 1}`} className="animate-fade-in h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
    {images.length > 1 ? <><button type="button" onClick={event => changeImage(event, -1)} className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white transition hover:border-cyan-200 hover:bg-cyan-300 hover:text-black sm:left-3 sm:h-9 sm:w-9" aria-label={`Foto anterior de ${title}`}><ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5"/></button><button type="button" onClick={event => changeImage(event, 1)} className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white transition hover:border-cyan-200 hover:bg-cyan-300 hover:text-black sm:right-3 sm:h-9 sm:w-9" aria-label={`Foto siguiente de ${title}`}><ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5"/></button><div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/65 px-2 py-1.5 sm:bottom-3">{images.map((image, index) => <span key={image} className={`h-1.5 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-5 bg-cyan-300' : 'w-1.5 bg-white/55'}`}/>)}</div></> : null}
  </>;
}

export default function PollsSection({ polls, onPollUpdated }) {
  const [submitting, setSubmitting] = useState('');
  const [messages, setMessages] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  if (!polls.length) return null;

  const submitVote = async (pollId, optionIds) => {
    setSubmitting(String(pollId)); setMessages(current => ({ ...current, [pollId]: '' }));
    try {
      const response = await pollsApi.vote(pollId, optionIds);
      onPollUpdated(response.data.data);
      setSelectedOptions(current => { const next = { ...current }; delete next[pollId]; return next; });
      setMessages(current => ({ ...current, [pollId]: response.data.message || 'Tu voto fue registrado.' }));
    } catch (error) { setMessages(current => ({ ...current, [pollId]: error.response?.data?.error || 'No se pudo registrar el voto.' })); }
    finally { setSubmitting(''); }
  };

  const toggleOption = (pollId, optionId, currentIds, maxOptions) => {
    const optionKey = String(optionId);
    const normalized = normalizeOptionIds(currentIds);
    let next;
    if (normalized.includes(optionKey)) next = normalized.filter(id => id !== optionKey);
    else if (maxOptions === 1) next = [optionKey];
    else if (normalized.length >= maxOptions) {
      setMessages(current => ({ ...current, [pollId]: `Podés elegir como máximo ${maxOptions} opciones. Desmarcá una para cambiarla.` }));
      return;
    } else next = [...normalized, optionKey];
    setSelectedOptions(current => ({ ...current, [pollId]: next }));
    setMessages(current => ({ ...current, [pollId]: '' }));
  };

  return <section>
    <header className="mb-5 flex items-end justify-between gap-4 border-l-2 border-cyan-300 pl-4"><div><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300"><ChartBarIcon className="h-4 w-4" /> Tu opinión decide</div><h2 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">Próximos campeonatos</h2><p className="mt-1 text-sm text-gray-500">Elegí tus opciones y confirmá el voto.</p></div></header>
    <div className="grid gap-6">
      {polls.map(poll => {
        const startsAt = pollTime(poll.fecha_inicio);
        const closesAt = pollTime(poll.fecha_cierre);
        const upcoming = Number.isFinite(startsAt) ? now < startsAt : poll.estado === 'proxima';
        const closed = Number.isFinite(closesAt) ? now > closesAt : poll.estado === 'cerrada';
        const openingMinutes = upcoming && Number.isFinite(startsAt) ? Math.max(0, Math.ceil((startsAt - now) / 60000)) : 0;
        const openingCountdown = [
          { key: 'days', value: Math.floor(openingMinutes / 1440), singular: 'Día', plural: 'Días' },
          { key: 'hours', value: Math.floor((openingMinutes % 1440) / 60), singular: 'Hora', plural: 'Horas' },
          { key: 'minutes', value: openingMinutes % 60, singular: 'Minuto', plural: 'Minutos' },
        ].filter(part => part.value > 0);
        const remainingMinutes = !closed && Number.isFinite(closesAt) ? Math.max(0, Math.ceil((closesAt - now) / 60000)) : 0;
        const closingCountdown = [
          { key: 'days', value: Math.floor(remainingMinutes / 1440), singular: 'Día', plural: 'Días' },
          { key: 'hours', value: Math.floor((remainingMinutes % 1440) / 60), singular: 'Hora', plural: 'Horas' },
          { key: 'minutes', value: remainingMinutes % 60, singular: 'Minuto', plural: 'Minutos' },
        ].filter(part => part.value > 0);
        const showResults = closed || poll.ya_voto;
        const disabled = submitting === String(poll.id) || upcoming || closed;
        const maxOptions = Math.max(1, Number(poll.max_opciones || 1));
        const savedOptionIds = normalizeOptionIds(poll.idopciones_votadas?.length ? poll.idopciones_votadas : (poll.idopcion_votada ? [poll.idopcion_votada] : []));
        const selectedOptionIds = normalizeOptionIds(Object.prototype.hasOwnProperty.call(selectedOptions, poll.id) ? selectedOptions[poll.id] : savedOptionIds);
        const voteChanged = poll.ya_voto && !sameOptionIds(selectedOptionIds, savedOptionIds);
        const winningPercentage = closed ? Math.max(0, ...poll.opciones.map(option => Number(option.porcentaje || 0))) : 0;
        const winners = closed && (winningPercentage > 0 || Number(poll.total_votos) > 0)
          ? poll.opciones.filter(option => Number(option.porcentaje || 0) === winningPercentage)
          : [];
        const winnerIds = new Set(winners.map(option => String(option.id)));
        const optionGridClass = poll.opciones.length === 2 ? 'sm:grid-cols-2' : poll.opciones.length >= 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : '';
        return <article key={poll.id} className="overflow-hidden border border-cyan-300/25 bg-racing-card p-5 shadow-xl shadow-black/25 sm:p-7">
          <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${closed ? 'bg-gray-700 text-gray-200' : upcoming ? 'bg-yellow-300 text-black' : 'bg-cyan-300 text-black'}`}>{closed ? <CheckCircleIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}{closed ? 'Votación cerrada' : upcoming ? 'Próxima votación' : 'Votación abierta'}</span>{upcoming ? <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400"><strong className="text-yellow-300">Abre en</strong>{openingCountdown.map(part => <span key={part.key}><b className="font-racing text-sm text-white">{part.value}</b> {part.value === 1 ? part.singular : part.plural}</span>)}</span> : null}</div>
          {poll.dias ? <p className="mt-4 font-racing text-xl font-bold uppercase tracking-[0.18em] text-cyan-300 sm:text-2xl">DÍAS • {poll.dias}</p> : null}
          {!closed ? <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.14em]"><span className="text-gray-400">{maxOptions === 1 ? 'Elegí una opción' : `Elegí hasta ${maxOptions} opciones`}</span>{!upcoming ? <span className="text-cyan-300">Seleccionadas {selectedOptionIds.length}/{maxOptions}</span> : null}</div> : null}
          {!upcoming ? <div className="mt-4 flex flex-col gap-3 border-l-2 border-cyan-300/70 bg-black/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">Cierre de la votación</p><p className="mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-200 sm:text-sm"><ClockIcon className="h-4 w-4 shrink-0 text-cyan-300"/>{formatDate(poll.fecha_cierre)} H</p></div>
            {!closed && closingCountdown.length ? <div className="flex flex-wrap gap-2">{closingCountdown.map(part => <div key={part.key} className="min-w-16 border border-cyan-300/20 bg-black/45 px-3 py-2 text-center"><strong className="block font-racing text-xl font-bold tabular-nums text-cyan-300 sm:text-2xl">{part.value}</strong><span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500 sm:text-[9px]">{part.value === 1 ? part.singular : part.plural}</span></div>)}</div> : null}
          </div> : null}
          {winners.length ? <div className="poll-winner-banner mt-5 flex flex-col gap-3 border border-yellow-300/60 bg-yellow-400/10 px-5 py-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-black"><TrophyIcon className="h-6 w-6" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300">{winners.length === 1 ? 'Ganador de la votación' : 'Empate en la votación'}</p><p className="mt-1 font-racing text-2xl font-bold uppercase text-white sm:text-3xl">{winners.map(option => option.titulo).join(' • ')}</p></div></div> : null}
          <div className={`mt-6 grid grid-cols-1 gap-3 sm:gap-5 ${optionGridClass}`}>
            {poll.opciones.map(option => {
              const selected = selectedOptionIds.includes(String(option.id));
              const winner = winnerIds.has(String(option.id));
              const optionImages = option.imagenes?.length ? option.imagenes : (option.imagen ? [option.imagen] : []);
              return <div key={option.id} role="button" tabIndex={disabled || closed ? -1 : 0} aria-disabled={disabled || closed} aria-pressed={selected} onClick={() => { if (!disabled && !closed) toggleOption(poll.id, option.id, selectedOptionIds, maxOptions); }} onKeyDown={event => { if (!disabled && !closed && ['Enter', ' '].includes(event.key)) { event.preventDefault(); toggleOption(poll.id, option.id, selectedOptionIds, maxOptions); } }} className={`group relative grid min-h-[150px] grid-cols-[minmax(105px,36%)_minmax(0,1fr)] overflow-hidden border bg-black/35 text-left transition sm:flex sm:min-h-full sm:flex-col ${disabled || closed ? 'cursor-not-allowed' : 'cursor-pointer'} ${winner ? 'poll-winner-card border-yellow-300 ring-2 ring-yellow-300/35' : closed && winners.length ? 'border-white/10 opacity-60 grayscale-[35%]' : selected ? 'border-cyan-300 ring-2 ring-cyan-300/40' : 'border-white/15 hover:border-cyan-300'}`}>
                <div className="relative h-full min-h-[150px] w-full overflow-hidden bg-gray-900 sm:aspect-[16/10] sm:h-auto sm:min-h-0">
                  <PollOptionCarousel images={optionImages} title={option.titulo}/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                  {winner ? <span className="poll-winner-badge absolute left-2 top-2 inline-flex items-center gap-1.5 bg-yellow-300 px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-black shadow-xl sm:left-4 sm:top-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.18em]"><TrophyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Ganador</span> : null}
                  {!closed && !upcoming ? <span className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center border shadow-lg sm:right-4 sm:top-4 sm:h-8 sm:w-8 ${maxOptions === 1 ? 'rounded-full' : 'rounded-sm'} ${selected ? 'border-cyan-200 bg-cyan-300' : 'border-white/70 bg-black/55'}`}>{selected ? <CheckCircleIcon className="h-5 w-5 text-black" /> : null}</span> : null}
                </div>
                <div className="relative flex min-w-0 flex-1 flex-col p-3.5 sm:p-6">
                  <div className="flex items-start justify-between gap-2 sm:gap-4"><strong className="min-w-0 break-words font-racing text-lg font-bold uppercase leading-tight text-white sm:text-3xl sm:leading-none">{option.titulo}</strong>{showResults ? <span className="animate-fade-in shrink-0 font-racing text-2xl font-bold text-cyan-300 sm:text-4xl">{option.porcentaje}%</span> : null}</div>
                  {option.descripcion ? <div className="mt-2 border-l-2 border-cyan-300/60 bg-black/30 px-2.5 py-2 sm:mt-4 sm:px-4 sm:py-3"><p className="whitespace-pre-line text-[11px] leading-relaxed text-gray-300 sm:text-sm">{option.descripcion}</p></div> : null}
                  {showResults ? <div className="animate-fade-in mt-auto pt-3 sm:pt-4"><div className="h-1.5 overflow-hidden bg-white/10 sm:h-2"><div className="poll-result-fill h-full origin-left bg-cyan-300" style={{ width: `${option.porcentaje}%` }} /></div></div> : null}
                </div>
              </div>;
            })}
          </div>
          {!closed && !upcoming ? <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center"><button type="button" disabled={!selectedOptionIds.length || submitting === String(poll.id) || (poll.ya_voto && !voteChanged)} onClick={() => submitVote(poll.id, selectedOptionIds)} className="w-full bg-cyan-300 px-7 py-3 font-racing text-sm font-bold uppercase tracking-wider text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto">{submitting === String(poll.id) ? 'Confirmando...' : poll.ya_voto ? 'Confirmar cambio' : 'Confirmar voto'}</button>{poll.ya_voto ? <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"><CheckCircleIcon className="h-5 w-5 shrink-0" />{voteChanged ? 'Confirmá para reemplazar tus opciones anteriores.' : `Tu voto está registrado con ${savedOptionIds.length} opción${savedOptionIds.length === 1 ? '' : 'es'}.`}</p> : null}</div> : null}
          {messages[poll.id] ? <p className="mt-4 border-l-2 border-cyan-300 pl-3 text-sm text-gray-200">{messages[poll.id]}</p> : null}
        </article>;
      })}
    </div>
  </section>;
}
