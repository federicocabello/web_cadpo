import { useCallback, useEffect, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const numberValue = (value, fallback = 0) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

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

const defaultValues = {
  maxTorque: 2400,
  frontShare: 69.5,
  handbrakeTorque: 1600,
  cockpitAdjustable: true,
  adjustStep: 0.5,
};

export default function BrakesCalculator() {
  const [content, setContent] = useState('');
  const [values, setValues] = useState(defaultValues);
  const [originalValues, setOriginalValues] = useState(defaultValues);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  const loadDataFiles = useCallback(async selectedFiles => {
    const brakeFile = [...(selectedFiles || [])].find(file => file.name.toLocaleLowerCase() === 'brakes.ini');
    if (!brakeFile) {
      setContent('');
      setLoaded(false);
      setMessage('La carpeta seleccionada no contiene brakes.ini.');
      return;
    }
    const brakeContent = await brakeFile.text();
    const data = parseIniSections(brakeContent).get('DATA') || {};
    const imported = {
      maxTorque: Math.max(0, numberValue(data.MAX_TORQUE, defaultValues.maxTorque)),
      frontShare: clamp(numberValue(data.FRONT_SHARE, defaultValues.frontShare / 100) * 100, 0, 100),
      handbrakeTorque: Math.max(0, numberValue(data.HANDBRAKE_TORQUE, defaultValues.handbrakeTorque)),
      cockpitAdjustable: String(data.COCKPIT_ADJUSTABLE ?? '1').trim() !== '0',
      adjustStep: Math.max(0.1, numberValue(data.ADJUST_STEP, defaultValues.adjustStep)),
    };
    setContent(brakeContent);
    setValues(imported);
    setOriginalValues(imported);
    setLoaded(true);
    setMessage('brakes.ini cargado. Los cambios se agregarán a la descarga conjunta.');
  }, []);

  useEffect(() => {
    const receiveSharedDataFolder = event => loadDataFiles(event.detail?.files || []);
    window.addEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
    return () => window.removeEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
  }, [loadDataFiles]);

  const changed = Boolean(loaded && (
    numberValue(values.maxTorque) !== numberValue(originalValues.maxTorque)
    || numberValue(values.frontShare) !== numberValue(originalValues.frontShare)
    || numberValue(values.handbrakeTorque) !== numberValue(originalValues.handbrakeTorque)
    || Boolean(values.cockpitAdjustable) !== Boolean(originalValues.cockpitAdjustable)
    || numberValue(values.adjustStep) !== numberValue(originalValues.adjustStep)
  ));

  const buildContent = () => {
    let output = content;
    output = upsertIniValue(output, 'DATA', 'MAX_TORQUE', Math.round(Math.max(0, numberValue(values.maxTorque))), 'Par máximo de frenado');
    output = upsertIniValue(output, 'DATA', 'FRONT_SHARE', (clamp(numberValue(values.frontShare), 0, 100) / 100).toFixed(3), 'Reparto de frenada delantero');
    output = upsertIniValue(output, 'DATA', 'HANDBRAKE_TORQUE', Math.round(Math.max(0, numberValue(values.handbrakeTorque))), 'Par del freno de mano');
    output = upsertIniValue(output, 'DATA', 'COCKPIT_ADJUSTABLE', values.cockpitAdjustable ? 1 : 0, 'Permite regular el reparto desde el cockpit');
    output = upsertIniValue(output, 'DATA', 'ADJUST_STEP', Math.max(0.1, numberValue(values.adjustStep, 0.5)), 'Paso de ajuste del reparto');
    return output;
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cadpo:brakes-modified-files-change', {
      detail: { files: changed ? ['brakes.ini'] : [] },
    }));
  }, [changed]);

  useEffect(() => {
    const appendModifiedBrakes = event => {
      if (!changed || !Array.isArray(event.detail?.files)) return;
      event.detail.files.push({ name: 'brakes.ini', content: buildContent() });
    };
    window.addEventListener('cadpo:download-modified-brakes-files', appendModifiedBrakes);
    return () => window.removeEventListener('cadpo:download-modified-brakes-files', appendModifiedBrakes);
  });

  const updateValue = (field, value) => setValues(current => ({ ...current, [field]: value }));
  const restore = () => {
    setValues(originalValues);
    setMessage('Se restauraron los valores originales de brakes.ini.');
  };

  return (
    <section className="border-t border-racing-border pt-10">
      <header className="border-b border-racing-border pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">Assetto Corsa</p>
        <h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Frenos</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-400">Controlá la potencia, el reparto y el freno de mano desde los parámetros principales de brakes.ini.</p>
      </header>

      {loaded ? <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 border border-racing-border bg-racing-card p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          <label><span className="text-xs font-semibold text-gray-300">Potencia de frenado</span><div className="relative mt-1.5"><input type="number" min="0" step="50" value={values.maxTorque} onChange={event => updateValue('maxTorque', event.target.value)} className="input-field pr-12"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">NM</span></div><small className="mt-1 block text-[9px] text-gray-600">MAX_TORQUE</small></label>
          <label><span className="text-xs font-semibold text-gray-300">Reparto delantero</span><div className="relative mt-1.5"><input type="number" min="0" max="100" step="0.5" value={values.frontShare} onChange={event => updateValue('frontShare', event.target.value)} className="input-field pr-10"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">%</span></div><small className="mt-1 block text-[9px] text-gray-600">FRONT_SHARE</small></label>
          <label><span className="text-xs font-semibold text-gray-300">Freno de mano</span><div className="relative mt-1.5"><input type="number" min="0" step="50" value={values.handbrakeTorque} onChange={event => updateValue('handbrakeTorque', event.target.value)} className="input-field pr-12"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">NM</span></div><small className="mt-1 block text-[9px] text-gray-600">HANDBRAKE_TORQUE</small></label>
          <div className="grid gap-3 border-t border-racing-border pt-4 sm:col-span-2 sm:grid-cols-2 sm:items-end xl:col-span-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <label><span className="text-xs font-semibold text-gray-300">Paso del reparto</span><div className="relative mt-1.5"><input type="number" min="0.1" step="0.1" value={values.adjustStep} onChange={event => updateValue('adjustStep', event.target.value)} className="input-field pr-10"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">%</span></div><small className="mt-1 block text-[9px] text-gray-600">ADJUST_STEP</small></label>
            <label className={`flex min-h-[66px] cursor-pointer items-center justify-between gap-4 border px-4 py-3 transition-colors ${values.cockpitAdjustable ? 'border-amber-400/40 bg-amber-400/[0.06] text-amber-200' : 'border-racing-border bg-black/20 text-gray-500'}`}><span><strong className="block text-[10px] font-bold uppercase tracking-wide">Reparto ajustable en pista</strong><small className="mt-1 block text-[9px] font-normal text-gray-600">COCKPIT_ADJUSTABLE</small></span><input type="checkbox" checked={values.cockpitAdjustable} onChange={event => updateValue('cockpitAdjustable', event.target.checked)} className="h-5 w-5 shrink-0 accent-amber-400"/></label>
          </div>
        </div>

        <aside className="border border-racing-border bg-racing-card p-4">
          <div className="flex items-center gap-3"><AdjustmentsHorizontalIcon className="h-8 w-8 text-amber-400"/><div><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Distribución actual</p><h3 className="font-racing text-xl font-bold uppercase text-white">Balance de frenada</h3></div></div>
          <div className="mt-5 h-3 overflow-hidden bg-gray-800"><div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all" style={{ width: `${clamp(numberValue(values.frontShare), 0, 100)}%` }}/></div>
          <div className="mt-2 flex justify-between font-racing text-lg font-bold"><span className="text-amber-300">Delante {numberValue(values.frontShare).toLocaleString('es-AR')}%</span><span className="text-gray-400">Atrás {(100 - clamp(numberValue(values.frontShare), 0, 100)).toLocaleString('es-AR')}%</span></div>
          <button type="button" onClick={restore} className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 border border-racing-border text-[9px] font-bold uppercase text-gray-400 hover:border-amber-400 hover:text-white"><ArrowPathIcon className="h-4 w-4"/>Restaurar brakes.ini</button>
          {message ? <p className="mt-3 border-l-2 border-amber-400 pl-2 text-[10px] leading-relaxed text-gray-400">{message}</p> : null}
        </aside>
      </div> : <div className="mt-5 flex min-h-40 flex-col items-center justify-center border border-dashed border-racing-border bg-black/15 px-6 text-center"><AdjustmentsHorizontalIcon className="h-11 w-11 text-gray-700"/><h3 className="mt-3 font-racing text-xl font-bold uppercase text-gray-500">Frenos no disponibles</h3><p className="mt-1 text-xs text-gray-600">{message || 'Seleccioná una carpeta data que contenga brakes.ini.'}</p></div>}
    </section>
  );
}
