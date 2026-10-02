import { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, PhotoIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { projectsApi } from '../services/api';

const sections = [
  { id: 'categoria', title: 'Categorías', subtitle: 'Categorías y propuestas deportivas en desarrollo.', Icon: TagIcon },
  { id: 'circuito', title: 'Circuitos', subtitle: 'Circuitos y escenarios en los que estamos trabajando.', Icon: FlagIcon },
];

function ProjectGallery({ project, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const photos = project.fotos || [];
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setIndex(current => (current - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight') setIndex(current => (current + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose, photos.length]);
  if (!photos[index]) return null;
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-0 sm:p-5" role="dialog" aria-modal="true" aria-label={`Galería de ${project.titulo}`}><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar galería"/><div className="relative z-10 flex h-[100dvh] w-full max-w-7xl flex-col sm:h-[92dvh]"><header className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-racing-red">{project.tipo}</p><h2 className="truncate font-racing text-xl font-bold uppercase text-white">{project.titulo}</h2></div><div className="flex items-center gap-3"><span className="font-racing text-sm text-gray-400">{index + 1}/{photos.length}</span><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center border border-white/15 text-white hover:border-racing-red" aria-label="Cerrar"><XMarkIcon className="h-5 w-5"/></button></div></header><div className="relative min-h-0 flex-1"><img src={photos[index].imagen} alt={`${project.titulo} ${index + 1}`} className="h-full w-full object-contain"/>{photos.length > 1 ? <><button type="button" onClick={() => setIndex(current => (current - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:text-racing-red sm:left-5" aria-label="Imagen anterior"><ChevronLeftIcon className="h-7 w-7"/></button><button type="button" onClick={() => setIndex(current => (current + 1) % photos.length)} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:text-racing-red sm:right-5" aria-label="Imagen siguiente"><ChevronRightIcon className="h-7 w-7"/></button></> : null}</div></div></div>;
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gallery, setGallery] = useState(null);
  useEffect(() => { projectsApi.getAll().then(response => setProjects(response.data.data || [])).catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar los proyectos.')).finally(() => setLoading(false)); }, []);
  const grouped = useMemo(() => Object.fromEntries(sections.map(section => [section.id, projects.filter(project => project.tipo === section.id)])), [projects]);
  return <main className="mx-auto min-h-[70vh] w-full max-w-[1600px] animate-fade-in px-4 py-8 sm:px-8 lg:px-14 xl:px-20"><header className="border-b border-racing-border pb-7"><p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">CADPO en desarrollo</p><h1 className="mt-2 font-racing text-5xl font-bold uppercase text-white sm:text-7xl">Proyectos</h1><p className="mt-3 max-w-3xl text-gray-400">Conocé las categorías y los circuitos que estamos preparando para seguir ampliando la experiencia de la comunidad.</p></header>{loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-7 text-red-200">{error}</div> : <div className="mt-10 space-y-16">{sections.map(section => { const items = grouped[section.id] || []; const Icon = section.Icon; return items.length ? <section key={section.id}><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center bg-racing-red text-white"><Icon className="h-6 w-6"/></span><div><h2 className="font-racing text-3xl font-bold uppercase text-white sm:text-4xl">{section.title}</h2><p className="text-sm text-gray-500">{section.subtitle}</p></div></div><div className="mt-6 grid gap-6 lg:grid-cols-2">{items.map(project => <article key={project.id} className="overflow-hidden border border-racing-border bg-racing-card"><div className="p-5 sm:p-6"><h3 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">{project.titulo}</h3>{project.descripcion ? <p className="mt-3 text-sm leading-relaxed text-gray-400">{project.descripcion}</p> : null}</div>{project.fotos?.length ? <div className="grid grid-cols-2 gap-px bg-racing-border sm:grid-cols-3">{project.fotos.slice(0, 6).map((photo, index) => <button type="button" key={photo.id} onClick={() => setGallery({ project, index })} className="group relative aspect-video overflow-hidden bg-black" aria-label={`Ver imagen ${index + 1} de ${project.titulo}`}><img src={photo.imagen} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"/>{index === 5 && project.fotos.length > 6 ? <span className="absolute inset-0 flex items-center justify-center bg-black/65 font-racing text-xl font-bold text-white">+{project.fotos.length - 6}</span> : null}</button>)}</div> : <div className="flex items-center gap-2 border-t border-racing-border px-5 py-4 text-xs text-gray-600"><PhotoIcon className="h-5 w-5"/>Próximamente agregaremos imágenes.</div>}</article>)}</div></section> : null; })}{!projects.length ? <div className="border border-dashed border-racing-border py-20 text-center"><PhotoIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">Próximamente</h2><p className="mt-2 text-sm text-gray-500">Todavía no hay proyectos publicados.</p></div> : null}</div>}{gallery ? <ProjectGallery project={gallery.project} initialIndex={gallery.index} onClose={() => setGallery(null)}/> : null}</main>;
}
