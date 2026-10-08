import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, CircleStackIcon } from '@heroicons/react/24/outline';

const numberValue = (value, fallback = 0) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
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

const readAxle = (section, data) => ({
  section,
  longitudinalKey: data.DX_REF !== undefined ? 'DX_REF' : 'DX0',
  lateralKey: data.DY_REF !== undefined ? 'DY_REF' : 'DY0',
  values: {
    radius: data.RADIUS ?? '',
    rimRadius: data.RIM_RADIUS ?? '',
    width: data.WIDTH ?? '',
    pressureStatic: data.PRESSURE_STATIC ?? '',
    pressureIdeal: data.PRESSURE_IDEAL ?? '',
    longitudinalGrip: data.DX_REF ?? data.DX0 ?? '',
    lateralGrip: data.DY_REF ?? data.DY0 ?? '',
    falloffLevel: data.FALLOFF_LEVEL ?? '',
    speedSensitivity: data.SPEED_SENSITIVITY ?? '',
  },
});

const buildCompounds = sections => [...sections.entries()]
  .filter(([name]) => /^FRONT(?:_\d+)?$/.test(name))
  .map(([frontSection, frontData], index) => {
    const suffix = frontSection.slice('FRONT'.length);
    const rearSection = `REAR${suffix}`;
    const rearData = sections.get(rearSection);
    return {
      id: suffix || '_0',
      label: frontData.NAME || rearData?.NAME || `Compuesto ${index + 1}`,
      front: readAxle(frontSection, frontData),
      rear: rearData ? readAxle(rearSection, rearData) : null,
    };
  });

const axleFields = [
  { key: 'radius', label: 'Radio exterior', unit: 'M', step: '0.001' },
  { key: 'rimRadius', label: 'Radio de llanta', unit: 'M', step: '0.001' },
  { key: 'width', label: 'Ancho', unit: 'M', step: '0.001' },
  { key: 'pressureStatic', label: 'Presión en frío', unit: 'PSI', step: '0.1' },
  { key: 'pressureIdeal', label: 'Presión ideal', unit: 'PSI', step: '0.1' },
  { key: 'longitudinalGrip', label: 'Agarre longitudinal', unit: '', step: '0.01' },
  { key: 'lateralGrip', label: 'Agarre lateral', unit: '', step: '0.01' },
  { key: 'falloffLevel', label: 'Agarre pasado el límite', unit: '', step: '0.01' },
  { key: 'speedSensitivity', label: 'Sensibilidad a velocidad', unit: '', step: '0.0001' },
];

export default function TyresCalculator() {
  const [content, setContent] = useState('');
  const [compounds, setCompounds] = useState([]);
  const [originalCompounds, setOriginalCompounds] = useState([]);
  const [selectedCompoundId, setSelectedCompoundId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  const loadDataFiles = useCallback(async selectedFiles => {
    const tyreFile = [...(selectedFiles || [])].find(file => file.name.toLocaleLowerCase() === 'tyres.ini');
    if (!tyreFile) {
      setLoaded(false);
      setCompounds([]);
      setMessage('La carpeta seleccionada no contiene tyres.ini.');
      return;
    }
    const tyreContent = await tyreFile.text();
    const imported = buildCompounds(parseIniSections(tyreContent));
    if (!imported.length) {
      setLoaded(false);
      setCompounds([]);
      setMessage('tyres.ini no contiene secciones FRONT compatibles.');
      return;
    }
    setContent(tyreContent);
    setCompounds(imported);
    setOriginalCompounds(JSON.parse(JSON.stringify(imported)));
    setSelectedCompoundId(imported[0].id);
    setLoaded(true);
    setMessage(`${imported.length} compuesto${imported.length === 1 ? '' : 's'} detectado${imported.length === 1 ? '' : 's'}.`);
  }, []);

  useEffect(() => {
    const receiveSharedDataFolder = event => loadDataFiles(event.detail?.files || []);
    window.addEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
    return () => window.removeEventListener('cadpo:assetto-data-folder', receiveSharedDataFolder);
  }, [loadDataFiles]);

  useEffect(() => {
    const syncGearDiameter = event => {
      const section = String(event.detail?.section || '').toUpperCase();
      const diameter = numberValue(event.detail?.diameter);
      if (!section || !diameter) return;
      setCompounds(current => current.map(compound => {
        const axleKey = compound.front.section === section ? 'front' : compound.rear?.section === section ? 'rear' : '';
        if (!axleKey) return compound;
        return { ...compound, [axleKey]: { ...compound[axleKey], values: { ...compound[axleKey].values, radius: (diameter / 2000).toFixed(4) } } };
      }));
    };
    window.addEventListener('cadpo:gear-wheel-diameter-change', syncGearDiameter);
    return () => window.removeEventListener('cadpo:gear-wheel-diameter-change', syncGearDiameter);
  }, []);

  const changed = loaded && JSON.stringify(compounds) !== JSON.stringify(originalCompounds);
  const selectedCompound = useMemo(() => compounds.find(compound => compound.id === selectedCompoundId) || compounds[0] || null, [compounds, selectedCompoundId]);

  const updateAxle = (compoundId, axleKey, field, value) => {
    setCompounds(current => current.map(compound => compound.id === compoundId
      ? { ...compound, [axleKey]: { ...compound[axleKey], values: { ...compound[axleKey].values, [field]: value } } }
      : compound));
    if (field === 'radius') {
      const compound = compounds.find(item => item.id === compoundId);
      const section = compound?.[axleKey]?.section;
      if (section) window.dispatchEvent(new CustomEvent('cadpo:tyre-radius-change', { detail: { section, radius: value } }));
    }
  };

  const buildContent = () => {
    let output = content;
    compounds.forEach(compound => ['front', 'rear'].forEach(axleKey => {
      const axle = compound[axleKey];
      if (!axle) return;
      const entries = {
        RADIUS: axle.values.radius,
        RIM_RADIUS: axle.values.rimRadius,
        WIDTH: axle.values.width,
        PRESSURE_STATIC: axle.values.pressureStatic,
        PRESSURE_IDEAL: axle.values.pressureIdeal,
        [axle.longitudinalKey]: axle.values.longitudinalGrip,
        [axle.lateralKey]: axle.values.lateralGrip,
        FALLOFF_LEVEL: axle.values.falloffLevel,
        SPEED_SENSITIVITY: axle.values.speedSensitivity,
      };
      Object.entries(entries).forEach(([key, value]) => {
        if (String(value).trim() !== '') output = upsertIniValue(output, axle.section, key, String(value).replace(',', '.'));
      });
    }));
    return output;
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cadpo:tyres-modified-files-change', { detail: { files: changed ? ['tyres.ini'] : [] } }));
  }, [changed]);

  useEffect(() => {
    const appendModifiedTyres = event => {
      if (!changed || !Array.isArray(event.detail?.files)) return;
      event.detail.files.push({ name: 'tyres.ini', content: buildContent() });
    };
    window.addEventListener('cadpo:download-modified-tyres-files', appendModifiedTyres);
    return () => window.removeEventListener('cadpo:download-modified-tyres-files', appendModifiedTyres);
  });

  const restore = () => {
    const restored = JSON.parse(JSON.stringify(originalCompounds));
    setCompounds(restored);
    restored.forEach(compound => ['front', 'rear'].forEach(axleKey => {
      const axle = compound[axleKey];
      if (axle?.values.radius) window.dispatchEvent(new CustomEvent('cadpo:tyre-radius-change', {
        detail: { section: axle.section, radius: axle.values.radius },
      }));
    }));
    setMessage('Se restauraron los valores originales de tyres.ini.');
  };

  const renderAxle = (axle, axleKey, title) => axle ? <article className="border border-racing-border bg-racing-card p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{axle.section}</p><h3 className="font-racing text-xl font-bold uppercase text-white">{title}</h3></div><CircleStackIcon className={`h-8 w-8 ${axleKey === 'front' ? 'text-sky-300' : 'text-violet-300'}`}/></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{axleFields.map(field => <label key={field.key}><span className="text-[10px] font-semibold text-gray-400">{field.label}</span><div className="relative mt-1"><input type="number" step={field.step} value={axle.values[field.key]} onChange={event => updateAxle(selectedCompound.id, axleKey, field.key, event.target.value)} className="input-field pr-11 text-sm"/>{field.unit ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-bold text-gray-600">{field.unit}</span> : null}</div></label>)}</div>
  </article> : null;

  return <section className="border-t border-racing-border pt-10">
    <header className="border-b border-racing-border pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Assetto Corsa</p><h2 className="mt-1 font-racing text-3xl font-bold uppercase text-white">Neumáticos</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-gray-400">Los neumáticos determinan buena parte del agarre, la respuesta, la temperatura, el desgaste y el comportamiento al superar el límite.</p></header>
    {loaded && selectedCompound ? <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 border border-sky-400/25 bg-sky-400/[0.04] p-4 sm:flex-row sm:items-end sm:justify-between"><label className="sm:w-80"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Compuesto</span><select value={selectedCompound.id} onChange={event => setSelectedCompoundId(event.target.value)} className="input-field mt-1.5">{compounds.map((compound, index) => <option key={compound.id} value={compound.id}>{index + 1}. {compound.label}</option>)}</select></label><button type="button" onClick={restore} className="inline-flex h-10 items-center justify-center gap-2 border border-racing-border px-4 text-[9px] font-bold uppercase text-gray-400 hover:border-sky-300 hover:text-white"><ArrowPathIcon className="h-4 w-4"/>Restaurar tyres.ini</button></div>
      <div className="grid gap-4 2xl:grid-cols-2">{renderAxle(selectedCompound.front, 'front', 'Eje delantero')}{renderAxle(selectedCompound.rear, 'rear', 'Eje trasero')}</div>
      <p className="border-l-2 border-yellow-400 bg-yellow-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-yellow-100/70">Cambiar radio, agarre o presiones puede alterar notablemente el balance y los tiempos. Probá los cambios de forma gradual y verificá temperaturas y desgaste en pista.</p>
      {message ? <p className="text-[10px] text-gray-500">{message}</p> : null}
    </div> : <div className="mt-5 border border-dashed border-racing-border bg-black/15 px-6 py-12 text-center text-sm text-gray-600">{message || 'Seleccioná una carpeta data que contenga tyres.ini.'}</div>}
  </section>;
}
