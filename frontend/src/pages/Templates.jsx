import { useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveBoxIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, PaintBrushIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { templatesApi } from '../services/api';

const maxFileSize = 40 * 1024 * 1024;
const maxFilesPerUpload = 20;

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

function SelectedFilePreview({ file }) {
  const previewable = ['image/png', 'image/jpeg'].includes(file.type)
    || /\.(png|jpe?g)$/i.test(file.name);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!previewable) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, previewable]);

  return (
    <article className="min-w-0 overflow-hidden border border-cyan-300/25 bg-black/25">
      {previewUrl ? <img src={previewUrl} alt={'Vista previa de ' + file.name} className="aspect-square w-full bg-[linear-gradient(45deg,#151515_25%,transparent_25%),linear-gradient(-45deg,#151515_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151515_75%),linear-gradient(-45deg,transparent_75%,#151515_75%)] bg-[length:16px_16px] object-contain"/> : <div className="flex aspect-square items-center justify-center bg-black/30"><div className="text-center"><ArchiveBoxIcon className="mx-auto h-9 w-9 text-cyan-300"/><strong className="mt-2 block font-racing text-base text-white">DDS</strong><span className="mt-1 block text-[9px] uppercase text-gray-600">Vista previa no disponible</span></div></div>}
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
    if (selected.length > maxFilesPerUpload) {
      setFiles([]);
      event.target.value = '';
      setError(`Podés enviar hasta ${maxFilesPerUpload} archivos por carga.`);
      return;
    }
    const oversized = selected.find(file => file.size > maxFileSize);
    if (oversized) {
      setFiles([]);
      event.target.value = '';
      setError(`${oversized.name} supera el máximo de 40 MB.`);
      return;
    }
    const normalizedNames = selected.map(file => file.name.trim().toLocaleLowerCase('es-AR'));
    if (normalizedNames.some((name, index) => normalizedNames.indexOf(name) !== index)) {
      setFiles([]);
      event.target.value = '';
      setError('No podés seleccionar dos archivos con el mismo nombre.');
      return;
    }
    const submittedNames = new Set(submittedFiles.map(file => String(file.nombre_original || '').trim().toLocaleLowerCase('es-AR')));
    const duplicate = selected.find(file => submittedNames.has(file.name.trim().toLocaleLowerCase('es-AR')));
    if (duplicate) {
      setFiles([]);
      event.target.value = '';
      setError(`Ya existe un archivo llamado "${duplicate.name}" para este piloto.`);
      return;
    }
    setError('');
    setMessage('');
    setFiles(selected);
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
        ? 'Uno de los archivos supera el máximo permitido de 40 MB.'
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
            <label className="block"><span className="text-sm text-gray-300">Archivos terminados</span><span className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-racing-border bg-black/25 px-4 text-center transition hover:border-cyan-300"><ArrowUpTrayIcon className="h-7 w-7 text-cyan-300"/><span className="mt-2 text-sm text-gray-300">{files.length ? `${files.length} archivo${files.length === 1 ? '' : 's'} seleccionado${files.length === 1 ? '' : 's'}` : 'Seleccionar archivos'}</span><span className="mt-1 text-[10px] uppercase text-gray-600">DDS, PNG o JPG · máximo 40 MB por archivo · hasta 20 por carga</span></span><input ref={inputRef} type="file" multiple accept=".dds,.png,.jpg,.jpeg,image/png,image/jpeg" onChange={selectFiles} className="sr-only" required/></label>
            {files.length ? <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Vista previa antes de enviar</p><span className="text-[10px] text-gray-500">{files.length} archivo{files.length === 1 ? '' : 's'}</span></div><div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">{files.map(file => <SelectedFilePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file}/>)}</div></div> : null}
            <button type="submit" disabled={uploading || !driverId || !files.length} className="inline-flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-racing text-sm font-bold uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{uploading ? `Subiendo ${progress}%` : 'Enviar pinturas'}</button>
            {uploading ? <div className="h-2 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }}/></div> : null}
          </form>}
          {message ? <p className="mt-4 flex items-center gap-2 border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-200"><CheckCircleIcon className="h-5 w-5 shrink-0"/>{message}</p> : null}
          {error ? <p className="mt-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {deliveryOpen && submittedDriverId ? <div className="mt-6 border-t border-racing-border pt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Archivos entregados</p><h3 className="mt-1 font-racing text-lg font-bold uppercase text-white">Pinturas del piloto</h3></div><span className="text-xs text-gray-500">{submittedFiles.length} archivo{submittedFiles.length === 1 ? '' : 's'}</span></div>{loadingSubmittedFiles ? <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent"/></div> : submittedFiles.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{submittedFiles.map(file => { const previewable = ['.png', '.jpg', '.jpeg'].includes(String(file.extension || '').toLowerCase()); return <article key={file.id} className="min-w-0 overflow-hidden border border-racing-border bg-black/25">{previewable ? <img src={`/api/templates/paintings/${file.id}/preview`} alt={`Vista previa de ${file.nombre_original}`} className="aspect-square w-full bg-[linear-gradient(45deg,#151515_25%,transparent_25%),linear-gradient(-45deg,#151515_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151515_75%),linear-gradient(-45deg,transparent_75%,#151515_75%)] bg-[length:16px_16px] object-contain" loading="lazy"/> : <div className="flex aspect-square items-center justify-center bg-black/30"><div className="text-center"><ArchiveBoxIcon className="mx-auto h-10 w-10 text-cyan-300"/><strong className="mt-2 block font-racing text-lg text-white">DDS</strong></div></div>}<div className="p-2.5"><p className="truncate text-xs text-gray-200" title={file.nombre_original}>{file.nombre_original}</p><p className="mt-1 text-[9px] uppercase text-gray-600">{String(file.extension || '').replace('.', '')} · {formatFileSize(file.tamano)}</p></div></article>; })}</div> : <p className="mt-4 border border-dashed border-racing-border py-6 text-center text-xs text-gray-600">Este piloto todavía no envió archivos.</p>}</div> : null}
        </section>
      </div>}

      {uploading ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 px-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="painting-upload-title"><div className="w-full max-w-lg border border-cyan-300/50 bg-racing-dark p-7 shadow-[0_0_60px_rgba(34,211,238,0.2)]"><div className="flex items-center gap-4"><div className="relative h-16 w-16 shrink-0"><div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"/><PaintBrushIcon className="absolute inset-0 m-auto h-7 w-7 text-cyan-300"/></div><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">No cierres esta pantalla</p><h2 id="painting-upload-title" className="mt-1 font-racing text-2xl font-bold uppercase text-white">{progress >= 100 ? 'Procesando pinturas…' : 'Subiendo pinturas…'}</h2></div></div><div className="mt-7 h-3 overflow-hidden bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${progress}%` }}/></div><div className="mt-3 flex items-center justify-between"><span className="text-xs uppercase text-gray-500">{progress >= 100 ? 'Actualizando archivos entregados' : 'Carga en progreso'}</span><p className="font-racing text-2xl text-white">{progress}%</p></div></div></div> : null}
    </main>
  );
}
