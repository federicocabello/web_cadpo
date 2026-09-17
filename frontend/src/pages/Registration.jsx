import { useEffect, useMemo, useState } from 'react';
import { CalendarDaysIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, MapPinIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { CountryFlag, CountrySelect } from '../components/CountryFlag';
import { mediaApi, registrationFormsApi } from '../services/api';
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
const getOpeningCountdown = (value, now) => {
  const openingDate = parseCalendarDate(value);
  if (!openingDate) return null;

  const currentDate = new Date(now);
  const currentDay = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const openingDay = Date.UTC(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());
  const calendarDays = Math.round((openingDay - currentDay) / 86400000);

  if (calendarDays > 1) return { label: 'Las inscripciones abren en', value: `${calendarDays} días` };
  if (calendarDays === 1) return { label: 'Las inscripciones abren', value: 'mañana' };

  const difference = Math.max(0, openingDate.getTime() - now);
  const hours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference / 60000) % 60);
  return { label: 'Las inscripciones abren en', value: `${hours} h ${String(minutes).padStart(2, '0')} min` };
};

export default function Registration() {
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('campeonato') || '';
  const [config, setConfig] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [activeGalleryImage, setActiveGalleryImage] = useState(0);
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
  const openingCountdown = configPhase === 'upcoming' ? getOpeningCountdown(config?.fecha_apertura, now) : null;

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setGalleryImages([]);
    setActiveGalleryImage(0);
    setFormToken('');
    setCompleted(false);
    setMessage('');
    if (!selectedId) {
      setLoading(false);
      setMessage('No se indicó el campeonato en el enlace de inscripción.');
      return () => { cancelled = true; };
    }
    setLoading(true);
    registrationFormsApi.getById(selectedId)
      .then(async response => {
        const loadedConfig = response.data.data;
        if (cancelled) return;
        setConfig(loadedConfig);
        try {
          const imagesResponse = await mediaApi.getRegistrationImages({ categoria: loadedConfig.categoria, temporada: loadedConfig.temporada });
          if (!cancelled) setGalleryImages(imagesResponse.data.data || []);
        } catch {
          if (!cancelled) setGalleryImages([]);
        }
      })
      .catch(error => { if (!cancelled) setMessage(error.response?.data?.error || 'No se pudo cargar el campeonato.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (galleryImages.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveGalleryImage(current => {
      let next = current;
      while (next === current) next = Math.floor(Math.random() * galleryImages.length);
      return next;
    }), 9000);
    return () => window.clearInterval(timer);
  }, [galleryImages]);

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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {loading ? <div className="py-20 text-center text-gray-400">Cargando...</div> : null}
        {config && !loading ? <>
          {openingCountdown ? <div className="mb-5 flex w-full items-center justify-center gap-4 border border-yellow-300/55 bg-black/75 p-5 text-center backdrop-blur-sm sm:p-6"><div className="flex h-14 w-14 shrink-0 items-center justify-center border border-yellow-300/50 bg-yellow-400 text-black"><ClockIcon className="h-7 w-7"/></div><div className="text-left"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-200 sm:text-xs">{openingCountdown.label}</p><p className="mt-1 font-racing text-3xl font-bold uppercase leading-none text-white sm:text-4xl">{openingCountdown.value}</p></div></div> : null}
          <section className="relative min-h-[34rem] overflow-hidden border border-racing-border bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            {galleryImages[activeGalleryImage] ? <img key={galleryImages[activeGalleryImage]} src={galleryImages[activeGalleryImage]} alt="" className="registration-background-transition absolute inset-0 h-full w-full object-cover"/> : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/20"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30"/>
            <div className="race-hero-grid absolute inset-0 opacity-20"/>
            <div className="relative z-10 flex min-h-[34rem] flex-col justify-between p-6 sm:p-9 lg:p-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur-md ${configPhase === 'open' ? 'border-green-400/60 bg-green-500/20 text-green-300' : 'border-yellow-400/60 bg-yellow-400/15 text-yellow-300'}`}>{phaseText(configPhase)}</span>
                <span className="border border-white/20 bg-black/55 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-200 backdrop-blur-md">{config.plataforma}</span>
              </div>

              <div className="max-w-4xl py-12">
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                  {config.categoria_logo ? <img src={config.categoria_logo} alt={`Logo de ${config.categoria}`} className="h-24 w-28 shrink-0 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.9)] sm:h-32 sm:w-40 lg:h-40 lg:w-48"/> : null}
                  <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-yellow-300">Temporada {config.temporada}</p><h2 className="font-racing text-5xl font-bold uppercase leading-[0.9] text-white drop-shadow-[0_7px_25px_rgba(0,0,0,0.95)] sm:text-6xl lg:text-7xl">{config.categoria}</h2></div>
                </div>
                <p className="mt-7 max-w-3xl text-sm leading-relaxed text-gray-200 sm:text-base"><strong className="text-white">Setup:</strong> {config.setup_detalle}</p>
              </div>

              <div className="grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Calendario</p><p className="mt-1 font-racing text-xl font-bold text-white">{config.cantidad_fechas} fechas</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cupos</p><p className="mt-1 font-racing text-xl font-bold text-white">{configPhase === 'upcoming' ? Number(config.preinscriptos || 0) : config.cupos_ocupados}/{config.limite_inscriptos} {configPhase === 'upcoming' ? 'pre-inscriptos' : 'inscriptos'}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Precio base</p><p className="mt-1 font-racing text-2xl font-bold text-yellow-300">{formatPrice(config.precio)}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Servicio</p>{Number(config.precio || 0) > 10000 ? <a href="https://www.youtube.com/@alPodioEnVivo" target="_blank" rel="noreferrer" className="mt-1 flex w-fit items-center gap-2 text-sm font-semibold text-green-400 transition-colors hover:text-green-300"><PlayCircleIcon className="h-5 w-5"/>Transmisión en vivo</a> : <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-400"><PlayCircleIcon className="h-5 w-5"/>Sin transmisión en vivo</p>}</div>
              </div>
            </div>
            {galleryImages.length > 1 ? <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">{galleryImages.map((image, index) => <button key={image} type="button" onClick={() => setActiveGalleryImage(index)} aria-label={`Mostrar imagen ${index + 1}`} className={`h-1.5 transition-all ${index === activeGalleryImage ? 'w-8 bg-yellow-300' : 'w-3 bg-white/40 hover:bg-white/70'}`}/>)}</div> : null}
          </section>

          <section className="mt-6 border border-racing-border bg-racing-card p-6">
            <div className="mb-5 flex items-center gap-3"><CalendarDaysIcon className="h-6 w-6 text-racing-red"/><h3 className="font-racing text-2xl font-bold">Calendario</h3></div>
            <div className="grid gap-3 md:grid-cols-2">
              {config.calendario.map(event => <article key={event.ronda} className="relative min-h-48 overflow-hidden border border-racing-border bg-racing-dark"><img src={event.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/><div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/25"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"/><div className="relative z-10 flex min-h-48 items-stretch justify-between gap-4 p-5"><div className="flex min-w-0 flex-col"><span className="w-fit bg-racing-red px-3 py-1 font-racing text-sm font-bold uppercase text-white">Fecha {event.ronda}</span><div className="mt-auto"><div className="flex items-center gap-2"><CountryFlag country={event.pais} className="text-xl"/><p className="font-racing text-2xl font-bold uppercase leading-tight text-white">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</p></div><p className="mt-2 flex items-center gap-2 text-sm capitalize text-gray-200"><CalendarDaysIcon className="h-4 w-4 text-racing-red"/>{formatCalendarDate(event.fecha, { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p>{[event.localidad, event.provincia].filter(Boolean).length ? <p className="mt-1 flex items-center gap-2 text-xs text-gray-400"><MapPinIcon className="h-4 w-4 text-racing-red"/>{[event.localidad, event.provincia].filter(Boolean).join(', ')}</p> : null}</div></div>{event.circuito_trazado_url ? <img src={event.circuito_trazado_url} alt={`Trazado de ${event.circuito}`} className="h-28 w-32 shrink-0 self-center object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.9)] sm:h-32 sm:w-40" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : null}</div></article>)}
            </div>
          </section>

          {!formToken && !completed && configPhase === 'open' ? <div className="mt-8 text-center"><button type="button" onClick={startForm} className="btn-primary justify-center">Comenzar inscripción</button></div> : null}
          {!formToken && !completed && configPhase === 'full' ? <p className="mt-8 text-center text-sm text-yellow-300">Se alcanzó el límite de {config.limite_inscriptos} inscriptos.</p> : null}

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

        {message && !formToken && !completed ? <p className="mt-6 text-sm text-yellow-300">{message}</p> : null}
      </div>
    </main>
  );
}
