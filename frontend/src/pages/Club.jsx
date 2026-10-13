import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ClockIcon,
  FlagIcon,
  MapPinIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { clubApi } from '../services/api';
import ServerJoinButton from '../components/ServerJoinButton';
import { CountryFlag } from '../components/CountryFlag';

const formatCards = [
  { value: '7', unit: 'MINUTOS', title: 'Clasificación', text: 'Una sesión corta para ordenar la grilla de cada carrera.', Icon: ClockIcon, tone: 'text-cyan-300' },
  { value: '7', unit: 'MINUTOS', title: 'Carrera', text: 'Carreras rápidas para competir, divertirse y volver a largar.', Icon: FlagIcon, tone: 'text-racing-red' },
  { value: '∞', unit: 'EN LOOP', title: 'Actividad permanente', text: 'Al finalizar la carrera, el ciclo vuelve a comenzar automáticamente.', Icon: ArrowPathIcon, tone: 'text-violet-300' },
];

const formatLapTime = nanoseconds => {
  if (!nanoseconds) return 'S/TIEMPO';
  const milliseconds = Math.round(Number(nanoseconds) / 1000000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

export default function Club() {
  const [configurations, setConfigurations] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [timing, setTiming] = useState(null);
  const [timingError, setTimingError] = useState('');
  const [timingLoading, setTimingLoading] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || '';
    document.title = 'CADPO CLUB | Servidores gratuitos de carreras';
    description?.setAttribute('content', 'CADPO CLUB reúne los servidores abiertos y gratuitos de la comunidad para correr durante toda la semana.');
    return () => {
      document.title = previousTitle;
      description?.setAttribute('content', previousDescription);
    };
  }, []);

  useEffect(() => {
    let active = true;
    clubApi.get()
      .then(({ data }) => {
        if (!active) return;
        const items = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
        setConfigurations(items);
        setSelectedServerId(current => current || String(items[0]?.id || ''));
      })
      .catch(() => active && setConfigurations([]));
    return () => { active = false; };
  }, []);

  const configuration = useMemo(
    () => configurations.find(item => String(item.id) === String(selectedServerId)) || configurations[0] || null,
    [configurations, selectedServerId],
  );

  const loadTiming = useCallback(async () => {
    if (!configuration) return;
    setTimingLoading(true);
    try {
      const { data } = await clubApi.getLiveTiming(configuration.id);
      setTiming(data.data || null);
      setTimingError('');
    } catch (error) {
      setTimingError(error.response?.data?.error || 'No se pudo conectar con este servidor CLUB.');
    } finally {
      setTimingLoading(false);
    }
  }, [configuration]);

  useEffect(() => {
    if (!configuration) return undefined;
    setTiming(null);
    setTimingError('');
    loadTiming();
    const interval = window.setInterval(loadTiming, 10000);
    return () => window.clearInterval(interval);
  }, [configuration, loadTiming]);

  const connectedDrivers = useMemo(() => [...(timing?.connected || [])].sort((a, b) => {
    if (Number(a.position) && Number(b.position)) return Number(a.position) - Number(b.position);
    return Number(b.bestLap || 0) - Number(a.bestLap || 0);
  }), [timing]);

  return <div className="animate-fade-in bg-[#060709]">
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-black">
      {configuration?.circuito_imagen ? <img src={configuration.circuito_imagen} alt="" className="absolute inset-0 -z-30 h-full w-full object-cover opacity-30"/> : null}
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(2,12,30,.98)_0%,rgba(4,35,70,.82)_48%,rgba(2,12,30,.94)_100%),radial-gradient(circle_at_18%_20%,rgba(37,99,235,.3),transparent_40%)]"/>
      <div className="race-hero-grid absolute inset-0 -z-10 opacity-15"/>
      <div className="mx-auto grid min-h-[460px] w-full max-w-[1600px] items-center gap-8 px-5 py-11 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:px-14 xl:px-20">
        <div>
          <div className="inline-flex items-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"/>Servidores abiertos y gratuitos</div>
          {configurations.length > 1 ? <div className="mt-4 flex max-w-3xl flex-wrap gap-2">{configurations.map(server => <button key={server.id} type="button" onClick={() => setSelectedServerId(String(server.id))} className={`border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition ${String(server.id) === String(configuration?.id) ? 'border-yellow-300 bg-yellow-300 text-black' : 'border-blue-300/30 bg-blue-500/10 text-blue-200 hover:border-blue-300 hover:bg-blue-500 hover:text-white'}`}><span className="mr-2 opacity-60">#{server.numero_servidor}</span>{server.nombre}</button>)}</div> : null}
          <div className="mt-6 flex items-center gap-4 sm:gap-6">{configuration?.categoria_logo ? <img src={configuration.categoria_logo} alt={configuration.categoria || ''} className="h-20 w-24 shrink-0 object-contain sm:h-28 sm:w-36"/> : <img src="/casco.png" alt="Casco CADPO CLUB" className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(96,165,250,0.3)] sm:h-24 sm:w-24"/>}<div><p className="font-racing text-sm font-bold uppercase tracking-[0.35em] text-blue-300 sm:text-base">CADPO</p><h1 className="font-racing text-6xl font-black uppercase leading-none text-white sm:text-8xl lg:text-9xl">Club</h1></div></div>
          <h2 className="mt-7 max-w-3xl font-racing text-2xl font-bold uppercase leading-tight text-white sm:text-4xl">Entrá, clasificá y corré todas las veces que quieras.</h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">Servidores libres de la comunidad para que cualquier piloto pueda sumarse gratuitamente. No necesitás estar inscripto en un campeonato.</p>
          <div className="mt-5 max-w-2xl border-l-2 border-blue-300 bg-blue-400/[0.06] px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-300">Contenido renovado</p><p className="mt-1 text-xs leading-relaxed text-gray-300 sm:text-sm">Las categorías y los circuitos se irán renovando para ofrecer nuevas combinaciones.</p></div>
          {configuration ? <div className="mt-7 flex flex-wrap gap-3"><ServerJoinButton href={configuration.servidor} variant="green" steady/><a href="#tiempos-club" className="inline-flex items-center gap-2 border border-blue-300 bg-blue-600 px-5 py-3 font-racing text-sm font-bold uppercase text-white transition hover:bg-blue-500"><SignalIcon className="h-5 w-5"/>Ver tiempos</a></div> : null}
        </div>

        <div className="relative mx-auto w-full max-w-xl border border-blue-300/35 bg-[#03152b]/85 p-5 shadow-2xl shadow-black sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-500">{configuration?.nombre || 'Contenido actual'}</p><p className="mt-1 font-racing text-2xl font-bold uppercase text-white">{configuration?.categoria || 'Carreras constantes'}</p></div><span className="bg-emerald-400 px-3 py-1.5 font-racing text-xs font-black uppercase text-black">GRATIS</span></div>
          {configuration ? <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Circuito</p><h3 className="mt-1 font-racing text-2xl font-bold uppercase text-white">{configuration.circuito}</h3><p className="mt-1 flex items-center gap-2 text-xs text-gray-400"><CountryFlag country={configuration.pais} className="text-lg"/><MapPinIcon className="h-4 w-4 text-blue-300"/>{[configuration.localidad, configuration.provincia].filter(Boolean).join(', ') || 'Ubicación no informada'}</p></div>{configuration.circuito_trazado ? <img src={configuration.circuito_trazado} alt="Trazado" className="h-24 w-32 object-contain"/> : null}</div>
            <div className="border-t border-white/10 pt-4"><p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Autos disponibles</p><div className="mt-3 flex flex-wrap gap-2">{configuration.autos.map(car => <span key={car.id} className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold uppercase text-gray-200">{car.logo ? <img src={car.logo} alt="" className="h-6 w-8 object-contain"/> : null}{car.modelo}</span>)}</div></div>
            <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">{formatCards.map(({ value, unit, title, tone }) => <div key={title} className="bg-white/[0.035] px-2 py-2.5 text-center"><strong className={`font-racing text-2xl font-black ${tone}`}>{value}</strong><span className="ml-1 text-[7px] font-black uppercase text-gray-500">{unit}</span><p className="mt-0.5 truncate text-[8px] font-bold uppercase text-gray-300">{title}</p></div>)}</div>
          </div> : <div className="mt-5 space-y-3">{formatCards.map(({ value, unit, title, text, Icon, tone }) => <article key={title} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border border-white/10 bg-white/[0.025] p-3"><div className="border-r border-white/10 pr-3 text-center"><strong className="block font-racing text-4xl font-black leading-none text-white">{value}</strong><span className={`mt-1 block text-[8px] font-black uppercase ${tone}`}>{unit}</span></div><div><p className="flex items-center gap-2 font-racing text-lg font-bold uppercase text-white"><Icon className={`h-5 w-5 ${tone}`}/>{title}</p><p className="mt-1 text-xs leading-relaxed text-gray-400">{text}</p></div></article>)}</div>}
        </div>
      </div>
    </section>

    {configuration ? <section id="tiempos-club" className="mx-auto w-full max-w-[1600px] scroll-mt-40 px-5 py-14 sm:px-8 lg:px-14 xl:px-20">
      <header className="flex flex-col gap-4 border-l-2 border-blue-300 pl-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300">Actividad · {configuration.nombre}</p><h2 className="mt-2 font-racing text-3xl font-bold uppercase text-white sm:text-5xl">Tiempos en vivo</h2></div><div className="flex items-center gap-2"><span className={`inline-flex h-10 items-center gap-2 border px-3 text-xs font-bold uppercase ${timingError ? 'border-red-400/35 bg-red-400/10 text-red-300' : 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'}`}><span className={`h-2 w-2 rounded-full ${timingError ? 'bg-red-400' : 'animate-pulse bg-emerald-300'}`}/>{timingError ? 'Sin conexión' : `${connectedDrivers.length} conectado${connectedDrivers.length === 1 ? '' : 's'}`}</span><button type="button" onClick={loadTiming} disabled={timingLoading} className="inline-flex h-10 w-10 items-center justify-center border border-racing-border text-gray-300 hover:border-blue-300 hover:text-blue-300 disabled:opacity-50" aria-label="Actualizar tiempos"><ArrowPathIcon className={`h-5 w-5 ${timingLoading ? 'animate-spin' : ''}`}/></button></div></header>
      {timingError ? <p className="mt-6 border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-200">{timingError}</p> : null}
      <div className="mt-7 overflow-x-auto border border-blue-300/15 bg-[#030b18]"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-blue-300/25 bg-blue-950/35 text-[9px] font-black uppercase tracking-[0.18em] text-gray-500"><th className="w-20 px-4 py-3 text-center">Pos.</th><th className="px-4 py-3">Piloto</th><th className="px-4 py-3">Auto</th><th className="w-28 px-4 py-3 text-center">Vueltas</th><th className="w-40 px-4 py-3 text-right">Mejor tiempo</th></tr></thead><tbody>{connectedDrivers.map((driver, index) => <tr key={driver.guid || `${driver.name}-${index}`} className="border-b border-blue-300/10 last:border-0"><td className="px-4 py-3 text-center font-racing text-xl font-bold text-blue-300">{driver.position || index + 1}</td><td className="px-4 py-3"><strong className="text-sm text-white">{driver.name}</strong><span className="ml-2 text-[10px] uppercase text-emerald-300">Conectado</span></td><td className="px-4 py-3 text-xs uppercase text-gray-400">{driver.car || driver.carModel || '-'}</td><td className="px-4 py-3 text-center font-racing text-lg text-white">{driver.laps || 0}</td><td className="px-4 py-3 text-right font-racing text-lg font-bold tabular-nums text-white">{formatLapTime(driver.bestLap)}</td></tr>)}{!connectedDrivers.length && !timingLoading ? <tr><td colSpan="5" className="px-5 py-16 text-center text-sm text-gray-500">No hay pilotos conectados en este momento.</td></tr> : null}{timingLoading && !timing ? <tr><td colSpan="5" className="px-5 py-16 text-center text-sm text-gray-500">Consultando el servidor...</td></tr> : null}</tbody></table></div>
    </section> : null}
  </div>;
}
