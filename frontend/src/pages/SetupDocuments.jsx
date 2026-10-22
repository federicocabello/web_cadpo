import { useEffect, useState } from 'react';
import { ArrowTopRightOnSquareIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { setupDocumentsApi } from '../services/api';

const formatSize = bytes => `${(Number(bytes || 0) / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 2 })} MB`;

export default function SetupDocuments() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setupDocumentsApi.getAll()
      .then(response => {
        const items = response.data.data || [];
        setDocuments(items);
        setSelectedId(items[0]?.id || null);
      })
      .catch(error => setMessage(error.response?.data?.error || 'No se pudieron cargar los documentos.'))
      .finally(() => setLoading(false));
  }, []);

  const selected = documents.find(item => String(item.id) === String(selectedId)) || documents[0] || null;

  return (
    <main className="animate-fade-in">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-cyan-300/30 pb-6"><p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Biblioteca técnica</p><h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl">Puesta a punto</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">Documentos técnicos seleccionados por CADPO para consultar conceptos y criterios de puesta a punto de autos de competición.</p></header>
        {loading ? <div className="flex min-h-[55vh] items-center justify-center"><div className="h-11 w-11 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent"/></div> : null}
        {!loading && message ? <p className="mt-6 border border-red-400/30 bg-red-500/10 p-4 text-red-200">{message}</p> : null}
        {!loading && !message && !documents.length ? <section className="mt-6 border border-dashed border-racing-border py-16 text-center"><DocumentTextIcon className="mx-auto h-12 w-12 text-gray-600"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-white">Sin documentos publicados</h2><p className="mt-2 text-sm text-gray-500">La biblioteca técnica todavía no tiene PDFs disponibles.</p></section> : null}
        {selected ? <div className="mt-6 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]"><aside className="space-y-2">{documents.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border p-4 text-left transition ${String(item.id) === String(selected.id) ? 'border-cyan-300 bg-cyan-300/10' : 'border-racing-border bg-racing-card/60 hover:border-cyan-300/50'}`}><span className="flex items-start gap-3"><DocumentTextIcon className="mt-0.5 h-6 w-6 shrink-0 text-cyan-300"/><span className="min-w-0"><strong className="block break-words text-sm text-white">{item.titulo}</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-gray-600">PDF · {formatSize(item.tamano)}</span></span></span></button>)}</aside><section className="overflow-hidden border border-racing-border bg-racing-card"><header className="flex flex-col gap-4 border-b border-racing-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="font-racing text-2xl font-bold uppercase text-white">{selected.titulo}</h2>{selected.descripcion ? <p className="mt-1 max-w-3xl text-sm text-gray-400">{selected.descripcion}</p> : null}</div><a href={selected.archivo} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 border border-cyan-300/50 bg-cyan-300/10 px-4 py-2.5 text-xs font-bold uppercase text-cyan-200 transition hover:bg-cyan-300 hover:text-black"><ArrowTopRightOnSquareIcon className="h-4 w-4"/>Abrir PDF</a></header><iframe key={selected.archivo} src={`${selected.archivo}#view=FitH`} title={selected.titulo} className="h-[70vh] min-h-[560px] w-full bg-white"/></section></div> : null}
      </div>
    </main>
  );
}
