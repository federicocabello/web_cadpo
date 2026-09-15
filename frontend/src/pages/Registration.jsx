import { useEffect, useMemo, useState } from 'react';
import { CalendarDaysIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, PlayCircleIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { CountrySelect } from '../components/CountryFlag';
import { registrationFormsApi } from '../services/api';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';
import { formatPrice } from '../utils/currency';
import { formatInstagramHandle } from '../utils/instagram';

const emptyDriver = { idpiloto: '', nombre: '', localidad: '', provincia: '', telefono: '', nacionalidad: 'ar', steam: '', ig: '' };
const formatCountdown = milliseconds => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const getRegistrationPhase = (form, now) => {
  if (!form) return 'closed';
  if ((parseCalendarDate(form.fecha_apertura)?.getTime() || 0) > now) return 'upcoming';
  if ((parseCalendarDate(form.fecha_cierre)?.getTime() || 0) <= now) return 'closed';
  return Number(form.inscriptos_actuales) + Number(form.preinscriptos || 0) >= Number(form.limite_inscriptos) ? 'full' : 'open';
};
const phaseText = phase => phase === 'open' ? 'Inscripciones abiertas' : phase === 'upcoming' ? 'Próximo campeonato' : phase === 'full' ? 'Cupo completo' : 'Inscripciones cerradas';

export default function Registration() {
  const [searchParams] = useSearchParams();
  const [forms, setForms] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [config, setConfig] = useState(null);
  const [formToken, setFormToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [driver, setDriver] = useState(emptyDriver);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [carId, setCarId] = useState('');
  const [modality, setModality] = useState('');
  const [number, setNumber] = useState('');
  const [numberAvailable, setNumberAvailable] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const configPhase = getRegistrationPhase(config, now);

  useEffect(() => {
    registrationFormsApi.getAll()
      .then(response => {
        const loaded = response.data.data || [];
        setForms(loaded);
        const requestedId = searchParams.get('campeonato');
        if (requestedId && loaded.some(item => String(item.idcampeonato) === String(requestedId))) setSelectedId(requestedId);
      })
      .catch(() => setMessage('No se pudieron cargar los formularios de inscripción.'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) { setConfig(null); return; }
    setLoading(true);
    registrationFormsApi.getById(selectedId)
      .then(response => setConfig(response.data.data))
      .catch(error => setMessage(error.response?.data?.error || 'No se pudo cargar el campeonato.'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!config) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [config]);

  const expired = Boolean(formToken && expiresAt <= now);
  useEffect(() => {
    if (expired) setMessage('El tiempo del formulario terminó. Volvé a iniciar la inscripción.');
  }, [expired]);

  useEffect(() => {
    if (!formToken || driver.idpiloto || driver.nombre.trim().length < 2) { setSuggestions([]); return undefined; }
    const timer = window.setTimeout(() => {
      registrationFormsApi.searchDrivers(selectedId, driver.nombre, formToken)
        .then(response => { setSuggestions(response.data.data || []); setShowSuggestions(true); })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [driver.idpiloto, driver.nombre, formToken, selectedId]);

  useEffect(() => {
    if (!formToken || modality === 'extra' || !number || Number(number) < 1 || Number(number) > 200) {
      setNumberAvailable(null); return undefined;
    }
    setNumberAvailable('checking');
    const timer = window.setTimeout(() => {
      registrationFormsApi.checkNumber(selectedId, number)
        .then(response => setNumberAvailable(response.data.data.available))
        .catch(() => setNumberAvailable(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formToken, modality, number, selectedId]);

  const modalities = useMemo(() => [
    config?.permite_personalizado && { id: 'personalizado', label: 'Personalizado', description: 'Presentás tu propio diseño.', price: Number(config.precio) },
    config?.permite_diseno_liga && { id: 'personalizado_liga', label: 'Personalizado + diseño de la liga', description: 'La liga prepara el diseño solicitado.', price: Number(config.precio) + Number(config.precio_diseno) },
    config?.permite_extra && { id: 'extra', label: 'Extra sin diseño', description: 'Participás como extra; no necesitás reservar número.', price: Number(config.precio) },
  ].filter(Boolean), [config]);

  const startForm = async () => {
    setMessage('');
    try {
      const response = await registrationFormsApi.start(selectedId);
      setFormToken(response.data.data.token);
      setExpiresAt(new Date(response.data.data.expiresAt).getTime());
      setNow(Date.now());
      setDriver(emptyDriver); setCarId(''); setModality(''); setNumber(''); setCompleted(false);
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo iniciar la inscripción.'); }
  };

  const selectDriver = selected => {
    setDriver({
      idpiloto: selected.id, nombre: selected.nombre || '', localidad: selected.localidad || '',
      provincia: selected.provincia || '', telefono: selected.telefono || '',
      nacionalidad: selected.nacionalidad || 'ar', steam: selected.steam || '', ig: formatInstagramHandle(selected.ig),
    });
    setShowSuggestions(false); setSuggestions([]);
  };

  const changeDriver = event => {
    const { name, value } = event.target;
    setDriver(current => ({ ...current, [name]: name === 'ig' ? formatInstagramHandle(value) : value, ...(name === 'nombre' ? { idpiloto: '' } : {}) }));
  };

  const submit = async event => {
    event.preventDefault();
    if (expired) return;
    if (modality !== 'extra' && numberAvailable !== true) { setMessage('Elegí un número disponible para continuar.'); return; }
    setSubmitting(true); setMessage('');
    try {
      const response = await registrationFormsApi.submit(selectedId, {
        ...driver, idauto: Number(carId), modalidad_diseno: modality,
        numero: modality === 'extra' ? 0 : Number(number), formToken,
      });
      setCompleted(true); setFormToken(''); setMessage(response.data.message);
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo registrar la inscripción.'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="animate-fade-in">
      <header className="border-b border-racing-border bg-racing-gray px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-racing-red">Participá</p>
          <h1 className="section-title text-4xl md:text-5xl">Inscripción <span className="gradient-text">a campeonato</span></h1>
          <p className="mt-3 max-w-2xl text-gray-400">Elegí el campeonato, revisá sus condiciones y completá tu inscripción.</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <label className="block max-w-2xl">
          <span className="text-sm font-semibold text-gray-300">Campeonato</span>
          <select value={selectedId} onChange={event => { setSelectedId(event.target.value); setFormToken(''); setCompleted(false); setMessage(''); }} className="input-field mt-2">
            <option value="">Seleccionar campeonato</option>
            {forms.map(item => <option key={item.idcampeonato} value={item.idcampeonato}>{item.categoria} · Temporada {item.temporada} · {item.anio} · {phaseText(getRegistrationPhase(item, now))}</option>)}
          </select>
        </label>

        {loading ? <div className="py-20 text-center text-gray-400">Cargando...</div> : null}
        {config && !loading ? <>
          <section className="mt-8 overflow-hidden border border-racing-border bg-racing-gray">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-racing text-3xl font-bold">{config.categoria} · Temporada {config.temporada}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${configPhase === 'open' ? 'bg-green-500/15 text-green-400' : 'bg-racing-red/15 text-racing-red'}`}>{phaseText(configPhase)}</span>
                </div>
                <p className="mt-2 text-gray-400">{config.plataforma} · {config.cantidad_fechas} fechas · {config.cupos_ocupados}/{config.limite_inscriptos} cupos ocupados</p>
                <p className="mt-2 text-sm text-gray-300"><strong>Setup:</strong> {config.setup_detalle}</p>
                <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${Number(config.precio || 0) > 10000 ? 'text-green-400' : 'text-gray-500'}`}><PlayCircleIcon className="h-5 w-5"/>{Number(config.precio || 0) > 10000 ? 'Transmisión en vivo incluida' : 'Sin transmisión en vivo'}</p>
              </div>
              <div className="lg:text-right"><p className="text-xs uppercase text-gray-500">Precio base</p><p className="font-racing text-3xl font-bold text-yellow-300">{formatPrice(config.precio)}</p><p className="mt-1 text-sm text-gray-400">{config.lugares_disponibles} lugares disponibles</p></div>
            </div>
            <div className="grid border-t border-racing-border md:grid-cols-2">
              <div className="border-b border-racing-border p-6 md:border-b-0 md:border-r">
                <p className="text-xs font-semibold uppercase text-gray-500">Apertura</p><p className="mt-1 text-white">{formatCalendarDate(config.fecha_apertura, { dateStyle: 'long', timeStyle: 'short' })}</p>
              </div>
              <div className="p-6"><p className="text-xs font-semibold uppercase text-gray-500">Cierre</p><p className="mt-1 text-white">{formatCalendarDate(config.fecha_cierre, { dateStyle: 'long', timeStyle: 'short' })}</p>{configPhase === 'open' ? <p className="mt-2 font-racing text-xl font-bold text-yellow-300">Cierra en {formatCountdown(parseCalendarDate(config.fecha_cierre).getTime() - now)}</p> : null}</div>
            </div>
          </section>

          <section className="mt-6 border border-racing-border bg-racing-card p-6">
            <div className="mb-5 flex items-center gap-3"><CalendarDaysIcon className="h-6 w-6 text-racing-red"/><h3 className="font-racing text-2xl font-bold">Calendario</h3></div>
            <div className="grid gap-3 md:grid-cols-2">
              {config.calendario.map(event => <div key={event.ronda} className="flex gap-4 border border-racing-border bg-racing-dark p-4"><span className="font-racing text-2xl font-bold text-racing-red">{event.ronda}</span><div><p className="font-semibold text-white">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</p><p className="text-sm text-gray-400">{formatCalendarDate(event.fecha, { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>)}
            </div>
          </section>

          {!formToken && !completed ? <div className="mt-8 text-center">
            <button type="button" onClick={startForm} disabled={configPhase !== 'open'} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-40">Comenzar inscripción</button>
            {configPhase === 'upcoming' ? <div className="mx-auto mt-4 max-w-xl border border-yellow-400/30 bg-yellow-400/10 p-4"><p className="font-racing text-xl font-bold text-yellow-300">Próximo inicio de campeonato</p><p className="mt-2 text-sm text-gray-300">El formulario se abrirá automáticamente el {formatCalendarDate(config.fecha_apertura, { dateStyle: 'long', timeStyle: 'short' })}.</p></div> : null}
            {configPhase === 'full' ? <p className="mt-3 text-sm text-yellow-300">Se alcanzó el límite de {config.limite_inscriptos} inscriptos.</p> : null}
          </div> : null}

          {formToken && !expired ? <form onSubmit={submit} className="mt-8 space-y-8">
            <div className="sticky top-2 z-20 flex items-center justify-between border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 backdrop-blur"><span className="flex items-center gap-2 text-sm text-yellow-200"><ClockIcon className="h-5 w-5"/>Tiempo para completar</span><strong className="font-racing text-2xl text-yellow-300">{formatCountdown(expiresAt - now)}</strong></div>

            <section className="card-glass p-6">
              <h3 className="font-racing text-2xl font-bold">1. Datos del piloto</h3>
              <div className="relative mt-5"><label className="text-sm text-gray-300">Nombre completo</label><div className="relative mt-2"><MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"/><input name="nombre" value={driver.nombre} onChange={changeDriver} onFocus={() => setShowSuggestions(true)} className="input-field pl-10" autoComplete="off" required placeholder="Escribí tu nombre para buscarte"/></div>
                {showSuggestions && suggestions.length ? <div className="absolute z-30 mt-1 w-full border border-racing-border bg-racing-dark shadow-xl">{suggestions.map(item => <button key={item.id} type="button" onClick={() => selectDriver(item)} className="block w-full border-b border-racing-border px-4 py-3 text-left hover:bg-racing-red/10"><strong>{item.nombre}</strong><span className="ml-2 text-sm text-gray-500">{item.localidad}</span>{item.ig ? <span className="ml-2 text-sm text-racing-red">{formatInstagramHandle(item.ig)}</span> : null}</button>)}</div> : null}
              </div>
              <p className="mt-2 text-xs text-gray-500">Si aparecés en la búsqueda, seleccioná tu nombre. Si sos nuevo, completá todos tus datos.</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label><span className="text-sm text-gray-300">Teléfono</span><input name="telefono" value={driver.telefono} onChange={changeDriver} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">ID Steam</span><input name="steam" value={driver.steam} onChange={changeDriver} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Usuario de Instagram</span><input name="ig" value={driver.ig} onChange={changeDriver} className="input-field mt-2" placeholder="@usuario o enlace de Instagram" autoComplete="off"/></label>
                <label><span className="text-sm text-gray-300">Localidad</span><input name="localidad" value={driver.localidad} onChange={changeDriver} className="input-field mt-2" required/></label>
                <label><span className="text-sm text-gray-300">Provincia</span><input name="provincia" value={driver.provincia} onChange={changeDriver} className="input-field mt-2"/></label>
                <label className="md:col-span-2"><span className="text-sm text-gray-300">Nacionalidad</span><CountrySelect value={driver.nacionalidad} onChange={value => setDriver(current => ({ ...current, nacionalidad: value }))} className="mt-2"/></label>
              </div>
            </section>

            <section className="card-glass p-6"><h3 className="font-racing text-2xl font-bold">2. Auto habilitado</h3><p className="mt-2 text-sm text-gray-500">Cada modelo admite hasta {config.limite_por_modelo} pilotos.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{config.autos.map(car => <label key={car.id} className={`border p-4 transition ${!car.disponible ? 'cursor-not-allowed border-racing-border bg-racing-dark opacity-45' : String(carId) === String(car.id) ? 'cursor-pointer border-racing-red bg-racing-red/10' : 'cursor-pointer border-racing-border bg-racing-dark'}`}><input type="radio" name="auto" value={car.id} disabled={!car.disponible} checked={String(carId) === String(car.id)} onChange={event => setCarId(event.target.value)} className="sr-only"/><p className="font-bold text-white">{car.marca}</p><p className="text-sm text-gray-400">{car.modelo}</p><p className={`mt-3 text-xs font-semibold ${car.disponible ? 'text-green-400' : 'text-racing-red'}`}>{car.disponible ? `${car.inscriptos_modelo}/${car.limite_modelo} inscriptos` : 'Modelo completo'}</p></label>)}</div>{!config.autos.length ? <p className="mt-4 text-yellow-300">Todavía no hay autos habilitados para este formulario.</p> : null}</section>

            <section className="card-glass p-6"><h3 className="font-racing text-2xl font-bold">3. Diseño del auto</h3><div className="mt-5 grid gap-3 md:grid-cols-3">{modalities.map(item => <label key={item.id} className={`cursor-pointer border p-4 ${modality === item.id ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><input type="radio" name="modalidad" value={item.id} checked={modality === item.id} onChange={event => { setModality(event.target.value); setNumber(''); }} className="sr-only"/><p className="font-bold text-white">{item.label}</p><p className="mt-1 text-sm text-gray-400">{item.description}</p><p className="mt-3 font-racing text-xl font-bold text-yellow-300">{formatPrice(item.price)}</p></label>)}</div>
              {modality && modality !== 'extra' ? <div className="mt-6 max-w-sm"><label className="text-sm text-gray-300">Número del auto</label><input type="number" min="1" max="200" value={number} onChange={event => setNumber(event.target.value)} className={`input-field mt-2 ${numberAvailable === false ? 'border-red-500' : numberAvailable === true ? 'border-green-500' : ''}`} required/>{numberAvailable === false ? <p className="mt-2 text-sm font-semibold text-red-400">Ese número está ocupado.</p> : null}{numberAvailable === true ? <p className="mt-2 text-sm font-semibold text-green-400">Número disponible.</p> : null}</div> : null}
              {modality ? <div className="mt-6 flex items-center justify-between border-t border-racing-border pt-5"><span className="font-semibold text-gray-300">Total a abonar</span><strong className="font-racing text-3xl text-yellow-300">{formatPrice(modalities.find(item => item.id === modality)?.price)}</strong></div> : null}
            </section>

            {message ? <div className="border border-racing-red/30 bg-racing-red/10 p-4 text-sm text-gray-200">{message}</div> : null}
            <button type="submit" disabled={submitting || !carId || !modality || (modality !== 'extra' && numberAvailable !== true)} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Registrando...' : 'Confirmar inscripción'}</button>
          </form> : null}

          {expired ? <div className="mt-8 border border-racing-red/30 bg-racing-red/10 p-6 text-center"><ClockIcon className="mx-auto h-10 w-10 text-racing-red"/><p className="mt-3 font-racing text-2xl font-bold">El formulario venció</p><button type="button" onClick={startForm} className="btn-primary mt-5">Empezar nuevamente</button></div> : null}
          {completed ? <div className="mt-8 border border-green-500/30 bg-green-500/10 p-8 text-center"><CheckCircleIcon className="mx-auto h-14 w-14 text-green-400"/><h3 className="mt-4 font-racing text-3xl font-bold">¡Inscripción completada!</h3><p className="mt-2 text-gray-300">{message}</p></div> : null}
        </> : null}

        {!loading && !forms.length ? <div className="mt-10 border border-racing-border bg-racing-card p-10 text-center"><UserPlusIcon className="mx-auto h-12 w-12 text-gray-600"/><p className="mt-4 text-gray-400">No hay formularios de inscripción configurados.</p></div> : null}
        {message && !formToken && !completed ? <p className="mt-6 text-sm text-yellow-300">{message}</p> : null}
      </div>
    </main>
  );
}
