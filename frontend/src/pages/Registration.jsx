import { useEffect, useMemo, useRef, useState } from 'react';
import { BanknotesIcon, CalendarDaysIcon, CheckCircleIcon, ChevronDownIcon, ClockIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, MapPinIcon, PlayCircleIcon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { CountryFlag, CountrySelect } from '../components/CountryFlag';
import { championshipsApi, mediaApi, registrationFormsApi, resultsApi } from '../services/api';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';
import { formatPrice } from '../utils/currency';
import { formatInstagramHandle } from '../utils/instagram';

const emptyDriver = { idpiloto: '', nombre: '', localidad: '', provincia: '', telefono: '', nacionalidad: '', steam: '', ig: '', rankingPosition: null };
const formatPersonName = value => String(value || '').trim().toLocaleLowerCase('es-AR')
  .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);
const getRegistrationPhase = (form, now) => {
  if (!form) return 'closed';
  if ((parseCalendarDate(form.fecha_apertura)?.getTime() || 0) > now) return 'upcoming';
  if ((parseCalendarDate(form.fecha_cierre)?.getTime() || 0) <= now) return 'closed';
  return Number(form.inscriptos_actuales) >= Number(form.limite_inscriptos) ? 'full' : 'open';
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
  return { label: 'Las inscripciones abren en', value: [hours > 0 ? `${hours} HORAS` : '', `${String(minutes).padStart(2, '0')} min`].filter(Boolean).join(' ') };
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
  const [officialCarId, setOfficialCarId] = useState('');
  const [officialCarCollapsedGroups, setOfficialCarCollapsedGroups] = useState({});
  const [modality, setModality] = useState('');
  const [number, setNumber] = useState('');
  const [numberAvailable, setNumberAvailable] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [validationNotice, setValidationNotice] = useState('');
  const [rankingOpen, setRankingOpen] = useState(false);
  const [previousRanking, setPreviousRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState('');
  const autoStartRef = useRef('');
  const configPhase = getRegistrationPhase(config, now);
  const openingCountdown = configPhase === 'upcoming' ? getOpeningCountdown(config?.fecha_apertura, now) : null;
  const numericCarNumber = Number(number);
  const numberInvalid = Boolean(number) && (!Number.isInteger(numericCarNumber) || numericCarNumber < 1 || numericCarNumber > 255);
  const configuredPlan = config?.planes?.find(plan => plan.id === modality) || null;
  const planRequiresNumber = Boolean(configuredPlan && configuredPlan.tipo !== 'sin_numero');
  const usesOfficialCar = configuredPlan?.tipo === 'pintura_oficial';
  const usesManualNumber = configuredPlan?.tipo === 'con_numero';

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setGalleryImages([]);
    setActiveGalleryImage(0);
    setOfficialCarId('');
    setOfficialCarCollapsedGroups({});
    setFormToken('');
    setCompleted(false);
    setConfirmationOpen(false);
    setValidationNotice('');
    setRankingOpen(false);
    setPreviousRanking(null);
    setRankingError('');
    autoStartRef.current = '';
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
    if (!formToken || !planRequiresNumber || !number || !Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > 255) {
      setNumberAvailable(null); return undefined;
    }
    if (usesOfficialCar) {
      const officialCar = (config?.autos_oficiales || []).find(car => String(car.id) === String(officialCarId));
      setNumberAvailable(Boolean(officialCar && !officialCar.ocupado));
      return undefined;
    }
    setNumberAvailable('checking');
    const timer = window.setTimeout(() => {
      registrationFormsApi.checkNumber(selectedId, number, driver.idpiloto)
        .then(response => setNumberAvailable(response.data.data.available))
        .catch(() => setNumberAvailable(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [config?.autos_oficiales, driver.idpiloto, formToken, number, officialCarId, planRequiresNumber, selectedId, usesOfficialCar]);

  const modalities = useMemo(() => (config?.planes || []).filter(plan => plan.habilitado).map(plan => ({
    ...plan,
    label: plan.titulo,
    description: plan.descripcion,
    price: Number(config.precio) + Number(plan.precio_adicional || 0),
    displayPrice: Number(plan.precio_adicional || 0) > 0 ? `+ ${formatPrice(plan.precio_adicional)}` : 'Precio base',
  })), [config]);
  const selectedCar = config?.autos?.find(car => String(car.id) === String(carId)) || null;
  const selectedModality = modalities.find(item => item.id === modality) || null;
  const selectedOfficialCar = config?.autos_oficiales?.find(car => String(car.id) === String(officialCarId)) || null;
  const availableCars = useMemo(() => selectedModality && !usesOfficialCar ? config?.autos || [] : [], [config?.autos, selectedModality, usesOfficialCar]);
  const availableOfficialCars = useMemo(() => selectedModality && usesOfficialCar ? (config?.autos_oficiales || []).filter(car => !car.ocupado) : [], [config?.autos_oficiales, selectedModality, usesOfficialCar]);
  const officialCarGroups = useMemo(() => [...availableOfficialCars.reduce((brands, car) => {
    const brandKey = String(car.idmarca || car.marca);
    if (!brands.has(brandKey)) brands.set(brandKey, { id: brandKey, marca: car.marca, logo: car.logo, models: new Map() });
    const brand = brands.get(brandKey);
    const modelKey = String(car.idauto);
    if (!brand.models.has(modelKey)) brand.models.set(modelKey, { id: modelKey, modelo: car.modelo, cars: [] });
    brand.models.get(modelKey).cars.push(car);
    return brands;
  }, new Map()).values()].map(brand => ({
    ...brand,
    models: [...brand.models.values()].sort((a, b) => String(a.modelo).localeCompare(String(b.modelo), 'es-AR', { sensitivity: 'base' })),
  })).sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es-AR', { sensitivity: 'base' })), [availableOfficialCars]);

  useEffect(() => {
    if (usesOfficialCar || !carId || !selectedModality || availableCars.some(car => String(car.id) === String(carId))) return;
    setCarId('');
  }, [availableCars, carId, selectedModality, usesOfficialCar]);

  const startForm = async () => {
    setMessage('');
    try {
      const response = await registrationFormsApi.start(selectedId);
      setFormToken(response.data.data.token);
      setExpiresAt(new Date(response.data.data.expiresAt).getTime());
      setNow(Date.now());
      setDriver(emptyDriver); setCarId(''); setOfficialCarId(''); setModality(''); setNumber(''); setCompleted(false);
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudo iniciar la inscripción.'); }
  };

  useEffect(() => {
    if (!config || configPhase !== 'open' || formToken || completed) return;
    const startKey = String(config.idcampeonato);
    if (autoStartRef.current === startKey) return;
    autoStartRef.current = startKey;

    registrationFormsApi.start(selectedId)
      .then(response => {
        setFormToken(response.data.data.token);
        setExpiresAt(new Date(response.data.data.expiresAt).getTime());
        setNow(Date.now());
        setDriver(emptyDriver);
        setCarId('');
        setOfficialCarId('');
        setModality('');
        setNumber('');
        setCompleted(false);
      })
      .catch(error => setMessage(error.response?.data?.error || 'No se pudo iniciar la inscripción.'));
  }, [completed, config, configPhase, formToken, selectedId]);

  const selectDriver = selected => {
    setDriver({
      idpiloto: selected.id, nombre: selected.nombre || '', localidad: selected.localidad || '',
      provincia: selected.provincia || '', telefono: selected.telefono || '',
      nacionalidad: selected.nacionalidad || '', steam: selected.steam || '', ig: formatInstagramHandle(selected.ig),
      rankingPosition: Number(selected.ranking_position) || null,
    });
    setNumber(usesOfficialCar && selectedOfficialCar ? String(selectedOfficialCar.numero) : selected.ranking_position ? String(selected.ranking_position) : '');
    setNumberAvailable(null);
    setShowSuggestions(false); setSuggestions([]);
  };

  const changeDriver = event => {
    const { name, value } = event.target;
    setDriver(current => ({ ...current, [name]: name === 'ig' ? formatInstagramHandle(value) : value, ...(name === 'nombre' ? { idpiloto: '', rankingPosition: null } : {}) }));
  };

  const showPreviousRanking = async () => {
    setRankingOpen(true);
    if (previousRanking || rankingLoading) return;
    setRankingLoading(true);
    setRankingError('');
    try {
      const response = await registrationFormsApi.getPreviousRanking(selectedId, formToken);
      setPreviousRanking(response.data.data);
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          const championshipsResponse = await championshipsApi.getAll();
          const previousChampionship = (championshipsResponse.data.data || [])
            .filter(item => String(item.idcategoria) === String(config?.idcategoria) && String(item.id) !== String(selectedId))
            .filter(item => Number(item.id) < Number(selectedId))
            .sort((a, b) => Number(b.id) - Number(a.id))[0];
          if (!previousChampionship) {
            setPreviousRanking({ campeonato: null, pilotos: [] });
          } else {
            const standingsResponse = await championshipsApi.getStandings(previousChampionship.id);
            let standings = standingsResponse.data.data || [];
            if (!standings.length) {
              const resultsResponse = await resultsApi.getAll({ idcampeonato: previousChampionship.id });
              const totals = new Map();
              (resultsResponse.data.data || []).forEach(result => {
                const driverId = Number(result.idpiloto);
                const points = ['presentismo', 'pts_qualy_sprint', 'pts_sprint', 'pts_qualy_final', 'pts_final']
                  .reduce((total, field) => total + (Number(String(result[field] ?? 0).replace(',', '.')) || 0), 0);
                const current = totals.get(driverId) || { idpiloto: driverId, nombre: result.piloto, puntos: 0 };
                current.puntos += points;
                totals.set(driverId, current);
              });
              standings = [...totals.values()]
                .sort((a, b) => b.puntos - a.puntos || String(a.nombre).localeCompare(String(b.nombre), 'es-AR', { sensitivity: 'base' }))
                .map((item, index) => ({ ...item, posicion: index + 1 }));
            }
            setPreviousRanking({
              campeonato: previousChampionship,
              pilotos: standings.filter(item => Number(item.posicion) >= 1 && Number(item.posicion) <= 255).map(item => ({
                idpiloto: item.idpiloto,
                nombre: item.nombre,
                posicion: Number(item.posicion),
                numero: Number(item.posicion),
              })),
            });
          }
        } catch (fallbackError) {
          setRankingError(fallbackError.response?.data?.error || 'No se pudo cargar el ranking de la temporada anterior.');
        }
      } else {
        setRankingError(error.response?.data?.error || 'No se pudo cargar el ranking de la temporada anterior.');
      }
    } finally { setRankingLoading(false); }
  };

  const requestConfirmation = async event => {
    event.preventDefault();
    if (expired) return;
    if (usesOfficialCar && !officialCarId) { setMessage('Elegí uno de los autos oficiales disponibles.'); return; }
    if (planRequiresNumber && numberAvailable !== true) { setMessage('Elegí un número disponible para continuar.'); return; }
    setCheckingAvailability(true);
    setMessage('');
    setValidationNotice('');
    try {
      const response = await registrationFormsApi.checkAvailability(selectedId, {
        idpiloto: Number(driver.idpiloto) || null,
        numero: planRequiresNumber ? Number(number) : 0,
        idauto_oficial: usesOfficialCar ? Number(officialCarId) : null,
        formToken,
      });
      if (!response.data.data.available) {
        setValidationNotice(response.data.message || 'La inscripción ya no está disponible.');
        return;
      }
      setConfirmationOpen(true);
    } catch (error) {
      const apiError = error.response?.data?.error || '';
      const availabilityRouteMissing = error.response?.status === 404 && apiError === 'Ruta no encontrada';
      if (availabilityRouteMissing) {
        // Compatibilidad durante despliegues escalonados: el guardado vuelve a
        // validar piloto, número, auto y cupos dentro de una transacción.
        setConfirmationOpen(true);
      } else {
        setValidationNotice(apiError || 'No se pudo comprobar la disponibilidad de la inscripción.');
      }
    } finally { setCheckingAvailability(false); }
  };

  const submit = async () => {
    if (expired || submitting) return;
    setSubmitting(true); setMessage('');
    try {
      const response = await registrationFormsApi.submit(selectedId, {
        ...driver, idauto: Number(carId), plan_id: modality, modalidad_diseno: modality,
        idauto_oficial: usesOfficialCar ? Number(officialCarId) : null,
        numero: planRequiresNumber ? Number(number) : 0, formToken,
      });
      setCompleted(true); setFormToken(''); setConfirmationOpen(false); setMessage(response.data.message);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'No se pudo registrar la inscripción.';
      setConfirmationOpen(false); setMessage(errorMessage); setValidationNotice(errorMessage);
    }
    finally { setSubmitting(false); }
  };

  return (
    <main className="animate-fade-in overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
        {loading ? <div className="py-20 text-center text-gray-400">Cargando...</div> : null}
        {config && !loading ? <>
          {openingCountdown ? <div className="mb-4 flex w-full flex-col items-center justify-center gap-3 border border-yellow-300/55 bg-black/75 p-4 text-center backdrop-blur-sm sm:mb-5 sm:flex-row sm:gap-4 sm:p-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center border border-yellow-300/50 bg-yellow-400 text-black sm:h-14 sm:w-14"><ClockIcon className="h-6 w-6 sm:h-7 sm:w-7"/></div><div className="min-w-0 sm:text-left"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-200 sm:text-xs sm:tracking-[0.22em]">{openingCountdown.label}</p><p className="mt-1 break-words font-racing text-2xl font-bold uppercase leading-none text-white sm:text-4xl">{openingCountdown.value}</p></div></div> : null}
          <section className="relative min-h-0 overflow-hidden border border-racing-border bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:min-h-[34rem]">
            {galleryImages[activeGalleryImage] ? <img key={galleryImages[activeGalleryImage]} src={galleryImages[activeGalleryImage]} alt="" className="registration-background-transition absolute inset-0 h-full w-full object-cover"/> : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/20"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30"/>
            <div className="race-hero-grid absolute inset-0 opacity-20"/>
            <div className="relative z-10 flex min-h-0 flex-col justify-between p-4 pb-10 sm:min-h-[34rem] sm:p-9 lg:p-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md sm:px-4 sm:text-xs sm:tracking-[0.18em] ${configPhase === 'open' ? 'border-green-400/60 bg-green-500/20 text-green-300' : 'border-yellow-400/60 bg-yellow-400/15 text-yellow-300'}`}>{phaseText(configPhase)}</span>
                <span className="border border-white/20 bg-black/55 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-200 backdrop-blur-md sm:px-4 sm:text-xs">{config.plataforma}</span>
              </div>

              <div className="max-w-4xl py-8 sm:py-12">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
                  {config.categoria_logo ? <img src={config.categoria_logo} alt={`Logo de ${config.categoria}`} className="h-20 w-24 shrink-0 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.9)] sm:h-32 sm:w-40 lg:h-40 lg:w-48"/> : null}
                  <div className="min-w-0"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-yellow-300 sm:text-xs sm:tracking-[0.3em]">Temporada {config.temporada}</p><h2 className="break-words font-racing text-4xl font-bold uppercase leading-[0.92] text-white drop-shadow-[0_7px_25px_rgba(0,0,0,0.95)] [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">{config.categoria}</h2></div>
                </div>
                <p className="mt-5 max-w-3xl text-sm leading-relaxed text-gray-200 sm:mt-7 sm:text-base"><strong className="text-white">Setup:</strong> {config.setup_detalle}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-5 border-t border-white/15 pt-5 lg:grid-cols-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Calendario</p><p className="mt-1 font-racing text-xl font-bold text-white">{config.cantidad_fechas} fechas</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cupos</p><p className="mt-1 break-words font-racing text-lg font-bold text-white sm:text-xl">{configPhase === 'upcoming' ? Number(config.preinscriptos || 0) : config.cupos_ocupados}/{config.limite_inscriptos} {configPhase === 'upcoming' ? 'pre-inscriptos' : 'inscriptos'}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Precio base</p><p className="mt-1 font-racing text-2xl font-bold text-yellow-300">{formatPrice(config.precio)}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Servicio</p>{Number(config.precio || 0) > 10000 ? <a href="https://www.youtube.com/@alPodioEnVivo" target="_blank" rel="noreferrer" className="mt-1 flex w-fit items-start gap-1.5 text-xs font-semibold leading-snug text-green-400 transition-colors hover:text-green-300 sm:items-center sm:gap-2 sm:text-sm"><PlayCircleIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"/>Transmisión en vivo</a> : <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-snug text-gray-400 sm:items-center sm:gap-2 sm:text-sm"><PlayCircleIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"/>Sin transmisión en vivo</p>}</div>
              </div>
            </div>
            {galleryImages.length > 1 ? <div className="absolute bottom-3 left-4 right-4 z-20 flex justify-end gap-1.5 overflow-x-auto">{galleryImages.map((image, index) => <button key={image} type="button" onClick={() => setActiveGalleryImage(index)} aria-label={`Mostrar imagen ${index + 1}`} className={`h-1.5 shrink-0 transition-all ${index === activeGalleryImage ? 'w-8 bg-yellow-300' : 'w-3 bg-white/40 hover:bg-white/70'}`}/>)}</div> : null}
          </section>

          <section className="mt-4 border border-racing-border bg-racing-card p-4 sm:mt-6 sm:p-6">
            <div className="mb-4 flex items-center gap-3 sm:mb-5"><CalendarDaysIcon className="h-5 w-5 text-racing-red sm:h-6 sm:w-6"/><h3 className="font-racing text-xl font-bold sm:text-2xl">Calendario</h3></div>
            <div className="grid gap-3 md:grid-cols-2">
              {config.calendario.map(event => <article key={event.ronda} className="relative min-h-52 overflow-hidden border border-racing-border bg-racing-dark sm:min-h-48"><img src={event.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/><div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/25"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"/><div className="relative z-10 flex min-h-52 items-stretch justify-between gap-2 p-4 sm:min-h-48 sm:gap-4 sm:p-5"><div className="flex min-w-0 flex-1 flex-col pr-20 sm:pr-0"><span className="w-fit bg-racing-red px-3 py-1 font-racing text-xs font-bold uppercase text-white sm:text-sm">Fecha {event.ronda}</span><div className="mt-auto"><div className="flex items-start gap-2"><CountryFlag country={event.pais} className="shrink-0 text-lg sm:text-xl"/><p className="break-words font-racing text-xl font-bold uppercase leading-tight text-white [overflow-wrap:anywhere] sm:text-2xl">{event.circuito}{event.variante ? ` · ${event.variante}` : ''}</p></div><p className="mt-2 flex items-start gap-2 text-xs capitalize leading-relaxed text-gray-200 sm:items-center sm:text-sm"><CalendarDaysIcon className="mt-0.5 h-4 w-4 shrink-0 text-racing-red sm:mt-0"/>{formatCalendarDate(event.fecha, { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H</p>{[event.localidad, event.provincia].filter(Boolean).length ? <p className="mt-1 flex items-start gap-2 text-xs text-gray-400"><MapPinIcon className="h-4 w-4 shrink-0 text-racing-red"/><span className="break-words">{[event.localidad, event.provincia].filter(Boolean).join(', ')}</span></p> : null}</div></div>{event.circuito_trazado_url ? <img src={event.circuito_trazado_url} alt={`Trazado de ${event.circuito}`} className="absolute right-3 top-12 h-16 w-20 object-contain opacity-80 drop-shadow-[0_10px_18px_rgba(0,0,0,0.9)] sm:static sm:h-32 sm:w-40 sm:shrink-0 sm:self-center sm:opacity-100" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : null}</div></article>)}
            </div>
          </section>

          {!formToken && !completed && configPhase === 'full' ? <p className="mt-8 text-center text-sm text-yellow-300">Se alcanzó el límite de {config.limite_inscriptos} inscriptos.</p> : null}

          {formToken && !expired ? <form onSubmit={requestConfirmation} className="mt-5 flex flex-col gap-5 sm:mt-8 sm:gap-8">
            <section className="card-glass order-1 p-4 sm:p-6">
              <h3 className="font-racing text-xl font-bold sm:text-2xl">1. Datos del piloto</h3>
              <div className="relative mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><label className="text-sm text-gray-300">Nombre y apellido</label>{driver.idpiloto ? <div className="flex items-center gap-2"><span className="border border-green-400/40 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-300">Piloto registrado</span><button type="button" onClick={() => { setDriver(emptyDriver); setSuggestions([]); setShowSuggestions(false); }} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-white">Cambiar piloto</button></div> : driver.nombre.trim() ? <span className="border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-300">Piloto nuevo</span> : null}</div><div className="relative mt-2"><MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"/><input name="nombre" value={driver.nombre} onChange={changeDriver} onBlur={() => { if (!driver.idpiloto) setDriver(current => ({ ...current, nombre: formatPersonName(current.nombre) })); }} onFocus={() => { if (!driver.idpiloto) setShowSuggestions(true); }} className={`input-field pl-10 ${driver.idpiloto ? 'cursor-not-allowed bg-black/40 text-gray-400' : ''}`} autoComplete="off" required readOnly={Boolean(driver.idpiloto)} placeholder="Escribí tu nombre para buscarte"/></div>
                {showSuggestions && suggestions.length ? <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto border border-racing-border bg-racing-dark shadow-xl">{suggestions.map(item => <button key={item.id} type="button" onClick={() => selectDriver(item)} className="block w-full border-b border-racing-border px-3 py-3 text-left transition-colors hover:bg-racing-red/10 sm:px-4"><strong className="block break-words text-white">{item.nombre}</strong><span className="mt-1 flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:text-sm"><span>Localidad: <span className="text-gray-200">{item.localidad || 'Sin registrar'}</span></span><span>Teléfono: <span className="text-gray-200">{item.telefono || 'Sin registrar'}</span></span>{item.ig ? <span className="break-all text-racing-red">{formatInstagramHandle(item.ig)}</span> : null}</span></button>)}</div> : null}
              </div>
              <p className="mt-2 text-xs text-gray-500">Si aparecés en la búsqueda, seleccioná tu nombre. Si sos nuevo, completá todos tus datos.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label><span className="text-sm text-gray-300">Teléfono <span className="text-gray-600">(opcional)</span></span><input name="telefono" value={driver.telefono} onChange={changeDriver} className="input-field mt-2"/></label>
                <label><span className="text-sm text-gray-300">ID Steam <span className="text-gray-600">(opcional)</span></span><input name="steam" value={driver.steam} onChange={changeDriver} className="input-field mt-2"/></label>
                <label><span className="text-sm text-gray-300">Usuario de Instagram <span className="text-gray-600">(opcional)</span></span><input name="ig" value={driver.ig} onChange={changeDriver} className="input-field mt-2" placeholder="@usuario o enlace de Instagram" autoComplete="off"/></label>
                <label><span className="text-sm text-gray-300">Localidad <span className="text-gray-600">(opcional)</span></span><input name="localidad" value={driver.localidad} onChange={changeDriver} className="input-field mt-2"/></label>
                <label><span className="text-sm text-gray-300">Provincia <span className="text-gray-600">(opcional)</span></span><input name="provincia" value={driver.provincia} onChange={changeDriver} className="input-field mt-2"/></label>
                <label><span className="text-sm text-gray-300">Nacionalidad <span className="text-gray-600">(opcional)</span></span><CountrySelect value={driver.nacionalidad} onChange={value => setDriver(current => ({ ...current, nacionalidad: value }))} allowEmpty className="mt-2"/></label>
              </div>
            </section>

            <section className="card-glass order-3 p-4 sm:p-6">
              <h3 className="font-racing text-xl font-bold sm:text-2xl">3. Auto habilitado</h3>
              <p className="mt-2 text-sm text-gray-500">Cada modelo admite hasta {config.limite_por_modelo} autos confirmados.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {officialCarGroups.map(brand => {
                  const brandGroupKey = `brand:${brand.id}`;
                  const brandCollapsed = Boolean(officialCarCollapsedGroups[brandGroupKey]);
                  const brandCarsCount = brand.models.reduce((total, model) => total + model.cars.length, 0);
                  return <div key={brand.id} className="overflow-hidden border border-white/10 bg-black/20 sm:col-span-2 lg:col-span-3">
                    <button type="button" onClick={() => setOfficialCarCollapsedGroups(current => ({ ...current, [brandGroupKey]: !current[brandGroupKey] }))} className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-300 hover:bg-yellow-400/[0.06]" aria-expanded={!brandCollapsed}>
                      <span className="flex min-w-0 items-center gap-3">{brand.logo ? <img src={brand.logo} alt="" className="h-10 w-16 shrink-0 object-contain"/> : null}<span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">Marca</span><span className="block truncate font-racing text-xl font-bold uppercase text-white">{brand.marca}</span></span><span className="shrink-0 text-xs font-semibold uppercase text-gray-500">{brand.models.length} modelo{brand.models.length === 1 ? '' : 's'} · {brandCarsCount} auto{brandCarsCount === 1 ? '' : 's'}</span></span>
                      <ChevronDownIcon className={`h-5 w-5 shrink-0 text-yellow-300 transition-transform duration-500 ease-in-out ${brandCollapsed ? '-rotate-90' : 'rotate-0'}`}/>
                    </button>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${brandCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-3 border-t border-white/10 p-3 sm:p-4">{brand.models.map(model => {
                          const modelGroupKey = `model:${brand.id}:${model.id}`;
                          const modelCollapsed = Boolean(officialCarCollapsedGroups[modelGroupKey]);
                          return <section key={model.id} className="overflow-hidden border border-white/10 bg-racing-dark/70">
                            <button type="button" onClick={() => setOfficialCarCollapsedGroups(current => ({ ...current, [modelGroupKey]: !current[modelGroupKey] }))} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-300 hover:bg-white/[0.04]" aria-expanded={!modelCollapsed}>
                              <span><span className="block text-[9px] font-bold uppercase tracking-widest text-gray-500">Modelo</span><span className="font-racing text-lg font-bold uppercase text-white">{model.modelo}</span><span className="ml-3 text-xs font-semibold uppercase text-gray-500">{model.cars.length} diseño{model.cars.length === 1 ? '' : 's'}</span></span>
                              <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-500 ease-in-out ${modelCollapsed ? '-rotate-90' : 'rotate-0'}`}/>
                            </button>
                            <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${modelCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                              <div className="min-h-0 overflow-hidden">
                                <div className="grid gap-4 border-t border-white/10 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">{model.cars.map(car => {
                                  const selected = String(officialCarId) === String(car.id);
                                  return <label key={car.id} aria-disabled={car.ocupado} className={`group relative min-h-64 overflow-hidden border-2 transition-all duration-300 ${car.ocupado ? 'cursor-not-allowed border-gray-700 opacity-55 grayscale' : selected ? 'cursor-pointer border-green-400 ring-2 ring-green-400/35 shadow-[0_0_30px_rgba(34,197,94,0.22)] sm:scale-[1.015]' : 'cursor-pointer border-racing-border hover:-translate-y-1 hover:border-yellow-300'}`}>
                                    <input type="radio" name="auto_oficial" value={car.id} disabled={car.ocupado} checked={selected} onChange={() => { setOfficialCarId(String(car.id)); setCarId(String(car.idauto)); setNumber(String(car.numero)); setNumberAvailable(null); }} className="sr-only"/>
                                    <img src={car.foto} alt={`${car.marca} ${car.modelo} número ${car.numero}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10"/>
                                    <div className="relative z-10 flex min-h-64 flex-col justify-between p-4">
                                      <div className="flex items-start justify-between gap-3">{car.logo ? <img src={car.logo} alt={`Logo de ${car.marca}`} className="h-14 w-20 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.9)]"/> : <span className="bg-black/70 px-3 py-2 text-xs font-bold uppercase text-white">{car.marca}</span>}<span className="bg-yellow-400 px-3 py-2 font-racing text-xl font-bold text-black">Nº {car.numero}</span></div>
                                      <div>{selected ? <span className="mb-3 inline-flex items-center gap-1.5 bg-green-500 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black"><CheckCircleIcon className="h-4 w-4"/>Seleccionado</span> : car.ocupado ? <span className="mb-3 inline-block bg-racing-red px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white">No disponible</span> : null}<p className="text-xs font-semibold uppercase tracking-widest text-gray-300">{car.marca}</p><p className="mt-1 font-racing text-2xl font-bold uppercase leading-tight text-white">{car.modelo}</p><p className="mt-2 text-sm leading-relaxed text-gray-200">{car.descripcion}</p></div>
                                    </div>
                                  </label>;
                                })}</div>
                              </div>
                            </div>
                          </section>;
                        })}</div>
                      </div>
                    </div>
                  </div>;
                })}
                {availableCars.map(car => {
                  const selected = String(carId) === String(car.id);
                  return <label key={car.id} aria-disabled={!car.disponible} className={`group relative min-h-56 overflow-hidden border-2 transition-all duration-300 sm:min-h-64 ${!car.disponible ? 'cursor-not-allowed border-gray-700 opacity-60 grayscale' : selected ? 'cursor-pointer border-green-400 ring-2 ring-green-400/35 shadow-[0_0_30px_rgba(34,197,94,0.22)] sm:scale-[1.015]' : 'cursor-pointer border-racing-border hover:-translate-y-1 hover:border-racing-red'}`}>
                    <input type="radio" name="auto" value={car.id} disabled={!car.disponible} checked={selected} onChange={event => setCarId(event.target.value)} className="sr-only"/>
                    {car.imagen ? <img src={car.imagen} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={imageEvent => { imageEvent.currentTarget.style.display = 'none'; }}/> : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/20"/>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent"/>
                    <div className="relative z-10 flex min-h-56 flex-col justify-between p-4 sm:min-h-64">
                      <div className="flex items-start justify-between gap-3">
                        {car.logo ? <span className="flex h-14 w-20 items-center justify-center"><img src={car.logo} alt={`Logo de ${car.marca}`} className="h-full w-full object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.9)]"/></span> : <span className="border border-white/20 bg-black/60 px-3 py-2 text-xs font-bold uppercase text-white">{car.marca}</span>}
                        {selected ? <span className="flex items-center gap-1 bg-green-500 px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-black sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-wider"><CheckCircleIcon className="h-4 w-4 shrink-0"/>Seleccionado</span> : !car.disponible ? <span className="bg-racing-red px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-white sm:px-3 sm:text-[10px] sm:tracking-wider">Modelo completo</span> : null}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-300">{car.marca}</p>
                        <p className="mt-1 font-racing text-2xl font-bold uppercase leading-tight text-white drop-shadow-lg">{car.modelo}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-wider drop-shadow-lg">
                          <span className="text-green-300"><strong className="mr-1 font-racing text-base text-white">{Number(car.ocupados_modelo || 0)}/{car.limite_modelo}</strong>Ocupados</span>
                          <span className="text-yellow-300"><strong className="mr-1 font-racing text-base text-white">{Number(car.lista_espera_modelo || 0)}</strong>Lista de espera</span>
                        </div>
                      </div>
                    </div>
                  </label>;
                })}
              </div>
              {!availableCars.length && !availableOfficialCars.length ? <p className="mt-4 text-yellow-300">{!selectedModality ? 'Primero elegí uno de los planes de inscripción.' : usesOfficialCar ? (config?.autos_oficiales?.length ? 'Todos los autos oficiales ya están ocupados.' : 'Este plan todavía no tiene autos oficiales cargados.') : 'Todavía no hay autos habilitados para este formulario.'}</p> : null}
            </section>

            <section className="card-glass order-2 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-racing text-xl font-bold sm:text-2xl">2. Plan de inscripción</h3><p className="mt-1 text-xs text-gray-500">Los pilotos rankeados conservan el número de su posición anterior.</p></div><button type="button" onClick={showPreviousRanking} className="inline-flex w-full items-center justify-center gap-2 border border-yellow-400/40 bg-yellow-400/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-yellow-300 transition hover:border-yellow-300 hover:bg-yellow-400 hover:text-black sm:w-auto"><TrophyIcon className="h-5 w-5"/>Ver ranking anterior</button></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{modalities.map(item => <label key={item.id} className={`cursor-pointer border p-4 transition-colors ${modality === item.id ? 'border-racing-red bg-racing-red/10' : 'border-racing-border bg-racing-dark'}`}><input type="radio" name="modalidad" value={item.id} checked={modality === item.id} onChange={() => { setModality(item.id); setOfficialCarId(''); setCarId(''); setNumber(item.tipo === 'con_numero' && driver.rankingPosition ? String(driver.rankingPosition) : ''); setNumberAvailable(null); }} className="sr-only"/><p className="font-bold text-white">{item.label}</p><p className="mt-1 text-sm text-gray-400">{item.description}</p><p className="mt-3 font-racing text-xl font-bold text-yellow-300">{item.displayPrice}</p></label>)}</div>
              {modality && usesManualNumber ? <div className="mx-auto mt-8 w-full max-w-xs text-center"><label className="text-xs font-bold uppercase tracking-[0.22em] text-gray-300">Número del auto</label><input type="number" min="1" max="255" step="1" value={number} onChange={event => setNumber(event.target.value)} readOnly={Boolean(driver.rankingPosition)} className={`input-field font-anton mt-3 h-24 text-center text-5xl tracking-[0.08em] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:h-28 sm:text-6xl ${driver.rankingPosition ? 'cursor-not-allowed bg-black/40 text-gray-400' : 'bg-black/55 text-yellow-300'} ${numberInvalid || numberAvailable === false ? 'border-red-500' : numberAvailable === true ? 'border-green-500' : 'border-yellow-300/40'}`} required/>{driver.rankingPosition ? <p className="mt-3 border-t-2 border-yellow-400 pt-3 text-sm font-semibold text-yellow-300">Piloto rankeado: te corresponde el número {driver.rankingPosition} por tu posición en la temporada anterior.</p> : <p className="mt-3 text-xs text-gray-500">Ingresá un número entero del 1 al 255.</p>}{numberAvailable === 'checking' ? <p className="mt-2 text-sm font-semibold text-gray-400">Comprobando disponibilidad del número...</p> : null}{numberInvalid ? <p className="mt-2 text-sm font-semibold text-red-400">El número debe ser un entero entre 1 y 255.</p> : null}{!numberInvalid && numberAvailable === false ? <p className="mt-2 text-sm font-semibold text-red-400">{driver.rankingPosition ? `El número ${driver.rankingPosition} asignado por ranking ya está ocupado. No podés continuar con esta inscripción.` : 'Ese número está ocupado o reservado. Elegí otro para continuar.'}</p> : null}{!numberInvalid && numberAvailable === true ? <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-green-400"><CheckCircleIcon className="h-5 w-5"/>{driver.rankingPosition ? `Número ${driver.rankingPosition} disponible y confirmado por ranking.` : 'Número disponible.'}</p> : null}</div> : null}
            </section>

            {modality ? <section className="card-glass order-4 overflow-hidden border-yellow-400/35"><div className="grid lg:grid-cols-[1.25fr_0.75fr]"><div className="p-4 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center bg-yellow-400 text-black"><BanknotesIcon className="h-6 w-6"/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">4. Pago de la inscripción</p><h3 className="font-racing text-xl font-bold uppercase text-white sm:text-2xl">Datos para realizar el pago</h3></div></div><p className="mt-5 max-w-2xl text-sm leading-relaxed text-gray-300">Realizá el pago para confirmar tu lugar. Una vez acreditado, te agregaremos a los grupos y recibirás todo lo necesario para descargar el contenido e ingresar al servidor.</p><dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm"><div className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-gray-500">Alias</dt><dd className="select-all font-racing text-lg font-bold text-yellow-300">fede.liga</dd></div><div className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-gray-500">Cuenta</dt><dd className="font-semibold text-white">Personal Pay</dd></div><div className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-gray-500">A nombre de</dt><dd className="font-semibold text-white">Federico Manuel</dd></div></dl></div><div className="flex flex-col justify-center border-t border-yellow-400/20 bg-yellow-400/[0.06] p-4 sm:p-6 lg:border-l lg:border-t-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Resumen</p><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between gap-3 text-gray-400"><span>Inscripción</span><span className="shrink-0">{formatPrice(config.precio)}</span></div>{Number(selectedModality?.precio_adicional || 0) > 0 ? <div className="flex items-center justify-between gap-3 text-gray-400"><span>{selectedModality.label}</span><span className="shrink-0">+ {formatPrice(selectedModality.precio_adicional)}</span></div> : null}</div><div className="mt-5 border-t border-yellow-400/25 pt-4"><span className="text-xs font-bold uppercase tracking-wider text-gray-400">Subtotal</span><strong className="mt-1 block font-racing text-4xl font-bold text-yellow-300">{formatPrice(selectedModality?.price)}</strong></div></div></div></section> : null}

            {message ? <div className="order-5 border border-racing-red/30 bg-racing-red/10 p-4 text-sm text-gray-200">{message}</div> : null}
            <button type="submit" disabled={submitting || checkingAvailability || !carId || !modality || (usesOfficialCar && !officialCarId) || (planRequiresNumber && numberAvailable !== true)} className="btn-primary order-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">{checkingAvailability ? 'Comprobando piloto y número...' : submitting ? 'Registrando...' : 'Confirmar inscripción'}</button>
          </form> : null}

          {expired ? <div className="mt-5 border border-racing-red/30 bg-racing-red/10 p-4 text-center sm:mt-8 sm:p-6"><ClockIcon className="mx-auto h-10 w-10 text-racing-red"/><p className="mt-3 font-racing text-xl font-bold sm:text-2xl">El formulario venció</p><button type="button" onClick={startForm} className="btn-primary mt-5 w-full justify-center sm:w-auto">Empezar nuevamente</button></div> : null}
          {completed ? <div className="mt-5 border border-green-500/30 bg-green-500/10 p-5 text-center sm:mt-8 sm:p-8"><CheckCircleIcon className="mx-auto h-12 w-12 text-green-400 sm:h-14 sm:w-14"/><h3 className="mt-4 font-racing text-2xl font-bold sm:text-3xl">¡Inscripción completada!</h3><p className="mt-2 break-words text-sm text-gray-300 sm:text-base">{message}</p></div> : null}

          {confirmationOpen && !submitting ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto border border-green-400/45 bg-racing-dark p-4 shadow-[0_25px_80px_rgba(0,0,0,0.7)] sm:max-h-[calc(100dvh-2rem)] sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400 sm:text-xs sm:tracking-[0.24em]">Confirmación final</p><h3 className="mt-2 font-racing text-2xl font-bold uppercase text-white sm:text-3xl">Revisá tu inscripción</h3><div className="mt-4 divide-y divide-racing-border border-y border-racing-border text-sm sm:mt-6"><div className="flex items-start justify-between gap-3 py-3"><span className="shrink-0 text-gray-500">Piloto</span><strong className="break-words text-right text-white">{driver.nombre}</strong></div><div className="flex items-start justify-between gap-3 py-3"><span className="shrink-0 text-gray-500">Auto</span><strong className="break-words text-right text-white">{selectedCar ? `${selectedCar.marca} ${selectedCar.modelo}` : '-'}</strong></div><div className="flex items-start justify-between gap-3 py-3"><span className="shrink-0 text-gray-500">Plan</span><strong className="break-words text-right text-white">{selectedModality?.label}</strong></div><div className="flex items-start justify-between gap-3 py-3"><span className="shrink-0 text-gray-500">Número</span><strong className="break-words text-right text-white">{planRequiresNumber ? number : 'No requiere número'}</strong></div><div className="flex items-center justify-between gap-3 py-3"><span className="shrink-0 text-gray-500">Total</span><strong className="font-racing text-xl text-yellow-300">{formatPrice(selectedModality?.price)}</strong></div></div><p className="mt-4 text-xs leading-relaxed text-gray-400 sm:mt-5">Al confirmar, volveremos a comprobar el cupo general, el lugar disponible en el modelo y, cuando corresponda, el número elegido.</p><div className="mt-5 flex flex-col-reverse gap-3 sm:mt-6 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmationOpen(false)} className="w-full border border-gray-600 px-5 py-3 text-sm font-bold uppercase text-gray-300 transition-colors hover:border-gray-400 hover:text-white sm:w-auto">Volver</button><button type="button" onClick={submit} className="btn-primary w-full justify-center sm:w-auto">Confirmar inscripción</button></div></div></div> : null}
          {validationNotice && !submitting ? <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="registration-validation-title"><div className="w-full max-w-md border border-red-400/60 bg-racing-dark p-5 shadow-[0_25px_80px_rgba(0,0,0,0.75)] sm:p-7"><ExclamationTriangleIcon className="h-11 w-11 text-red-400"/><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">No se puede guardar</p><h3 id="registration-validation-title" className="mt-1 font-racing text-2xl font-bold uppercase text-white">Revisá la inscripción</h3><p className="mt-4 text-sm leading-relaxed text-gray-300">{validationNotice}</p><p className="mt-3 text-xs leading-relaxed text-gray-500">Las inscripciones pendientes de pago también reservan al piloto y el número del auto.</p><button type="button" onClick={() => setValidationNotice('')} className="btn-primary mt-6 w-full justify-center">Entendido</button></div></div> : null}
          {rankingOpen ? <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="previous-ranking-title"><section className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-yellow-400/45 bg-racing-dark shadow-[0_25px_80px_rgba(0,0,0,0.75)] sm:max-h-[85vh]"><header className="flex items-start justify-between gap-4 border-b border-racing-border p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-300">Numeración por ranking</p><h3 id="previous-ranking-title" className="mt-1 font-racing text-2xl font-bold uppercase text-white sm:text-3xl">Temporada anterior</h3>{previousRanking?.campeonato ? <p className="mt-1 text-sm text-gray-400">{previousRanking.campeonato.categoria} · Temporada {previousRanking.campeonato.temporada} · {previousRanking.campeonato.anio}</p> : null}</div><button type="button" onClick={() => setRankingOpen(false)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-racing-border text-gray-400 transition hover:border-yellow-300 hover:text-white" aria-label="Cerrar ranking"><XMarkIcon className="h-5 w-5"/></button></header><div className="min-h-0 overflow-y-auto p-4 sm:p-6">{rankingLoading ? <p className="py-12 text-center text-gray-400">Cargando ranking...</p> : rankingError ? <p className="border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{rankingError}</p> : previousRanking?.pilotos?.length ? <div className="overflow-hidden border border-racing-border"><div className="grid grid-cols-[90px_1fr] bg-black/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500"><span>Número</span><span>Piloto</span></div>{previousRanking.pilotos.map(item => { const selected = String(item.idpiloto) === String(driver.idpiloto); return <div key={item.idpiloto} className={`grid grid-cols-[90px_1fr] items-center border-t px-3 py-3 ${selected ? 'border-yellow-300/50 bg-yellow-400/15' : 'border-racing-border'}`}><span className={`font-racing text-xl font-bold ${selected ? 'text-yellow-300' : 'text-white'}`}>#{item.numero}</span><span className="flex min-w-0 flex-wrap items-center gap-2"><strong className="break-words text-sm text-white">{item.nombre}</strong>{selected ? <span className="bg-yellow-400 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-black">Tu número</span> : null}</span></div>; })}</div> : <p className="border border-dashed border-racing-border py-10 text-center text-sm text-gray-500">No hay un ranking anterior disponible para este campeonato.</p>}</div></section></div> : null}
        </> : null}

        {message && !formToken && !completed ? <p className="mt-6 text-sm text-yellow-300">{message}</p> : null}
      </div>
      {submitting ? <div className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center bg-black/95 px-5 text-center"><div className="registration-info-flag server-join-flag h-14 w-20 border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.16)] sm:h-16 sm:w-24"/><p className="mt-6 font-racing text-3xl font-bold uppercase tracking-wider text-white sm:mt-7 sm:text-4xl">Cargando...</p><p className="mt-2 text-xs uppercase tracking-[0.14em] text-gray-400 sm:text-sm sm:tracking-[0.18em]">Verificando cupos, auto y número</p><div className="mt-6 h-1 w-full max-w-64 overflow-hidden bg-white/10 sm:mt-7"><div className="h-full w-1/2 animate-pulse bg-racing-red"/></div></div> : null}
    </main>
  );
}
