import { useCallback, useEffect, useState } from 'react';
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
  { value: '7', unit: 'MINUTOS', title: 'Clasificación', Icon: ClockIcon, tone: 'text-cyan-300' },
  { value: '7', unit: 'MINUTOS', title: 'Carrera', Icon: FlagIcon, tone: 'text-racing-red' },
  { value: '∞', unit: 'EN LOOP', title: 'Actividad permanente', Icon: ArrowPathIcon, tone: 'text-violet-300' },
];

const isRaceSession = timing => Number(timing?.sessionType) === 3 || /carrera|race/i.test(String(timing?.session || ''));

function ServerCard({ configuration, timing, error, loading }) {
  const connected = timing?.connected?.length || 0;
  const racing = isRaceSession(timing);
  const session = timing?.session || (error ? 'Sin conexión' : loading ? 'Consultando...' : 'Sin actividad');

  return (
    <article className="relative isolate flex min-h-0 flex-col overflow-hidden border border-blue-300/30 bg-[#03152b]/90 shadow-xl shadow-black/30">
      {configuration.circuito_imagen ? <img src={configuration.circuito_imagen} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-20"/> : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#020b18]/95 via-[#03152b]/90 to-[#03152b]/75"/>

      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {configuration.categoria_logo ? <img src={configuration.categoria_logo} alt={configuration.categoria || ''} className="h-12 w-14 shrink-0 object-contain"/> : null}
          <div className="min-w-0">
            <h2 className="truncate font-racing text-xl font-bold uppercase text-white">{configuration.categoria}</h2>
            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wider text-blue-300">{configuration.nombre}</p>
          </div>
        </div>
        <span className="shrink-0 bg-emerald-400 px-2 py-1 text-[8px] font-black uppercase text-black">Gratis</span>
      </header>

      <div className="grid grid-cols-2 border-b border-white/10">
        <div className="border-r border-white/10 px-4 py-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Tanda actual</p>
          <p className={`mt-1 truncate font-racing text-base font-bold uppercase ${error ? 'text-red-300' : racing ? 'text-racing-red' : 'text-cyan-300'}`}>{session}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Estado</p>
          <p className={`mt-1 flex items-center gap-2 font-racing text-base font-bold uppercase ${error ? 'text-red-300' : racing ? 'text-racing-red' : 'text-emerald-300'}`}>
            <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-400' : racing ? 'animate-pulse bg-racing-red' : 'bg-emerald-300'}`}/>
            {error ? 'No disponible' : racing ? 'En carrera' : 'Fuera de carrera'}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="relative isolate flex min-h-24 items-center justify-between gap-4 overflow-hidden border border-white/[0.06] bg-black/10 px-4 py-4">
          <CountryFlag country={configuration.pais} className="!absolute !inset-y-0 !right-0 !h-full !w-3/5 !shrink [background-position:center] [background-size:cover] opacity-30 [mask-image:linear-gradient(to_left,black,transparent)] [-webkit-mask-image:linear-gradient(to_left,black,transparent)]"/>
          <div className="relative z-10 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-blue-300">Circuito</p>
            <h3 className="mt-1 truncate font-racing text-xl font-bold uppercase text-white sm:text-2xl">{configuration.circuito}</h3>
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-gray-300"><MapPinIcon className="h-4 w-4 shrink-0 text-blue-300"/>{[configuration.localidad, configuration.provincia].filter(Boolean).join(', ') || 'Ubicación no informada'}</p>
          </div>
          {configuration.circuito_trazado ? <img src={configuration.circuito_trazado} alt="Trazado" className="relative z-10 h-20 w-28 shrink-0 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.9)]"/> : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-y border-white/10 py-2.5">
          <div className="flex items-center gap-2"><SignalIcon className="h-5 w-5 text-emerald-300"/><div><strong className="block font-racing text-xl leading-none text-white">{error ? '—' : connected}</strong><span className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Pilotos online</span></div></div>
          {!error ? <span className="text-[8px] font-black uppercase tracking-wider text-emerald-300">Servidor conectado</span> : null}
        </div>

        {configuration.autos?.length ? <div className="scrollbar-hidden mt-3 grid min-h-0 flex-1 grid-cols-1 content-start gap-1.5 overflow-y-auto">{configuration.autos.map(car => <div key={car.id} className="flex min-h-11 w-full items-center gap-3 border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">{car.logo ? <img src={car.logo} alt="" className="h-9 w-14 shrink-0 object-contain sm:h-10 sm:w-16"/> : <span className="h-9 w-14 shrink-0"/>}<span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-gray-200 sm:text-xs">{car.modelo}</span></div>)}</div> : null}
        <ServerJoinButton href={configuration.servidor} variant="green" steady label="Instalar contenido e ingresar" className="mt-3 w-full justify-center py-2.5 text-xs"/>
      </div>
    </article>
  );
}

export default function Club() {
  const [configurations, setConfigurations] = useState([]);
  const [timingByServer, setTimingByServer] = useState({});
  const [errorsByServer, setErrorsByServer] = useState({});
  const [timingLoading, setTimingLoading] = useState(false);

  useEffect(() => {
    let active = true;
    clubApi.get()
      .then(({ data }) => {
        if (!active) return;
        const items = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
        setConfigurations(items.slice(0, 3));
      })
      .catch(() => active && setConfigurations([]));
    return () => { active = false; };
  }, []);

  const loadServerStatuses = useCallback(async (showLoading = false) => {
    if (!configurations.length) return;
    if (showLoading) setTimingLoading(true);

    const responses = await Promise.all(configurations.map(async configuration => {
      try {
        const { data } = await clubApi.getLiveTiming(configuration.id);
        return { id: configuration.id, timing: data.data || null, error: '' };
      } catch (requestError) {
        return {
          id: configuration.id,
          timing: null,
          error: requestError.response?.data?.error || 'Sin conexión',
        };
      }
    }));

    setTimingByServer(current => {
      const next = { ...current };
      responses.forEach(response => {
        if (response.timing) next[String(response.id)] = response.timing;
      });
      return next;
    });
    setErrorsByServer(Object.fromEntries(responses.map(response => [String(response.id), response.error])));
    setTimingLoading(false);
  }, [configurations]);

  useEffect(() => {
    if (!configurations.length) return undefined;
    loadServerStatuses(true);
    const interval = window.setInterval(() => loadServerStatuses(false), 10000);
    return () => window.clearInterval(interval);
  }, [configurations, loadServerStatuses]);

  const primaryConfiguration = configurations[0] || null;
  return (
    <main className="relative isolate min-h-[calc(100svh-7rem)] overflow-hidden border-b border-white/10 bg-[#060709] animate-fade-in">
      {primaryConfiguration?.circuito_imagen ? <img src={primaryConfiguration.circuito_imagen} alt="" className="absolute inset-0 -z-30 h-full w-full object-cover opacity-25"/> : null}
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(2,10,24,.98)_0%,rgba(4,30,60,.9)_48%,rgba(2,10,24,.97)_100%),radial-gradient(circle_at_18%_20%,rgba(37,99,235,.3),transparent_40%)]"/>
      <div className="race-hero-grid absolute inset-0 -z-10 opacity-15"/>

      <div className="mx-auto grid min-h-[calc(100svh-7rem)] w-full max-w-[1800px] gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(390px,520px)] lg:items-stretch lg:px-12 xl:gap-12 xl:px-16">
        <section className="flex min-w-0 flex-col justify-center py-3 lg:py-7">
          <div className="inline-flex w-fit items-center gap-2 border border-emerald-300/35 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"/>Servidores abiertos y gratuitos</div>

          <div className="mt-6 flex items-center gap-4 sm:gap-6">
            <img src="/casco.png" alt="Casco CADPO CLUB" className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(96,165,250,0.35)] sm:h-28 sm:w-28 xl:h-32 xl:w-32"/>
            <div><p className="font-racing text-sm font-bold uppercase tracking-[0.35em] text-blue-300 sm:text-base">CADPO</p><h1 className="font-racing text-6xl font-black uppercase leading-none text-white sm:text-8xl xl:text-9xl">Club</h1></div>
          </div>

          <h2 className="mt-7 max-w-3xl font-racing text-2xl font-bold uppercase leading-tight text-white sm:text-4xl xl:text-5xl">Entrá, clasificá y corré todas las veces que quieras.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">Servidores libres de la comunidad para que cualquier piloto pueda sumarse gratuitamente. No necesitás estar inscripto en un campeonato.</p>

          <div className="mt-6 grid max-w-3xl gap-2 sm:grid-cols-3">{formatCards.map(({ value, unit, title, Icon, tone }) => <article key={title} className="flex items-center gap-3 border border-white/10 bg-white/[0.035] px-3 py-3"><Icon className={`h-5 w-5 shrink-0 ${tone}`}/><div><strong className={`font-racing text-2xl font-black ${tone}`}>{value}</strong><span className="ml-1 text-[7px] font-black uppercase text-gray-500">{unit}</span><p className="text-[8px] font-bold uppercase text-gray-300">{title}</p></div></article>)}</div>

          <div className="mt-5 max-w-3xl border-l-2 border-blue-300 bg-blue-400/[0.06] px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-300">Contenido renovado</p><p className="mt-1 text-xs leading-relaxed text-gray-300 sm:text-sm">Las categorías y los circuitos se irán renovando para ofrecer nuevas combinaciones.</p></div>

        </section>

        <aside className="grid min-h-0 gap-3 lg:h-full" style={configurations.length ? { gridTemplateRows: `repeat(${configurations.length}, minmax(0, 1fr))` } : undefined}>
          {configurations.map(configuration => <ServerCard key={configuration.id} configuration={configuration} timing={timingByServer[String(configuration.id)]} error={errorsByServer[String(configuration.id)]} loading={timingLoading}/>) }
          {!configurations.length ? <div className="flex min-h-72 items-center justify-center border border-dashed border-blue-300/25 bg-black/20 px-6 text-center"><div><SignalIcon className="mx-auto h-10 w-10 text-blue-900"/><p className="mt-3 font-racing text-xl font-bold uppercase text-gray-500">No hay servidores CLUB publicados</p></div></div> : null}
        </aside>
      </div>
    </main>
  );
}
