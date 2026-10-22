import { useEffect, useState } from 'react';
import { ArrowUpTrayIcon, DocumentTextIcon, EyeIcon, EyeSlashIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { setupDocumentsApi } from '../services/api';

const emptyForm = { titulo: '', descripcion: '', visible: true, orden: 0, documento: null };
const formatSize = bytes => `${(Number(bytes || 0) / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 2 })} MB`;

export default function SetupDocumentsAdmin() {
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await setupDocumentsApi.getAdminAll();
      setDocuments(response.data.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudieron cargar los documentos.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const edit = item => {
    setEditingId(item.id);
    setForm({ titulo: item.titulo, descripcion: item.descripcion || '', visible: Boolean(item.visible), orden: Number(item.orden || 0), documento: null });
    setMessage('');
  };

  const submit = async event => {
    event.preventDefault();
    if (!editingId && !form.documento) {
      setMessage('Seleccioná el archivo PDF.');
      return;
    }
    setSaving(true);
    setMessage('');
    const data = new FormData();
    data.append('titulo', form.titulo);
    data.append('descripcion', form.descripcion);
    data.append('visible', form.visible ? '1' : '0');
    data.append('orden', String(form.orden || 0));
    if (form.documento) data.append('documento', form.documento);
    try {
      const response = editingId
        ? await setupDocumentsApi.update(editingId, data)
        : await setupDocumentsApi.create(data);
      setMessage(response.data.message || 'Documento guardado.');
      reset();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudo guardar el documento.');
    } finally { setSaving(false); }
  };

  const remove = async item => {
    if (!window.confirm(`¿Eliminar "${item.titulo}"?`)) return;
    try {
      const response = await setupDocumentsApi.remove(item.id);
      setMessage(response.data.message || 'Documento eliminado.');
      if (String(editingId) === String(item.id)) reset();
      await load();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo eliminar el documento.'); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <form onSubmit={submit} className="card-glass h-fit p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Biblioteca técnica</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase">{editingId ? 'Editar documento' : 'Cargar PDF'}</h2></div>
          {editingId ? <button type="button" onClick={reset} className="border border-racing-border p-2 text-gray-400 hover:text-white" aria-label="Cancelar edición"><XMarkIcon className="h-5 w-5"/></button> : null}
        </div>
        <div className="mt-5 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-400">Título</span><input className="input-field" maxLength="180" value={form.titulo} onChange={event => setForm(current => ({ ...current, titulo: event.target.value }))} required/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-400">Descripción</span><textarea className="input-field min-h-28 resize-y" value={form.descripcion} onChange={event => setForm(current => ({ ...current, descripcion: event.target.value }))}/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-400">Archivo PDF {editingId ? '(opcional para reemplazar)' : ''}</span><input type="file" accept="application/pdf,.pdf" onChange={event => setForm(current => ({ ...current, documento: event.target.files?.[0] || null }))} className="block w-full border border-racing-border bg-black/30 p-2 text-xs text-gray-300 file:mr-3 file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:font-bold file:text-black" required={!editingId}/><span className="mt-1 block text-[10px] text-gray-500">Máximo 40 MB.</span></label>
          <div className="grid grid-cols-[1fr_110px] gap-3"><label className="flex items-center gap-3 border border-racing-border bg-black/20 px-3 py-2"><input type="checkbox" checked={form.visible} onChange={event => setForm(current => ({ ...current, visible: event.target.checked }))}/><span className="text-sm font-semibold">Visible en la página</span></label><label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Orden</span><input type="number" className="input-field" value={form.orden} onChange={event => setForm(current => ({ ...current, orden: event.target.value }))}/></label></div>
        </div>
        <button disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-cyan-400 px-4 py-3 font-racing text-sm font-bold uppercase text-black transition hover:bg-cyan-300 disabled:opacity-50"><ArrowUpTrayIcon className="h-5 w-5"/>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Cargar documento'}</button>
        {message ? <p className="mt-4 border border-white/10 bg-black/30 p-3 text-sm text-gray-300">{message}</p> : null}
      </form>

      <section className="card-glass overflow-hidden">
        <header className="border-b border-racing-border p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Gestión</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase">Documentos publicados</h2></header>
        {loading ? <p className="p-10 text-center text-gray-500">Cargando documentos...</p> : documents.length ? <div className="divide-y divide-racing-border">{documents.map(item => <article key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"><DocumentTextIcon className="h-10 w-10 shrink-0 text-cyan-300"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{item.titulo}</h3><span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[9px] font-bold uppercase ${item.visible ? 'border-green-400/30 text-green-300' : 'border-gray-500/30 text-gray-500'}`}>{item.visible ? <EyeIcon className="h-3 w-3"/> : <EyeSlashIcon className="h-3 w-3"/>}{item.visible ? 'Visible' : 'Oculto'}</span></div><p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.descripcion || 'Sin descripción'}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-gray-600">{item.nombre_original} · {formatSize(item.tamano)} · Orden {item.orden}</p></div><div className="flex shrink-0 gap-2"><a href={item.archivo} target="_blank" rel="noreferrer" className="border border-cyan-300/30 p-2 text-cyan-300 hover:bg-cyan-300 hover:text-black" aria-label="Ver PDF"><EyeIcon className="h-5 w-5"/></a><button type="button" onClick={() => edit(item)} className="border border-yellow-300/30 p-2 text-yellow-300 hover:bg-yellow-300 hover:text-black" aria-label="Editar"><PencilSquareIcon className="h-5 w-5"/></button><button type="button" onClick={() => remove(item)} className="border border-red-400/30 p-2 text-red-400 hover:bg-red-500 hover:text-white" aria-label="Eliminar"><TrashIcon className="h-5 w-5"/></button></div></article>)}</div> : <p className="p-10 text-center text-gray-500">Todavía no cargaste documentos.</p>}
      </section>
    </div>
  );
}
