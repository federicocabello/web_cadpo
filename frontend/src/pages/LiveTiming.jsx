import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FlagIcon,
  MapPinIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { authApi, championshipsApi, driversApi, eventsApi, liveTimingApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import ServerJoinButton from '../components/ServerJoinButton';
import { getLiveTimingEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';

const DEFAULT_REFRESH_INTERVAL_MS = 10000;
const QUALIFYING_REFRESH_INTERVAL_MS = 1000;
const DEFAULT_REQUIRED_LAPS = 25;

function CheckeredFlagIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <defs>
        <pattern id="live-timing-checker" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="currentColor" />
          <rect x="8" y="8" width="8" height="8" fill="currentColor" />
        </pattern>
      </defs>
      <path d="M17 8v56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 11c13-8 23 8 39 0v31c-16 8-26-8-39 0V11Z" fill="url(#live-timing-checker)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

const driverNameKey = value => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('es-AR');
const formatBallast = value => {
  const ballast = Math.trunc(Number(value));
  if (!ballast) return '';
  return `+${ballast.toLocaleString('es-AR', { maximumFractionDigits: 0 })} KG`;
};
const sectorColor = (sector, fastestSectors) => {
  if (sector.time === fastestSectors[sector.index]) return 'text-[#c77dff]';
  return ['text-cyan-400', 'text-amber-300', 'text-emerald-400'][sector.index] || 'text-gray-400';
};

const formatSectorDelta = (sector, leaderSectors) => {
  const leaderTime = leaderSectors[sector.index];
  if (!sector.time || !leaderTime) return '';
  const difference = (sector.time - leaderTime) / 1000000000;
  if (Math.abs(difference) < 0.0005) return '0.000';
  return `${difference > 0 ? '+' : '-'}${Math.abs(difference).toFixed(3)}`;
};

const sectorDeltaColor = (sector, fastestSectors, leaderSectors) => {
  if (sector.time === fastestSectors[sector.index]) return 'text-[#c77dff]';
  const leaderTime = leaderSectors[sector.index];
  if (!sector.time || !leaderTime || sector.time === leaderTime) return 'text-gray-500';
  return sector.time > leaderTime ? 'text-red-400' : 'text-green-400';
};

function SectorMiniTable({ sectors, fastestSectors, leaderSectors }) {
  if (!sectors?.length) return null;

  return (
    <div className="grid shrink-0 gap-x-2 font-racing tabular-nums md:gap-x-1 2xl:gap-x-2" style={{ gridTemplateColumns: `repeat(${sectors.length}, minmax(0, 1fr))` }}>
      {sectors.map(sector => (
        <span key={`label-${sector.index}`} className="flex items-baseline gap-1 text-left text-[11px] font-bold uppercase text-white md:text-[9px] 2xl:text-[11px]">
          S{sector.index + 1}
          <strong className={`text-xs md:text-[10px] 2xl:text-xs ${sectorDeltaColor(sector, fastestSectors, leaderSectors)}`}>
            {formatSectorDelta(sector, leaderSectors)}
          </strong>
        </span>
      ))}
      {sectors.map(sector => (
        <span key={`time-${sector.index}`} className={`text-left text-lg font-bold leading-none md:text-sm xl:text-base 2xl:text-lg ${sectorColor(sector, fastestSectors)}`}>
          {formatSectorTime(sector.time)}
        </span>
      ))}
    </div>
  );
}

const formatLapTime = nanoseconds => {
  if (!nanoseconds) return '--:--.---';
  const milliseconds = Math.round(nanoseconds / 1000000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const formatSectorTime = nanoseconds => {
  if (!nanoseconds) return '--.---';
  const milliseconds = Math.round(nanoseconds / 1000000);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  const time = `${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  return minutes ? `${minutes}:${time}` : time;
};

const sessionLabel = value => {
  const session = String(value || '').trim();
  if (/pr[aá]ctica|practice/i.test(session)) return 'Práctica';
  if (/clasificaci[oó]n|qualifying|qualification|qualy/i.test(session)) return 'Clasificación';
  if (/carrera|race/i.test(session)) return 'Carrera';
  return session || 'Sin sesión activa';
};

const isQualifyingSession = value => /clasificaci[oó]n|qualifying|qualification|qualy/i.test(String(value || ''));
const isRaceSession = value => /carrera|race/i.test(String(value || ''));

const parseDate = value => parseCalendarDate(value);

const formatEventDate = value => formatCalendarDate(value, {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatCountdown = (value, now) => {
  if (!value) return '--:--:--';
  const difference = parseDate(value).getTime() - now;
  if (difference <= 0) return '00:00:00';

  const hours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference / 60000) % 60);
  const seconds = Math.floor((difference / 1000) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatRequirementCountdown = (value, now) => {
  if (!value) return '';
  const deadline = parseDate(value)?.getTime() - (20 * 60 * 1000);
  if (!Number.isFinite(deadline)) return '';
  const difference = deadline - now;
  if (difference <= 0) return 'Período finalizado';
  const days = Math.floor(difference / 86400000);
  const hours = Math.floor((difference / 3600000) % 24);
  const minutes = Math.floor((difference / 60000) % 60);
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.length ? parts.join(' · ') : 'Menos de 1 minuto';
};

const formatSessionRemaining = (timing, now) => {
  if (!timing?.time) return '--:--:--';
  const fetchedAt = new Date(timing.updatedAt).getTime();
  const elapsedSinceFetch = Number.isNaN(fetchedAt) ? 0 : Math.max(0, now - fetchedAt);
  const remaining = Math.max(0, (timing.time * 60000) - timing.elapsedMilliseconds - elapsedSinceFetch);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining / 60000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatGap = (lap, leaderLap) => {
  if (!lap || !leaderLap) return '--';
  if (lap === leaderLap) return '';

  const milliseconds = Math.round((lap - leaderLap) / 1000000);
  return `+${(milliseconds / 1000).toFixed(3)}`;
};

const getSelectableLiveTimingEvents = (events, now = new Date()) => {
  const timestamp = now.getTime();
  const allConfiguredEvents = getLiveTimingEvents(events, now);
  const publishedEvents = (Array.isArray(events) ? events : []).filter(event => (
    Boolean(Number(event.mostrar_inicio))
    && (!event.mostrar_desde || (parseCalendarDate(event.mostrar_desde)?.getTime() || 0) <= timestamp)
  ));
  const publishedByChampionship = new Map(
    getLiveTimingEvents(publishedEvents, now)
      .map(event => [String(event.idcampeonato), event]),
  );

  // La fecha elegida para Inicio define el circuito de ese campeonato, pero
  // los otros servidores configurados siguen disponibles en el selector.
  return allConfiguredEvents.map(event => (
    publishedByChampionship.get(String(event.idcampeonato)) || event
  ));
};

export default function LiveTiming() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedChampionshipId = searchParams.get('campeonato');
  const [timing, setTiming] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [calendarError, setCalendarError] = useState(false);
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(null);
  const [driverCountries, setDriverCountries] = useState(new Map());
  const [registeredDrivers, setRegisteredDrivers] = useState(new Map());
  const [enrolledDrivers, setEnrolledDrivers] = useState(new Map());
  const [qualifyingBans, setQualifyingBans] = useState([]);
  const [percentageRule, setPercentageRule] = useState(0);
  const [percentageExemption, setPercentageExemption] = useState(101);
  const [requiredLaps, setRequiredLaps] = useState(DEFAULT_REQUIRED_LAPS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const previousPositionsRef = useRef(new Map());
  const previousSessionRef = useRef('');
  const hasRenderedRowsRef = useRef(false);
  const timingRequestInFlightRef = useRef(false);
  const liveTimingEvents = useMemo(
    () => getSelectableLiveTimingEvents(calendarEvents, new Date(now)),
    [calendarEvents, now],
  );
  const raceEvent = liveTimingEvents.find(event => event.idcampeonato === selectedChampionshipId)
    || liveTimingEvents[0]
    || null;

  const loadTiming = useCallback(async (manual = false) => {
    if (!selectedChampionshipId || timingRequestInFlightRef.current) return;
    timingRequestInFlightRef.current = true;
    if (manual) setRefreshing(true);

    try {
      const response = await liveTimingApi.get(selectedChampionshipId);
      setTiming(response.data.data);
      setStale(Boolean(response.data.stale));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el servidor de tiempos.');
    } finally {
      timingRequestInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChampionshipId]);

  useEffect(() => {
    if (!selectedChampionshipId) return undefined;
    setTiming(null);
    setLoading(true);
    setError('');
    setStale(false);
    previousPositionsRef.current = new Map();
    previousSessionRef.current = '';
    hasRenderedRowsRef.current = false;
    loadTiming();
  }, [loadTiming, selectedChampionshipId]);

  useEffect(() => {
    if (!selectedChampionshipId) return undefined;
    const refreshInterval = isQualifyingSession(timing?.session)
      ? QUALIFYING_REFRESH_INTERVAL_MS
      : DEFAULT_REFRESH_INTERVAL_MS;
    const interval = window.setInterval(loadTiming, refreshInterval);
    return () => window.clearInterval(interval);
  }, [loadTiming, selectedChampionshipId, timing?.session]);

  useEffect(() => {
    if (!selectedChampionshipId) {
      setEnrolledDrivers(new Map());
      setQualifyingBans([]);
      setPercentageRule(0);
      setPercentageExemption(101);
      setRequiredLaps(DEFAULT_REQUIRED_LAPS);
      return undefined;
    }

    let active = true;
    const loadEnrolledDrivers = async () => {
      try {
        const [response, bansResponse] = await Promise.all([
          championshipsApi.getEnrolled(selectedChampionshipId),
          championshipsApi.getQualifyingBans(selectedChampionshipId),
        ]);
        if (!active) return;

        const enrolledMap = new Map();
        for (const registration of response.data.data || []) {
          enrolledMap.set(driverNameKey(registration.nombre), registration);
        }
        setEnrolledDrivers(enrolledMap);
        setQualifyingBans(bansResponse.data.data || []);
      } catch (err) {
        console.error('No se pudieron cargar los inscriptos del campeonato:', err);
        if (active) {
          setEnrolledDrivers(new Map());
          setQualifyingBans([]);
        }
      }
    };

    loadEnrolledDrivers();
    return () => {
      active = false;
    };
  }, [selectedChampionshipId]);

  useEffect(() => {
    if (!selectedChampionshipId) return undefined;
    let active = true;
    setPercentageRule(0);
    setPercentageExemption(101);
    setRequiredLaps(DEFAULT_REQUIRED_LAPS);
    championshipsApi.getById(selectedChampionshipId)
      .then(response => {
        if (!active) return;
        setPercentageRule(Number(response.data.data?.regla_porcentaje || 0));
        setPercentageExemption(Number(response.data.data?.regla_porcentaje_libre || 101));
        setRequiredLaps(Number(response.data.data?.vueltas_minimas || DEFAULT_REQUIRED_LAPS));
      })
      .catch(error => {
        console.error('No se pudo cargar la regla porcentual del campeonato:', error);
        if (active) {
          setPercentageRule(0);
          setPercentageExemption(101);
          setRequiredLaps(DEFAULT_REQUIRED_LAPS);
        }
      });
    return () => { active = false; };
  }, [selectedChampionshipId]);

  useEffect(() => {
    const loadCalendarEvent = async () => {
      try {
        const response = await eventsApi.getAll();
        const loadedEvents = response.data.data || [];
        const activeEvents = getSelectableLiveTimingEvents(loadedEvents);
        setCalendarError(false);
        setCalendarEvents(loadedEvents);
        const priorityEvent = activeEvents[0];
        const requestedEvent = activeEvents.find(event => String(event.idcampeonato) === String(requestedChampionshipId));
        setSelectedChampionshipId(requestedEvent?.idcampeonato || priorityEvent?.idcampeonato || null);
      } catch (err) {
        console.error('No se pudo cargar la fecha del calendario:', err);
        setCalendarError(true);
        setError('No se pudo consultar el calendario.');
        setLoading(false);
      } finally {
        setCalendarLoaded(true);
      }
    };

    loadCalendarEvent();
  }, [requestedChampionshipId]);

  useEffect(() => {
    if (liveTimingEvents.length) {
      const priorityEvent = liveTimingEvents[0];
      const selectedStillAvailable = liveTimingEvents.some(event => event.idcampeonato === selectedChampionshipId);
      if (!selectedStillAvailable) {
        setSelectedChampionshipId(priorityEvent.idcampeonato);
      }
      return;
    }

    if (calendarLoaded) {
      setSelectedChampionshipId(null);
      setTiming(null);
      setLoading(false);
    }
  }, [calendarLoaded, liveTimingEvents, now, selectedChampionshipId]);

  useEffect(() => {
    const loadDriverCountries = async () => {
      try {
        const response = await driversApi.getAll();
        const countryMap = new Map();
        const driverMap = new Map();
        for (const driver of response.data.data || []) {
          const nameKey = driverNameKey(driver.nombre);
          if (driver.steam) {
            const steamKey = String(driver.steam).trim();
            countryMap.set(steamKey, driver.nacionalidad);
            driverMap.set(steamKey, driver);
          }
          countryMap.set(nameKey, driver.nacionalidad);
          driverMap.set(nameKey, driver);
        }
        setDriverCountries(countryMap);
        setRegisteredDrivers(driverMap);
      } catch (err) {
        console.error('No se pudieron cargar las nacionalidades de los pilotos:', err);
      }
    };

    loadDriverCountries();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const drivers = useMemo(() => {
    const byDriver = new Map();

    for (const driver of timing?.stored || []) {
      if (driverNameKey(driver.name) === 'admin') continue;
      byDriver.set(`${driver.guid}-${driver.carModel}`, driver);
    }

    for (const driver of timing?.connected || []) {
      if (driverNameKey(driver.name) === 'admin') continue;
      const key = `${driver.guid}-${driver.carModel}`;
      const stored = byDriver.get(key);
      byDriver.set(key, {
        ...stored,
        ...driver,
        bestLap: driver.bestLap || stored?.bestLap || 0,
        lastLap: driver.lastLap || stored?.lastLap || 0,
        laps: Math.max(driver.laps || 0, stored?.laps || 0),
        topSpeed: Math.max(driver.topSpeed || 0, stored?.topSpeed || 0),
        bestSectors: driver.bestSectors?.length ? driver.bestSectors : stored?.bestSectors || [],
        connected: true,
      });
    }

    return [...byDriver.values()].map(driver => {
      const registration = enrolledDrivers.get(driverNameKey(driver.name));
      const registeredDriver = registeredDrivers.get(driver.guid)
        || registeredDrivers.get(driverNameKey(driver.name));
      return {
        ...driver,
        name: registration?.nombre || registeredDriver?.nombre || driver.name,
        displayCarModel: registration?.modelo || driver.car,
        carBrandLogo: registration?.auto_logo || '',
      };
    }).sort((a, b) => {
      if (!a.bestLap) return 1;
      if (!b.bestLap) return -1;
      return a.bestLap - b.bestLap;
    });
  }, [enrolledDrivers, registeredDrivers, timing]);
  const connectedDriverCount = useMemo(
    () => drivers.filter(driver => driver.connected).length,
    [drivers],
  );

  const bestLap = useMemo(
    () => drivers.reduce((best, driver) => driver.bestLap && (!best || driver.bestLap < best) ? driver.bestLap : best, 0),
    [drivers],
  );
  const percentageRuleActive = percentageRule > 0;
  const qualifyingSession = isQualifyingSession(timing?.session);
  const percentageExemptionCutoff = percentageRuleActive && bestLap ? bestLap * (percentageExemption / 100) : 0;
  const percentageMaximumCutoff = percentageRuleActive && bestLap ? bestLap * (percentageRule / 100) : 0;
  const lapsRequirementDividerIndex = percentageRuleActive && percentageExemptionCutoff
    ? drivers.findIndex(driver => !driver.bestLap || driver.bestLap > percentageExemptionCutoff)
    : -1;
  const exclusionDividerIndex = percentageRuleActive && percentageMaximumCutoff
    ? drivers.findIndex(driver => !driver.bestLap || driver.bestLap > percentageMaximumCutoff)
    : -1;
  const percentageRuleLabel = Number.isInteger(percentageRule) ? String(percentageRule) : String(Number(percentageRule.toFixed(3)));
  const percentageExemptionLabel = Number.isInteger(percentageExemption) ? String(percentageExemption) : String(Number(percentageExemption.toFixed(3)));
  const requirementCountdown = formatRequirementCountdown(raceEvent?.fecha, now);
  const getDriverEligibility = driver => {
    const missingLaps = Math.max(0, requiredLaps - Number(driver.laps || 0));
    const missing = [];
    if (!percentageRuleActive) {
      if (missingLaps > 0) missing.push(`faltan ${missingLaps} ${missingLaps === 1 ? 'vuelta' : 'vueltas'}`);
      return { enabled: missingLaps === 0, missing, status: missingLaps === 0 ? 'laps-complete' : 'laps-required' };
    }

    if (!bestLap) return { enabled: false, missing: ['esperando tiempo del líder'], status: 'no-leader' };
    if (!driver.bestLap) return { enabled: false, missing: ['sin tiempo registrado'], status: 'no-time' };
    if (driver.bestLap > percentageMaximumCutoff) {
      missing.push(`supera el ${percentageRuleLabel}% · debe bajar ${((driver.bestLap - percentageMaximumCutoff) / 1000000000).toFixed(3)} s`);
      return { enabled: false, missing, status: 'outside-maximum' };
    }
    if (driver.bestLap <= percentageExemptionCutoff) return { enabled: true, missing, status: 'percentage-exempt' };
    if (missingLaps > 0) missing.push(`faltan ${missingLaps} ${missingLaps === 1 ? 'vuelta' : 'vueltas'}`);
    return {
      enabled: missingLaps === 0,
      missing,
      status: missingLaps === 0 ? 'laps-complete' : 'laps-required',
    };
  };

  const generateTimingPdf = async () => {
    if (!raceEvent || !drivers.length || generatingPdf) return;
    const password = window.prompt('Ingresá la contraseña de administrador para generar el PDF');
    if (!password) return;
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      window.alert('El navegador bloqueó la pestaña del PDF. Habilitá las ventanas emergentes e intentá nuevamente.');
      return;
    }
    previewWindow.document.title = 'Generando planilla PDF...';
    previewWindow.document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0e;color:#fff;font:700 16px Arial,sans-serif;letter-spacing:.08em">GENERANDO PLANILLA PDF...</div>';
    setGeneratingPdf(true);
    try {
      await authApi.adminLogin(password);
    } catch (authError) {
      previewWindow.close();
      window.alert(authError.response?.data?.error || 'No se pudo validar la contraseña de administrador.');
      setGeneratingPdf(false);
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const loadPdfImage = async source => {
        if (!source) return '';
        const response = await fetch(source);
        if (!response.ok) return '';
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = reject;
            element.src = objectUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, image.naturalWidth);
          canvas.height = Math.max(1, image.naturalHeight);
          canvas.getContext('2d').drawImage(image, 0, 0);
          return canvas.toDataURL('image/png');
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      const [leagueLogoData, categoryLogoData] = await Promise.all([
        loadPdfImage('/logo.png').catch(() => ''),
        loadPdfImage(raceEvent.categoria_logo).catch(() => ''),
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const addContainedImage = (imageData, x, y, maxWidth, maxHeight) => {
        if (!imageData) return;
        const properties = pdf.getImageProperties(imageData);
        const ratio = properties.width / properties.height;
        const width = Math.min(maxWidth, maxHeight * ratio);
        const height = width / ratio;
        pdf.addImage(imageData, 'PNG', x + ((maxWidth - width) / 2), y + ((maxHeight - height) / 2), width, height, undefined, 'FAST');
      };
      const columns = qualifyingSession ? [
        { label: 'P.', width: 10, align: 'center' },
        { label: 'PILOTO', width: 55 },
        { label: 'AUTO', width: 43 },
        { label: 'VUELTA', width: 27, align: 'right' },
        { label: 'DIF.', width: 20, align: 'right' },
        { label: 'V.', width: 14, align: 'center' },
        { label: 'KM/H', width: 21, align: 'right' },
      ] : [
        { label: 'P.', width: 9, align: 'center' },
        { label: 'PILOTO', width: 40 },
        { label: 'AUTO', width: 31 },
        { label: 'VUELTA', width: 23, align: 'right' },
        { label: 'DIF.', width: 17, align: 'right' },
        { label: 'V.', width: 11, align: 'center' },
        { label: 'KM/H', width: 19, align: 'right' },
        { label: 'HABILITACIÓN', width: 40 },
      ];
      const tableWidth = columns.reduce((total, column) => total + column.width, 0);
      const deadline = parseDate(raceEvent.fecha);
      const deadlineText = deadline ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date(deadline.getTime() - (20 * 60 * 1000))).replace(',', '') : '-';

      const drawDocumentHeader = () => {
        pdf.setFillColor(12, 12, 14);
        pdf.rect(0, 0, pageWidth, 44, 'F');
        pdf.setFillColor(220, 38, 38);
        pdf.rect(0, 0, 4, 44, 'F');
        addContainedImage(categoryLogoData, margin, 5, 25, 25);
        addContainedImage(leagueLogoData, pageWidth - margin - 16, 5, 16, 10);
        pdf.setTextColor(220, 38, 38);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('CADPO TORNEOS', 40, 9);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.text(qualifyingSession ? 'PLANILLA DE CLASIFICACIÓN' : 'PLANILLA DE TIEMPOS Y HABILITACIÓN', 40, 17);
        pdf.setFontSize(8);
        pdf.text(`${raceEvent.categoria}  |  Temporada ${raceEvent.temporada}  |  Fecha ${raceEvent.ronda}`, 40, 24);
        pdf.setFontSize(7);
        pdf.text(`${raceEvent.circuito}${raceEvent.variante ? ` - ${raceEvent.variante}` : ''}`, 40, 29);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(190, 190, 195);
        pdf.setFontSize(6.5);
        pdf.text(`Clasificación: ${formatEventDate(raceEvent.fecha)} H`, margin, 35);
        const ruleText = qualifyingSession
          ? `Sesión de clasificación  |  Tiempo restante: ${formatSessionRemaining(timing, now)}`
          : percentageRuleActive
          ? `Hasta ${percentageExemptionLabel}%: sin vueltas mínimas  |  Entre ${percentageExemptionLabel}% y ${percentageRuleLabel}%: ${requiredLaps} vueltas  |  Más de ${percentageRuleLabel}%: no habilitado  |  Cierre: ${deadlineText} H`
          : `Requisito: ${requiredLaps} vueltas mínimas  |  Regla porcentual desactivada`;
        pdf.text(pdf.splitTextToSize(ruleText, pageWidth - (margin * 2)), margin, 40, { lineHeightFactor: 1.05 });
      };

      const drawTableHeader = y => {
        pdf.setFillColor(220, 38, 38);
        pdf.rect(margin, y, tableWidth, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(5.8);
        let x = margin;
        columns.forEach(column => {
          const textX = column.align === 'right' ? x + column.width - 2 : column.align === 'center' ? x + column.width / 2 : x + 2;
          pdf.text(column.label, textX, y + 4.6, { align: column.align || 'left' });
          x += column.width;
        });
        return y + 7;
      };

      drawDocumentHeader();
      let y = drawTableHeader(47);
      drivers.forEach((driver, index) => {
        const eligibility = getDriverEligibility(driver);
        const status = eligibility.enabled ? 'HABILITADO' : `INHABILITADO - ${eligibility.missing.join(' - ')}`;
        const cells = [
          String(index + 1),
          driver.name || '-',
          driver.displayCarModel || '-',
          formatLapTime(driver.bestLap),
          formatGap(driver.bestLap, bestLap) || 'LÍDER',
          String(driver.laps || 0),
          driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '-',
          ...(!qualifyingSession ? [status] : []),
        ];
        const wrapped = cells.map((cell, cellIndex) => pdf.splitTextToSize(cell, columns[cellIndex].width - 3));
        const rowHeight = Math.max(6.5, Math.min(12, Math.max(...wrapped.map(lines => lines.length)) * 2.45 + 2));
        if (y + rowHeight > pageHeight - 11) {
          pdf.addPage('a4', 'portrait');
          drawDocumentHeader();
          y = drawTableHeader(47);
        }
        pdf.setFillColor(index % 2 === 0 ? 246 : 238, index % 2 === 0 ? 246 : 238, index % 2 === 0 ? 248 : 241);
        pdf.rect(margin, y, tableWidth, rowHeight, 'F');
        let x = margin;
        columns.forEach((column, cellIndex) => {
          pdf.setDrawColor(215, 215, 220);
          pdf.rect(x, y, column.width, rowHeight);
          pdf.setTextColor(cellIndex === 7 ? (eligibility.enabled ? 22 : 190) : 25, cellIndex === 7 ? (eligibility.enabled ? 125 : 35) : 25, cellIndex === 7 ? (eligibility.enabled ? 65 : 35) : 28);
          pdf.setFont('helvetica', cellIndex === 0 || cellIndex === 7 ? 'bold' : 'normal');
          pdf.setFontSize(cellIndex === 7 ? 5.1 : 5.8);
          const textX = column.align === 'right' ? x + column.width - 1.5 : column.align === 'center' ? x + column.width / 2 : x + 1.5;
          pdf.text(wrapped[cellIndex].slice(0, 4), textX, y + 4, { align: column.align || 'left', lineHeightFactor: 1.05 });
          x += column.width;
        });
        y += rowHeight;
      });

      const generatedAt = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date()).replace(',', '');
      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(110, 110, 115);
        pdf.text(`Generado el ${generatedAt} H`, margin, pageHeight - 5);
        pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      }
      const pdfUrl = URL.createObjectURL(pdf.output('blob'));
      previewWindow.location.replace(pdfUrl);
    } catch (pdfError) {
      console.error('No se pudo generar la planilla PDF:', pdfError);
      previewWindow.close();
      window.alert('No se pudo generar la planilla PDF. Intentá nuevamente.');
    } finally {
      setGeneratingPdf(false);
    }
  };
  const fastestSectors = useMemo(() => drivers.reduce((fastest, driver) => {
    for (const sector of driver.bestSectors || []) {
      if (sector.time && (!fastest[sector.index] || sector.time < fastest[sector.index])) {
        fastest[sector.index] = sector.time;
      }
    }
    return fastest;
  }, []), [drivers]);
  const leaderSectors = useMemo(() => {
    const leader = drivers.find(driver => driver.bestLap && driver.bestLap === bestLap);
    return (leader?.bestSectors || []).reduce((sectors, sector) => {
      sectors[sector.index] = sector.time;
      return sectors;
    }, []);
  }, [bestLap, drivers]);
  const positionChanges = useMemo(() => {
    const changes = new Map();
    if (!isQualifyingSession(timing?.session) || !isQualifyingSession(previousSessionRef.current)) {
      return changes;
    }

    drivers.forEach((driver, index) => {
      const key = `${driver.guid}-${driver.carModel}`;
      const previousPosition = previousPositionsRef.current.get(key);
      if (previousPosition !== undefined && previousPosition !== index) {
        changes.set(key, previousPosition - index);
      }
    });
    return changes;
  }, [drivers, timing?.session]);

  useEffect(() => {
    previousPositionsRef.current = new Map(
      drivers.map((driver, index) => [`${driver.guid}-${driver.carModel}`, index]),
    );
    previousSessionRef.current = timing?.session || '';
    if (drivers.length) hasRenderedRowsRef.current = true;
  }, [drivers, timing?.session]);

  const serviceUnavailable = !loading && (Boolean(error) || stale);
  const calendarLoading = !calendarLoaded;
  const noAvailableDates = calendarLoaded && !calendarError && !raceEvent;

  if (loading) {
    return (
      <main className="relative isolate flex min-h-[calc(100svh-7rem)] items-center justify-center overflow-hidden border-b border-racing-border bg-[#090a0d] px-5 animate-fade-in">
        <div className="race-hero-grid absolute inset-0 -z-20 opacity-20" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.18),transparent_42%)]" />
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-32 w-40 items-center justify-center sm:h-40 sm:w-52">
            <span className="absolute h-28 w-28 animate-spin rounded-full border-2 border-racing-red/15 border-t-racing-red sm:h-32 sm:w-32" />
            <span className="absolute h-20 w-20 animate-ping rounded-full border border-white/10 sm:h-24 sm:w-24" />
            <span className="live-timing-speed-line live-timing-speed-line--top" />
            <span className="live-timing-speed-line live-timing-speed-line--middle" />
            <span className="live-timing-speed-line live-timing-speed-line--bottom" />
            <CheckeredFlagIcon className="live-timing-loading-flag relative h-20 w-20 text-white drop-shadow-[0_0_18px_rgba(225,29,72,0.65)] sm:h-24 sm:w-24" />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-racing-red">Tiempos en vivo</p>
          <h1 className="mt-2 font-racing text-xl font-bold uppercase tracking-[0.1em] text-white sm:text-2xl">Comprobando servidor</h1>
          <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map(index => <span key={index} className="h-2 w-2 animate-pulse rounded-full bg-racing-red" style={{ animationDelay: `${index * 180}ms` }} />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-racing-dark pb-8">
      <header className="relative min-h-[190px] shrink-0 overflow-hidden border-b border-racing-border bg-black px-4 py-4 sm:px-6 lg:px-8">
        {raceEvent?.circuito_foto_url && (
          <img src={raceEvent.circuito_foto_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/25" />

        <div className="relative z-10 mx-auto grid max-w-[1900px] items-center gap-5 lg:grid-cols-[1fr_420px]">
          <div className="max-w-4xl">
            <div className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] ${calendarLoading ? 'text-gray-400' : calendarError || noAvailableDates ? 'text-gray-500' : 'text-racing-red'}`}>
              {calendarLoading ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDaysIcon className="h-4 w-4" />
              )}
              {calendarLoading ? 'Cargando calendario' : calendarError ? 'Calendario no disponible' : noAvailableDates ? 'Sin fechas disponibles' : 'Próxima fecha'}
            </div>
            <h1 className="mt-3 font-racing text-3xl font-bold uppercase text-white sm:text-5xl">
              {calendarLoading
                ? 'Buscando la próxima fecha...'
                : calendarError
                  ? 'No se pudo cargar el calendario'
                  : raceEvent?.circuito || 'No hay próximas fechas aún'}
            </h1>
            {raceEvent?.variante && <p className="font-racing text-xl font-semibold uppercase text-racing-red">Variante {raceEvent.variante}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-300">
              {raceEvent && (
                <>
                  <div className="flex max-w-full gap-1.5 overflow-x-auto py-0.5 scrollbar-hidden">
                    {liveTimingEvents.map(event => (
                      <button
                        key={event.idcampeonato}
                        type="button"
                        onClick={() => {
                          setSelectedChampionshipId(event.idcampeonato);
                          setSearchParams({ campeonato: String(event.idcampeonato) }, { replace: true });
                        }}
                        className={`inline-flex min-h-7 shrink-0 items-center border px-2.5 font-racing text-[11px] font-bold uppercase leading-none transition-colors sm:px-3 sm:text-xs ${raceEvent.idcampeonato === event.idcampeonato ? 'border-racing-red bg-racing-red text-white' : 'border-white/25 bg-black/60 text-gray-300 hover:border-racing-red hover:text-white'}`}
                      >
                        {event.categoria} · Fecha {event.ronda}
                      </button>
                    ))}
                  </div>
                  <span className="inline-flex min-h-6 items-center gap-1.5 capitalize leading-none"><CalendarDaysIcon className="h-4 w-4 shrink-0 text-racing-red" /> {formatEventDate(raceEvent.fecha)} H</span>
                  <span className="inline-flex min-h-6 items-center gap-2 leading-none"><CountryFlag country={raceEvent.pais} className="shrink-0 text-lg" /><MapPinIcon className="h-4 w-4 shrink-0 text-racing-red" /> {[raceEvent.localidad, raceEvent.provincia].filter(Boolean).join(', ')}</span>
                </>
              )}
            </div>

            {raceEvent && <div className="mt-5 flex flex-wrap items-center gap-2">
              <ServerJoinButton href={raceEvent?.servidor} variant="green" steady className="event-action-button h-9 w-full justify-center gap-2 px-3 py-0 text-[10px] sm:w-auto" />
              <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-white/15 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
                <span className="inline-flex items-center gap-1.5 text-[10px] text-yellow-300">Sesión <button type="button" onClick={generateTimingPdf} disabled={generatingPdf || loading || !drivers.length} className="font-racing text-sm font-bold uppercase text-yellow-300 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base" title="Ver planilla PDF" aria-label={`Ver planilla PDF de la sesión ${sessionLabel(timing?.session)}`}>{sessionLabel(timing?.session)}</button></span>
                {Number(connectedDriverCount) > 0 ? <span className="inline-flex items-center gap-1.5 font-racing text-sm text-emerald-300 sm:text-base"><span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.9)]" aria-hidden="true"/><strong className="text-base sm:text-lg">{connectedDriverCount}</strong> pilotos en pista</span> : null}
                <span className="inline-flex flex-wrap items-center gap-x-1.5 text-white"><span>{isQualifyingSession(timing?.session) ? 'Tiempo de clasificación' : `Clasificación ${formatCalendarDate(raceEvent?.fecha, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H comienza en`}</span><strong className="font-racing text-base tabular-nums text-orange-400 sm:text-lg">{isQualifyingSession(timing?.session) ? formatSessionRemaining(timing, now) : formatCountdown(raceEvent?.fecha, now)}</strong></span>
              </div>
            </div>}
          </div>

          <div className="hidden h-[160px] items-center justify-center lg:flex">
            {raceEvent?.circuito_trazado_url && (
              <img src={raceEvent.circuito_trazado_url} alt={`Trazado de ${raceEvent.circuito}`} className="h-full w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)]" />
            )}
          </div>
        </div>
        {qualifyingBans.length ? <div className="relative z-10 mx-auto mt-3 flex w-full max-w-[1900px] flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-red-400/45 bg-red-500/10 px-3 py-2 sm:px-4 lg:px-5">
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-red-300">No pueden clasificar</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 uppercase leading-relaxed">{qualifyingBans.map((item, index) => <Fragment key={item.idpiloto}>{index > 0 ? <span className="text-[10px] text-gray-600">•</span> : null}<span className="inline-flex flex-wrap items-baseline gap-x-1.5"><span className="text-[10px] font-semibold text-gray-500">#{item.numero ?? 0}</span><strong className="font-racing text-sm font-bold text-white">{item.nombre}</strong>{item.nota ? <span className="text-[9px] font-extrabold tracking-[0.08em] text-[#ff3b78]">{item.nota}</span> : null}</span></Fragment>)}</span>
        </div> : null}
      </header>

      <div className="mx-auto w-full max-w-[1900px] px-2 py-3 sm:px-4 lg:px-6">
        {serviceUnavailable && (
          <section className="flex min-h-[500px] items-center justify-center border border-racing-border bg-black px-6 py-16 text-center">
            <div>
              <div className="relative mx-auto mb-7 flex h-40 w-40 items-center justify-center sm:h-52 sm:w-52">
                <div className="absolute inset-0 animate-pulse bg-racing-red/10 blur-3xl" />
                <img src="/logo.png" alt="CADPO" className="relative h-full w-full object-contain opacity-75 grayscale" />
              </div>
              <ExclamationTriangleIcon className="mx-auto mb-4 h-8 w-8 text-yellow-400" />
              <h2 className="font-racing text-3xl font-bold uppercase text-white sm:text-5xl">Servidor en mantenimiento</h2>
              <p className="mt-2 font-racing text-xl font-semibold uppercase tracking-wider text-racing-red sm:text-2xl">No disponible momentáneamente</p>
              <button type="button" onClick={() => loadTiming(true)} className="btn-secondary mt-7">
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Reintentar conexión
              </button>
            </div>
          </section>
        )}

        {noAvailableDates && (
          <section className="flex min-h-[360px] items-center justify-center border border-racing-border bg-black px-6 py-14 text-center">
            <div>
              <CalendarDaysIcon className="mx-auto mb-4 h-12 w-12 text-gray-700" />
              <h2 className="font-racing text-3xl font-bold uppercase text-white sm:text-4xl">No hay próximas fechas aún</h2>
              <p className="mx-auto mt-2 max-w-lg text-gray-500">Los tiempos en vivo estarán disponibles cuando exista una nueva fecha cargada en el calendario.</p>
            </div>
          </section>
        )}

        {!serviceUnavailable && !noAvailableDates && isRaceSession(timing?.session) && (
          <section className="race-session-panel relative flex min-h-[520px] items-center justify-center overflow-hidden border border-racing-border bg-black px-6 py-16 text-center">
            <div className="race-session-checker absolute inset-0 opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.88)_72%)]" />
            <div className="relative z-10">
              <div className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full border border-racing-red/40" />
                <FlagIcon className="race-session-flag h-20 w-20 text-white" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-racing-red">Sesión en curso</p>
              <h2 className="mt-3 font-racing text-4xl font-bold uppercase text-white sm:text-6xl">Están en carrera</h2>
              <p className="mx-auto mt-3 max-w-xl font-racing text-lg uppercase text-gray-400">Los tiempos en vivo volverán a mostrarse cuando finalice la tanda de carrera.</p>
            </div>
          </section>
        )}

        {!serviceUnavailable && !noAvailableDates && !isRaceSession(timing?.session) && <>
          {percentageRuleActive && !qualifyingSession && <section className="mb-3 grid overflow-hidden border border-cyan-400/35 bg-cyan-400/10 md:grid-cols-2 xl:grid-cols-[1.25fr_repeat(4,auto)] md:items-stretch">
            <div className="flex items-center gap-3 border-b border-cyan-400/20 px-4 py-3 md:border-r xl:border-b-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-cyan-400 font-racing text-lg font-bold text-black">%</span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Regla de habilitación</p><p className="font-racing text-lg font-bold uppercase text-white">≤ {percentageExemptionLabel}% sin vueltas</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Hasta {percentageRuleLabel}% exige {requiredLaps} vueltas · Superarlo inhabilita</p></div></div>
            <div className="border-b border-cyan-400/20 px-5 py-3 md:min-w-44 md:border-b-0 md:border-r"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Tiempo del líder</p><p className="mt-1 font-racing text-2xl font-bold tabular-nums text-white">{formatLapTime(bestLap)}</p></div>
            <div className="border-b border-cyan-400/20 px-5 py-3 md:min-w-48 md:border-r xl:border-b-0"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Sin vueltas hasta {percentageExemptionLabel}%</p><p className="mt-1 font-racing text-2xl font-bold tabular-nums text-green-300">{formatLapTime(percentageExemptionCutoff)}</p></div>
            <div className="border-b border-cyan-400/20 px-5 py-3 md:min-w-48 md:border-b-0 md:border-r"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Tiempo máximo {percentageRuleLabel}%</p><p className="mt-1 font-racing text-2xl font-bold tabular-nums text-red-300">{formatLapTime(percentageMaximumCutoff)}</p></div>
            <div className="px-5 py-3 md:min-w-64"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Cierra 20 minutos antes de clasificación</p><p className={`mt-1 font-racing text-xl font-bold uppercase ${requirementCountdown === 'Período finalizado' ? 'text-red-300' : 'text-yellow-200'}`}>{requirementCountdown || '--'}</p></div>
          </section>}

          <section className="overflow-hidden border border-racing-border bg-racing-card">
            <div className="md:hidden">
              <p className="whitespace-nowrap border-b border-cyan-300/15 px-2.5 py-1 text-center text-[8px] font-bold uppercase tracking-wide text-cyan-300/75">Planilla completa solo en vista desde la PC</p>
              <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_4.75rem_3.75rem_2rem] items-center gap-1.5 border-b border-racing-border bg-black px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-wider text-gray-500">
                <span className="text-center">Pos.</span>
                <span>Piloto</span>
                <span className="text-right">Tiempo</span>
                <span className="text-right">Dif.</span>
                <span className="text-right">Vtas.</span>
              </div>
              <div className="divide-y divide-racing-border">
              {drivers.map((driver, index) => {
                const driverKey = `${driver.guid}-${driver.carModel}`;
                const positionChange = positionChanges.get(driverKey) || 0;
                const animationClass = positionChange > 0
                  ? 'timing-driver-row-moved-up'
                  : positionChange < 0
                    ? 'timing-driver-row-moved-down'
                    : !hasRenderedRowsRef.current ? 'timing-driver-row-enter' : '';
                const eligibility = getDriverEligibility(driver);

                return (
                  <Fragment key={`mobile-${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}>
                  {!qualifyingSession && index === lapsRequirementDividerIndex && lapsRequirementDividerIndex !== exclusionDividerIndex ? <div className="my-3 !border-x-0 !border-b-0 !border-t !border-racing-border/70 bg-transparent px-3 py-2 text-center">
                    <div className="flex items-center gap-3">
                      <span className="h-px min-w-5 flex-1 bg-gradient-to-r from-transparent to-yellow-300/70" />
                      <div className="shrink-0"><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-yellow-200">Fuera del {percentageExemptionLabel}%</p><p className="mt-0.5 font-racing text-base font-bold uppercase text-white">Debe completar <span className="text-yellow-200">{requiredLaps} vueltas</span></p></div>
                      <span className="h-px min-w-5 flex-1 bg-gradient-to-r from-yellow-300/70 to-transparent" />
                    </div>
                  </div> : null}
                  {!qualifyingSession && index === exclusionDividerIndex ? <div className="my-3 !border-x-0 !border-b-0 !border-t !border-red-400/70 bg-transparent px-3 py-2 text-center"><div className="flex items-center gap-3"><span className="h-px min-w-5 flex-1 bg-gradient-to-r from-transparent to-red-400/80"/><div className="shrink-0"><p className="text-[8px] font-bold uppercase tracking-[0.18em] text-red-300">Fuera del {percentageRuleLabel}%</p><p className="mt-0.5 font-racing text-base font-bold uppercase text-white">No puede participar · Máximo <span className="text-red-300">{formatLapTime(percentageMaximumCutoff)}</span></p></div><span className="h-px min-w-5 flex-1 bg-gradient-to-r from-red-400/80 to-transparent"/></div></div> : null}
                  <article
                    className={`timing-driver-row relative px-2.5 py-2 ${animationClass} ${qualifyingSession ? '' : eligibility.enabled ? 'timing-driver-row-enabled' : 'timing-driver-row-disabled'}`}
                    style={{ '--row-shift': `${positionChange * 150}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                  >
                    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_4.75rem_3.75rem_2rem] items-center gap-1.5">
                      <span className="text-center font-racing text-sm font-bold tabular-nums text-white">{index + 1}</span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-xs font-semibold leading-none text-white" title={driver.name}>{driver.name}</span>
                          {driver.connected ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.75)]" title="Piloto online" aria-label="Piloto online" /> : null}
                        </div>
                        {driver.ballast > 0 ? <div className="mt-0.5 flex items-center"><span className="font-racing text-[10px] font-bold leading-none text-yellow-300">{formatBallast(driver.ballast)}</span></div> : null}
                      </div>
                      <span className={`whitespace-nowrap text-right font-racing text-sm font-bold tabular-nums ${driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</span>
                      <span className="whitespace-nowrap text-right font-racing text-[10px] font-bold tabular-nums text-racing-red">{formatGap(driver.bestLap, bestLap) || 'LÍDER'}</span>
                      <span className="text-right font-racing text-[10px] font-bold tabular-nums text-gray-300">{driver.laps}</span>
                    </div>
                  </article>
                  </Fragment>
                );
              })}
              </div>
            </div>

            <div className="scrollbar-hidden hidden overflow-x-auto md:block">
              <table className={`w-full table-fixed border-collapse text-left text-sm 2xl:text-base ${qualifyingSession ? 'min-w-[1080px]' : 'min-w-[1260px]'}`}>
                <thead className="bg-black text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="w-12 px-2 py-2 text-center 2xl:w-16 2xl:px-4">Pos.</th>
                    <th className="w-[280px] px-2.5 py-2 2xl:w-[390px] 2xl:px-4">Piloto</th>
                    <th className="w-[230px] px-2.5 py-2 2xl:w-[340px] 2xl:px-4">Auto</th>
                    <th className="w-[150px] px-2.5 py-2 2xl:w-[210px] 2xl:px-4">Sectores</th>
                    <th className="w-[125px] px-2.5 py-2 text-right 2xl:w-[160px] 2xl:px-4">Mejor vuelta</th>
                    <th className="w-[95px] px-2 py-2 text-right 2xl:w-[120px] 2xl:px-4">Diferencia</th>
                    <th className="w-[65px] px-2 py-2 text-center 2xl:w-[90px] 2xl:px-4">Vueltas</th>
                    <th className="w-[95px] px-2 py-2 text-right 2xl:w-[130px] 2xl:px-4">Vel. máx.</th>
                    {!qualifyingSession && <th className="w-[172px] px-2 py-2 text-center 2xl:w-[280px] 2xl:px-4">Habilitación</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {drivers.map((driver, index) => {
                    const driverKey = `${driver.guid}-${driver.carModel}`;
                    const positionChange = positionChanges.get(driverKey) || 0;
                    const animationClass = positionChange > 0
                      ? 'timing-driver-row-moved-up'
                      : positionChange < 0
                        ? 'timing-driver-row-moved-down'
                        : !hasRenderedRowsRef.current ? 'timing-driver-row-enter' : '';
                    const eligibility = getDriverEligibility(driver);

                    return (
                      <Fragment key={`${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}>
                      {!qualifyingSession && index === lapsRequirementDividerIndex && lapsRequirementDividerIndex !== exclusionDividerIndex ? <tr className="!border-x-0 !border-b-0 !border-t !border-racing-border/70 bg-transparent">
                        <td colSpan={9} className="!border-x-0 !border-b-0 !border-t !border-racing-border/70 bg-transparent px-5 py-4">
                          <div className="flex items-center gap-5">
                            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-yellow-300/70" />
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-200">Fuera del {percentageExemptionLabel}%</span>
                            <span className="shrink-0 font-racing text-lg font-bold uppercase text-white">Debe completar <strong className="ml-2 text-yellow-200">{requiredLaps} vueltas</strong></span>
                            <span className="h-px flex-1 bg-gradient-to-r from-yellow-300/70 to-transparent" />
                          </div>
                        </td>
                      </tr> : null}
                      {!qualifyingSession && index === exclusionDividerIndex ? <tr className="!border-x-0 !border-b-0 !border-t !border-red-400/70 bg-transparent"><td colSpan={9} className="!border-x-0 !border-b-0 !border-t !border-red-400/70 bg-transparent px-5 py-4"><div className="flex items-center gap-5"><span className="h-px flex-1 bg-gradient-to-r from-transparent to-red-400/80"/><span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Fuera del {percentageRuleLabel}%</span><span className="shrink-0 font-racing text-lg font-bold uppercase text-white">No puede participar · Tiempo máximo <strong className="ml-2 text-red-300">{formatLapTime(percentageMaximumCutoff)}</strong></span><span className="h-px flex-1 bg-gradient-to-r from-red-400/80 to-transparent"/></div></td></tr> : null}
                      <tr
                        className={`timing-driver-row ${qualifyingSession ? 'timing-driver-row-compact' : ''} ${animationClass} ${qualifyingSession ? '' : eligibility.enabled ? 'timing-driver-row-enabled' : 'timing-driver-row-disabled'}`}
                        style={{ '--row-shift': `${positionChange * 54}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                      >
                        <td className="px-2 py-1.5 text-center font-racing text-lg font-bold text-white 2xl:px-4 2xl:py-2 2xl:text-xl">
                          <span className="inline-flex items-center justify-center gap-1">
                            {index + 1}
                            {positionChange > 0 ? <ArrowUpIcon className="timing-position-arrow h-4 w-4 text-green-400" /> : null}
                            {positionChange < 0 ? <ArrowDownIcon className="timing-position-arrow h-4 w-4 text-red-400" /> : null}
                          </span>
                        </td>
                        <td className="w-[280px] px-2.5 py-1.5 2xl:w-[390px] 2xl:px-4 2xl:py-2">
                          <div className="min-w-0">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <CountryFlag country={driverCountries.get(driver.guid) || driverCountries.get(driverNameKey(driver.name))} className="text-base 2xl:text-lg" />
                                <p className="min-w-0 truncate font-semibold text-white" title={driver.name}>{driver.name}</p>
                                {driver.ballast > 0 ? (
                                  <span className="shrink-0 font-racing text-sm font-bold text-yellow-300 2xl:text-base">
                                    {formatBallast(driver.ballast)}
                                  </span>
                                ) : null}
                                {driver.connected && (
                                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-green-400">
                                    <span className="relative flex h-2 w-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                                    </span>
                                    Online
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{driver.team || (driver.raceNumber ? `#${driver.raceNumber}` : '')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="h-[50px] w-[230px] px-2.5 py-1.5 2xl:h-[58px] 2xl:w-[340px] 2xl:px-4 2xl:py-2">
                          <div className="flex min-w-0 items-center gap-2 2xl:gap-4">
                          {driver.carBrandLogo ? (
                            <img
                              src={driver.carBrandLogo}
                              alt=""
                              className="h-8 w-14 shrink-0 object-contain xl:w-16 2xl:h-10 2xl:w-20"
                            />
                          ) : null}
                          <span className="min-w-0 break-words text-sm font-bold uppercase leading-tight text-white 2xl:text-base">
                            {driver.displayCarModel}
                          </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 2xl:px-4 2xl:py-2">
                          <SectorMiniTable sectors={driver.bestSectors} fastestSectors={fastestSectors} leaderSectors={leaderSectors} />
                        </td>
                        <td className="px-2.5 py-1.5 2xl:px-4 2xl:py-2">
                          <p className={`shrink-0 text-right font-racing text-base font-bold tabular-nums 2xl:text-xl ${driver.bestLap && driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</p>
                        </td>
                        <td className="px-2 py-1.5 text-right font-racing text-base font-bold tabular-nums text-racing-red 2xl:px-4 2xl:py-2 2xl:text-lg">{formatGap(driver.bestLap, bestLap)}</td>
                        <td className="px-2 py-1.5 text-center text-gray-300 2xl:px-4 2xl:py-2">{driver.laps}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs text-gray-300 2xl:px-4 2xl:py-2 2xl:text-base">{driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '--'}</td>
                        {!qualifyingSession && <td className="px-2 py-1.5 text-center 2xl:px-4 2xl:py-2">
                          {eligibility.enabled ? <span className="inline-flex bg-green-500/15 px-2 py-1 text-xs font-bold uppercase text-green-400 2xl:px-3 2xl:text-sm">Habilitado</span> : <span className="inline-flex bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase text-red-300 2xl:px-3 2xl:text-xs">Inhabilitado · {eligibility.missing.join(' · ')}</span>}
                        </td>}
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && drivers.length === 0 && (
              <div className="px-6 py-16 text-center">
                <SignalIcon className="mx-auto mb-3 h-10 w-10 text-gray-700" />
                <p className="font-racing text-lg font-bold uppercase text-gray-400">No hay tiempos registrados</p>
              </div>
            )}

          </section>
        </>}
      </div>
    </main>
  );
}
