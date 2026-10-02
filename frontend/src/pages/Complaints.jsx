import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, CalendarDaysIcon, DocumentTextIcon, ExclamationTriangleIcon, FlagIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { complaintsApi, replaysApi } from '../services/api';
import { formatCalendarDate } from '../utils/calendarDate';
import { formatComplaintCountdown } from '../utils/complaintCountdown';

const emptyForm = {
  idpiloto_denunciado: '',
  tanda: '',
  minuto_repeticion: '',
  descripcion: '',
};

const normalizeReplayMinute = value => {
  const match = String(value || '').trim().replace(/\s+/g, '').match(/^(\d+)(?:[.,:](\d{1,2}))?$/);
  if (!match || Number(match[2] || 0) > 59) return value;
  return `${Number(match[1])}.${String(Number(match[2] || 0)).padStart(2, '0')}`;
};

const eventTitle = event => `${event.categoria} · Temporada ${event.temporada} · Fecha ${event.ronda}`;

export default function Complaints() {
  const [context, setContext] = useState({ eventos: [], proxima: null });
  const [selectedEventKey, setSelectedEventKey] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [replays, setReplays] = useState([]);
  const [replaysLoading, setReplaysLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadContext = () => complaintsApi.getContext()
      .then(response => {
        if (!active) return;
        const data = response.data.data || { eventos: [], proxima: null };
        setContext(data);
        const first = data.eventos?.[0];
        setSelectedEventKey(current => current || (first ? `${first.idcampeonato}-${first.ronda}` : ''));
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.error || 'No se pudo consultar el período de denuncias.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    loadContext();
    const interval = window.setInterval(loadContext, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedEvent = useMemo(() => context.eventos.find(event =>
    `${event.idcampeonato}-${event.ronda}` === selectedEventKey
  ) || context.eventos[0] || null, [context.eventos, selectedEventKey]);
  const closingCountdown = formatComplaintCountdown(selectedEvent?.cierre_denuncias, now);
  const selectedEventOpen = Boolean(selectedEvent && closingCountdown);

  useEffect(() => {
    if (!selectedEventOpen) {
      setReplays([]);
      setReplaysLoading(false);
      return undefined;
    }
    let active = true;
    setReplaysLoading(true);
    replaysApi.getAll({ idcampeonato: selectedEvent.idcampeonato, ronda: selectedEvent.ronda })
      .then(response => {
        if (active) setReplays(response.data.data || []);
      })
      .catch(() => {
        if (active) setReplays([]);
      })
      .finally(() => {
        if (active) setReplaysLoading(false);
      });
    return () => { active = false; };
  }, [selectedEvent?.idcampeonato, selectedEvent?.ronda, selectedEventOpen]);

  const submit = async event => {
    event.preventDefault();
    if (!selectedEventOpen || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const minute = normalizeReplayMinute(form.minuto_repeticion);
      const response = await complaintsApi.create({
        ...form,
        minuto_repeticion: minute,
        idcampeonato: selectedEvent.idcampeonato,
        ronda: selectedEvent.ronda,
      });
      setForm(emptyForm);
      setMessage(response.data.message || 'La denuncia fue enviada correctamente.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo enviar la denuncia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-6xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-racing-border pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">Revisión deportiva</p>
        <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Denuncias</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">El formulario es completamente anónimo. Podés denunciar cualquier situación todas las veces que consideres necesario. Si una denuncia no corresponde a una sanción, la resolución se informará en los resultados junto con la explicación de los motivos.</p>
      </header>

      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent" /></div> : null}
      {!loading && error && !selectedEventOpen ? <div className="mt-8 border border-red-500/35 bg-red-500/10 p-6 text-center text-red-200">{error}</div> : null}

      {!loading && !selectedEventOpen ? <section className="mt-8 border border-racing-border bg-racing-card p-7 text-center sm:p-10">
        <ShieldCheckIcon className="mx-auto h-14 w-14 text-gray-600" />
        <h2 className="mt-4 font-racing text-3xl font-bold uppercase text-white">No hay un período habilitado</h2>
        <p className="mx-auto mt-3 max-w-2xl text-gray-400">Las denuncias se habilitan automáticamente cuando comienza la clasificación de una fecha y permanecen abiertas hasta las 23:45 del día siguiente.</p>
        {context.proxima ? <div className="mx-auto mt-6 max-w-xl border border-racing-border bg-black/25 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">Próxima apertura</p><p className="mt-1 font-racing text-xl font-bold uppercase text-white">{eventTitle(context.proxima)}</p><p className="mt-2 inline-flex items-center gap-2 text-sm text-gray-400"><CalendarDaysIcon className="h-4 w-4 text-racing-red" />{formatCalendarDate(context.proxima.fecha, { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p></div> : null}
      </section> : null}

      {!loading && selectedEventOpen ? <><section className="mt-8 flex flex-col gap-3 border border-orange-400/45 bg-orange-400/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-400"/><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">Formulario de denuncias habilitado</p><p className="mt-0.5 text-xs uppercase text-gray-500">Hasta las {formatCalendarDate(selectedEvent.cierre_denuncias, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p></div></div><div className="sm:text-right"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Cierra en</p><p className="mt-1 font-racing text-xl font-bold uppercase text-white">{closingCountdown}</p></div></section><div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.35fr]">
        <aside className="self-start border border-racing-border bg-racing-card p-5 sm:p-6">
          <div className="flex items-start gap-4">{selectedEvent.categoria_logo ? <img src={selectedEvent.categoria_logo} alt="" className="h-20 w-24 shrink-0 object-contain" /> : <FlagIcon className="h-14 w-14 shrink-0 text-racing-red" />}<div><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">Campeonato seleccionado</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">{selectedEvent.categoria}</h2><p className="text-sm text-gray-400">Temporada {selectedEvent.temporada} · Fecha {selectedEvent.ronda}</p></div></div>
          <div className="mt-5 border-t border-racing-border pt-5 text-sm"><p className="flex items-start gap-2 text-gray-300"><FlagIcon className="mt-0.5 h-4 w-4 shrink-0 text-racing-red" /><span>{selectedEvent.circuito}{selectedEvent.variante ? ` · ${selectedEvent.variante}` : ''}</span></p></div>
          {selectedEvent.reglamento || replaysLoading || replays.length ? <div className="mt-5 border-t border-racing-border pt-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Documentación y descargas</p><div className="mt-3 space-y-2">{selectedEvent.reglamento ? <a href={selectedEvent.reglamento} target="_blank" rel="noreferrer" className="flex w-full items-center justify-between gap-3 border border-white/15 bg-white/[0.04] px-3 py-2.5 text-left text-xs font-bold uppercase text-gray-200 transition hover:border-white hover:bg-white/[0.08]"><span className="flex min-w-0 items-center gap-2"><DocumentTextIcon className="h-5 w-5 shrink-0 text-white"/><span>Ver reglamento</span></span><span className="text-[9px] text-gray-500">PDF</span></a> : null}{replaysLoading ? <div className="border border-racing-border bg-black/20 px-3 py-3 text-xs text-gray-500">Buscando repeticiones...</div> : replays.map(replay => <a key={replay.id} href={`/api/replays/${replay.id}/download`} className="flex w-full items-center justify-between gap-3 border border-racing-red/30 bg-racing-red/10 px-3 py-2.5 text-left transition hover:border-racing-red hover:bg-racing-red/20"><span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-widest text-racing-red">Repetición · Fecha {replay.ronda}</span><strong className="mt-0.5 block truncate text-xs uppercase text-white">{replay.tanda}</strong></span><ArrowDownTrayIcon className="h-5 w-5 shrink-0 text-racing-red"/></a>)}</div></div> : null}
          {context.eventos.length > 1 ? <label className="mt-5 block"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Evento habilitado</span><select value={selectedEventKey} onChange={event => { setSelectedEventKey(event.target.value); setForm(emptyForm); setMessage(''); setError(''); }} className="input-field mt-2">{context.eventos.map(item => <option key={`${item.idcampeonato}-${item.ronda}`} value={`${item.idcampeonato}-${item.ronda}`}>{eventTitle(item)}</option>)}</select></label> : null}
        </aside>

        <section className="border border-racing-border bg-racing-card p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center bg-racing-red text-white"><ExclamationTriangleIcon className="h-6 w-6" /></span><div><p className="text-[10px] font-bold uppercase tracking-widest text-racing-red">Formulario anónimo</p><h2 className="font-racing text-2xl font-bold uppercase text-white">Informar una maniobra</h2></div></div>
          <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="text-sm text-gray-300">Piloto denunciado</span><select value={form.idpiloto_denunciado} onChange={event => setForm(current => ({ ...current, idpiloto_denunciado: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar piloto</option>{selectedEvent.pilotos.map(driver => <option key={driver.id} value={driver.id}>#{driver.numero ?? 0} · {driver.nombre}</option>)}</select><small className="mt-1 block text-xs text-gray-600">Los pilotos están ordenados alfabéticamente.</small></label>
            <label className="block"><span className="text-sm text-gray-300">Tanda</span><select value={form.tanda} onChange={event => setForm(current => ({ ...current, tanda: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar tanda</option><option value="SPRINT">Sprint</option><option value="FINAL">Final</option></select></label>
            <label className="block"><span className="text-sm text-gray-300">Minuto de la repetición</span><input type="text" inputMode="decimal" value={form.minuto_repeticion} onChange={event => setForm(current => ({ ...current, minuto_repeticion: event.target.value }))} onBlur={() => setForm(current => ({ ...current, minuto_repeticion: normalizeReplayMinute(current.minuto_repeticion) }))} className="input-field mt-2" placeholder="1.24" maxLength={12} required /><small className="mt-1 block text-xs text-gray-600">Ejemplo: 1.24 significa 1 minuto y 24 segundos. También podés escribir 1,24 o 1:24.</small></label>
            <label className="block sm:col-span-2"><span className="text-sm text-gray-300">Breve descripción de la maniobra <span className="text-gray-600">(opcional)</span></span><textarea value={form.descripcion} onChange={event => setForm(current => ({ ...current, descripcion: event.target.value }))} className="input-field mt-2 min-h-32 resize-y" maxLength={1000} placeholder="Contanos brevemente qué ocurrió..." /><small className="mt-1 block text-right text-xs text-gray-600">{form.descripcion.length}/1000</small></label>
            <div className="sm:col-span-2"><button type="submit" disabled={saving || !selectedEvent.pilotos.length} className="inline-flex w-full items-center justify-center gap-2 bg-racing-red px-6 py-3.5 font-racing text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-racing-red-dark disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Enviando denuncia...' : 'Enviar denuncia anónima'}</button>{message ? <p className="mt-4 border border-green-400/35 bg-green-500/10 p-4 text-center text-sm font-semibold text-green-300">{message}</p> : null}{error ? <p className="mt-4 border border-red-400/35 bg-red-500/10 p-4 text-center text-sm text-red-200">{error}</p> : null}</div>
          </form>
        </section>
      </div></> : null}
    </main>
  );
}
