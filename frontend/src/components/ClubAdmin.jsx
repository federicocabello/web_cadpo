import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  FlagIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  ServerStackIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { clubApi } from '../services/api';

const emptyForm = {
  nombre: '',
  idcategoria: '',
  idcircuito: '',
  servidor: '',
  autos: [],
  activo: true,
  orden: 0,
};

const toForm = configuration => ({
  nombre: configuration?.nombre || '',
  idcategoria: String(configuration?.idcategoria || ''),
  idcircuito: String(configuration?.idcircuito || ''),
  servidor: configuration?.servidor || '',
  autos: (configuration?.autos || []).map(car => Number(car.id)),
  activo: configuration ? Boolean(configuration.activo) : true,
  orden: Number(configuration?.orden || 0),
});

export default function ClubAdmin({ categories, circuits, cars }) {
  const [configurations, setConfigurations] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [discoverySource, setDiscoverySource] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadConfigurations = useCallback(async () => {
    const { data } = await clubApi.getAdmin();
    const items = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
    setConfigurations(items);
    return items;
  }, []);

  useEffect(() => {
    let active = true;
    loadConfigurations()
      .catch(requestError => active && setError(requestError.response?.data?.error || 'No se pudieron cargar los servidores del CLUB.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadConfigurations]);

  const categoryCars = useMemo(
    () => cars.filter(car => String(car.idcategoria) === String(form.idcategoria)),
    [cars, form.idcategoria],
  );

  const groupedCars = useMemo(() => categoryCars.reduce((groups, car) => {
    const brand = car.marca || 'Sin marca';
    if (!groups[brand]) groups[brand] = [];
    groups[brand].push(car);
    return groups;
  }, {}), [categoryCars]);

  const resetForm = () => {
    setForm({ ...emptyForm, orden: configurations.length });
    setEditingId(null);
    setError('');
  };

  const editConfiguration = configuration => {
    setEditingId(Number(configuration.id));
    setForm(toForm(configuration));
    setMessage('');
    setError('');
    window.requestAnimationFrame(() => document.getElementById('club-server-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const discover = async () => {
    setDiscovering(true);
    setError('');
    setMessage('');
    try {
      const { data } = await clubApi.discover();
      setDiscovered(data.data || []);
      setDiscoverySource(data.source || '');
      setMessage(`Se encontraron ${(data.data || []).length} servidores en el Server Manager.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo consultar el Server Manager.');
    } finally {
      setDiscovering(false);
    }
  };

  const selectDiscoveredServer = server => {
    const configured = configurations.find(item => Number(item.id) === Number(server.idconfiguracion));
    if (configured) {
      editConfiguration(configured);
      return;
    }
    setEditingId(null);
    setForm({
      ...emptyForm,
      nombre: server.nombre || `CADPO CLUB ${server.numero}`,
      servidor: server.enlace,
      orden: configurations.length,
    });
    setMessage(`Servidor ${server.numero} seleccionado. Completá la categoría, el circuito y los autos que se mostrarán públicamente.`);
    setError('');
    window.requestAnimationFrame(() => document.getElementById('club-server-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const changeCategory = event => {
    setForm(current => ({ ...current, idcategoria: event.target.value, autos: [] }));
    setMessage('');
    setError('');
  };

  const toggleCar = id => setForm(current => ({
    ...current,
    autos: current.autos.includes(Number(id))
      ? current.autos.filter(carId => carId !== Number(id))
      : [...current.autos, Number(id)],
  }));

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = editingId
        ? await clubApi.update(editingId, form)
        : await clubApi.create(form);
      const items = await loadConfigurations();
      setMessage(response.data.message || 'Servidor CLUB guardado.');
      setEditingId(null);
      setForm({ ...emptyForm, orden: items.length });
      if (discovered.length) {
        const discoveryResponse = await clubApi.discover();
        setDiscovered(discoveryResponse.data.data || []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo guardar el servidor CLUB.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async configuration => {
    if (!window.confirm(`¿Eliminar ${configuration.nombre} de CADPO CLUB?`)) return;
    setError('');
    try {
      const { data } = await clubApi.remove(configuration.id);
      await loadConfigurations();
      if (editingId === Number(configuration.id)) resetForm();
      setMessage(data.message || 'Servidor eliminado.');
      if (discovered.length) {
        const discoveryResponse = await clubApi.discover();
        setDiscovered(discoveryResponse.data.data || []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo eliminar el servidor CLUB.');
    }
  };

  if (loading) return <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-yellow-300 border-t-transparent"/></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="border border-blue-300/25 bg-racing-gray p-5 sm:p-7">
        <header className="flex flex-col gap-4 border-b border-racing-border pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Servidores gratuitos</p><h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Gestionar CADPO CLUB</h2><p className="mt-2 max-w-3xl text-sm text-gray-400">Consultá los servidores publicados por el Server Manager y elegí únicamente cuáles se mostrarán como parte del CLUB. Los servidores privados no se publican hasta que los agregues.</p></div>
          <button type="button" onClick={discover} disabled={discovering} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-blue-300/50 bg-blue-500/10 px-5 text-xs font-bold uppercase text-blue-200 transition hover:bg-blue-500 hover:text-white disabled:opacity-40"><ArrowPathIcon className={`h-5 w-5 ${discovering ? 'animate-spin' : ''}`}/>{discovering ? 'Consultando...' : 'Buscar servidores'}</button>
        </header>
        {discoverySource ? <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-600">Origen: {discoverySource}</p> : null}
        {message ? <p className="mt-5 border border-emerald-400/30 bg-emerald-400/[0.07] p-3 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-5 border border-red-400/30 bg-red-400/[0.07] p-3 text-sm text-red-300">{error}</p> : null}

        {discovered.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{discovered.map(server => <article key={server.numero} className={`border p-4 ${server.idconfiguracion ? 'border-yellow-300/40 bg-yellow-300/[0.06]' : 'border-racing-border bg-black/20'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Servidor {server.numero}</p><h3 className="mt-1 truncate font-racing text-lg font-bold uppercase text-white">{server.nombre}</h3></div><span className={`shrink-0 px-2 py-1 text-[8px] font-black uppercase ${server.online ? 'bg-emerald-400 text-black' : 'bg-gray-800 text-gray-400'}`}>{server.online ? 'Online' : 'Offline'}</span></div>{server.circuito ? <p className="mt-3 text-xs text-gray-300">{server.circuito}{server.variante ? ` · ${server.variante}` : ''}</p> : null}<p className="mt-1 text-[10px] uppercase text-gray-500">{server.sesion || server.estado}{Number.isFinite(Number(server.conectados)) ? ` · ${server.conectados} conectados` : ''}</p><button type="button" onClick={() => selectDiscoveredServer(server)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 border px-3 py-2 text-[9px] font-bold uppercase transition ${server.idconfiguracion ? 'border-yellow-300/40 text-yellow-200 hover:bg-yellow-300 hover:text-black' : 'border-blue-300/40 text-blue-200 hover:bg-blue-500 hover:text-white'}`}>{server.idconfiguracion ? <PencilSquareIcon className="h-4 w-4"/> : <PlusIcon className="h-4 w-4"/>}{server.idconfiguracion ? 'Editar configuración' : 'Agregar al CLUB'}</button></article>)}</div> : null}
      </section>

      <section className="border border-yellow-300/25 bg-racing-gray p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-racing-border pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">Publicados en la web</p><h3 className="mt-1 font-racing text-2xl font-bold uppercase text-white">{configurations.length} servidor{configurations.length === 1 ? '' : 'es'} configurado{configurations.length === 1 ? '' : 's'}</h3></div><button type="button" onClick={resetForm} className="inline-flex items-center gap-2 border border-yellow-300/40 px-4 py-2 text-[10px] font-bold uppercase text-yellow-200 hover:bg-yellow-300 hover:text-black"><PlusIcon className="h-4 w-4"/>Nuevo servidor</button></div>
        {configurations.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{configurations.map(configuration => <article key={configuration.id} className="border border-racing-border bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-blue-300">Servidor {configuration.numero_servidor ?? '—'} · Orden {configuration.orden}</p><h4 className="mt-1 truncate font-racing text-xl font-bold uppercase text-white">{configuration.nombre}</h4><p className="mt-1 truncate text-xs text-gray-500">{configuration.categoria} · {configuration.circuito}</p></div><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${configuration.activo ? 'bg-emerald-400' : 'bg-gray-600'}`}/></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => editConfiguration(configuration)} className="inline-flex flex-1 items-center justify-center gap-2 border border-blue-300/30 py-2 text-[9px] font-bold uppercase text-blue-200 hover:bg-blue-500 hover:text-white"><PencilSquareIcon className="h-4 w-4"/>Editar</button><button type="button" onClick={() => remove(configuration)} className="inline-flex h-9 w-9 items-center justify-center border border-red-400/30 text-red-300 hover:bg-red-600 hover:text-white" aria-label={`Eliminar ${configuration.nombre}`}><TrashIcon className="h-4 w-4"/></button></div></article>)}</div> : <p className="mt-4 border border-dashed border-racing-border py-8 text-center text-sm text-gray-500">Todavía no hay servidores públicos configurados.</p>}
      </section>

      <section id="club-server-form" className="scroll-mt-36 border border-yellow-300/25 bg-racing-gray p-5 sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-racing-border pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">{editingId ? 'Modificar servidor' : 'Nuevo servidor'}</p><h3 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Configuración pública</h3></div><label className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-xs font-bold uppercase ${form.activo ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-racing-border bg-black/20 text-gray-500'}`}><input type="checkbox" checked={form.activo} onChange={event => setForm(current => ({ ...current, activo: event.target.checked }))} className="h-4 w-4 accent-emerald-500"/>{form.activo ? 'Visible y activo' : 'Oculto'}</label></header>

        <form onSubmit={save} className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px]">
            <label><span className="text-sm font-semibold text-gray-300">Nombre público</span><input value={form.nombre} onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))} className="input-field mt-2" placeholder="Ej.: CADPO CLUB TURISMO" maxLength="160" required/></label>
            <label><span className="text-sm font-semibold text-gray-300">Orden</span><input type="number" min="0" max="65535" step="1" value={form.orden} onChange={event => setForm(current => ({ ...current, orden: event.target.value }))} className="input-field mt-2 text-center"/></label>
          </div>
          <label className="block"><span className="flex items-center gap-2 text-sm font-semibold text-gray-300"><LinkIcon className="h-4 w-4 text-yellow-300"/>Enlace del servidor</span><input type="url" value={form.servidor} onChange={event => setForm(current => ({ ...current, servidor: event.target.value }))} className="input-field mt-2" placeholder="http://rh.servegame.com:30000/live-timing?server=1" required/><small className="mt-2 block text-xs text-gray-500">Podés seleccionarlo automáticamente arriba o escribir el número de servidor correspondiente.</small></label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label><span className="text-sm font-semibold text-gray-300">Categoría activa</span><select value={form.idcategoria} onChange={changeCategory} className="input-field mt-2" required><option value="">Seleccionar categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.categoria}</option>)}</select></label>
            <label><span className="text-sm font-semibold text-gray-300">Circuito activo</span><select value={form.idcircuito} onChange={event => setForm(current => ({ ...current, idcircuito: event.target.value }))} className="input-field mt-2" required><option value="">Seleccionar circuito</option>{circuits.map(circuit => <option key={circuit.id} value={circuit.id}>{circuit.nombre}{circuit.variante ? ` · ${circuit.variante}` : ''}</option>)}</select></label>
          </div>

          <section className="border border-racing-border bg-black/20"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-racing-border px-4 py-3"><div><h4 className="font-racing text-lg font-bold uppercase text-white">Autos disponibles</h4><p className="text-xs text-gray-500">Modelos de la categoría seleccionada.</p></div><span className="text-xs font-bold uppercase text-yellow-300">{form.autos.length} seleccionados</span></div>{!form.idcategoria ? <p className="p-8 text-center text-sm text-gray-500">Primero seleccioná una categoría.</p> : categoryCars.length ? <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(groupedCars).map(([brand, brandCars]) => <div key={brand}><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{brand}</p><div className="space-y-2">{brandCars.map(car => { const selected = form.autos.includes(Number(car.id)); return <button key={car.id} type="button" onClick={() => toggleCar(car.id)} className={`flex w-full items-center gap-3 border p-3 text-left transition ${selected ? 'border-yellow-300 bg-yellow-300/10 text-white' : 'border-racing-border bg-racing-card/60 text-gray-400 hover:border-gray-500'}`}>{car.logo ? <img src={car.logo} alt="" className="h-8 w-10 shrink-0 object-contain"/> : <FlagIcon className="h-6 w-8 shrink-0"/>}<span className="min-w-0 flex-1"><strong className="block truncate text-sm">{car.modelo}</strong><span className="text-[10px] uppercase text-gray-500">{car.marca}</span></span>{selected ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-yellow-300"/> : null}</button>; })}</div></div>)}</div> : <p className="p-8 text-center text-sm text-yellow-200">Esta categoría todavía no tiene autos cargados.</p>}</section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{editingId ? <button type="button" onClick={resetForm} className="min-h-12 border border-racing-border px-5 text-xs font-bold uppercase text-gray-400 hover:text-white">Cancelar edición</button> : null}<button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 bg-yellow-400 px-7 font-racing text-sm font-bold uppercase text-black transition hover:bg-yellow-300 disabled:opacity-50">{editingId ? <PencilSquareIcon className="h-5 w-5"/> : <ServerStackIcon className="h-5 w-5"/>}{saving ? 'Guardando...' : editingId ? 'Guardar servidor' : 'Agregar servidor'}</button></div>
        </form>
      </section>
    </div>
  );
}
