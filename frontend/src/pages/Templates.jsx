import { useEffect, useMemo, useState } from 'react';
import { ArchiveBoxIcon, ArrowDownTrayIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { templatesApi } from '../services/api';

const formatFileSize = bytes => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.ceil(size / 1024).toLocaleString('es-AR')} KB`;
};

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [championshipId, setChampionshipId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    templatesApi.getAll()
      .then(response => setTemplates(response.data.data || []))
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar las plantillas.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleTemplates = useMemo(() => templates.filter(template =>
    !championshipId || String(template.idcampeonato) === championshipId
  ), [championshipId, templates]);

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-7xl animate-fade-in px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-racing-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Archivos de diseño</p>
          <h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Plantillas</h1>
          <p className="mt-2 max-w-2xl text-gray-400">Descargá la plantilla oficial correspondiente a cada campeonato.</p>
        </div>
        {!loading && templates.length ? <label className="w-full shrink-0 md:w-80"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Campeonato</span><select value={championshipId} onChange={event => setChampionshipId(event.target.value)} className="input-field mt-1.5 py-2.5 text-sm"><option value="">Todos los campeonatos</option>{templates.map(item => <option key={item.idcampeonato} value={item.idcampeonato}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label> : null}
      </header>

      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent"/></div> : error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">{error}</div> : !visibleTemplates.length ? <div className="mt-8 border border-dashed border-racing-border py-16 text-center"><ArchiveBoxIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">No hay plantillas disponibles</h2><p className="mt-2 text-sm text-gray-500">Cuando se publique una plantilla aparecerá en esta sección.</p></div> : <section className="mt-8 grid gap-4 md:grid-cols-2">{visibleTemplates.map(template => <article key={template.id} className="grid gap-4 border border-racing-border bg-racing-card p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex h-20 w-24 items-center justify-center text-cyan-300">{template.categoria_logo ? <img src={template.categoria_logo} alt={`Logo ${template.categoria}`} className="h-20 w-24 object-contain"/> : <TrophyIcon className="h-10 w-10"/>}</div>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{template.categoria}</p><h2 className="mt-1 font-racing text-xl font-bold uppercase text-white">Temporada {template.temporada} · {template.anio}</h2><p className="mt-1 truncate text-xs text-gray-500">Archivo ZIP · {formatFileSize(template.tamano)}</p><a href={`/api/templates/${template.id}/download`} className="mt-4 inline-flex items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-racing text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-cyan-200"><ArrowDownTrayIcon className="h-5 w-5"/>Descargar plantilla</a></div>
      </article>)}</section>}
    </main>
  );
}
