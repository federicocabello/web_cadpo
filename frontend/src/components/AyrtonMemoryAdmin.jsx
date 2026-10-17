import { useCallback, useEffect, useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { ayrtonApi } from '../services/api';

const emptyForm = {
  title: '',
  content: '',
  keywords: '',
  priority: 0,
  approved: true,
  active: true,
};

const cleanAnswer = value => String(value || '').replace(/\s*COPIADO\.?$/i, '').trim();

const normalizeGeneralContext = value => String(value || '')
  .toUpperCase()
  .replace(/\r\n?/g, '\n')
  .replace(/\.+(?=\s|$)|\n+/g, '; ')
  .replace(/\s*;\s*/g, '; ')
  .replace(/(?:;\s*){2,}/g, '; ')
  .slice(0, 12000);

const formatDate = value => value ? new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date(`${String(value).replace(' ', 'T')}Z`)) : '';

export default function AyrtonMemoryAdmin() {
  const [knowledge, setKnowledge] = useState([]);
  const [messages, setMessages] = useState([]);
  const [generalContext, setGeneralContext] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [contextResponse, knowledgeResponse, messagesResponse] = await Promise.all([
        ayrtonApi.getAdminContext(),
        ayrtonApi.getAdminKnowledge(),
        ayrtonApi.getAdminMessages(40),
      ]);
      setGeneralContext(normalizeGeneralContext(contextResponse.data.data?.content || ''));
      setKnowledge(knowledgeResponse.data.data || []);
      setMessages(messagesResponse.data.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo cargar la memoria de Ayrton');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveGeneralContext = async event => {
    event.preventDefault();
    setSavingContext(true);
    setMessage('');
    try {
      const response = await ayrtonApi.updateAdminContext(generalContext);
      await load();
      setMessage(response.data.message || 'Contexto general actualizado.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo guardar el contexto general');
    } finally {
      setSavingContext(false);
    }
  };

  const selectConversation = conversation => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      title: conversation.question,
      content: cleanAnswer(conversation.answer),
      keywords: '',
    });
    setMessage('Revisá y corregí la respuesta antes de guardarla como conocimiento oficial.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editKnowledge = item => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      content: item.content || '',
      keywords: item.keywords || '',
      priority: Number(item.priority || 0),
      approved: Boolean(item.approved),
      active: Boolean(item.active),
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (editingId) await ayrtonApi.updateKnowledge(editingId, form);
      else await ayrtonApi.createKnowledge(form);
      resetForm();
      await load();
      setMessage('La memoria de Ayrton fue actualizada correctamente.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo guardar el conocimiento');
    } finally {
      setSaving(false);
    }
  };

  const toggleKnowledge = async (item, field) => {
    try {
      await ayrtonApi.updateKnowledge(item.id, { ...item, [field]: !item[field] });
      await load();
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo actualizar la memoria');
    }
  };

  const removeKnowledge = async item => {
    if (!window.confirm(`¿Eliminar de la memoria "${item.title}"?`)) return;
    try {
      await ayrtonApi.removeKnowledge(item.id);
      if (String(editingId) === String(item.id)) resetForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo eliminar la memoria');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 border-b border-racing-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#20f4d0]">CADPO Team Radio</p><h2 className="font-racing text-3xl font-bold uppercase text-white">Memoria de Ayrton</h2></div>
        <p className="max-w-2xl text-xs leading-relaxed text-gray-400">Las conversaciones son candidatos, no conocimiento automático. Revisá la respuesta antes de aprobarla para evitar datos incorrectos.</p>
      </header>

      {message ? <div className="border border-[#20f4d0]/30 bg-[#20f4d0]/[0.07] px-4 py-3 text-sm text-[#9fffee]">{message}</div> : null}

      <form onSubmit={saveGeneralContext} className="border border-[#20f4d0]/25 bg-[#20f4d0]/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#20f4d0]">Siempre disponible</p><h3 className="font-racing text-xl font-bold uppercase text-white">Contexto general de CADPO</h3><p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500">Escribí reglas, aclaraciones o datos generales que Ayrton debe considerar en todas sus respuestas. Se guardarán en mayúsculas y cada oración quedará separada por punto y coma.</p></div>
          <span className="shrink-0 text-[9px] tabular-nums text-gray-600">{generalContext.length}/12.000</span>
        </div>
        <textarea value={generalContext} onChange={event => setGeneralContext(normalizeGeneralContext(event.target.value))} rows={7} placeholder="EJEMPLO: PARA CONSULTAS SOBRE...; AYRTON DEBE TENER EN CUENTA QUE..." className="input-field mt-4 resize-y uppercase"/>
        <div className="mt-3 flex justify-end"><button type="submit" disabled={savingContext} className="bg-[#20f4d0] px-5 py-2.5 font-racing text-xs font-bold uppercase text-black disabled:opacity-50">{savingContext ? 'Guardando...' : 'Guardar contexto general'}</button></div>
      </form>

      <form onSubmit={save} className="border border-racing-border bg-racing-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-racing text-xl font-bold uppercase text-white">{editingId ? 'Modificar conocimiento' : 'Agregar conocimiento'}</h3>{editingId ? <button type="button" onClick={resetForm} className="text-xs font-bold uppercase text-gray-400 hover:text-white">Cancelar edición</button> : null}</div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px]">
          <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Título o pregunta frecuente" className="input-field" required/>
          <input type="number" min="-100" max="100" value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))} className="input-field" aria-label="Prioridad" title="Prioridad"/>
        </div>
        <textarea value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} rows={5} placeholder="Respuesta oficial que Ayrton debe recordar" className="input-field mt-3 resize-y" required/>
        <input value={form.keywords} onChange={event => setForm(current => ({ ...current, keywords: event.target.value }))} placeholder="Palabras clave separadas por coma" className="input-field mt-3"/>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-300"><input type="checkbox" checked={form.approved} onChange={event => setForm(current => ({ ...current, approved: event.target.checked }))} className="accent-[#20f4d0]"/>Aprobada</label>
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-300"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} className="accent-[#20f4d0]"/>Activa</label>
          <button type="submit" disabled={saving} className="ml-auto inline-flex items-center gap-2 bg-[#20f4d0] px-5 py-2.5 font-racing text-xs font-bold uppercase text-black disabled:opacity-50"><PlusIcon className="h-4 w-4"/>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar a la memoria'}</button>
        </div>
      </form>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="border border-racing-border bg-racing-card">
          <div className="border-b border-racing-border px-4 py-3"><h3 className="font-racing text-xl font-bold uppercase text-white">Conocimiento aprobado</h3><p className="text-xs text-gray-500">{knowledge.length} entrada{knowledge.length === 1 ? '' : 's'} en D1</p></div>
          <div className="divide-y divide-racing-border">{knowledge.map(item => <article key={item.id} className={`p-4 ${item.active && item.approved ? '' : 'opacity-55'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-bold text-white">{item.title}</h4><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-400">{item.content}</p>{item.keywords ? <p className="mt-2 text-[9px] uppercase tracking-wide text-[#20f4d0]">{item.keywords}</p> : null}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => editKnowledge(item)} className="p-2 text-gray-400 hover:text-white" aria-label="Editar"><PencilSquareIcon className="h-4 w-4"/></button><button type="button" onClick={() => removeKnowledge(item)} className="p-2 text-gray-500 hover:text-red-400" aria-label="Eliminar"><TrashIcon className="h-4 w-4"/></button></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => toggleKnowledge(item, 'approved')} className={`border px-2 py-1 text-[9px] font-bold uppercase ${item.approved ? 'border-emerald-300/30 text-emerald-300' : 'border-gray-600 text-gray-500'}`}>{item.approved ? 'Aprobada' : 'Pendiente'}</button><button type="button" onClick={() => toggleKnowledge(item, 'active')} className={`border px-2 py-1 text-[9px] font-bold uppercase ${item.active ? 'border-[#20f4d0]/30 text-[#20f4d0]' : 'border-gray-600 text-gray-500'}`}>{item.active ? 'Activa' : 'Desactivada'}</button><span className="px-2 py-1 text-[9px] uppercase text-gray-600">Prioridad {item.priority || 0}</span></div></article>)}{!loading && !knowledge.length ? <p className="p-8 text-center text-sm text-gray-500">Todavía no hay conocimiento permanente aprobado.</p> : null}</div>
        </section>

        <section className="border border-racing-border bg-racing-card">
          <div className="border-b border-racing-border px-4 py-3"><h3 className="font-racing text-xl font-bold uppercase text-white">Conversaciones recientes</h3><p className="text-xs text-gray-500">Elegí una para convertirla en memoria revisada.</p></div>
          <div className="divide-y divide-racing-border">{messages.map(item => <article key={item.id} className="p-4"><div className="flex items-start gap-3"><ChatBubbleLeftRightIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#20f4d0]"/><div className="min-w-0 flex-1"><strong className="text-sm text-white">{item.question}</strong><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{cleanAnswer(item.answer)}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[9px] uppercase text-gray-600">{formatDate(item.created_at)}</span><button type="button" onClick={() => selectConversation(item)} className="inline-flex items-center gap-1.5 border border-[#20f4d0]/30 px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#20f4d0] hover:bg-[#20f4d0]/10"><CheckCircleIcon className="h-4 w-4"/>Revisar y aprender</button></div></div></div></article>)}{!loading && !messages.length ? <p className="p-8 text-center text-sm text-gray-500">No hay conversaciones guardadas.</p> : null}</div>
        </section>
      </div>
    </div>
  );
}
