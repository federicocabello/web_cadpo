import { useEffect, useState } from 'react';
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { pollsApi } from '../services/api';

const emptyOption = () => ({ id: null, titulo: '', descripcion: '', porcentaje_manual: '', imagenes: [], newImages: [], photoOrder: [] });
const emptyForm = () => ({ dias: '', fecha_inicio: '', fecha_cierre: '', max_opciones: 1, visible: true, opciones: [emptyOption(), emptyOption()] });
const inputDate = value => String(value || '').replace(' ', 'T').slice(0, 16);
const stateLabel = state => ({ abierta: 'Abierta', cerrada: 'Cerrada', proxima: 'Próxima' }[state] || state);

export default function PollsAdmin() {
  const [polls, setPolls] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const response = await pollsApi.getAdminAll();
      setPolls(response.data.data || []);
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudieron cargar las votaciones.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const releasePreviews = options => options.forEach(option => option.newImages?.forEach(image => URL.revokeObjectURL(image.preview)));
  const reset = () => {
    releasePreviews(form.opciones);
    setForm(emptyForm()); setEditingId('');
  };
  const edit = poll => {
    releasePreviews(form.opciones);
    setEditingId(String(poll.id));
    setForm({
      dias: poll.dias || '', max_opciones: Math.max(1, Number(poll.max_opciones || 1)), visible: Boolean(poll.visible),
      fecha_inicio: inputDate(poll.fecha_inicio), fecha_cierre: inputDate(poll.fecha_cierre),
      opciones: poll.opciones?.map(option => { const imagenes = option.imagenes?.length ? option.imagenes : (option.imagen ? [option.imagen] : []); return { id: option.id, titulo: String(option.titulo || '').toLocaleUpperCase('es-AR'), descripcion: option.descripcion || '', porcentaje_manual: option.porcentaje_manual ?? '', imagenes, newImages: [], photoOrder: [...imagenes] }; }) || [emptyOption(), emptyOption()],
    });
    setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const updateOption = (index, changes) => setForm(current => ({ ...current, opciones: current.opciones.map((option, optionIndex) => optionIndex === index ? { ...option, ...changes } : option) }));
  const addOptionImages = (index, files) => {
    const additions = [...(files || [])].map((file, fileIndex) => ({ key: `new-${Date.now()}-${fileIndex}-${file.name}`, file, preview: URL.createObjectURL(file) }));
    if (!additions.length) return;
    updateOption(index, { newImages: [...(form.opciones[index].newImages || []), ...additions], photoOrder: [...(form.opciones[index].photoOrder || []), ...additions.map(image => image.key)] });
  };
  const removeStoredOptionImage = (index, image) => {
    updateOption(index, { imagenes: form.opciones[index].imagenes.filter(item => item !== image), photoOrder: form.opciones[index].photoOrder.filter(item => item !== image) });
  };
  const removeNewOptionImage = (index, imageKey) => {
    const images = [...(form.opciones[index].newImages || [])];
    const imageIndex = images.findIndex(image => image.key === imageKey);
    if (imageIndex < 0) return;
    URL.revokeObjectURL(images[imageIndex].preview);
    images.splice(imageIndex, 1);
    updateOption(index, { newImages: images, photoOrder: form.opciones[index].photoOrder.filter(item => item !== imageKey) });
  };
  const moveOptionImage = (optionIndex, photoIndex, direction) => {
    const order = [...form.opciones[optionIndex].photoOrder];
    const targetIndex = photoIndex + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    [order[photoIndex], order[targetIndex]] = [order[targetIndex], order[photoIndex]];
    updateOption(optionIndex, { photoOrder: order });
  };
  const removeOption = index => {
    const option = form.opciones[index];
    option.newImages?.forEach(image => URL.revokeObjectURL(image.preview));
    setForm(current => {
      const opciones = current.opciones.filter((_, optionIndex) => optionIndex !== index);
      return { ...current, opciones, max_opciones: Math.min(Number(current.max_opciones) || 1, opciones.length) };
    });
  };

  const submit = async event => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const data = new FormData();
      data.append('dias', form.dias);
      data.append('max_opciones', String(form.max_opciones));
      data.append('fecha_inicio', form.fecha_inicio); data.append('fecha_cierre', form.fecha_cierre);
      data.append('visible', String(form.visible));
      data.append('opciones', JSON.stringify(form.opciones.map(({ id, titulo, descripcion, porcentaje_manual, imagenes, newImages, photoOrder }) => ({ id, titulo, descripcion, porcentaje_manual, imagenes, orden_imagenes: photoOrder.map(photo => { const newIndex = newImages.findIndex(image => image.key === photo); return newIndex >= 0 ? `new:${newIndex}` : photo; }) }))));
      form.opciones.forEach((option, index) => option.newImages.forEach(image => data.append(`imagenes_${index}`, image.file)));
      const response = editingId ? await pollsApi.update(editingId, data) : await pollsApi.create(data);
      setMessage(response.data.message || 'Votación guardada.'); reset(); await load();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo guardar la votación.'); }
    finally { setSaving(false); }
  };
  const remove = async poll => {
    if (!window.confirm('¿Eliminar esta votación y todos sus votos?')) return;
    try {
      const response = await pollsApi.remove(poll.id);
      setMessage(response.data.message); setPolls(current => current.filter(item => item.id !== poll.id));
      if (String(poll.id) === editingId) reset();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo eliminar la votación.'); }
  };
  const resetVotes = async poll => {
    if (!window.confirm(`¿Reiniciar los ${poll.total_votos} votos? Todas las IP podrán votar nuevamente.`)) return;
    try {
      const response = await pollsApi.resetVotes(poll.id);
      setMessage(response.data.message || 'Votos reiniciados correctamente.');
      await load();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudieron reiniciar los votos.'); }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[440px_minmax(0,1fr)]">
      <section className="card-glass self-start p-5 sm:p-6 xl:sticky xl:top-24">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Próximos campeonatos</p>
        <h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">{editingId ? 'Modificar votación' : 'Nueva votación'}</h2>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className="text-sm text-gray-300">Días del campeonato</span><input value={form.dias} onChange={event => setForm(current => ({ ...current, dias: event.target.value.toLocaleUpperCase('es-AR') }))} className="input-field mt-2 uppercase" maxLength={120} placeholder="Ej.: MIÉRCOLES 22:00 H" required /><small className="mt-1 block text-gray-500">Se mostrará como: DÍAS • MIÉRCOLES 22:00 H</small></label>
          <label className="block"><span className="text-sm text-gray-300">Máximo de opciones por voto</span><input type="number" min="1" max={Math.max(1, form.opciones.length)} step="1" value={form.max_opciones} onChange={event => setForm(current => ({ ...current, max_opciones: Math.max(1, Math.min(current.opciones.length, Math.floor(Number(event.target.value) || 1))) }))} className="input-field mt-2" required/><small className="mt-1 block text-gray-500">Ejemplo: con 2, cada persona podrá elegir hasta dos opciones.</small></label>
          <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-sm text-gray-300">Apertura</span><input type="datetime-local" value={form.fecha_inicio} onChange={event => setForm(current => ({ ...current, fecha_inicio: event.target.value }))} className="input-field mt-2" required /></label><label><span className="text-sm text-gray-300">Cierre</span><input type="datetime-local" value={form.fecha_cierre} onChange={event => setForm(current => ({ ...current, fecha_cierre: event.target.value }))} className="input-field mt-2" required /></label></div>
          <fieldset className="space-y-3 border border-racing-border bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3"><legend className="text-xs font-bold uppercase tracking-wider text-gray-300">Opciones y fotos</legend><button type="button" onClick={() => setForm(current => ({ ...current, opciones: [...current.opciones, emptyOption()] }))} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-cyan-300 hover:text-white"><PlusIcon className="h-4 w-4" /> Agregar</button></div>
            {form.opciones.map((option, index) => <div key={option.id || `new-${index}`} className="border border-white/10 bg-black/25 p-3">
              <div className="flex gap-2"><input value={option.titulo} onChange={event => updateOption(index, { titulo: event.target.value.toLocaleUpperCase('es-AR') })} className="input-field min-w-0 py-2 uppercase" placeholder={`OPCIÓN ${index + 1}`} required /><button type="button" onClick={() => removeOption(index)} disabled={form.opciones.length <= 2} className="inline-flex w-10 shrink-0 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red disabled:opacity-25"><XMarkIcon className="h-4 w-4" /></button></div>
              <textarea value={option.descripcion} onChange={event => updateOption(index, { descripcion: event.target.value })} className="input-field mt-2 min-h-20 resize-y text-sm" placeholder="Descripción de esta opción..." />
              <label className="mt-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Porcentaje manual <span className="font-normal normal-case text-gray-600">(vacío = automático)</span></span><div className="relative mt-1"><input type="number" min="0" max="100" step="0.1" value={option.porcentaje_manual} onChange={event => updateOption(index, { porcentaje_manual: event.target.value })} className="input-field py-2 pr-9 text-right font-racing text-lg" placeholder="Auto" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-cyan-300">%</span></div></label>
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{option.photoOrder.map((photo, photoIndex) => { const newImage = option.newImages.find(image => image.key === photo); const source = newImage?.preview || photo; return <div key={photo} className={`group relative aspect-video overflow-hidden bg-black ${newImage ? 'border border-cyan-300/40' : 'border border-white/10'}`}><img src={source} alt={`Foto ${photoIndex + 1}`} className="h-full w-full object-cover"/><span className="absolute left-1 top-1 bg-black/80 px-1.5 py-0.5 font-racing text-[9px] font-bold text-white">{photoIndex + 1}</span>{newImage ? <span className="absolute bottom-1 left-1 bg-cyan-300 px-1.5 py-0.5 text-[7px] font-bold uppercase text-black">Nueva</span> : null}<button type="button" onClick={() => newImage ? removeNewOptionImage(index, photo) : removeStoredOptionImage(index, photo)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-black/85 text-white hover:bg-racing-red" aria-label="Quitar foto"><XMarkIcon className="h-3.5 w-3.5"/></button><div className="absolute bottom-1 right-1 flex gap-1"><button type="button" disabled={photoIndex === 0} onClick={() => moveOptionImage(index, photoIndex, -1)} className="flex h-6 w-6 items-center justify-center bg-black/85 text-white hover:bg-cyan-300 hover:text-black disabled:opacity-25" aria-label="Mover foto a la izquierda"><ChevronLeftIcon className="h-3.5 w-3.5"/></button><button type="button" disabled={photoIndex === option.photoOrder.length - 1} onClick={() => moveOptionImage(index, photoIndex, 1)} className="flex h-6 w-6 items-center justify-center bg-black/85 text-white hover:bg-cyan-300 hover:text-black disabled:opacity-25" aria-label="Mover foto a la derecha"><ChevronRightIcon className="h-3.5 w-3.5"/></button></div></div>; })}</div>
                <label className="mt-2 block"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fotos de esta opción</span><input type="file" multiple accept="image/avif,image/webp,image/jpeg,image/png" onChange={event => { addOptionImages(index, event.target.files); event.target.value = ''; }} className="mt-1 block w-full text-xs text-gray-500 file:mr-2 file:border-0 file:bg-cyan-300 file:px-2 file:py-1.5 file:font-semibold file:text-black" required={!option.photoOrder.length} /><small className="mt-1 block text-[9px] text-gray-600">Podés seleccionar varias imágenes y ordenarlas con las flechas. La posición 1 será la portada.</small></label>
              </div>
            </div>)}
          </fieldset>
          <label className="flex cursor-pointer items-center justify-between gap-4 border border-racing-border bg-black/25 px-4 py-3"><span><strong className="block text-sm text-white">Visible en la web</strong><small className="text-gray-500">Ocultala sin perder votos ni resultados.</small></span><input type="checkbox" checked={form.visible} onChange={event => setForm(current => ({ ...current, visible: event.target.checked }))} className="h-5 w-5 accent-cyan-400" /></label>
          <div className="grid gap-2 sm:grid-cols-2"><button type="submit" disabled={saving} className="min-h-12 bg-cyan-300 px-5 font-racing text-sm font-bold uppercase text-black hover:bg-cyan-200 disabled:opacity-50">{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear votación'}</button>{editingId ? <button type="button" onClick={reset} className="min-h-12 border border-racing-border font-racing text-xs font-bold uppercase text-gray-300 hover:border-white">Cancelar</button> : null}</div>
          {message ? <p className="border border-racing-border bg-black/30 p-3 text-sm text-gray-300">{message}</p> : null}
        </form>
      </section>

      <section className="space-y-5">
        <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Gestión</p><h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Votaciones cargadas</h2></header>
        {loading ? <p className="py-12 text-center text-gray-500">Cargando votaciones...</p> : polls.length ? polls.map(poll => <article key={poll.id} className={`border bg-racing-card p-5 ${poll.visible ? 'border-cyan-300/30' : 'border-racing-border opacity-65'}`}>
          <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="bg-cyan-300/10 px-2 py-1 text-[9px] font-bold uppercase text-cyan-300">{stateLabel(poll.estado)}</span><span className="bg-white/5 px-2 py-1 text-[9px] font-bold uppercase text-gray-400">{poll.visible ? 'Visible' : 'Oculta'}</span><span className="bg-cyan-300/10 px-2 py-1 text-[9px] font-bold uppercase text-cyan-200">Hasta {poll.max_opciones || 1} opción{Number(poll.max_opciones || 1) === 1 ? '' : 'es'}</span></div><p className="mt-3 font-racing text-lg font-bold uppercase tracking-wider text-cyan-300">DÍAS • {poll.dias || 'SIN CONFIGURAR'}</p></div><div className="flex gap-2"><button type="button" onClick={() => resetVotes(poll)} disabled={!poll.total_votos} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-amber-300 hover:border-amber-300 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-25" aria-label="Reiniciar votos" title="Reiniciar votos e IP"><ArrowPathIcon className="h-4 w-4" /></button><button type="button" onClick={() => edit(poll)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-300 hover:border-cyan-300 hover:text-cyan-300" aria-label="Editar votación"><PencilSquareIcon className="h-4 w-4" /></button><button type="button" onClick={() => remove(poll)} className="inline-flex h-9 w-9 items-center justify-center border border-racing-border text-gray-500 hover:border-racing-red hover:text-racing-red" aria-label="Eliminar votación"><TrashIcon className="h-4 w-4" /></button></div></div>
          <p className="mt-2 text-xs text-gray-500">{inputDate(poll.fecha_inicio).replace('T', ' ')} → {inputDate(poll.fecha_cierre).replace('T', ' ')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{poll.opciones.map(option => <div key={option.id} className="overflow-hidden border border-white/10 bg-black/25"><div className="relative aspect-video bg-black">{option.imagen ? <img src={option.imagen} alt="" className="h-full w-full object-cover" /> : null}{option.imagenes?.length > 1 ? <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 text-[8px] font-bold uppercase text-cyan-200">{option.imagenes.length} fotos</span> : null}</div><div className="p-3"><div className="flex items-center justify-between gap-2 text-sm"><strong className="truncate text-white">{option.titulo}</strong><strong className="text-cyan-300">{option.porcentaje}%</strong></div>{option.descripcion ? <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-500">{option.descripcion}</p> : null}<p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-600">{option.porcentaje_manual === null ? 'Porcentaje automático' : 'Porcentaje manual'} · {option.votos} votos</p></div></div>)}</div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-cyan-300">{poll.total_votos} voto{poll.total_votos === 1 ? '' : 's'} total{poll.total_votos === 1 ? '' : 'es'}</p>
        </article>) : <div className="border border-dashed border-racing-border py-16 text-center text-sm text-gray-500">Todavía no hay votaciones cargadas.</div>}
      </section>
    </div>
  );
}
