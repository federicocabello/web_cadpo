import { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveBoxIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, PaintBrushIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { templatesApi } from '../services/api';

const maxFileSize = 100 * 1024 * 1024;
const maxFilesPerUpload = 15;

const formatFileSize = bytes => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.ceil(size / 1024).toLocaleString('es-AR')} KB`;
};

const parseDeadline = value => value ? new Date(String(value).replace(' ', 'T')) : null;

const formatDeadline = value => {
  const date = parseDeadline(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('es-AR', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date).toUpperCase();
  const time = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${day} ${month} a las ${time} H`;
};

const getCountdownParts = (deadline, now) => {
  const end = parseDeadline(deadline)?.getTime();
  const difference = Number(end) - now;
  if (!Number.isFinite(difference) || difference <= 0) return [];
  const totalMinutes = Math.max(1, Math.ceil(difference / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} DÍA${days === 1 ? '' : 'S'}` : '',
    hours ? `${hours} HORA${hours === 1 ? '' : 'S'}` : '',
    minutes ? `${minutes} MINUTO${minutes === 1 ? '' : 'S'}` : '',
  ].filter(Boolean);
};

const readFourCC = (view, offset) => String.fromCharCode(
  view.getUint8(offset),
  view.getUint8(offset + 1),
  view.getUint8(offset + 2),
  view.getUint8(offset + 3)
);

const unpackRgb565 = value => [
  Math.round(((value >> 11) & 31) * 255 / 31),
  Math.round(((value >> 5) & 63) * 255 / 63),
  Math.round((value & 31) * 255 / 31),
  255,
];

const buildBcPalette = (color0, color1, allowTransparency) => {
  const first = unpackRgb565(color0);
  const second = unpackRgb565(color1);
  if (allowTransparency && color0 <= color1) {
    return [first, second, [
      Math.round((first[0] + second[0]) / 2),
      Math.round((first[1] + second[1]) / 2),
      Math.round((first[2] + second[2]) / 2),
      255,
    ], [0, 0, 0, 0]];
  }
  return [first, second, [
    Math.round((2 * first[0] + second[0]) / 3),
    Math.round((2 * first[1] + second[1]) / 3),
    Math.round((2 * first[2] + second[2]) / 3),
    255,
  ], [
    Math.round((first[0] + 2 * second[0]) / 3),
    Math.round((first[1] + 2 * second[1]) / 3),
    Math.round((first[2] + 2 * second[2]) / 3),
    255,
  ]];
};

const extractMaskedChannel = (value, rawMask, fallback = 0) => {
  const mask = rawMask >>> 0;
  if (!mask) return fallback;
  let shift = 0;
  while (shift < 32 && ((mask >>> shift) & 1) === 0) shift += 1;
  let bits = 0;
  while (shift + bits < 32 && ((mask >>> (shift + bits)) & 1) === 1) bits += 1;
  const maximum = (2 ** bits) - 1;
  return maximum ? Math.round((((value & mask) >>> shift) * 255) / maximum) : fallback;
};

const decodeDdsToDataUrl = async blob => {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 128 || view.getUint32(0, true) !== 0x20534444) throw new Error('DDS inválido');
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  if (!width || !height || width > 16384 || height > 16384) throw new Error('Dimensiones DDS inválidas');

  const pixelFlags = view.getUint32(80, true);
  let fourCC = readFourCC(view, 84);
  let dataOffset = 128;
  if (fourCC === 'DX10') {
    if (view.byteLength < 148) throw new Error('Cabecera DDS incompleta');
    const dxgiFormat = view.getUint32(128, true);
    fourCC = [71, 72].includes(dxgiFormat) ? 'DXT1' : [74, 75].includes(dxgiFormat) ? 'DXT3' : [77, 78].includes(dxgiFormat) ? 'DXT5' : 'DX10';
    dataOffset = 148;
  }

  const previewScale = Math.min(1, 512 / width, 512 / height);
  const outputWidth = Math.max(1, Math.round(width * previewScale));
  const outputHeight = Math.max(1, Math.round(height * previewScale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear la vista previa');
  const image = context.createImageData(outputWidth, outputHeight);
  const compressed = ['DXT1', 'DXT3', 'DXT5'].includes(fourCC);
  const blockBytes = fourCC === 'DXT1' ? 8 : 16;
  const blocksWide = Math.ceil(width / 4);
  const rgbBits = view.getUint32(88, true);
  const bytesPerPixel = Math.ceil(rgbBits / 8);
  const masks = [92, 96, 100, 104].map(offset => view.getUint32(offset, true));

  for (let y = 0; y < outputHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y * height / outputHeight));
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x * width / outputWidth));
      let rgba;
      if (compressed) {
        const blockX = Math.floor(sourceX / 4);
        const blockY = Math.floor(sourceY / 4);
        const blockOffset = dataOffset + ((blockY * blocksWide + blockX) * blockBytes);
        if (blockOffset + blockBytes > view.byteLength) throw new Error('Datos DDS incompletos');
        const colorOffset = blockOffset + (fourCC === 'DXT1' ? 0 : 8);
        const color0 = view.getUint16(colorOffset, true);
        const color1 = view.getUint16(colorOffset + 2, true);
        const colorBits = view.getUint32(colorOffset + 4, true);
        const pixelIndex = ((sourceY % 4) * 4) + (sourceX % 4);
        rgba = [...buildBcPalette(color0, color1, fourCC === 'DXT1')[(colorBits >>> (pixelIndex * 2)) & 3]];
        if (fourCC === 'DXT3') {
          const alphaRow = view.getUint16(blockOffset + ((sourceY % 4) * 2), true);
          rgba[3] = ((alphaRow >>> ((sourceX % 4) * 4)) & 15) * 17;
        } else if (fourCC === 'DXT5') {
          const alpha0 = view.getUint8(blockOffset);
          const alpha1 = view.getUint8(blockOffset + 1);
          const alphaPalette = alpha0 > alpha1
            ? [alpha0, alpha1, ...Array.from({ length: 6 }, (_, index) => Math.round(((6 - index) * alpha0 + (index + 1) * alpha1) / 7))]
            : [alpha0, alpha1, ...Array.from({ length: 4 }, (_, index) => Math.round(((4 - index) * alpha0 + (index + 1) * alpha1) / 5)), 0, 255];
          let alphaBits = 0n;
          for (let index = 0; index < 6; index += 1) alphaBits |= BigInt(view.getUint8(blockOffset + 2 + index)) << BigInt(index * 8);
          rgba[3] = alphaPalette[Number((alphaBits >> BigInt(pixelIndex * 3)) & 7n)];
        }
      } else if ((pixelFlags & 0x40) && [3, 4].includes(bytesPerPixel)) {
        const pixelOffset = dataOffset + ((sourceY * width + sourceX) * bytesPerPixel);
        if (pixelOffset + bytesPerPixel > view.byteLength) throw new Error('Datos DDS incompletos');
        let value = 0;
        for (let index = 0; index < bytesPerPixel; index += 1) value = (value | (view.getUint8(pixelOffset + index) << (index * 8))) >>> 0;
        rgba = [
          extractMaskedChannel(value, masks[0]),
          extractMaskedChannel(value, masks[1]),
          extractMaskedChannel(value, masks[2]),
          extractMaskedChannel(value, masks[3], 255),
        ];
      } else {
        throw new Error(`Formato DDS ${fourCC.trim() || 'desconocido'} no compatible`);
      }
      image.data.set(rgba, ((y * outputWidth) + x) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};

function PaintingPreviewImage({ file, source, extension, alt }) {
  const normalizedExtension = String(extension || file?.name?.split('.').pop() || '').replace('.', '').toLowerCase();
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreviewUrl('');
    setPreviewFailed(false);
    if (!['dds', 'png', 'jpg', 'jpeg', 'bmp'].includes(normalizedExtension)) return undefined;

    const loadPreview = async () => {
      if (normalizedExtension === 'dds') {
        const blob = file || await fetch(source, { credentials: 'same-origin' }).then(response => {
          if (!response.ok) throw new Error('No se pudo obtener el DDS');
          return response.blob();
        });
        const ddsUrl = await decodeDdsToDataUrl(blob);
        if (active) setPreviewUrl(ddsUrl);
        return;
      }
      if (file) {
        objectUrl = URL.createObjectURL(file);
        if (active) setPreviewUrl(objectUrl);
      } else if (active) setPreviewUrl(source);
    };
    loadPreview().catch(() => {
      if (active) {
        setPreviewUrl('');
        setPreviewFailed(true);
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, normalizedExtension, source]);

  return previewUrl ? <img src={previewUrl} alt={alt} className="aspect-square w-full bg-[linear-gradient(45deg,#151515_25%,transparent_25%),linear-gradient(-45deg,#151515_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151515_75%),linear-gradient(-45deg,transparent_75%,#151515_75%)] bg-[length:16px_16px] object-contain"/> : <div className="flex aspect-square items-center justify-center bg-black/30"><div className="text-center"><ArchiveBoxIcon className="mx-auto h-9 w-9 text-cyan-300"/><strong className="mt-2 block font-racing text-base text-white">{normalizedExtension.toUpperCase() || 'ARCHIVO'}</strong><span className="mt-1 block text-[9px] uppercase text-gray-600">{previewFailed ? 'Vista previa no disponible' : 'Generando vista previa…'}</span></div></div>;
}

function SelectedFilePreview({ file }) {
  const extensionLabel = file.name.split('.').pop()?.toUpperCase() || 'ARCHIVO';
  const previewable = /\.(dds|png|jpe?g|bmp)$/i.test(file.name);

  return (
    <article className="min-w-0 overflow-hidden border border-cyan-300/25 bg-black/25">
      {previewable ? <PaintingPreviewImage file={file} extension={extensionLabel} alt={'Vista previa de ' + file.name}/> : null}
      {!previewable ? <div className="flex aspect-square items-center justify-center bg-black/30"><div className="text-center"><ArchiveBoxIcon className="mx-auto h-9 w-9 text-cyan-300"/><strong className="mt-2 block font-racing text-base text-white">{extensionLabel}</strong><span className="mt-1 block text-[9px] uppercase text-gray-600">Vista previa no disponible</span></div></div> : null}
      <div className="p-2.5"><p className="truncate text-xs text-gray-200" title={file.name}>{file.name}</p><p className="mt-1 text-[9px] uppercase text-gray-600">{formatFileSize(file.size)}</p></div>
    </article>
  );
}

export default function Templates() {
  const inputRef = useRef(null);
  const [championships, setChampionships] = useState([]);
  const [championshipId, setChampionshipId] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [files, setFiles] = useState([]);
  const [submittedFiles, setSubmittedFiles] = useState([]);
  const [loadingSubmittedFiles, setLoadingSubmittedFiles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!uploading) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [uploading]);

  useEffect(() => {
    templatesApi.getChampionships()
      .then(response => {
        const rows = response.data.data || [];
        setChampionships(rows);
        setChampionshipId(rows[0]?.idcampeonato ? String(rows[0].idcampeonato) : '');
      })
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudo cargar la sección de pinturas.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedChampionship = useMemo(
    () => championships.find(item => String(item.idcampeonato) === championshipId) || null,
    [championshipId, championships]
  );
  const deadlineTime = parseDeadline(selectedChampionship?.fecha_cierre)?.getTime();
  const deliveryOpen = Boolean(Number.isFinite(deadlineTime) && deadlineTime > now);
  const countdownParts = getCountdownParts(selectedChampionship?.fecha_cierre, now);
  const submittedDriverId = driverId;

  useEffect(() => {
    setDriverId('');
    setFiles([]);
    setMessage('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    if (!championshipId || !deliveryOpen) {
      setDrivers([]);
      return;
    }
    let active = true;
    setLoadingDrivers(true);
    templatesApi.getEnrolledDrivers(championshipId)
      .then(response => { if (active) setDrivers(response.data.data || []); })
      .catch(requestError => { if (active) setError(requestError.response?.data?.error || 'No se pudieron cargar los pilotos inscriptos.'); })
      .finally(() => { if (active) setLoadingDrivers(false); });
    return () => { active = false; };
  }, [championshipId, deliveryOpen]);

  useEffect(() => {
    if (!championshipId || !submittedDriverId || !deliveryOpen) {
      setSubmittedFiles([]);
      return;
    }
    let active = true;
    setLoadingSubmittedFiles(true);
    templatesApi.getSubmittedPaintings(championshipId, submittedDriverId)
      .then(response => { if (active) setSubmittedFiles(response.data.data || []); })
      .catch(() => { if (active) setSubmittedFiles([]); })
      .finally(() => { if (active) setLoadingSubmittedFiles(false); });
    return () => { active = false; };
  }, [championshipId, deliveryOpen, submittedDriverId]);

  const selectFiles = event => {
    const selected = Array.from(event.target.files || []);
    const combined = [...files, ...selected];
    event.target.value = '';
    if (combined.length > maxFilesPerUpload) {
      setError(`Podés enviar hasta ${maxFilesPerUpload} archivos por carga. Ya tenés ${files.length} seleccionado${files.length === 1 ? '' : 's'}.`);
      return;
    }
    const oversized = combined.find(file => file.size > maxFileSize);
    if (oversized) {
      setError(`${oversized.name} supera el máximo de 100 MB.`);
      return;
    }
    const normalizedNames = combined.map(file => file.name.trim().toLocaleLowerCase('es-AR'));
    if (normalizedNames.some((name, index) => normalizedNames.indexOf(name) !== index)) {
      setError('No podés seleccionar dos archivos con el mismo nombre.');
      return;
    }
    const submittedNames = new Set(submittedFiles.map(file => String(file.nombre_original || '').trim().toLocaleLowerCase('es-AR')));
    const duplicate = selected.find(file => submittedNames.has(file.name.trim().toLocaleLowerCase('es-AR')));
    if (duplicate) {
      setError(`Ya existe un archivo llamado "${duplicate.name}" para este piloto.`);
      return;
    }
    setError('');
    setMessage('');
    setFiles(combined);
  };

  const submitPaintings = async event => {
    event.preventDefault();
    if (!championshipId || !driverId || !files.length || uploading) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      data.append('idcampeonato', championshipId);
      data.append('idpiloto', driverId);
      files.forEach(file => data.append('archivos', file));
      const response = await templatesApi.uploadPaintings(data, progressEvent => {
        const ratio = progressEvent.progress ?? (progressEvent.total ? progressEvent.loaded / progressEvent.total : 0);
        setProgress(Math.min(100, Math.max(0, Math.round(ratio * 100))));
      });
      setProgress(100);
      const refreshed = await templatesApi.getSubmittedPaintings(championshipId, submittedDriverId);
      setSubmittedFiles(refreshed.data.data || []);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      setMessage(response.data.message || 'Archivos enviados correctamente.');
    } catch (requestError) {
      setError(requestError.response?.status === 413
        ? 'Uno de los archivos supera el máximo permitido de 100 MB.'
        : requestError.response?.data?.error || 'No se pudieron enviar los archivos.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-7xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-racing-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Diseños de competición</p>
          <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Pinturas</h1>
          <p className="mt-2 max-w-2xl text-gray-400">Descargá las plantillas del campeonato y entregá los archivos terminados de tu auto.</p>
        </div>
        {!loading && championships.length ? <label className="w-full shrink-0 md:w-96"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={championshipId} onChange={event => setChampionshipId(event.target.value)} className="input-field mt-1.5 py-2.5 text-sm">{championships.map(item => <option key={item.idcampeonato} value={item.idcampeonato}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label> : null}
      </header>

      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent"/></div> : error && !selectedChampionship ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">{error}</div> : !selectedChampionship ? <div className="mt-8 border border-dashed border-racing-border py-16 text-center"><PaintBrushIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">No hay campeonatos cargados</h2></div> : <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="card-glass p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-24 shrink-0 items-center justify-center text-cyan-300">{selectedChampionship.categoria_logo ? <img src={selectedChampionship.categoria_logo} alt={`Logo ${selectedChampionship.categoria}`} className="h-20 w-24 object-contain"/> : <TrophyIcon className="h-10 w-10"/>}</div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{selectedChampionship.categoria}</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Temporada {selectedChampionship.temporada} · {selectedChampionship.anio}</h2></div>
          </div>
          <div className="mt-6 border-t border-racing-border pt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Plantilla oficial</p>
            {selectedChampionship.plantilla_id ? <><p className="mt-2 truncate text-sm text-gray-300">{selectedChampionship.plantilla_nombre}</p><p className="mt-1 text-xs text-gray-600">ZIP · {formatFileSize(selectedChampionship.plantilla_tamano)}</p><a href={`/api/templates/${selectedChampionship.plantilla_id}/download`} className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-racing text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-cyan-200"><ArrowDownTrayIcon className="h-5 w-5"/>Descargar plantillas</a></> : <div className="mt-3 border border-dashed border-racing-border p-5 text-center text-sm text-gray-500">Este campeonato todavía no tiene un ZIP de plantillas publicado.</div>}
          </div>
        </section>

        <section className="card-glass p-5 sm:p-6">
          <div className="flex items-start gap-3"><PaintBrushIcon className="mt-0.5 h-7 w-7 shrink-0 text-cyan-300"/><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Entrega del piloto</p><h2 className="mt-1 font-racing text-2xl font-bold uppercase text-white">Subir archivos de pintura</h2></div></div>
          {selectedChampionship.fecha_cierre ? <div className={`mt-5 border px-4 py-3 ${deliveryOpen ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-yellow-400/30 bg-yellow-400/10'}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className={`text-[10px] font-bold uppercase tracking-widest ${deliveryOpen ? 'text-cyan-300' : 'text-yellow-300'}`}>{deliveryOpen ? 'La entrega cierra en' : 'Plazo de entrega finalizado'}</p><p className="mt-1 text-xs text-gray-400">{deliveryOpen ? 'Cierra' : 'Cerró'} {formatDeadline(selectedChampionship.fecha_cierre)}</p></div>{deliveryOpen ? <div className="flex flex-wrap gap-2">{countdownParts.map(part => <span key={part} className="bg-cyan-300 px-2.5 py-1 font-racing text-sm font-bold text-black">{part}</span>)}</div> : null}</div></div> : null}
          {!deliveryOpen ? <div className="mt-6 border border-yellow-400/30 bg-yellow-400/10 p-5 text-center"><ArchiveBoxIcon className="mx-auto h-9 w-9 text-yellow-300"/><p className="mt-3 font-racing text-lg font-bold uppercase text-white">La entrega está cerrada</p></div> : <form onSubmit={submitPaintings} className="mt-6 space-y-4">
            <label className="block"><span className="text-sm text-gray-300">Piloto inscripto</span><select value={driverId} onChange={event => setDriverId(event.target.value)} disabled={loadingDrivers} className="input-field mt-2" required><option value="">{loadingDrivers ? 'Cargando pilotos…' : 'Seleccionar piloto'}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>#{driver.numero ?? 0} · {driver.nombre}</option>)}</select><small className="mt-1 block text-gray-500">Seleccioná tu nombre. Incluye inscripciones confirmadas y pendientes de pago.</small></label>
            <label className="block"><span className="text-sm text-gray-300">Archivos terminados</span><span className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-racing-border bg-black/25 px-4 text-center transition hover:border-cyan-300"><ArrowUpTrayIcon className="h-7 w-7 text-cyan-300"/><span className="mt-2 text-sm text-gray-300">{files.length ? `${files.length} archivo${files.length === 1 ? '' : 's'} seleccionado${files.length === 1 ? '' : 's'} · agregar más` : 'Seleccionar archivos'}</span><span className="mt-1 text-[10px] uppercase text-gray-600">DDS, PNG, JPG, BMP, ZIP o RAR · máximo 100 MB por archivo · hasta 15 por carga</span></span><input ref={inputRef} type="file" multiple accept=".dds,.png,.jpg,.jpeg,.bmp,.zip,.rar,image/png,image/jpeg,image/bmp,application/zip,application/x-rar-compressed" onChange={selectFiles} className="sr-only"/></label>
            {files.length ? <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Vista previa antes de enviar</p><span className="text-[10px] text-gray-500">{files.length} archivo{files.length === 1 ? '' : 's'}</span></div><div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">{files.map(file => <SelectedFilePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file}/>)}</div></div> : null}
            <button type="submit" disabled={uploading || !driverId || !files.length} className="inline-flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-racing text-sm font-bold uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{uploading ? `Subiendo ${progress}%` : 'Enviar pinturas'}</button>
            {uploading ? <div className="h-2 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }}/></div> : null}
          </form>}
          {message ? <p className="mt-4 flex items-center gap-2 border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-200"><CheckCircleIcon className="h-5 w-5 shrink-0"/>{message}</p> : null}
          {error ? <p className="mt-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {deliveryOpen && submittedDriverId ? <div className="mt-6 border-t border-racing-border pt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Archivos entregados</p><h3 className="mt-1 font-racing text-lg font-bold uppercase text-white">Pinturas del piloto</h3></div><span className="text-xs text-gray-500">{submittedFiles.length} archivo{submittedFiles.length === 1 ? '' : 's'}</span></div>{loadingSubmittedFiles ? <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent"/></div> : submittedFiles.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{submittedFiles.map(file => { const extension = String(file.extension || '').toLowerCase(); const previewable = ['.dds', '.png', '.jpg', '.jpeg', '.bmp'].includes(extension); const extensionLabel = extension.replace('.', '').toUpperCase() || 'ARCHIVO'; return <article key={file.id} className="min-w-0 overflow-hidden border border-racing-border bg-black/25">{previewable ? <PaintingPreviewImage source={`/api/templates/paintings/${file.id}/preview`} extension={extension} alt={`Vista previa de ${file.nombre_original}`}/> : <div className="flex aspect-square items-center justify-center bg-black/30"><div className="text-center"><ArchiveBoxIcon className="mx-auto h-10 w-10 text-cyan-300"/><strong className="mt-2 block font-racing text-lg text-white">{extensionLabel}</strong></div></div>}<div className="p-2.5"><p className="truncate text-xs text-gray-200" title={file.nombre_original}>{file.nombre_original}</p><p className="mt-1 text-[9px] uppercase text-gray-600">{extensionLabel} · {formatFileSize(file.tamano)}</p></div></article>; })}</div> : <p className="mt-4 border border-dashed border-racing-border py-6 text-center text-xs text-gray-600">Este piloto todavía no envió archivos.</p>}</div> : null}
        </section>
      </div>}

      {uploading ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 px-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="painting-upload-title"><div className="w-full max-w-lg border border-cyan-300/50 bg-racing-dark p-7 shadow-[0_0_60px_rgba(34,211,238,0.2)]"><div className="flex items-center gap-4"><div className="relative h-16 w-16 shrink-0"><div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"/><PaintBrushIcon className="absolute inset-0 m-auto h-7 w-7 text-cyan-300"/></div><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">No cierres esta pantalla</p><h2 id="painting-upload-title" className="mt-1 font-racing text-2xl font-bold uppercase text-white">{progress >= 100 ? 'Procesando pinturas…' : 'Subiendo pinturas…'}</h2></div></div><div className="mt-7 h-3 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }}/></div><div className="mt-3 flex items-center justify-between"><span className="text-xs uppercase text-gray-500">{progress >= 100 ? 'Actualizando archivos entregados' : 'Carga en progreso'}</span><p className="font-racing text-2xl text-white">{progress}%</p></div></div></div> : null}
    </main>
  );
}
