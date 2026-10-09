import { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, PhotoIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { projectsApi } from '../services/api';

const sections = [
  { id: 'categoria', title: 'Categorías', subtitle: 'Categorías y propuestas deportivas en desarrollo.', Icon: TagIcon },
  { id: 'circuito', title: 'Circuitos', subtitle: 'Circuitos y escenarios en los que estamos trabajando.', Icon: FlagIcon },
];

const formatProjectDate = value => {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(date)
    .replace(' de ', ' • ')
    .toLocaleUpperCase('es-AR');
};

const protectImage = event => event.preventDefault();
const projectsSeoTitle = 'Proyectos para Assetto Corsa | CADPO TORNEOS';
const projectsSeoDescription = 'Categorías, autos y circuitos para Assetto Corsa desarrollados por CADPO TORNEOS. Conocé los proyectos, avances e imágenes de la comunidad.';
const projectsCanonicalUrl = 'https://cadpotorneos.com/proyectos';

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
  return <div className="fixed inset-0 z-[110] flex select-none items-center justify-center bg-black/95 p-0 sm:p-5" role="dialog" aria-modal="true" aria-label={`Galería de ${project.titulo}`} onContextMenu={protectImage}><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar galería"/><div className="relative z-10 flex h-[100dvh] w-full max-w-7xl flex-col sm:h-[92dvh]"><header className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-racing-red">{project.tipo}</p><h2 className="truncate font-racing text-xl font-bold uppercase text-white">{project.titulo}</h2></div><div className="flex items-center gap-3"><span className="font-racing text-sm text-gray-400">{index + 1}/{photos.length}</span><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center border border-white/15 text-white hover:border-racing-red" aria-label="Cerrar"><XMarkIcon className="h-5 w-5"/></button></div></header><div className="relative min-h-0 flex-1"><img src={photos[index].imagen} alt={`${project.titulo} ${index + 1}`} draggable={false} onDragStart={protectImage} className="pointer-events-none h-full w-full object-contain" style={{ WebkitTouchCallout: 'none' }}/>{photos.length > 1 ? <><button type="button" onClick={() => setIndex(current => (current - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:text-racing-red sm:left-5" aria-label="Imagen anterior"><ChevronLeftIcon className="h-7 w-7"/></button><button type="button" onClick={() => setIndex(current => (current + 1) % photos.length)} className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-black/75 text-white hover:text-racing-red sm:right-5" aria-label="Imagen siguiente"><ChevronRightIcon className="h-7 w-7"/></button></> : null}</div></div></div>;
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gallery, setGallery] = useState(null);
  useEffect(() => {
    const description = document.querySelector('meta[name="description"]');
    const keywords = document.querySelector('meta[name="keywords"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const previous = {
      title: document.title,
      description: description?.getAttribute('content') || '',
      keywords: keywords?.getAttribute('content') || '',
      canonical: canonical?.getAttribute('href') || '',
      ogTitle: ogTitle?.getAttribute('content') || '',
      ogDescription: ogDescription?.getAttribute('content') || '',
      ogUrl: ogUrl?.getAttribute('content') || '',
    };
    document.title = projectsSeoTitle;
    description?.setAttribute('content', projectsSeoDescription);
    keywords?.setAttribute('content', 'Assetto Corsa, circuitos Assetto Corsa, categorías Assetto Corsa, mods Assetto Corsa, CADPO TORNEOS, simracing Argentina');
    canonical?.setAttribute('href', projectsCanonicalUrl);
    ogTitle?.setAttribute('content', projectsSeoTitle);
    ogDescription?.setAttribute('content', projectsSeoDescription);
    ogUrl?.setAttribute('content', projectsCanonicalUrl);
    return () => {
      document.title = previous.title;
      description?.setAttribute('content', previous.description);
      keywords?.setAttribute('content', previous.keywords);
      canonical?.setAttribute('href', previous.canonical);
      ogTitle?.setAttribute('content', previous.ogTitle);
      ogDescription?.setAttribute('content', previous.ogDescription);
      ogUrl?.setAttribute('content', previous.ogUrl);
    };
  }, []);
  useEffect(() => { projectsApi.getAll().then(response => setProjects(response.data.data || [])).catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar los proyectos.')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!projects.length) return undefined;
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.id = 'cadpo-projects-schema';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: projectsSeoTitle,
      description: projectsSeoDescription,
      url: projectsCanonicalUrl,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: projects.map((project, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${projectsCanonicalUrl}#proyecto-${project.id}`,
          item: {
            '@type': 'CreativeWork',
            name: `${project.titulo} para Assetto Corsa`,
            description: project.descripcion || `${project.titulo}, proyecto para Assetto Corsa de CADPO TORNEOS.`,
            dateCreated: project.creado || undefined,
            image: (project.fotos || []).map(photo => String(photo.imagen || '').startsWith('http') ? photo.imagen : `https://cadpotorneos.com${photo.imagen}`),
          },
        })),
      },
    });
    document.getElementById(schema.id)?.remove();
    document.head.appendChild(schema);
    return () => schema.remove();
  }, [projects]);
  const grouped = useMemo(() => Object.fromEntries(sections.map(section => [section.id, projects.filter(project => project.tipo === section.id)])), [projects]);
  return <main className="mx-auto min-h-[70vh] w-full max-w-[1600px] animate-fade-in px-3 py-6 sm:px-8 sm:py-8 lg:px-14 xl:px-20"><header className="border-b border-racing-border pb-6 sm:pb-7"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-racing-red sm:text-xs sm:tracking-[0.24em]">CADPO en desarrollo</p><h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-7xl">Proyectos</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">Conocé las categorías, autos y circuitos para Assetto Corsa que estamos preparando para seguir ampliando la experiencia de la comunidad.</p></header>{loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-7 text-red-200">{error}</div> : <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-16">{sections.map(section => { const items = grouped[section.id] || []; const Icon = section.Icon; return items.length ? <section key={section.id}><div className="flex items-center gap-3 sm:gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-racing-red text-white sm:h-12 sm:w-12"><Icon className="h-5 w-5 sm:h-6 sm:w-6"/></span><div className="min-w-0"><h2 className="font-racing text-2xl font-bold uppercase text-white sm:text-4xl">{section.title}</h2><p className="text-xs leading-relaxed text-gray-500 sm:text-sm">{section.subtitle}</p></div></div><div className="mt-5 space-y-6 sm:mt-6 sm:space-y-8">{items.map(project => <article id={`proyecto-${project.id}`} key={project.id} className="overflow-hidden border border-racing-border bg-racing-card"><div className="p-4 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words font-racing text-2xl font-bold uppercase text-white sm:text-4xl">{project.titulo}</h3><div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><span className="border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200 sm:px-3 sm:text-[10px] sm:tracking-[0.18em]">Para Assetto Corsa</span>{formatProjectDate(project.creado) ? <span className="border border-racing-red/30 bg-racing-red/[0.08] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-racing-red sm:px-3 sm:text-[10px] sm:tracking-[0.18em]">{formatProjectDate(project.creado)}</span> : null}</div></div>{project.descripcion ? <p className="mt-3 max-w-5xl text-sm leading-relaxed text-gray-400 sm:text-base">{project.descripcion}</p> : null}</div>{project.fotos?.length ? <div className="grid h-[420px] select-none grid-cols-2 grid-rows-4 gap-0.5 bg-racing-border min-[420px]:h-[480px] sm:h-[540px] sm:grid-cols-4 sm:grid-rows-2 sm:gap-1" onContextMenu={protectImage} style={{ WebkitTouchCallout: 'none' }}>{project.fotos.slice(0, 5).map((photo, index) => <button type="button" key={photo.id} onClick={() => setGallery({ project, index })} className={`group relative overflow-hidden bg-black ${index === 0 ? 'col-span-2 row-span-2' : ''}`} aria-label={`Ver imagen ${index + 1} de ${project.titulo} para Assetto Corsa`}><img src={photo.imagen} alt={`${project.titulo} para Assetto Corsa - imagen ${index + 1}`} loading="lazy" draggable={false} onDragStart={protectImage} className="pointer-events-none h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"/>{index === 4 && project.fotos.length > 5 ? <span className="absolute inset-0 flex items-center justify-center bg-black/65 font-racing text-2xl font-bold text-white">+{project.fotos.length - 5}</span> : null}</button>)}</div> : <div className="flex items-center gap-2 border-t border-racing-border px-5 py-4 text-xs text-gray-600"><PhotoIcon className="h-5 w-5"/>Próximamente agregaremos imágenes.</div>}</article>)}</div></section> : null; })}{!projects.length ? <div className="border border-dashed border-racing-border py-20 text-center"><PhotoIcon className="mx-auto h-14 w-14 text-gray-700"/><h2 className="mt-4 font-racing text-2xl font-bold uppercase text-gray-300">Próximamente</h2><p className="mt-2 text-sm text-gray-500">Todavía no hay proyectos publicados.</p></div> : null}</div>}{gallery ? <ProjectGallery project={gallery.project} initialIndex={gallery.index} onClose={() => setGallery(null)}/> : null}</main>;
}
