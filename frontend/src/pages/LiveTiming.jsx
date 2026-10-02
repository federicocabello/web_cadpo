import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentArrowDownIcon,
  FlagIcon,
  MapPinIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { authApi, championshipsApi, driversApi, eventsApi, liveTimingApi } from '../services/api';
import { CountryFlag } from '../components/CountryFlag';
import ServerJoinButton from '../components/ServerJoinButton';
import { getLiveTimingEvents, getWeeklyChampionshipEvents } from '../utils/weeklyChampionships';
import { formatCalendarDate, parseCalendarDate } from '../utils/calendarDate';

const DEFAULT_REFRESH_INTERVAL_MS = 10000;
const QUALIFYING_REFRESH_INTERVAL_MS = 1000;
const REQUIRED_LAPS = 25;
const driverNameKey = value => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('es-AR');
const formatBallast = value => {
  const ballast = Number(value);
  if (!ballast) return '';
  return `+${Number.isInteger(ballast) ? ballast : ballast.toFixed(1)} KG`;
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
    <div className="grid shrink-0 gap-x-2 font-racing tabular-nums" style={{ gridTemplateColumns: `repeat(${sectors.length}, minmax(0, 1fr))` }}>
      {sectors.map(sector => (
        <span key={`label-${sector.index}`} className="flex items-baseline gap-1 text-left text-[11px] font-bold uppercase text-white">
          S{sector.index + 1}
          <strong className={`text-xs ${sectorDeltaColor(sector, fastestSectors, leaderSectors)}`}>
            {formatSectorDelta(sector, leaderSectors)}
          </strong>
        </span>
      ))}
      {sectors.map(sector => (
        <span key={`time-${sector.index}`} className={`text-left text-lg font-bold leading-none ${sectorColor(sector, fastestSectors)}`}>
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

export default function LiveTiming() {
  const [searchParams] = useSearchParams();
  const requestedChampionshipId = searchParams.get('campeonato');
  const [timing, setTiming] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [calendarError, setCalendarError] = useState(false);
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(null);
  const [driverCountries, setDriverCountries] = useState(new Map());
  const [enrolledDrivers, setEnrolledDrivers] = useState(new Map());
  const [percentageRule, setPercentageRule] = useState(0);
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
  const weeklyEvents = useMemo(() => getLiveTimingEvents(calendarEvents, new Date(now)), [calendarEvents, now]);
  const calendarSchedule = useMemo(
    () => getWeeklyChampionshipEvents(calendarEvents, new Date(now)),
    [calendarEvents, now],
  );
  const raceEvent = calendarSchedule.find(event => event.idcampeonato === selectedChampionshipId)
    || calendarSchedule[0]
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
      setPercentageRule(0);
      return undefined;
    }

    let active = true;
    const loadEnrolledDrivers = async () => {
      try {
        const response = await championshipsApi.getEnrolled(selectedChampionshipId);
        if (!active) return;

        const enrolledMap = new Map();
        for (const registration of response.data.data || []) {
          enrolledMap.set(driverNameKey(registration.nombre), registration);
        }
        setEnrolledDrivers(enrolledMap);
      } catch (err) {
        console.error('No se pudieron cargar los inscriptos del campeonato:', err);
        if (active) setEnrolledDrivers(new Map());
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
    championshipsApi.getById(selectedChampionshipId)
      .then(response => {
        if (active) setPercentageRule(Number(response.data.data?.regla_porcentaje || 0));
      })
      .catch(error => {
        console.error('No se pudo cargar la regla porcentual del campeonato:', error);
        if (active) setPercentageRule(0);
      });
    return () => { active = false; };
  }, [selectedChampionshipId]);

  useEffect(() => {
    const loadCalendarEvent = async () => {
      try {
        const response = await eventsApi.getAll();
        const loadedEvents = response.data.data || [];
        const activeEvents = getLiveTimingEvents(loadedEvents);
        setCalendarError(false);
        setCalendarEvents(loadedEvents);
        const requestedEvent = activeEvents.find(event => String(event.idcampeonato) === String(requestedChampionshipId));
        setSelectedChampionshipId(requestedEvent?.idcampeonato || activeEvents[0]?.idcampeonato || null);
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
    if (weeklyEvents.length) {
      if (!weeklyEvents.some(event => event.idcampeonato === selectedChampionshipId)) {
        setSelectedChampionshipId(weeklyEvents[0].idcampeonato);
      }
      return;
    }

    if (calendarLoaded) {
      setSelectedChampionshipId(null);
      setTiming(null);
      setLoading(false);
    }
  }, [calendarLoaded, selectedChampionshipId, weeklyEvents]);

  useEffect(() => {
    const loadDriverCountries = async () => {
      try {
        const response = await driversApi.getAll();
        const countryMap = new Map();
        for (const driver of response.data.data || []) {
          if (driver.steam) countryMap.set(String(driver.steam).trim(), driver.nacionalidad);
          countryMap.set(driverNameKey(driver.nombre), driver.nacionalidad);
        }
        setDriverCountries(countryMap);
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
      return {
        ...driver,
        displayCarModel: registration?.modelo || driver.car,
        carBrandLogo: registration?.auto_logo || '',
      };
    }).sort((a, b) => {
      if (!a.bestLap) return 1;
      if (!b.bestLap) return -1;
      return a.bestLap - b.bestLap;
    });
  }, [enrolledDrivers, timing]);
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
  const percentageCutoff = percentageRuleActive && bestLap ? bestLap * (percentageRule / 100) : 0;
  const percentageRuleLabel = Number.isInteger(percentageRule) ? String(percentageRule) : String(Number(percentageRule.toFixed(3)));
  const isPercentageEnabled = driver => Boolean(percentageCutoff && driver.bestLap && driver.bestLap <= percentageCutoff);
  const requirementCountdown = formatRequirementCountdown(raceEvent?.fecha, now);
  const getDriverEligibility = driver => {
    const missingLaps = Math.max(0, REQUIRED_LAPS - Number(driver.laps || 0));
    const percentageMet = !percentageRuleActive || isPercentageEnabled(driver);
    const missing = [];
    if (missingLaps > 0) missing.push(`faltan ${missingLaps} ${missingLaps === 1 ? 'vuelta' : 'vueltas'}`);
    if (percentageRuleActive && !percentageMet) {
      if (!bestLap) missing.push('esperando tiempo del líder');
      else if (!driver.bestLap) missing.push('sin tiempo registrado');
      else missing.push(`debe bajar ${(Math.max(0, driver.bestLap - percentageCutoff) / 1000000000).toFixed(3)} s`);
    }
    return {
      enabled: missingLaps === 0 && percentageMet,
      missing,
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
          ? `Requisitos: ${REQUIRED_LAPS} vueltas y ${percentageRuleLabel}% del líder  |  Líder: ${formatLapTime(bestLap)}  |  Límite: ${formatLapTime(percentageCutoff)}  |  Cierre: ${deadlineText} H`
          : `Requisito: ${REQUIRED_LAPS} vueltas mínimas  |  Regla porcentual desactivada`;
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
            {weeklyEvents.length > 1 && (
              <div className="mb-3 flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                {weeklyEvents.map(event => (
                  <button
                    key={event.idcampeonato}
                    type="button"
                    onClick={() => setSelectedChampionshipId(event.idcampeonato)}
                    className={`shrink-0 border px-3 py-1.5 font-racing text-[11px] font-bold uppercase transition-colors ${raceEvent?.idcampeonato === event.idcampeonato ? 'border-racing-red bg-racing-red text-white' : 'border-white/25 bg-black/60 text-gray-300 hover:border-racing-red'}`}
                  >
                    {event.categoria} · T{event.temporada}
                  </button>
                ))}
              </div>
            )}
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

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300">
              {raceEvent && (
                <>
                  <span className="font-bold uppercase text-white">{raceEvent.categoria} · Fecha {raceEvent.ronda}</span>
                  <span className="flex items-center gap-1.5 capitalize"><CalendarDaysIcon className="h-4 w-4 text-racing-red" /> {formatEventDate(raceEvent.fecha)} H</span>
                  <span className="flex items-center gap-2"><CountryFlag country={raceEvent.pais} className="text-lg" /><MapPinIcon className="h-4 w-4 text-racing-red" /> {[raceEvent.localidad, raceEvent.provincia].filter(Boolean).join(', ')}</span>
                </>
              )}
            </div>

            {raceEvent && <div className="mt-5 flex flex-wrap items-center gap-2">
              <ServerJoinButton href={raceEvent?.servidor} className="h-9 px-3 py-0 text-xs" />
              <span className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-bold uppercase ${error ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-green-500/40 bg-green-500/10 text-green-300'}`}>
                <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-400' : 'animate-pulse bg-green-400'}`} />
                {error ? 'Sin conexión' : stale ? 'Datos guardados' : 'En línea'}
              </span>
              <button
                type="button"
                onClick={() => loadTiming(true)}
                disabled={refreshing}
                className="inline-flex h-9 items-center gap-2 border border-racing-border bg-black/70 px-3 font-racing text-xs font-bold uppercase text-gray-200 transition-colors hover:border-racing-red hover:text-racing-red disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
              </button>
              <button
                type="button"
                onClick={generateTimingPdf}
                disabled={generatingPdf || loading || !drivers.length}
                className="inline-flex h-9 w-9 items-center justify-center border border-white/25 bg-white/10 text-white transition-colors hover:border-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                title="Ver planilla PDF"
                aria-label="Ver planilla PDF"
              >
                <DocumentArrowDownIcon className={`h-4 w-4 ${generatingPdf ? 'animate-pulse' : ''}`} />
              </button>
            </div>}
          </div>

          <div className="hidden h-[160px] items-center justify-center lg:flex">
            {raceEvent?.circuito_trazado_url && (
              <img src={raceEvent.circuito_trazado_url} alt={`Trazado de ${raceEvent.circuito}`} className="h-full w-full object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)]" />
            )}
          </div>
        </div>
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
          <section className="mb-3 grid grid-cols-2 gap-px overflow-hidden border border-racing-border bg-racing-border sm:grid-cols-3">
            <div className="relative isolate overflow-hidden bg-racing-card p-3">
              {isQualifyingSession(timing?.session) ? (
                <div className="classification-checker absolute inset-y-0 right-0 -z-10 w-2/3 opacity-20" />
              ) : (
                <div className="session-country-flag absolute inset-y-0 right-0 -z-10 w-1/3 opacity-35">
                  <CountryFlag country={raceEvent?.pais} />
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sesión</p>
              <p className="mt-1 truncate font-racing text-xl font-bold uppercase text-white">{sessionLabel(timing?.session)}</p>
            </div>
            <div className="bg-racing-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pilotos en pista</p>
              <p className="mt-1 font-racing text-2xl font-bold text-white">{connectedDriverCount}</p>
            </div>
            <div className="relative isolate col-span-2 overflow-hidden bg-racing-card p-3 sm:col-span-1">
              <div className="classification-checker absolute inset-y-0 right-0 -z-10 w-2/3 opacity-30" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isQualifyingSession(timing?.session) ? 'Tiempo de clasificación' : `Inicio de clasificación a las ${formatCalendarDate(raceEvent?.fecha, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} H`}</p>
              <p className="mt-1 font-racing text-2xl font-bold tabular-nums text-orange-400">
                {isQualifyingSession(timing?.session) ? formatSessionRemaining(timing, now) : formatCountdown(raceEvent?.fecha, now)}
              </p>
            </div>
          </section>

          {percentageRuleActive && !qualifyingSession && <section className="mb-3 grid overflow-hidden border border-cyan-400/35 bg-cyan-400/10 md:grid-cols-[1.15fr_auto_auto_auto] md:items-stretch">
            <div className="flex items-center gap-3 border-b border-cyan-400/20 px-4 py-3 md:border-b-0 md:border-r"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-cyan-400 font-racing text-lg font-bold text-black">%</span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Regla de habilitación</p><p className="font-racing text-xl font-bold uppercase text-white">Dentro del {percentageRuleLabel}% del líder</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">También debe completar {REQUIRED_LAPS} vueltas</p></div></div>
            <div className="border-b border-cyan-400/20 px-5 py-3 md:min-w-44 md:border-b-0 md:border-r"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Tiempo del líder</p><p className="mt-1 font-racing text-2xl font-bold tabular-nums text-white">{formatLapTime(bestLap)}</p></div>
            <div className="border-b border-cyan-400/20 px-5 py-3 md:min-w-52 md:border-b-0 md:border-r"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Tiempo para cumplir</p><p className="mt-1 font-racing text-2xl font-bold tabular-nums text-cyan-300">{formatLapTime(percentageCutoff)}</p></div>
            <div className="px-5 py-3 md:min-w-64"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Cierra 20 minutos antes de clasificación</p><p className={`mt-1 font-racing text-xl font-bold uppercase ${requirementCountdown === 'Período finalizado' ? 'text-red-300' : 'text-yellow-200'}`}>{requirementCountdown || '--'}</p></div>
          </section>}

          <section className="overflow-hidden border border-racing-border bg-racing-card">
            <div className="divide-y divide-racing-border md:hidden">
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
                  <article
                    key={`mobile-${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}
                    className={`timing-driver-row relative ${qualifyingSession ? 'timing-driver-row-compact p-2.5' : 'p-3.5'} ${animationClass} ${qualifyingSession ? '' : eligibility.enabled ? 'timing-driver-row-enabled' : 'timing-driver-row-disabled'}`}
                    style={{ '--row-shift': `${positionChange * 150}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 min-w-10 shrink-0 items-center justify-center gap-0.5 bg-black px-1 font-racing text-xl font-bold text-white">
                        {index + 1}
                        {positionChange > 0 ? <ArrowUpIcon className="timing-position-arrow h-3.5 w-3.5 text-green-400" /> : null}
                        {positionChange < 0 ? <ArrowDownIcon className="timing-position-arrow h-3.5 w-3.5 text-red-400" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <CountryFlag country={driverCountries.get(driver.guid) || driverCountries.get(driverNameKey(driver.name))} className="mt-0.5 shrink-0 text-lg" />
                            <div className="min-w-0">
                              <h3 className="break-words font-semibold leading-tight text-white">{driver.name}</h3>
                              {(driver.team || driver.raceNumber || driver.ballast > 0) ? <p className="mt-1 text-[10px] uppercase text-gray-500">{driver.team || (driver.raceNumber ? `#${driver.raceNumber}` : '')}{driver.ballast > 0 ? <span className="ml-2 font-racing font-bold text-yellow-300">{formatBallast(driver.ballast)}</span> : null}</p> : null}
                            </div>
                          </div>
                          {driver.connected && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-green-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                              </span>
                              Online
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex min-h-14 items-center gap-3 border-t border-white/5 pt-3">
                          {driver.carBrandLogo ? (
                            <img
                              src={driver.carBrandLogo}
                              alt=""
                              className="h-10 w-16 shrink-0 object-contain"
                            />
                          ) : null}
                          <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Auto</p><p className="break-words text-sm font-bold uppercase leading-tight text-white">{driver.displayCarModel}</p></div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/5 pt-3">
                      <div className="col-span-2 overflow-x-auto pb-1">
                        <SectorMiniTable sectors={driver.bestSectors} fastestSectors={fastestSectors} leaderSectors={leaderSectors} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Mejor vuelta</p>
                        <p className={`font-racing text-xl font-bold tabular-nums min-[380px]:text-2xl ${driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Diferencia</p>
                        <p className="font-racing text-xl font-bold tabular-nums text-racing-red">{formatGap(driver.bestLap, bestLap) || 'LÍDER'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Vueltas</p>
                        <p className="font-racing text-lg font-bold text-gray-200">{driver.laps}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Velocidad máxima</p>
                        <p className="font-racing text-lg font-bold text-gray-200">{driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '--'}</p>
                      </div>
                    </div>

                    {!qualifyingSession && <div className="mt-3">
                      {eligibility.enabled ? <span className="inline-flex bg-green-500/15 px-3 py-1 text-xs font-bold uppercase text-green-400">Habilitado · {percentageRuleActive ? 'vueltas y tiempo cumplidos' : 'vueltas cumplidas'}</span> : <span className="inline-flex bg-red-500/15 px-3 py-1 text-xs font-bold uppercase text-red-300">Inhabilitado · {eligibility.missing.join(' · ')}</span>}
                    </div>}
                  </article>
                );
              })}
            </div>

            <div className="scrollbar-hidden hidden overflow-x-auto md:block">
              <table className={`w-full table-fixed border-collapse text-left text-base ${qualifyingSession ? 'min-w-[1500px]' : 'min-w-[1780px]'}`}>
                <thead className="bg-black text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="w-16 px-4 py-3 text-center">Pos.</th>
                    <th className="w-[340px] px-4 py-3">Piloto</th>
                    <th className="w-[340px] px-4 py-3">Auto</th>
                    <th className="w-[260px] px-4 py-3">Sectores</th>
                    <th className="w-[160px] px-4 py-3 text-right">Mejor vuelta</th>
                    <th className="w-[120px] px-4 py-3 text-right">Diferencia</th>
                    <th className="w-[90px] px-4 py-3 text-center">Vueltas</th>
                    <th className="w-[130px] px-4 py-3 text-right">Vel. máx.</th>
                    {!qualifyingSession && <th className="w-[280px] px-4 py-3 text-center">Habilitación</th>}
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
                      <tr
                        key={`${driverKey}-${positionChange ? timing?.updatedAt : 'stable'}`}
                        className={`timing-driver-row ${qualifyingSession ? 'timing-driver-row-compact' : ''} ${animationClass} ${qualifyingSession ? '' : eligibility.enabled ? 'timing-driver-row-enabled' : 'timing-driver-row-disabled'}`}
                        style={{ '--row-shift': `${positionChange * 54}px`, animationDelay: !hasRenderedRowsRef.current ? `${Math.min(index * 45, 700)}ms` : '0ms' }}
                      >
                        <td className="px-4 py-3 text-center font-racing text-xl font-bold text-white">
                          <span className="inline-flex items-center justify-center gap-1">
                            {index + 1}
                            {positionChange > 0 ? <ArrowUpIcon className="timing-position-arrow h-4 w-4 text-green-400" /> : null}
                            {positionChange < 0 ? <ArrowDownIcon className="timing-position-arrow h-4 w-4 text-red-400" /> : null}
                          </span>
                        </td>
                        <td className="w-[340px] px-4 py-3">
                          <div className="min-w-0">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <CountryFlag country={driverCountries.get(driver.guid) || driverCountries.get(driverNameKey(driver.name))} className="text-lg" />
                                <p className="min-w-0 flex-1 truncate font-semibold text-white" title={driver.name}>{driver.name}</p>
                                {driver.ballast > 0 ? (
                                  <span className="shrink-0 font-racing text-base font-bold text-yellow-300">
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
                        <td className="h-[70px] w-[340px] px-4 py-3">
                          <div className="flex min-w-0 items-center gap-4">
                          {driver.carBrandLogo ? (
                            <img
                              src={driver.carBrandLogo}
                              alt=""
                              className="h-12 w-24 shrink-0 object-contain"
                            />
                          ) : null}
                          <span className="min-w-0 break-words text-base font-bold uppercase leading-tight text-white">
                            {driver.displayCarModel}
                          </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SectorMiniTable sectors={driver.bestSectors} fastestSectors={fastestSectors} leaderSectors={leaderSectors} />
                        </td>
                        <td className="px-4 py-3">
                          <p className={`shrink-0 text-right font-racing text-xl font-bold tabular-nums ${driver.bestLap && driver.bestLap === bestLap ? 'text-[#c77dff]' : 'text-white'}`}>{formatLapTime(driver.bestLap)}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-racing text-lg font-bold tabular-nums text-racing-red">{formatGap(driver.bestLap, bestLap)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{driver.laps}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{driver.topSpeed ? `${driver.topSpeed.toFixed(1)} km/h` : '--'}</td>
                        {!qualifyingSession && <td className="px-4 py-3 text-center">
                          {eligibility.enabled ? <span className="inline-flex bg-green-500/15 px-3 py-1 text-sm font-bold uppercase text-green-400">Habilitado</span> : <span className="inline-flex bg-red-500/15 px-3 py-1 text-xs font-bold uppercase text-red-300">Inhabilitado · {eligibility.missing.join(' · ')}</span>}
                        </td>}
                      </tr>
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

            {loading && (
              <div className="px-6 py-16 text-center">
                <ArrowPathIcon className="mx-auto mb-3 h-8 w-8 animate-spin text-racing-red" />
                <p className="text-sm text-gray-400">Conectando con el servidor...</p>
              </div>
            )}
          </section>
        </>}
      </div>
    </main>
  );
}
