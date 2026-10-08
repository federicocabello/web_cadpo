import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

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

const upsertIniValue = (content, section, key, value) => {
  const replaced = replaceIniValue(content, section, key, value);
  if (replaced.replaced) return replaced.content;
  const newline = String(content || '').includes('\r\n') ? '\r\n' : '\n';
  const lines = String(content || '').split(/\r?\n/);
  const sectionIndex = lines.findIndex(line => line.trim().toUpperCase() === `[${section.toUpperCase()}]`);
  if (sectionIndex < 0) return content;
  let insertionIndex = sectionIndex + 1;
  while (insertionIndex < lines.length && !/^\s*\[[^\]]+]\s*$/.test(lines[insertionIndex])) insertionIndex += 1;
  lines.splice(insertionIndex, 0, `${key}=${value}`);
  return lines.join(newline);
};

const controlledFields = [
  { key: 'SPRING_RATE', label: 'Rigidez de resorte', unit: 'N/M', step: '100' },
  { key: 'PROGRESSIVE_SPRING_RATE', label: 'Progresividad', unit: 'N/M', step: '100' },
  { key: 'BUMP_STOP_RATE', label: 'Rigidez bump stop', unit: 'N/M', step: '100' },
  { key: 'DAMP_BUMP', label: 'Compresión lenta', unit: 'NS/M', step: '50' },
  { key: 'DAMP_REBOUND', label: 'Rebote lento', unit: 'NS/M', step: '50' },
  { key: 'DAMP_FAST_BUMP', label: 'Compresión rápida', unit: 'NS/M', step: '50' },
  { key: 'DAMP_FAST_REBOUND', label: 'Rebote rápido', unit: 'NS/M', step: '50' },
  { key: 'STATIC_CAMBER', label: 'Camber estático', unit: '°', step: '0.1' },
  { key: 'TOE_OUT', label: 'Convergencia', unit: 'RAD', step: '0.0001' },
];

const readAxle = (sections, name) => {
  const data = sections.get(name);
  if (!data) return null;
  return { section: name, values: Object.fromEntries(controlledFields.map(field => [field.key, data[field.key] ?? ''])) };
};

export default function SuspensionCalculator() {
  const [content, setContent] = useState('');
  const [axles, setAxles] = useState({ front: null, rear: null });
  const [originalAxles, setOriginalAxles] = useState({ front: null, rear: null });
  const [arb, setArb] = useState({ front: '', rear: '' });
  const [originalArb, setOriginalArb] = useState({ front: '', rear: '' });
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  const loadDataFiles = useCallback(async selectedFiles => {
    const suspensionFile = [...(selectedFiles || [])].find(file => file.name.toLocaleLowerCase() === 'suspensions.ini');
    if (!suspensionFile) {
      setLoaded(false);
      setMessage('La carpeta seleccionada no contiene suspensions.ini.');
      return;
    }
    const suspensionContent = await suspensionFile.text();
    const sections = parseIniSections(suspensionContent);
    const importedAxles = { front: readAxle(sections, 'FRONT'), rear: readAxle(sections, 'REAR') };
    if (!importedAxles.front && !importedAxles.rear) {
      setLoaded(false);
      setMessage('No se encontraron secciones FRONT o REAR compatibles en suspensions.ini.');
      return;
    }
    const arbData = sections.get('ARB') || {};
    const importedArb = { front: arbData.FRONT ?? '', rear: arbData.REAR ?? '' };
    setContent(suspensionContent);
    setAxles(importedAxles);
    setOriginalAxles(JSON.parse(JSON.stringify(importedAxles)));
    setArb(importedArb);
    setOriginalArb(importedArb);
    setLoaded(true);
    setMessage('Solo se editan resortes, amortiguadores, barras, camber y convergencia; la geometría permanece intacta.');
  }, []);

  useEffect(() => {
    const receiveSharedDataFolder = event => loadDataFiles(event.detail?.files || []);
    window.addEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
    return () => window.removeEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
  }, [loadDataFiles]);

  const changed = Boolean(loaded && (
    JSON.stringify(axles) !== JSON.stringify(originalAxles)
    || JSON.stringify(arb) !== JSON.stringify(originalArb)
  ));

  const updateAxle = (axleKey, field, value) => setAxles(current => ({
    ...current,
    [axleKey]: { ...current[axleKey], values: { ...current[axleKey].values, [field]: value } },
  }));

  const buildContent = () => {
    let output = content;
    ['front', 'rear'].forEach(axleKey => {
      const axle = axles[axleKey];
      if (!axle) return;
      Object.entries(axle.values).forEach(([key, value]) => {
        if (String(value).trim() !== '') output = upsertIniValue(output, axle.section, key, String(value).replace(',', '.'));
      });
    });
    if (String(arb.front).trim() !== '') output = upsertIniValue(output, 'ARB', 'FRONT', String(arb.front).replace(',', '.'));
    if (String(arb.rear).trim() !== '') output = upsertIniValue(output, 'ARB', 'REAR', String(arb.rear).replace(',', '.'));
    return output;
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cadpo:suspension-modified-files-change', { detail: { files: changed ? ['suspensions.ini'] : [] } }));
  }, [changed]);

  useEffect(() => {
    const appendModifiedSuspension = event => {
      if (!changed || !Array.isArray(event.detail?.files)) return;
      event.detail.files.push({ name: 'suspensions.ini', content: buildContent() });
    };
    window.addEventListener('cadpo:download-modified-suspension-files', appendModifiedSuspension);
    return () => window.removeEventListener('cadpo:download-modified-suspension-files', appendModifiedSuspension);
  });

  const restore = () => {
    setAxles(JSON.parse(JSON.stringify(originalAxles)));
    setArb(originalArb);
    setMessage('Se restauraron los valores originales de suspensions.ini.');
  };

  const renderAxle = (axle, axleKey, title) => axle ? <article className="border border-racing-border bg-racing-card p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{axle.section}</p><h3 className="font-racing text-xl font-bold uppercase text-white">{title}</h3></div><ArrowsUpDownIcon className={`h-8 w-8 ${axleKey === 'front' ? 'text-emerald-300' : 'text-fuchsia-300'}`}/></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{controlledFields.map(field => <label key={field.key}><span className="text-[10px] font-semibold text-gray-400">{field.label}</span><div className="relative mt-1"><input type="number" step={field.step} value={axle.values[field.key]} onChange={event => updateAxle(axleKey, field.key, event.target.value)} placeholder="No definido" className="input-field pr-12 text-sm"/><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-bold text-gray-600">{field.unit}</span></div></label>)}</div>
  </article> : null;

  return <section className="border-t border-racing-border pt-10">
    <header className="border-b border-racing-border pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Assetto Corsa</p><h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Suspensión</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-400">Ajustá la rigidez, amortiguación y balance sin modificar distancia entre ejes, vías ni puntos de anclaje del modelo.</p></header>
    {loaded ? <div className="mt-5 space-y-4">
      <div className="grid gap-4 2xl:grid-cols-2">{renderAxle(axles.front, 'front', 'Eje delantero')}{renderAxle(axles.rear, 'rear', 'Eje trasero')}</div>
      <div className="flex flex-col gap-4 border border-racing-border bg-racing-card p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5"><div><p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Barras estabilizadoras</p><div className="mt-2 grid grid-cols-2 gap-3"><label><span className="text-[10px] text-gray-500">Delantera</span><input type="number" step="100" value={arb.front} onChange={event => setArb(current => ({ ...current, front: event.target.value }))} className="input-field mt-1" placeholder="No definida"/></label><label><span className="text-[10px] text-gray-500">Trasera</span><input type="number" step="100" value={arb.rear} onChange={event => setArb(current => ({ ...current, rear: event.target.value }))} className="input-field mt-1" placeholder="No definida"/></label></div></div><button type="button" onClick={restore} className="inline-flex h-10 items-center justify-center gap-2 border border-racing-border px-4 text-[9px] font-bold uppercase text-gray-400 hover:border-emerald-300 hover:text-white"><ArrowPathIcon className="h-4 w-4"/>Restaurar suspensions.ini</button></div>
      <p className="border-l-2 border-emerald-400 bg-emerald-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-gray-400">{message}</p>
    </div> : <div className="mt-5 border border-dashed border-racing-border bg-black/15 px-6 py-12 text-center text-sm text-gray-600">{message || 'Seleccioná una carpeta data que contenga suspensions.ini.'}</div>}
  </section>;
}
