import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

const numberValue = (value, fallback = 0) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const positiveNumber = (value, fallback = 0) => {
  const parsed = numberValue(value, fallback);
  return parsed > 0 ? parsed : fallback;
};

const nonNegativeNumber = (value, fallback = 0) => {
  const parsed = numberValue(value, fallback);
  return parsed >= 0 ? parsed : fallback;
};

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
    sections.get(section)[line.slice(0, separator).trim().toUpperCase()] = line.slice(separator + 1).trim();
  });
  return sections;
};

const findIniValue = (sections, keys, preferredSections = []) => {
  for (const sectionName of preferredSections) {
    const section = sections.get(sectionName.toUpperCase());
    if (!section) continue;
    for (const key of keys) if (section[key.toUpperCase()] !== undefined) return section[key.toUpperCase()];
  }
  for (const section of sections.values()) {
    for (const key of keys) if (section[key.toUpperCase()] !== undefined) return section[key.toUpperCase()];
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
    const match = lines[index].match(valuePattern);
    if (!match) continue;
    lines[index] = `${match[1]}${nextValue}${match[3]}`;
    replaced = true;
    break;
  }
  return { content: lines.join(''), replaced };
};

const upsertIniValue = (content, targetSection, targetKey, nextValue, description = '') => {
  const replaced = replaceIniValue(content, targetSection, targetKey, nextValue);
  if (replaced.replaced) return replaced.content;
  const newline = String(content || '').includes('\r\n') ? '\r\n' : '\n';
  const lines = String(content || '').split(/\r?\n/);
  const sectionIndex = lines.findIndex(line => line.trim().toUpperCase() === `[${targetSection.toUpperCase()}]`);
  const entry = `${targetKey}=${nextValue}${description ? `\t\t\t; ${description}` : ''}`;
  if (sectionIndex >= 0) {
    let insertionIndex = sectionIndex + 1;
    while (insertionIndex < lines.length && !/^\s*\[[^\]]+]\s*$/.test(lines[insertionIndex])) insertionIndex += 1;
    lines.splice(insertionIndex, 0, entry);
    return lines.join(newline);
  }
  const suffix = content && !String(content).endsWith('\n') ? newline : '';
  return `${content || ''}${suffix}${newline}[${targetSection}]${newline}${entry}${newline}`;
};

const parsePowerLut = content => String(content || '')
  .split(/\r?\n/)
  .map(line => line.replace(/;.*/, '').trim())
  .filter(Boolean)
  .map((line, index) => {
    const match = line.match(/^(-?\d+(?:[.,]\d+)?)\s*\|\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!match) return null;
    return { id: `${Date.now()}-${index}`, rpm: positiveNumber(match[1]), torque: numberValue(match[2]) };
  })
  .filter(point => point && point.rpm > 0)
  .sort((a, b) => a.rpm - b.rpm);

const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString('es-AR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const calculateCv = point => (positiveNumber(point.rpm) * numberValue(point.torque)) / 7023.5;
const calculateHp = point => (positiveNumber(point.rpm) * numberValue(point.torque)) / 7127;

function EngineChart({ points, referencePoints, maxRpm, maxValue }) {
  const width = 920;
  const height = 430;
  const margin = { top: 26, right: 64, bottom: 50, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const safeMaxRpm = Math.max(1000, maxRpm);
  const safeMaxValue = Math.max(50, maxValue);
  const x = rpm => margin.left + (positiveNumber(rpm) / safeMaxRpm) * plotWidth;
  const y = value => margin.top + plotHeight - (Math.max(0, numberValue(value)) / safeMaxValue) * plotHeight;
  const linePoints = (source, getValue) => source
    .filter(point => positiveNumber(point.rpm) <= safeMaxRpm)
    .map(point => `${x(point.rpm)},${y(getValue(point))}`)
    .join(' ');
  const rpmTicks = Array.from({ length: 7 }, (_, index) => (safeMaxRpm / 6) * index);
  const valueTicks = Array.from({ length: 6 }, (_, index) => (safeMaxValue / 5) * index);
  const torquePoints = linePoints(points, point => point.torque);
  const powerPoints = linePoints(points, calculateCv);
  const referenceTorque = linePoints(referencePoints, point => point.torque);
  const referencePower = linePoints(referencePoints, calculateCv);

  return (
    <div className="overflow-x-auto border border-racing-border bg-black/25 p-2 sm:p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Curva de torque y potencia del motor">
        <defs><clipPath id="engine-power-plot"><rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight}/></clipPath></defs>
        <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="#080a0d"/>
        {rpmTicks.map(tick => <g key={`rpm-${tick}`}><line x1={x(tick)} y1={margin.top} x2={x(tick)} y2={margin.top + plotHeight} stroke="#252932"/><text x={x(tick)} y={height - 22} textAnchor="middle" fill="#8b929e" fontSize="11">{Math.round(tick)}</text></g>)}
        {valueTicks.map(tick => <g key={`value-${tick}`}><line x1={margin.left} y1={y(tick)} x2={margin.left + plotWidth} y2={y(tick)} stroke="#252932"/><text x={margin.left - 10} y={y(tick) + 4} textAnchor="end" fill="#8b929e" fontSize="11">{Math.round(tick)}</text><text x={margin.left + plotWidth + 10} y={y(tick) + 4} fill="#8b929e" fontSize="11">{Math.round(tick)}</text></g>)}
        <g clipPath="url(#engine-power-plot)">
          {referenceTorque ? <polyline points={referenceTorque} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.12"/> : null}
          {referencePower ? <polyline points={referencePower} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 5" opacity="0.12"/> : null}
          {torquePoints ? <polyline points={torquePoints} fill="none" stroke="#00ffcd" strokeWidth="2.5" strokeLinejoin="round"/> : null}
          {powerPoints ? <polyline points={powerPoints} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round"/> : null}
          {points.filter(point => positiveNumber(point.rpm) <= safeMaxRpm).map(point => <circle key={point.id} cx={x(point.rpm)} cy={y(point.torque)} r="3" fill="#00ffcd" stroke="#080a0d"/>)}
        </g>
        <text x={margin.left + 4} y={margin.top + 15} fill="#00ffcd" fontSize="10" fontWeight="700">TORQUE (NM)</text>
        <text x={margin.left + plotWidth - 4} y={margin.top + 15} textAnchor="end" fill="#ef4444" fontSize="10" fontWeight="700">POTENCIA (CV)</text>
        <text x={margin.left + plotWidth / 2} y={height - 3} textAnchor="middle" fill="#d1d5db" fontSize="12" fontWeight="700">MOTOR (RPM)</text>
      </svg>
    </div>
  );
}

export default function EnginePowerCalculator() {
  const [points, setPoints] = useState([]);
  const [referencePoints, setReferencePoints] = useState([]);
  const [engineContent, setEngineContent] = useState('');
  const [curveFilename, setCurveFilename] = useState('power.lut');
  const [limiter, setLimiter] = useState(0);
  const [originalLimiter, setOriginalLimiter] = useState(0);
  const [inertia, setInertia] = useState(0);
  const [originalInertia, setOriginalInertia] = useState(0);
  const [minimumRpm, setMinimumRpm] = useState(0);
  const [originalMinimumRpm, setOriginalMinimumRpm] = useState(0);
  const [limiterHz, setLimiterHz] = useState(0);
  const [originalLimiterHz, setOriginalLimiterHz] = useState(0);
  const [damageRpmThreshold, setDamageRpmThreshold] = useState(0);
  const [originalDamageRpmThreshold, setOriginalDamageRpmThreshold] = useState(0);
  const [damageRpmK, setDamageRpmK] = useState(0);
  const [originalDamageRpmK, setOriginalDamageRpmK] = useState(0);
  const [targetCv, setTargetCv] = useState('');
  const [targetTorque, setTargetTorque] = useState('');
  const [graphMaxRpm, setGraphMaxRpm] = useState(9000);
  const [graphMaxValue, setGraphMaxValue] = useState(400);
  const [turboInfo, setTurboInfo] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const stats = useMemo(() => {
    if (!points.length) return null;
    const maxTorquePoint = points.reduce((best, point) => numberValue(point.torque) > numberValue(best.torque) ? point : best, points[0]);
    const maxPowerPoint = points.reduce((best, point) => calculateCv(point) > calculateCv(best) ? point : best, points[0]);
    return {
      torque: numberValue(maxTorquePoint.torque),
      torqueRpm: positiveNumber(maxTorquePoint.rpm),
      cv: calculateCv(maxPowerPoint),
      hp: calculateHp(maxPowerPoint),
      powerRpm: positiveNumber(maxPowerPoint.rpm),
    };
  }, [points]);

  const curveChanged = useMemo(() => {
    if (!loaded || points.length !== referencePoints.length) return loaded && points.length > 0;
    const current = [...points].sort((a, b) => positiveNumber(a.rpm) - positiveNumber(b.rpm));
    const original = [...referencePoints].sort((a, b) => positiveNumber(a.rpm) - positiveNumber(b.rpm));
    return current.some((point, index) => (
      positiveNumber(point.rpm) !== positiveNumber(original[index]?.rpm)
      || numberValue(point.torque) !== numberValue(original[index]?.torque)
    ));
  }, [loaded, points, referencePoints]);

  const engineSettingsChanged = Boolean(loaded && (
    positiveNumber(limiter) !== positiveNumber(originalLimiter)
    || positiveNumber(inertia) !== positiveNumber(originalInertia)
    || positiveNumber(minimumRpm) !== positiveNumber(originalMinimumRpm)
    || nonNegativeNumber(limiterHz) !== nonNegativeNumber(originalLimiterHz)
    || positiveNumber(damageRpmThreshold) !== positiveNumber(originalDamageRpmThreshold)
    || nonNegativeNumber(damageRpmK) !== nonNegativeNumber(originalDamageRpmK)
  ));

  const loadDataFiles = useCallback(async selectedFiles => {
    const files = [...(selectedFiles || [])];
    const contents = new Map();
    await Promise.all(files.filter(file => /\.(?:ini|lut)$/i.test(file.name)).map(async file => {
      contents.set(file.name.toLowerCase(), await file.text());
    }));
    const engine = contents.get('engine.ini');
    if (!engine) {
      setError('No se encontró engine.ini dentro de la carpeta data seleccionada.');
      setLoaded(false);
      return;
    }
    const sections = parseIniSections(engine);
    const referencedCurve = String(findIniValue(sections, ['POWER_CURVE'], ['HEADER', 'ENGINE_DATA']) || 'power.lut').replace(/["']/g, '').trim();
    const curveName = referencedCurve.split(/[\\/]/).pop().toLowerCase();
    const curveContent = contents.get(curveName);
    const parsedPoints = parsePowerLut(curveContent);
    if (!parsedPoints.length) {
      setError(`Se encontró engine.ini, pero no se pudo leer la curva ${referencedCurve}.`);
      setLoaded(false);
      return;
    }
    const importedLimiter = positiveNumber(findIniValue(sections, ['LIMITER'], ['ENGINE_DATA']), Math.max(...parsedPoints.map(point => point.rpm)));
    const importedInertia = positiveNumber(findIniValue(sections, ['INERTIA'], ['ENGINE_DATA']));
    const importedMinimumRpm = positiveNumber(findIniValue(sections, ['MINIMUM'], ['ENGINE_DATA']), 800);
    const importedLimiterHz = nonNegativeNumber(findIniValue(sections, ['LIMITER_HZ'], ['ENGINE_DATA']), 30);
    const importedDamageThreshold = positiveNumber(findIniValue(sections, ['RPM_THRESHOLD'], ['DAMAGE']), importedLimiter);
    const importedDamageK = nonNegativeNumber(findIniValue(sections, ['RPM_DAMAGE_K'], ['DAMAGE']), 1);
    const turboFileSections = contents.get('turbo.ini') ? parseIniSections(contents.get('turbo.ini')) : new Map();
    const turboSections = [...sections.entries(), ...turboFileSections.entries()]
      .filter(([name]) => name.startsWith('TURBO'))
      .map(([name, values], index) => ({ id: `${name}-${index}`, name, maxBoost: values.MAX_BOOST, wastegate: values.WASTEGATE }))
      .filter(item => item.maxBoost !== undefined || item.wastegate !== undefined);
    const maxCurveValue = Math.max(...parsedPoints.flatMap(point => [point.torque, calculateCv(point)]));
    setPoints(parsedPoints);
    setReferencePoints(parsedPoints.map(point => ({ ...point })));
    setEngineContent(engine);
    setCurveFilename(referencedCurve);
    setLimiter(importedLimiter);
    setOriginalLimiter(importedLimiter);
    setInertia(importedInertia);
    setOriginalInertia(importedInertia);
    setMinimumRpm(importedMinimumRpm);
    setOriginalMinimumRpm(importedMinimumRpm);
    setLimiterHz(importedLimiterHz);
    setOriginalLimiterHz(importedLimiterHz);
    setDamageRpmThreshold(importedDamageThreshold);
    setOriginalDamageRpmThreshold(importedDamageThreshold);
    setDamageRpmK(importedDamageK);
    setOriginalDamageRpmK(importedDamageK);
    setGraphMaxRpm(Math.ceil(Math.max(importedLimiter, ...parsedPoints.map(point => point.rpm)) / 1000) * 1000);
    setGraphMaxValue(Math.ceil(maxCurveValue / 50) * 50 || 400);
    setTurboInfo(turboSections);
    setTargetCv('');
    setTargetTorque('');
    setError('');
    setMessage(`Se cargaron ${parsedPoints.length} puntos desde ${referencedCurve}.`);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const receiveSharedDataFolder = event => loadDataFiles(event.detail?.files || []);
    window.addEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
    return () => window.removeEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
  }, [loadDataFiles]);

  useEffect(() => {
    const syncGearLimiter = event => {
      const nextLimit = positiveNumber(event.detail?.limiter);
      if (nextLimit) setLimiter(nextLimit);
    };
    window.addEventListener('cadpo:gear-limiter-change', syncGearLimiter);
    return () => window.removeEventListener('cadpo:gear-limiter-change', syncGearLimiter);
  }, []);

  const updateLimiter = value => {
    setLimiter(value);
    window.dispatchEvent(new CustomEvent('cadpo:engine-limiter-change', { detail: { limiter: value } }));
  };

  const applyTargetPower = () => {
    const desired = positiveNumber(targetCv);
    if (!desired || !stats?.cv) return;
    const factor = desired / stats.cv;
    setPoints(current => current.map(point => ({ ...point, torque: Number((numberValue(point.torque) * factor).toFixed(3)) })));
    setMessage(`Curva escalada un ${formatNumber(factor * 100, 1)}% para alcanzar aproximadamente ${formatNumber(desired, 1)} CV.`);
  };

  const applyTargetTorque = () => {
    const desired = positiveNumber(targetTorque);
    if (!desired || !stats?.torque) return;
    const factor = desired / stats.torque;
    setPoints(current => current.map(point => ({ ...point, torque: Number((numberValue(point.torque) * factor).toFixed(3)) })));
    setMessage(`Curva escalada un ${formatNumber(factor * 100, 1)}% para alcanzar aproximadamente ${formatNumber(desired, 1)} Nm.`);
  };

  const restoreCurve = () => {
    setPoints(referencePoints.map(point => ({ ...point })));
    updateLimiter(originalLimiter);
    setInertia(originalInertia);
    setMinimumRpm(originalMinimumRpm);
    setLimiterHz(originalLimiterHz);
    setDamageRpmThreshold(originalDamageRpmThreshold);
    setDamageRpmK(originalDamageRpmK);
    setTargetCv('');
    setTargetTorque('');
    setMessage('Se restauraron los valores importados.');
  };

  const buildPowerCurveContent = () => {
    const ordered = [...points].sort((a, b) => positiveNumber(a.rpm) - positiveNumber(b.rpm));
    return `${ordered.map(point => `${Math.round(positiveNumber(point.rpm))}|${numberValue(point.torque).toFixed(3)}`).join('\r\n')}\r\n`;
  };

  const buildEngineContent = () => {
    let content = engineContent;
    const limiterResult = replaceIniValue(content, 'ENGINE_DATA', 'LIMITER', Math.round(positiveNumber(limiter)));
    if (!limiterResult.replaced) return null;
    content = limiterResult.content;
    if (positiveNumber(inertia)) {
      const inertiaResult = replaceIniValue(content, 'ENGINE_DATA', 'INERTIA', positiveNumber(inertia).toFixed(3));
      if (inertiaResult.replaced) content = inertiaResult.content;
    }
    content = upsertIniValue(content, 'ENGINE_DATA', 'MINIMUM', Math.round(positiveNumber(minimumRpm, 800)), 'RPM de ralentí');
    content = upsertIniValue(content, 'ENGINE_DATA', 'LIMITER_HZ', nonNegativeNumber(limiterHz, 30), 'Frecuencia de actuación del limitador');
    content = upsertIniValue(
      content,
      'DAMAGE',
      'RPM_THRESHOLD',
      Math.round(positiveNumber(damageRpmThreshold, limiter)),
      'RPM a partir de las cuales el motor empieza a dañarse',
    );
    content = upsertIniValue(
      content,
      'DAMAGE',
      'RPM_DAMAGE_K',
      nonNegativeNumber(damageRpmK, 1),
      'Daño por segundo por cada RPM sobre el umbral',
    );
    return content;
  };

  useEffect(() => {
    const files = [];
    if (loaded && curveChanged) files.push(curveFilename.split(/[\\/]/).pop() || 'power.lut');
    if (loaded && engineSettingsChanged) files.push('engine.ini');
    window.dispatchEvent(new CustomEvent('cadpo:engine-modified-files-change', { detail: { files } }));
  }, [curveChanged, curveFilename, engineSettingsChanged, loaded]);

  useEffect(() => {
    const downloadModifiedEngineFiles = event => {
      const files = event.detail?.files;
      if (!Array.isArray(files) || !loaded) return;
      if (curveChanged) {
        files.push({ name: curveFilename.split(/[\\/]/).pop() || 'power.lut', content: buildPowerCurveContent() });
      }
      if (engineSettingsChanged) {
        const content = buildEngineContent();
        if (content) files.push({ name: 'engine.ini', content });
      }
    };
    window.addEventListener('cadpo:download-modified-engine-files', downloadModifiedEngineFiles);
    return () => window.removeEventListener('cadpo:download-modified-engine-files', downloadModifiedEngineFiles);
  });

  return (
    <section className="border-t border-racing-border pt-10">
      <header className="border-b border-racing-border pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">Assetto Corsa</p>
        <h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Motor y potencia</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-400">Cargá la carpeta data para analizar y modificar la curva de torque del motor. La potencia se calcula en cada RPM y se actualiza en tiempo real.</p>
      </header>

      {error ? <p className="mt-5 border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-xs text-red-200">{error}</p> : null}

      {loaded ? <div className="mt-5 grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 border border-racing-border bg-racing-card p-4">
          <div><p className="text-[9px] font-bold uppercase tracking-widest text-red-300">Datos del motor</p><h3 className="font-racing text-xl font-bold uppercase text-white">Control de potencia</h3></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-racing-border bg-black/20 p-3"><span className="text-[8px] font-bold uppercase text-gray-600">Potencia máxima</span><strong className="mt-1 block font-racing text-2xl text-red-400">{formatNumber(stats?.cv, 1)} CV</strong><small className="text-[9px] text-gray-500">{formatNumber(stats?.hp, 1)} HP · {formatNumber(stats?.powerRpm)} RPM</small></div>
            <div className="border border-racing-border bg-black/20 p-3"><span className="text-[8px] font-bold uppercase text-gray-600">Torque máximo</span><strong className="mt-1 block font-racing text-2xl text-cyan-300">{formatNumber(stats?.torque, 1)} NM</strong><small className="text-[9px] text-gray-500">a {formatNumber(stats?.torqueRpm)} RPM</small></div>
          </div>
          <div className="space-y-2">
            <label className="block"><span className="text-xs font-semibold text-gray-300">Potencia objetivo</span><div className="mt-1.5 flex"><input type="number" min="1" step="1" value={targetCv} onChange={event => setTargetCv(event.target.value)} placeholder={formatNumber(stats?.cv)} className="input-field min-w-0 flex-1"/><button type="button" onClick={applyTargetPower} className="shrink-0 bg-red-500 px-3 text-[9px] font-bold uppercase text-white hover:bg-red-400">Aplicar CV</button></div></label>
            <label className="block"><span className="text-xs font-semibold text-gray-300">Torque objetivo</span><div className="mt-1.5 flex"><input type="number" min="1" step="1" value={targetTorque} onChange={event => setTargetTorque(event.target.value)} placeholder={formatNumber(stats?.torque)} className="input-field min-w-0 flex-1"/><button type="button" onClick={applyTargetTorque} className="shrink-0 bg-cyan-400 px-3 text-[9px] font-bold uppercase text-black hover:bg-cyan-300">Aplicar Nm</button></div></label>
            <span className="block text-[9px] leading-relaxed text-gray-600">CV y torque escalan toda la curva proporcionalmente sin alterar su forma ni las relaciones de caja.</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="text-[10px] font-semibold text-gray-400">Limitador</span><div className="relative mt-1"><input type="number" min="1000" step="100" value={limiter} onChange={event => updateLimiter(event.target.value)} className="input-field pr-10 text-sm"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-600">RPM</span></div></label>
            <label><span className="text-[10px] font-semibold text-gray-400">Inercia</span><input type="number" min="0.001" step="0.01" value={inertia} onChange={event => setInertia(event.target.value)} className="input-field mt-1 text-sm"/></label>
            <label><span className="text-[10px] font-semibold text-gray-400">Ralentí</span><div className="relative mt-1"><input type="number" min="100" step="50" value={minimumRpm} onChange={event => setMinimumRpm(event.target.value)} className="input-field pr-10 text-sm"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-600">RPM</span></div></label>
            <label><span className="text-[10px] font-semibold text-gray-400">Frecuencia de corte</span><div className="relative mt-1"><input type="number" min="0" step="1" value={limiterHz} onChange={event => setLimiterHz(event.target.value)} className="input-field pr-8 text-sm"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-600">HZ</span></div></label>
          </div>
          <div className="border border-red-400/20 bg-red-400/[0.04] p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-red-300">Daño del motor</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label><span className="text-[9px] font-semibold text-gray-400">Comienza a dañarse</span><div className="relative mt-1"><input type="number" min="1000" step="100" value={damageRpmThreshold} onChange={event => setDamageRpmThreshold(event.target.value)} className="input-field pr-10 text-sm"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-600">RPM</span></div></label>
              <label><span className="text-[9px] font-semibold text-gray-400">Daño por segundo</span><input type="number" min="0" step="0.1" value={damageRpmK} onChange={event => setDamageRpmK(event.target.value)} className="input-field mt-1 text-sm"/></label>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-gray-600">RPM_DAMAGE_K se aplica por cada RPM que supera el umbral configurado.</p>
          </div>
          <div className="border border-racing-border bg-black/20 p-3"><p className="text-[9px] font-bold uppercase text-gray-500">Sobrealimentación</p>{turboInfo.length ? <>{turboInfo.map(turbo => <p key={turbo.id} className="mt-1 text-xs text-gray-300"><strong className="text-yellow-300">{turbo.name}</strong> · Máx. {turbo.maxBoost ?? '—'} · Wastegate {turbo.wastegate ?? '—'}</p>)}<p className="mt-2 text-[9px] leading-relaxed text-yellow-200/70">La potencia del gráfico corresponde a la curva base. El turbo puede modificar la entrega efectiva en pista.</p></> : <p className="mt-1 text-xs text-gray-600">No se detectaron secciones de turbo.</p>}</div>
          <button type="button" onClick={restoreCurve} className="inline-flex h-9 w-full items-center justify-center gap-2 border border-racing-border text-[9px] font-bold uppercase text-gray-400 hover:border-white/40 hover:text-white"><ArrowPathIcon className="h-4 w-4"/>Restaurar archivo cargado</button>
          {message ? <p className="border-l-2 border-red-400 pl-2 text-[10px] leading-relaxed text-gray-300">{message}</p> : null}
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="border border-racing-border bg-racing-card">
            <div className="flex flex-col gap-3 border-b border-racing-border px-3 py-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-center gap-2"><BoltIcon className="h-6 w-6 text-red-400"/><div><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Banco de potencia</p><h3 className="font-racing text-lg font-bold text-white">{curveFilename}</h3></div></div><div className="grid grid-cols-2 gap-2"><label><span className="block text-[8px] font-bold uppercase text-gray-600">Máx. RPM gráfico</span><input type="number" min="1000" step="500" value={graphMaxRpm} onChange={event => setGraphMaxRpm(event.target.value)} className="mt-1 h-8 w-24 border border-racing-border bg-black/25 px-2 text-center font-racing text-xs text-white outline-none"/></label><label><span className="block text-[8px] font-bold uppercase text-gray-600">Máx. escala</span><input type="number" min="50" step="50" value={graphMaxValue} onChange={event => setGraphMaxValue(event.target.value)} className="mt-1 h-8 w-24 border border-racing-border bg-black/25 px-2 text-center font-racing text-xs text-white outline-none"/></label></div></div>
            <EngineChart points={[...points].sort((a, b) => positiveNumber(a.rpm) - positiveNumber(b.rpm))} referencePoints={referencePoints} maxRpm={positiveNumber(graphMaxRpm, 9000)} maxValue={positiveNumber(graphMaxValue, 400)}/>
          </div>

        </div>
      </div> : <div className="mt-5 flex min-h-56 flex-col items-center justify-center border border-dashed border-racing-border bg-black/15 px-6 text-center"><BoltIcon className="h-12 w-12 text-gray-700"/><h3 className="mt-3 font-racing text-xl font-bold uppercase text-gray-500">Cargá los datos del motor</h3><p className="mt-1 text-xs text-gray-600">El gráfico aparecerá cuando se detecten engine.ini y su curva de potencia.</p></div>}
    </section>
  );
}
