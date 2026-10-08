import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarIcon,
  FolderOpenIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const STORAGE_KEY = 'cadpo-assetto-gear-calculator';
const DEFAULT_SETUP = {
  name: 'Puesta a punto 1',
  wheelDiameter: 660,
  revLimit: 7500,
  shiftRpm: 7200,
  finalDrive: 4.1,
  graphMaxSpeed: 300,
  graphMaxRpm: 9000,
  gears: [3.2, 2.1, 1.55, 1.25, 1.05, 0.88],
};
const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#84cc16', '#14b8a6'];

const positiveNumber = (value, fallback = 0) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const speedAtRpm = (rpm, gear, finalDrive, circumference) => {
  if (!rpm || !gear || !finalDrive || !circumference) return 0;
  return (rpm * circumference * 60) / (gear * finalDrive * 1000);
};

const formatNumber = (value, digits = 1) => Number(value || 0).toLocaleString('es-AR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const parseIniSections = content => {
  const sections = new Map();
  let section = 'GENERAL';
  sections.set(section, {});

  String(content || '').split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.replace(/;.*/, '').trim();
    if (!line) return;
    const sectionMatch = line.match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toUpperCase();
      if (!sections.has(section)) sections.set(section, {});
      return;
    }
    const separator = line.indexOf('=');
    if (separator < 0) return;
    const key = line.slice(0, separator).trim().toUpperCase();
    const value = line.slice(separator + 1).trim();
    sections.get(section)[key] = value;
  });
  return sections;
};

const findIniValue = (sections, keys, preferredSections = []) => {
  const normalizedKeys = keys.map(key => key.toUpperCase());
  for (const sectionName of preferredSections) {
    const section = sections.get(sectionName.toUpperCase());
    if (!section) continue;
    for (const key of normalizedKeys) if (section[key] !== undefined) return section[key];
  }
  for (const section of sections.values()) {
    for (const key of normalizedKeys) if (section[key] !== undefined) return section[key];
  }
  return undefined;
};

const replaceIniValue = (content, targetSection, targetKey, nextValue) => {
  let currentSection = 'GENERAL';
  let replaced = false;
  const escapedKey = targetKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const valuePattern = new RegExp(`^(\\s*${escapedKey}\\s*=\\s*)([^;]*?)(\\s*(?:;.*)?)$`, 'i');
  const lines = String(content || '').split(/(\r?\n)/);

  for (let index = 0; index < lines.length; index += 2) {
    const sectionMatch = lines[index].trim().match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toUpperCase();
      continue;
    }
    if (currentSection !== targetSection.toUpperCase()) continue;
    const valueMatch = lines[index].match(valuePattern);
    if (!valueMatch) continue;
    lines[index] = `${valueMatch[1]}${nextValue}${valueMatch[3]}`;
    replaced = true;
    break;
  }
  return { content: lines.join(''), replaced };
};

const downloadBlobFile = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const safeOutputFilename = (value, fallback = 'archivo.ini') => {
  const withoutComment = String(value || '')
    .normalize('NFKC')
    .replace(/;.*/, '')
    .replace(/["']/g, '')
    .trim();
  const leaf = withoutComment.split(/[\\/]/).pop()?.trim() || '';
  const sanitized = [...leaf]
    .map(character => /[a-z0-9._-]/i.test(character) ? character : '_')
    .join('')
    .replace(/_+/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  const baseName = sanitized.split('.')[0]?.toUpperCase();
  if (!sanitized || sanitized === '.' || sanitized === '..' || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(baseName)) return fallback;
  return sanitized;
};

const parseRatioOptions = content => String(content || '')
  .split(/\r?\n/)
  .map(line => line.replace(/;.*/, '').trim())
  .filter(Boolean)
  .map((line, index) => {
    const pipeMatch = line.match(/^(.*?)\s*\|\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (!pipeMatch) return null;
    const ratio = positiveNumber(pipeMatch[2]);
    return ratio ? { id: `${Date.now()}-${index}`, label: pipeMatch[1].trim() || `RELACIÓN ${index + 1}`, ratio } : null;
  })
  .filter(Boolean);

const buildRatioFile = options => `${options.map(option => `${String(option.label || 'RELACIÓN').trim()} | ${positiveNumber(option.ratio).toFixed(3)}`).join('\r\n')}\r\n`;

const ensureFinalRatioSetup = (content, ratioFilename) => {
  const newline = String(content || '').includes('\r\n') ? '\r\n' : '\n';
  const replaced = replaceIniValue(content, 'FINAL_GEAR_RATIO', 'RATIOS', ratioFilename);
  if (replaced.replaced) return replaced.content;

  const lines = String(content || '').split(/\r?\n/);
  const sectionIndex = lines.findIndex(line => line.trim().toUpperCase() === '[FINAL_GEAR_RATIO]');
  if (sectionIndex >= 0) {
    lines.splice(sectionIndex + 1, 0, `RATIOS=${ratioFilename}`);
    return lines.join(newline);
  }

  const suffix = content && !String(content).endsWith('\n') ? newline : '';
  return `${content || ''}${suffix}${newline}[FINAL_GEAR_RATIO]${newline}SHOW_CLICKS=0${newline}RATIOS=${ratioFilename}${newline}NAME=Relación final${newline}POS_X=0.5${newline}POS_Y=6${newline}HELP=HELP_REAR_GEAR${newline}`;
};

const loadInitialSetup = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.gears) && saved.gears.length) return { ...DEFAULT_SETUP, ...saved };
  } catch {
    // Si el valor local quedó dañado, se recuperan los valores de ejemplo.
  }
  return DEFAULT_SETUP;
};

function GearRatioChart({ rows, revLimit, shiftRpm, graphMaxSpeed, graphMaxRpm, referenceRows, referenceShiftRpm }) {
  const width = 900;
  const height = 420;
  const margin = { top: 24, right: 28, bottom: 54, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maximumSpeed = Math.max(10, graphMaxSpeed);
  const maximumRpm = Math.max(1000, graphMaxRpm);
  const x = speed => margin.left + (speed / maximumSpeed) * plotWidth;
  const y = rpm => margin.top + plotHeight - (rpm / maximumRpm) * plotHeight;
  const speedTicks = Array.from({ length: 7 }, (_, index) => (maximumSpeed / 6) * index);
  const rpmStep = maximumRpm > 9000 ? 2000 : 1000;
  const rpmTicks = Array.from({ length: Math.floor(revLimit / rpmStep) + 1 }, (_, index) => index * rpmStep);
  const buildShiftPoints = (sourceRows, sourceShiftRpm) => {
    const points = [];
    sourceRows.forEach((row, index) => {
      const startRpm = index === 0 ? Math.min(2500, sourceShiftRpm) : row.rpmAfterShift;
      points.push(`${x(row.speedAt(startRpm))},${y(startRpm)}`);
      points.push(`${x(row.shiftSpeed)},${y(sourceShiftRpm)}`);
      if (index < sourceRows.length - 1) points.push(`${x(row.shiftSpeed)},${y(sourceRows[index + 1].rpmAfterShift)}`);
    });
    return points;
  };
  const shiftPoints = buildShiftPoints(rows, shiftRpm);
  const referencePoints = referenceRows?.length ? buildShiftPoints(referenceRows, referenceShiftRpm) : [];
  const finalSpeed = rows.at(-1)?.redlineSpeed || 0;

  return (
    <div className="overflow-x-auto border border-racing-border bg-black/25 p-2 sm:p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px]" role="img" aria-label="Gráfico de velocidad y RPM por marcha">
        <defs><clipPath id="gear-ratio-plot"><rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight}/></clipPath></defs>
        <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="#080a0d" />
        {speedTicks.map(tick => <g key={`speed-${tick}`}><line x1={x(tick)} y1={margin.top} x2={x(tick)} y2={margin.top + plotHeight} stroke="#252932" strokeWidth="1"/><text x={x(tick)} y={height - 27} textAnchor="middle" fill="#8b929e" fontSize="13">{Math.round(tick)}</text></g>)}
        {rpmTicks.map(tick => <g key={`rpm-${tick}`}><line x1={margin.left} y1={y(tick)} x2={margin.left + plotWidth} y2={y(tick)} stroke="#252932" strokeWidth="1"/><text x={margin.left - 12} y={y(tick) + 4} textAnchor="end" fill="#8b929e" fontSize="13">{tick}</text></g>)}
        <g clipPath="url(#gear-ratio-plot)">
          {referencePoints.length > 1 ? <polyline points={referencePoints.join(' ')} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" opacity="0.16" /> : null}
          <line x1={margin.left} y1={y(shiftRpm)} x2={margin.left + plotWidth} y2={y(shiftRpm)} stroke="#facc15" strokeWidth="1.5" strokeDasharray="7 7" />
          {rows.slice(0, -1).map((row, index) => row.shiftSpeed <= maximumSpeed ? <g key={`shift-${row.number}`}>
            <line x1={x(row.shiftSpeed)} y1={margin.top} x2={x(row.shiftSpeed)} y2={margin.top + plotHeight} stroke={COLORS[index % COLORS.length]} strokeWidth="1.5" strokeDasharray="5 5" opacity="0.85"/>
            <circle cx={x(row.shiftSpeed)} cy={y(shiftRpm)} r="5" fill={COLORS[index % COLORS.length]} stroke="#080a0d" strokeWidth="2"/>
          </g> : null)}
          {rows.map((row, index) => (
            <g key={row.number}>
            <line x1={x(0)} y1={y(0)} x2={x(row.redlineSpeed)} y2={y(revLimit)} stroke={COLORS[index % COLORS.length]} strokeWidth="2" opacity="0.55" />
            </g>
          ))}
          {finalSpeed <= maximumSpeed ? <line x1={x(finalSpeed)} y1={margin.top} x2={x(finalSpeed)} y2={margin.top + plotHeight} stroke="#22d3ee" strokeWidth="2" strokeDasharray="3 4"/> : null}
          {shiftPoints.length > 1 ? <polyline points={shiftPoints.join(' ')} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
        </g>
        {shiftRpm <= maximumRpm ? <text x={margin.left + 5} y={y(shiftRpm) - 6} textAnchor="start" fill="#fde047" fontSize="9" fontWeight="700">CAMBIO A {shiftRpm} RPM</text> : null}
        {rows.slice(0, -1).map((row, index) => row.shiftSpeed <= maximumSpeed ? <g key={`shift-label-${row.number}`}><text x={x(row.shiftSpeed) + 3} y={margin.top + 10 + ((index % 2) * 11)} fill={COLORS[index % COLORS.length]} fontSize="7" fontWeight="700">{Math.round(row.shiftSpeed)} KM/H</text><text x={x(row.shiftSpeed) + 6} y={y(rows[index + 1].rpmAfterShift) + 29} fill="#67e8f9" stroke="#080a0d" strokeWidth="2" paintOrder="stroke" fontSize="8" fontWeight="700">{Math.round(rows[index + 1].rpmAfterShift)} RPM</text><text x={x(row.shiftSpeed) + 6} y={y(rows[index + 1].rpmAfterShift) + 41} fill="#fbbf24" stroke="#080a0d" strokeWidth="2" paintOrder="stroke" fontSize="7">CAÍDA -{Math.round(rows[index + 1].rpmDrop)} RPM</text></g> : null)}
        {finalSpeed <= maximumSpeed ? <text x={margin.left + plotWidth - 6} y={y(shiftRpm) - 6} textAnchor="end" fill="#67e8f9" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke" fontSize="7" fontWeight="700">FINAL {formatNumber(finalSpeed)} KM/H</text> : null}
        {rows.map((row, index) => row.redlineSpeed <= maximumSpeed && revLimit <= maximumRpm ? <text key={`label-${row.number}`} x={x(row.redlineSpeed) - 5} y={y(revLimit) - 6} textAnchor="end" fill={COLORS[index % COLORS.length]} fontSize="9" fontWeight="700">{row.number}ª</text> : null)}
        <text x={margin.left + plotWidth / 2} y={height - 5} textAnchor="middle" fill="#d1d5db" fontSize="13" fontWeight="700">VELOCIDAD (KM/H)</text>
        <text x="16" y={margin.top + plotHeight / 2} transform={`rotate(-90 16 ${margin.top + plotHeight / 2})`} textAnchor="middle" fill="#d1d5db" fontSize="13" fontWeight="700">MOTOR (RPM)</text>
      </svg>
    </div>
  );
}

export default function GearRatioCalculator() {
  const [setup, setSetup] = useState(loadInitialSetup);
  const [referenceSetup, setReferenceSetup] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [importReport, setImportReport] = useState([]);
  const [importError, setImportError] = useState('');
  const [sourceFiles, setSourceFiles] = useState({});
  const [importMetadata, setImportMetadata] = useState({ tyreSection: '', tyreRadiusRaw: '', finalKey: 'FINAL', ratioFilename: 'final.rto' });
  const [finalRatioOptions, setFinalRatioOptions] = useState([]);
  const [defaultFinalRatioId, setDefaultFinalRatioId] = useState(null);
  const [finalRatiosDirty, setFinalRatiosDirty] = useState(false);
  const [newRatioLabel, setNewRatioLabel] = useState('');
  const [bulkSaveMessage, setBulkSaveMessage] = useState('');
  const [bulkSaveStatus, setBulkSaveStatus] = useState('idle');
  const [engineModifiedFileNames, setEngineModifiedFileNames] = useState([]);
  const [brakesModifiedFileNames, setBrakesModifiedFileNames] = useState([]);
  const [tyresModifiedFileNames, setTyresModifiedFileNames] = useState([]);
  const [suspensionModifiedFileNames, setSuspensionModifiedFileNames] = useState([]);
  const diameter = positiveNumber(setup.wheelDiameter);
  const revLimit = positiveNumber(setup.revLimit);
  const shiftRpm = Math.min(positiveNumber(setup.shiftRpm), revLimit || Infinity);
  const finalDrive = positiveNumber(setup.finalDrive);
  const circumference = Math.PI * (diameter / 1000);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  }, [setup]);

  useEffect(() => {
    const updateEngineModifiedFiles = event => setEngineModifiedFileNames(
      Array.isArray(event.detail?.files) ? event.detail.files : [],
    );
    window.addEventListener('cadpo:engine-modified-files-change', updateEngineModifiedFiles);
    return () => window.removeEventListener('cadpo:engine-modified-files-change', updateEngineModifiedFiles);
  }, []);

  useEffect(() => {
    const updateTyresModifiedFiles = event => setTyresModifiedFileNames(
      Array.isArray(event.detail?.files) ? event.detail.files : [],
    );
    window.addEventListener('cadpo:tyres-modified-files-change', updateTyresModifiedFiles);
    return () => window.removeEventListener('cadpo:tyres-modified-files-change', updateTyresModifiedFiles);
  }, []);

  useEffect(() => {
    const updateSuspensionModifiedFiles = event => setSuspensionModifiedFileNames(
      Array.isArray(event.detail?.files) ? event.detail.files : [],
    );
    window.addEventListener('cadpo:suspension-modified-files-change', updateSuspensionModifiedFiles);
    return () => window.removeEventListener('cadpo:suspension-modified-files-change', updateSuspensionModifiedFiles);
  }, []);

  useEffect(() => {
    const syncTyreRadius = event => {
      if (String(event.detail?.section || '').toUpperCase() !== String(importMetadata.tyreSection || '').toUpperCase()) return;
      const radius = positiveNumber(event.detail?.radius);
      if (!radius) return;
      setSetup(current => ({ ...current, wheelDiameter: Number((radius * 2000).toFixed(2)) }));
    };
    window.addEventListener('cadpo:tyre-radius-change', syncTyreRadius);
    return () => window.removeEventListener('cadpo:tyre-radius-change', syncTyreRadius);
  }, [importMetadata.tyreSection]);

  useEffect(() => {
    const updateBrakesModifiedFiles = event => setBrakesModifiedFileNames(
      Array.isArray(event.detail?.files) ? event.detail.files : [],
    );
    window.addEventListener('cadpo:brakes-modified-files-change', updateBrakesModifiedFiles);
    return () => window.removeEventListener('cadpo:brakes-modified-files-change', updateBrakesModifiedFiles);
  }, []);

  useEffect(() => {
    const syncEngineLimiter = event => {
      const nextLimit = positiveNumber(event.detail?.limiter);
      if (!nextLimit) return;
      setSetup(current => {
        const currentLimit = positiveNumber(current.revLimit);
        const currentShiftRpm = positiveNumber(current.shiftRpm);
        const shiftFollowsLimiter = Math.abs(currentShiftRpm - currentLimit) < 1 || currentShiftRpm > nextLimit;
        return {
          ...current,
          revLimit: nextLimit,
          shiftRpm: shiftFollowsLimiter ? nextLimit : current.shiftRpm,
          graphMaxRpm: positiveNumber(current.graphMaxRpm) < nextLimit
            ? Math.ceil(nextLimit / 500) * 500
            : current.graphMaxRpm,
        };
      });
    };
    window.addEventListener('cadpo:engine-limiter-change', syncEngineLimiter);
    return () => window.removeEventListener('cadpo:engine-limiter-change', syncEngineLimiter);
  }, []);

  const rows = useMemo(() => setup.gears.map((rawRatio, index) => {
    const ratio = positiveNumber(rawRatio);
    const previousRatio = index > 0 ? positiveNumber(setup.gears[index - 1]) : 0;
    const rpmAfterShift = previousRatio ? shiftRpm * (ratio / previousRatio) : 0;
    return {
      number: index + 1,
      ratio,
      overallRatio: ratio * finalDrive,
      redlineSpeed: speedAtRpm(revLimit, ratio, finalDrive, circumference),
      shiftSpeed: speedAtRpm(shiftRpm, ratio, finalDrive, circumference),
      rpmAfterShift,
      rpmDrop: index ? shiftRpm - rpmAfterShift : 0,
      speedAt: rpm => speedAtRpm(rpm, ratio, finalDrive, circumference),
    };
  }), [circumference, finalDrive, revLimit, setup.gears, shiftRpm]);
  const referenceShiftRpm = referenceSetup
    ? Math.min(positiveNumber(referenceSetup.shiftRpm), positiveNumber(referenceSetup.revLimit) || Infinity)
    : 0;
  const referenceRows = useMemo(() => {
    if (!referenceSetup) return [];
    const referenceDiameter = positiveNumber(referenceSetup.wheelDiameter);
    const referenceRevLimit = positiveNumber(referenceSetup.revLimit);
    const referenceFinalDrive = positiveNumber(referenceSetup.finalDrive);
    const referenceCircumference = Math.PI * (referenceDiameter / 1000);
    const referenceRpm = Math.min(positiveNumber(referenceSetup.shiftRpm), referenceRevLimit || Infinity);
    return referenceSetup.gears.map((rawRatio, index) => {
      const ratio = positiveNumber(rawRatio);
      const previousRatio = index > 0 ? positiveNumber(referenceSetup.gears[index - 1]) : 0;
      const rpmAfterShift = previousRatio ? referenceRpm * (ratio / previousRatio) : 0;
      return {
        number: index + 1,
        ratio,
        redlineSpeed: speedAtRpm(referenceRevLimit, ratio, referenceFinalDrive, referenceCircumference),
        shiftSpeed: speedAtRpm(referenceRpm, ratio, referenceFinalDrive, referenceCircumference),
        rpmAfterShift,
        speedAt: rpm => speedAtRpm(rpm, ratio, referenceFinalDrive, referenceCircumference),
      };
    });
  }, [referenceSetup]);

  const updateField = (field, value) => {
    setSetup(current => ({ ...current, [field]: value }));
    if (field === 'revLimit') {
      window.dispatchEvent(new CustomEvent('cadpo:gear-limiter-change', { detail: { limiter: value } }));
    }
    if (field === 'wheelDiameter') {
      window.dispatchEvent(new CustomEvent('cadpo:gear-wheel-diameter-change', {
        detail: { diameter: value, section: importMetadata.tyreSection },
      }));
    }
  };
  const updateGear = (index, value) => setSetup(current => ({ ...current, gears: current.gears.map((gear, gearIndex) => gearIndex === index ? value : gear) }));
  const addGear = () => setSetup(current => {
    if (current.gears.length >= 10) return current;
    const last = positiveNumber(current.gears[current.gears.length - 1], 1);
    return { ...current, gears: [...current.gears, Number(Math.max(0.4, last * 0.84).toFixed(3))] };
  });
  const removeGear = () => setSetup(current => current.gears.length > 1 ? { ...current, gears: current.gears.slice(0, -1) } : current);

  const importDataFiles = async event => {
    const requiredFileNames = ['drivetrain.ini', 'engine.ini', 'tyres.ini'];
    const selectedFiles = [...(event.target.files || [])];
    window.dispatchEvent(new CustomEvent('cadpo:assetto-data-folder', { detail: { files: selectedFiles } }));
    const files = selectedFiles.filter(file => {
      const name = file.name.toLocaleLowerCase();
      return requiredFileNames.includes(name) || name === 'setup.ini' || name.endsWith('.rto');
    });
    event.target.value = '';
    if (!files.length) {
      setImportReport([]);
      setImportError('La carpeta seleccionada no contiene drivetrain.ini, engine.ini ni tyres.ini. Elegí la carpeta data descomprimida del auto.');
      return;
    }

    setImportError('');
    const contents = new Map();
    await Promise.all(files.map(async file => {
      contents.set(file.name.toLocaleLowerCase(), await file.text());
    }));

    const changes = {};
    const report = [];
    const metadata = { tyreSection: '', tyreRadiusRaw: '', finalKey: 'FINAL', ratioFilename: 'final.rto' };
    const missingFiles = requiredFileNames.filter(fileName => !contents.has(fileName));
    let traction = '';
    const drivetrain = contents.get('drivetrain.ini');
    if (drivetrain) {
      const sections = parseIniSections(drivetrain);
      const gearsSection = sections.get('GEARS') || {};
      const importedGears = Object.entries(gearsSection)
        .map(([key, value]) => ({ match: key.match(/^GEAR_(\d+)$/), value: positiveNumber(value) }))
        .filter(item => item.match && Number(item.match[1]) > 0 && item.value)
        .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
        .map(item => item.value);
      metadata.finalKey = gearsSection.FINAL !== undefined ? 'FINAL' : gearsSection.FINAL_RATIO !== undefined ? 'FINAL_RATIO' : 'FINAL';
      const finalDriveValue = positiveNumber(gearsSection[metadata.finalKey]);
      traction = String(findIniValue(sections, ['TYPE'], ['TRACTION']) || '').trim().toUpperCase();
      if (importedGears.length) {
        changes.gears = importedGears.slice(0, 10);
        report.push(`${importedGears.length} relaciones de marcha`);
      }
      if (finalDriveValue) {
        changes.finalDrive = finalDriveValue;
        report.push(`relación final ${finalDriveValue}`);
      }
      if (traction) report.push(`tracción ${traction}`);
    }

    const engine = contents.get('engine.ini');
    if (engine) {
      const sections = parseIniSections(engine);
      const limiter = positiveNumber(findIniValue(sections, ['LIMITER'], ['ENGINE_DATA']));
      if (limiter) {
        changes.revLimit = limiter;
        changes.shiftRpm = limiter;
        report.push(`corte ${Math.round(limiter)} RPM`);
      }
    }

    const tyres = contents.get('tyres.ini');
    if (tyres) {
      const sections = parseIniSections(tyres);
      const preferredAxle = traction === 'FWD' ? ['FRONT'] : traction === 'RWD' ? ['REAR'] : ['REAR', 'FRONT'];
      let radiusRaw = '';
      for (const sectionName of preferredAxle) {
        if (positiveNumber(sections.get(sectionName)?.RADIUS)) {
          metadata.tyreSection = sectionName;
          radiusRaw = sections.get(sectionName).RADIUS;
          break;
        }
      }
      if (!radiusRaw) {
        for (const [sectionName, section] of sections) {
          if (!positiveNumber(section.RADIUS)) continue;
          metadata.tyreSection = sectionName;
          radiusRaw = section.RADIUS;
          break;
        }
      }
      const radius = positiveNumber(radiusRaw);
      if (radius) {
        metadata.tyreRadiusRaw = radiusRaw;
        const wheelDiameter = Number((radius * 2000).toFixed(2));
        changes.wheelDiameter = wheelDiameter;
        report.push(`rueda ${wheelDiameter} mm`);
      }
    }

    const setupFile = contents.get('setup.ini');
    if (setupFile) {
      const setupSections = parseIniSections(setupFile);
      metadata.ratioFilename = String(findIniValue(setupSections, ['RATIOS'], ['FINAL_GEAR_RATIO']) || 'final.rto').trim();
    }
    const importedRatioFile = contents.get(metadata.ratioFilename.toLocaleLowerCase()) || contents.get('final.rto');
    const importedRatioOptions = parseRatioOptions(importedRatioFile);
    const startingFinalDrive = positiveNumber(changes.finalDrive, positiveNumber(setup.finalDrive));
    const ratioOptions = importedRatioOptions.length
      ? importedRatioOptions
      : [{ id: `${Date.now()}-original`, label: 'ORIGINAL', ratio: startingFinalDrive }];

    if (!Object.keys(changes).length) {
      setImportReport([]);
      setImportError('No se encontraron valores compatibles. Cargá los archivos descomprimidos con sus nombres originales: drivetrain.ini, engine.ini y tyres.ini.');
      return;
    }

    const importedSetup = { ...setup, ...changes };
    setSetup(importedSetup);
    setReferenceSetup(importedSetup);
    setSourceFiles(Object.fromEntries(contents));
    setImportMetadata(metadata);
    setFinalRatioOptions(ratioOptions);
    setDefaultFinalRatioId(ratioOptions[0]?.id || null);
    setFinalRatiosDirty(false);
    setNewRatioLabel('');
    setBulkSaveMessage('');
    setBulkSaveStatus('idle');
    setImportReport(report);
    if (missingFiles.length) setImportError(`Se importaron los datos disponibles, pero faltan: ${missingFiles.join(', ')}.`);
    setDataLoaded(true);
  };

  const resetCalculator = () => {
    setSetup(DEFAULT_SETUP);
    setReferenceSetup(null);
    setSourceFiles({});
    setImportMetadata({ tyreSection: '', tyreRadiusRaw: '', finalKey: 'FINAL', ratioFilename: 'final.rto' });
    setFinalRatioOptions([]);
    setDefaultFinalRatioId(null);
    setFinalRatiosDirty(false);
    setNewRatioLabel('');
    setDataLoaded(false);
    setImportReport([]);
    setImportError('');
  };

  const engineChanged = Boolean(sourceFiles['engine.ini'] && referenceSetup
    && positiveNumber(setup.revLimit) !== positiveNumber(referenceSetup.revLimit));
  const tyresChanged = Boolean(sourceFiles['tyres.ini'] && referenceSetup && importMetadata.tyreSection
    && positiveNumber(setup.wheelDiameter) !== positiveNumber(referenceSetup.wheelDiameter));
  const sameGearCount = Boolean(referenceSetup && setup.gears.length === referenceSetup.gears.length);
  const drivetrainChanged = Boolean(sourceFiles['drivetrain.ini'] && referenceSetup && sameGearCount && (
    positiveNumber(setup.finalDrive) !== positiveNumber(referenceSetup.finalDrive)
    || setup.gears.some((ratio, index) => positiveNumber(ratio) !== positiveNumber(referenceSetup.gears[index]))
  ));

  const addCurrentFinalRatio = () => {
    const ratio = positiveNumber(setup.finalDrive);
    if (!ratio) return;
    const id = `${Date.now()}-${finalRatioOptions.length}`;
    setFinalRatioOptions(current => [...current, {
      id,
      label: newRatioLabel.trim() || `RELACIÓN ${current.length + 1}`,
      ratio,
    }]);
    if (!finalRatioOptions.length) setDefaultFinalRatioId(id);
    setFinalRatiosDirty(true);
    setNewRatioLabel('');
  };

  const updateFinalRatioOption = (id, field, value) => {
    setFinalRatioOptions(current => current.map(option => (
      option.id === id ? { ...option, [field]: value } : option
    )));
    setFinalRatiosDirty(true);
  };

  const removeFinalRatioOption = id => {
    const remaining = finalRatioOptions.filter(option => option.id !== id);
    setFinalRatioOptions(remaining);
    if (defaultFinalRatioId === id) setDefaultFinalRatioId(remaining[0]?.id || null);
    setFinalRatiosDirty(true);
  };
  const makeDefaultFinalRatio = id => {
    setDefaultFinalRatioId(id);
    setFinalRatiosDirty(true);
  };

  const finalRatioFilename = safeOutputFilename(importMetadata.ratioFilename, 'final.rto');
  const generatedSetupContent = ensureFinalRatioSetup(sourceFiles['setup.ini'] || '', finalRatioFilename);
  const setupChanged = Boolean(finalRatiosDirty && generatedSetupContent !== (sourceFiles['setup.ini'] || ''));
  const modifiedFileNames = [...new Set([
    drivetrainChanged ? 'drivetrain.ini' : '',
    engineChanged ? 'engine.ini' : '',
    tyresChanged ? 'tyres.ini' : '',
    finalRatiosDirty && finalRatioOptions.length ? finalRatioFilename : '',
    setupChanged ? 'setup.ini' : '',
    ...engineModifiedFileNames,
    ...brakesModifiedFileNames,
    ...tyresModifiedFileNames,
    ...suspensionModifiedFileNames,
  ].filter(Boolean))];

  const downloadModifiedFile = requestedFilename => {
    setBulkSaveStatus('working');
    setBulkSaveMessage(`Preparando ${requestedFilename}…`);
    const detail = { files: [] };
    if (drivetrainChanged) {
      let content = sourceFiles['drivetrain.ini'];
      const finalResult = replaceIniValue(content, 'GEARS', importMetadata.finalKey, positiveNumber(setup.finalDrive).toFixed(3));
      if (finalResult.replaced) {
        content = finalResult.content;
        let valid = true;
        for (let index = 0; index < setup.gears.length; index += 1) {
          const gearResult = replaceIniValue(content, 'GEARS', `GEAR_${index + 1}`, positiveNumber(setup.gears[index]).toFixed(3));
          if (!gearResult.replaced) {
            valid = false;
            break;
          }
          content = gearResult.content;
        }
        if (valid) detail.files.push({ name: 'drivetrain.ini', content });
      }
    }
    if (tyresChanged) {
      const originalDecimals = String(importMetadata.tyreRadiusRaw).split('.')[1]?.length || 3;
      const radius = (positiveNumber(setup.wheelDiameter) / 2000).toFixed(Math.max(3, originalDecimals));
      const updated = replaceIniValue(sourceFiles['tyres.ini'], importMetadata.tyreSection, 'RADIUS', radius);
      if (updated.replaced) detail.files.push({ name: 'tyres.ini', content: updated.content });
    }
    if (engineChanged) {
      const updated = replaceIniValue(sourceFiles['engine.ini'], 'ENGINE_DATA', 'LIMITER', Math.round(positiveNumber(setup.revLimit)));
      if (updated.replaced) detail.files.push({ name: 'engine.ini', content: updated.content });
    }
    if (finalRatiosDirty && finalRatioOptions.length) {
      const validOptions = finalRatioOptions.filter(option => positiveNumber(option.ratio));
      const defaultOption = validOptions.find(option => option.id === defaultFinalRatioId);
      const orderedForFile = defaultOption
        ? [defaultOption, ...validOptions.filter(option => option.id !== defaultFinalRatioId)]
        : validOptions;
      detail.files.push({
        name: finalRatioFilename,
        content: buildRatioFile(orderedForFile),
      });
    }
    if (setupChanged) detail.files.push({ name: 'setup.ini', content: generatedSetupContent });
    window.dispatchEvent(new CustomEvent('cadpo:download-modified-engine-files', { detail }));
    window.dispatchEvent(new CustomEvent('cadpo:download-modified-brakes-files', { detail }));
    window.dispatchEvent(new CustomEvent('cadpo:download-modified-tyres-files', { detail }));
    window.dispatchEvent(new CustomEvent('cadpo:download-modified-suspension-files', { detail }));
    detail.files = [...new Map(detail.files.map(file => {
      const name = safeOutputFilename(file.name, 'archivo.ini');
      return [name.toLocaleLowerCase(), { ...file, name }];
    })).values()];
    if (!detail.files.length) {
      setBulkSaveStatus('idle');
      setBulkSaveMessage('No se detectaron cambios. Modificá algún valor antes de guardar.');
      return;
    }

    try {
      const requestedFile = detail.files.find(file => file.name.toLocaleLowerCase() === requestedFilename.toLocaleLowerCase());
      if (!requestedFile) throw new Error(`no se encontró ${requestedFilename} entre los archivos modificados`);
      downloadBlobFile(
        requestedFile.name,
        new Blob([requestedFile.content], { type: 'text/plain;charset=utf-8' }),
      );
      setBulkSaveMessage(`Se inició la descarga de ${requestedFile.name}.`);
      setBulkSaveStatus('success');
    } catch (error) {
      setBulkSaveStatus('error');
      setBulkSaveMessage(`No se pudo descargar el archivo: ${error?.message || 'error desconocido'}.`);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-racing-border pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">Assetto Corsa</p>
        <h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Calculador de relaciones de caja</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-400">Compará la velocidad de cada marcha y la caída de RPM antes de pasar los valores al setup o a los archivos del mod. Los cambios se calculan y grafican al instante.</p>
      </header>

      <div>
        <label className="group flex cursor-pointer flex-col items-center justify-center border border-dashed border-cyan-400/45 bg-cyan-400/[0.05] px-4 py-5 text-center transition hover:border-cyan-300 hover:bg-cyan-400/10">
          <FolderOpenIcon className="h-8 w-8 text-cyan-400 transition group-hover:-translate-y-0.5"/>
          <strong className="mt-2 text-xs uppercase tracking-wider text-white">Seleccionar carpeta data</strong>
          <span className="mt-1 text-[10px] leading-relaxed text-gray-500">Este único cargador alimenta automáticamente la caja, el motor y los neumáticos</span>
          <input type="file" multiple webkitdirectory="" directory="" onChange={importDataFiles} className="sr-only"/>
        </label>
        {importReport.length ? <div className="mt-2 border border-green-400/30 bg-green-400/[0.07] px-3 py-2 text-xs text-green-300"><strong className="block uppercase">Datos importados</strong><span>{importReport.join(' · ')}</span></div> : null}
        {importError ? <p className="mt-2 border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-xs leading-relaxed text-red-200">{importError}</p> : null}
      </div>

      {dataLoaded ? <div className="border border-cyan-400/35 bg-cyan-400/[0.04] p-4 sm:p-5">
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Archivos modificados</p>
            {modifiedFileNames.length ? <div className="mt-2 flex flex-wrap gap-2">{modifiedFileNames.map(filename => <button type="button" key={filename} onClick={() => downloadModifiedFile(filename)} className="group inline-flex items-center gap-2 border border-cyan-400/35 bg-black/25 px-3 py-2 font-mono text-xs text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400 hover:text-black"><ArrowDownTrayIcon className="h-4 w-4 transition group-hover:translate-y-0.5"/>{filename}</button>)}</div> : <p className="mt-2 text-xs text-gray-500">Todavía no modificaste ningún archivo.</p>}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-gray-500">Los archivos aparecen acá apenas modificás la caja, el motor, los frenos, los neumáticos o las relaciones finales. Hacé clic en el nombre del archivo que quieras descargar.</p>
        {bulkSaveMessage ? <p className={`mt-3 border px-4 py-3 text-center text-xs font-semibold ${bulkSaveStatus === 'success' ? 'border-green-400/40 bg-green-400/[0.08] text-green-300' : bulkSaveStatus === 'error' ? 'border-red-400/40 bg-red-400/[0.08] text-red-200' : 'border-racing-border bg-black/20 text-gray-300'}`}>{bulkSaveMessage}</p> : null}
      </div> : null}

      <section className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)_250px]">
        <div className="space-y-4 border border-racing-border bg-racing-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Datos de entrada</p><h3 className="font-racing text-xl font-bold uppercase text-white">Transmisión y rueda</h3></div><button type="button" onClick={resetCalculator} className="inline-flex h-9 items-center gap-2 border border-racing-border px-3 text-[10px] font-bold uppercase text-gray-400 hover:border-cyan-400 hover:text-white"><ArrowPathIcon className="h-4 w-4"/>Restablecer</button></div>
          <label className="block"><span className="text-xs font-semibold text-gray-300">Nombre de la puesta a punto</span><input value={setup.name} onChange={event => updateField('name', event.target.value)} className="input-field mt-1.5" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="text-xs font-semibold text-gray-300">Corte del motor</span><div className="relative mt-1.5"><input type="number" min="1000" step="100" value={setup.revLimit} onChange={event => updateField('revLimit', event.target.value)} className="input-field pr-12"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">RPM</span></div></label>
            <label><span className="text-xs font-semibold text-gray-300">RPM de cambio</span><div className="relative mt-1.5"><input type="number" min="1000" step="100" value={setup.shiftRpm} onChange={event => updateField('shiftRpm', event.target.value)} className="input-field pr-12"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">RPM</span></div></label>
          </div>
          <label className="block"><span className="text-xs font-semibold text-gray-300">Diámetro de rueda</span><div className="relative mt-1.5"><input type="number" min="100" step="1" value={setup.wheelDiameter} onChange={event => updateField('wheelDiameter', event.target.value)} className="input-field pr-10"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">MM</span></div></label>
          <p className="border-l-2 border-cyan-400 bg-cyan-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-gray-400">En <strong className="text-white">tyres.ini</strong>, tomá el valor <strong className="text-white">RADIUS</strong> de la rueda motriz y multiplicalo por 2000. Ejemplo: 0.330 = 660 mm.</p>
          {dataLoaded && !sameGearCount ? <p className="border border-yellow-400/25 bg-yellow-400/[0.05] px-3 py-2 text-[10px] leading-relaxed text-yellow-300">Para generar drivetrain.ini mantené la misma cantidad de marchas que el archivo original.</p> : null}
        </div>

        {dataLoaded ? <div className="min-w-0 space-y-4">
          <div className="border border-racing-border bg-racing-card">
            <div className="px-3 py-3"><div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between"><div className="flex min-w-0 items-center gap-2"><ChartBarIcon className="h-6 w-6 shrink-0 text-cyan-400"/><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Gráfico de cambios</p><h3 className="truncate font-racing text-lg font-bold text-white">{setup.name || 'Sin nombre'}</h3></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-[104px_104px_auto_auto]"><label className="block"><span className="block text-[8px] font-bold uppercase text-gray-600">Máx. velocidad</span><div className="mt-1 flex h-8 items-center border border-racing-border bg-black/25 pl-1.5"><input type="number" min="10" step="10" value={setup.graphMaxSpeed} onChange={event => updateField('graphMaxSpeed', event.target.value)} className="min-w-0 w-[68px] bg-transparent text-center font-racing text-xs text-white outline-none"/><span className="shrink-0 pr-1 text-[7px] text-gray-600">KM/H</span></div></label><label className="block"><span className="block text-[8px] font-bold uppercase text-gray-600">Máx. motor</span><div className="mt-1 flex h-8 items-center border border-racing-border bg-black/25 pl-1.5"><input type="number" min="1000" step="500" value={setup.graphMaxRpm} onChange={event => updateField('graphMaxRpm', event.target.value)} className="min-w-0 w-[68px] bg-transparent text-center font-racing text-xs text-white outline-none"/><span className="shrink-0 pr-1 text-[7px] text-gray-600">RPM</span></div></label><div><p className="text-[8px] font-bold uppercase text-gray-600">Circunferencia</p><strong className="mt-1 block font-racing text-base text-white">{formatNumber(circumference, 3)} M</strong></div><div><p className="text-[8px] font-bold uppercase text-gray-600">Velocidad final</p><strong className="mt-1 block whitespace-nowrap font-racing text-base text-cyan-300">{formatNumber(rows.at(-1)?.redlineSpeed)} KM/H</strong></div></div></div></div>
            <div className="border-t border-racing-border bg-black/20 px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Relaciones por marcha</p><p className="text-[8px] text-gray-600">Cambios de 0,05</p></div><div className="flex gap-1"><button type="button" onClick={removeGear} disabled={setup.gears.length <= 1} className="inline-flex h-7 w-7 items-center justify-center border border-racing-border text-gray-400 hover:border-red-400 hover:text-white disabled:opacity-30" aria-label="Quitar marcha"><MinusIcon className="h-3.5 w-3.5"/></button><button type="button" onClick={addGear} disabled={setup.gears.length >= 10} className="inline-flex h-7 w-7 items-center justify-center border border-racing-border text-gray-400 hover:border-cyan-400 hover:text-white disabled:opacity-30" aria-label="Agregar marcha"><PlusIcon className="h-3.5 w-3.5"/></button></div></div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(setup.gears.length, 10)}, minmax(64px, 1fr))` }}>{setup.gears.map((gear, index) => <label key={index} className="flex min-w-0 items-center border border-racing-border bg-black/30 px-1.5 py-1"><span className="mr-1.5 shrink-0 font-racing text-sm font-bold" style={{ color: COLORS[index % COLORS.length] }}>{index + 1}ª</span><input type="number" min="0.05" step="0.05" value={gear} onChange={event => updateGear(index, event.target.value)} className="min-w-0 w-full bg-transparent text-right font-racing text-sm font-bold text-white outline-none"/></label>)}</div>
            </div>
          </div>
          <GearRatioChart rows={rows} revLimit={revLimit} shiftRpm={shiftRpm} graphMaxSpeed={positiveNumber(setup.graphMaxSpeed, 300)} graphMaxRpm={positiveNumber(setup.graphMaxRpm, 9000)} referenceRows={referenceRows} referenceShiftRpm={referenceShiftRpm}/>
          <section className="overflow-hidden border border-racing-border bg-racing-card">
            <div className="border-b border-racing-border px-4 py-3"><h3 className="font-racing text-xl font-bold uppercase text-white">Resultado y caída de RPM</h3><p className="text-xs text-gray-500">Referencia detallada del mismo gráfico. La velocidad al corte es teórica.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-black/30 text-[10px] font-bold uppercase tracking-wider text-gray-500"><th className="px-4 py-3">Marcha</th><th className="px-4 py-3">Relación</th><th className="px-4 py-3">Relación total</th><th className="px-4 py-3">Cambio a</th><th className="px-4 py-3">RPM luego del cambio</th><th className="px-4 py-3">Caída</th><th className="px-4 py-3 text-right">Velocidad al corte</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.number} className="border-t border-racing-border/70"><td className="px-4 py-3"><span className="font-racing text-xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>{row.number}ª</span></td><td className="px-4 py-3 font-racing text-lg text-white">{formatNumber(row.ratio, 3)}</td><td className="px-4 py-3 text-gray-300">{formatNumber(row.overallRatio, 3)}</td><td className="px-4 py-3 text-gray-300">{formatNumber(row.shiftSpeed)} km/h</td><td className="px-4 py-3 font-racing text-lg text-white">{index ? `${Math.round(row.rpmAfterShift)} RPM` : '—'}</td><td className="px-4 py-3 font-racing text-lg text-yellow-300">{index ? `-${Math.round(row.rpmDrop)} RPM` : '—'}</td><td className="px-4 py-3 text-right font-racing text-xl font-bold text-cyan-300">{formatNumber(row.redlineSpeed)} km/h</td></tr>)}</tbody></table></div>
          </section>
        </div> : <div className="flex min-h-[420px] min-w-0 flex-col items-center justify-center border border-dashed border-racing-border bg-black/15 px-6 text-center xl:col-span-2"><FolderOpenIcon className="h-14 w-14 text-gray-700"/><h3 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-400">Seleccioná la carpeta data</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">El gráfico aparecerá después de detectar los archivos de transmisión, motor y neumáticos del mod.</p></div>}

        {dataLoaded ? <aside className="overflow-hidden border border-racing-border bg-racing-card xl:sticky xl:top-4">
          <header className="border-b border-racing-border p-4"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">Assetto Corsa · final.rto</p><h3 className="mt-1 font-racing text-xl font-bold uppercase text-white">Relaciones finales</h3><p className="mt-1 text-[10px] leading-relaxed text-gray-600">Probá, guardá y aplicá relaciones sin alejarte del gráfico.</p></header>
          <div className="border-b border-racing-border bg-cyan-400/[0.04] p-4">
            <label><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Relación final actual</span><input type="number" min="0.05" step="0.05" value={setup.finalDrive} onChange={event => updateField('finalDrive', event.target.value)} className="input-field mt-1.5 text-center font-racing text-2xl font-bold text-cyan-300"/></label>
            <div className="mt-3 grid gap-2"><input value={newRatioLabel} onChange={event => setNewRatioLabel(event.target.value)} placeholder={`Nombre: CORTA ${finalRatioOptions.length + 1}`} className="input-field"/><button type="button" onClick={addCurrentFinalRatio} className="inline-flex h-10 items-center justify-center gap-2 bg-cyan-400 px-3 text-[10px] font-bold uppercase text-black hover:bg-cyan-300"><PlusIcon className="h-4 w-4"/>Guardar relación actual</button></div>
          </div>
          <div className="scrollbar-hidden max-h-[410px] divide-y divide-racing-border/70 overflow-y-auto">{finalRatioOptions.map((option, index) => {
            const active = Math.abs(positiveNumber(option.ratio) - positiveNumber(setup.finalDrive)) < 0.0001;
            return <div key={option.id} className={`p-3 ${active ? 'bg-cyan-400/[0.07]' : ''}`}>
              <div className="flex items-center gap-2"><button type="button" onClick={() => updateField('finalDrive', option.ratio)} className={`flex h-8 w-8 shrink-0 items-center justify-center border font-racing text-xs font-bold ${active ? 'border-cyan-300 bg-cyan-400 text-black' : 'border-racing-border text-gray-500 hover:border-cyan-400 hover:text-white'}`}>{index + 1}</button><input value={option.label} onChange={event => updateFinalRatioOption(option.id, 'label', event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none"/><button type="button" onClick={() => removeFinalRatioOption(option.id)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-gray-700 hover:text-red-300" aria-label={`Eliminar ${option.label}`}><TrashIcon className="h-4 w-4"/></button></div>
              <div className="mt-2 grid grid-cols-[88px_minmax(0,1fr)] gap-2"><label className="flex h-9 items-center border border-racing-border bg-black/25 px-1.5"><input type="number" min="0.05" step="0.05" value={option.ratio} onChange={event => updateFinalRatioOption(option.id, 'ratio', event.target.value)} className="min-w-0 w-full bg-transparent text-center font-racing text-base text-white outline-none"/></label><button type="button" onClick={() => updateField('finalDrive', option.ratio)} className="h-9 border border-cyan-400/30 px-2 text-[8px] font-bold uppercase text-cyan-300 hover:bg-cyan-400 hover:text-black">Aplicar</button></div>
              <div className="mt-2">{option.id === defaultFinalRatioId ? <span className="text-[8px] font-bold uppercase tracking-wider text-yellow-300">Predeterminada</span> : <button type="button" onClick={() => makeDefaultFinalRatio(option.id)} className="text-[8px] font-bold uppercase tracking-wider text-gray-600 hover:text-yellow-300">Usar como predeterminada</button>}</div>
            </div>;
          })}{!finalRatioOptions.length ? <p className="px-4 py-8 text-center text-xs text-gray-600">Todavía no agregaste relaciones.</p> : null}</div>
        </aside> : null}
      </section>

    </div>
  );
}
