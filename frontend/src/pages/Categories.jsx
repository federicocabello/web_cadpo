import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PhotoIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { categoriesApi } from '../services/api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [gallery, setGallery] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [collapsedSeasons, setCollapsedSeasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [error, setError] = useState('');
  const categoryStripRef = useRef(null);
  const categoryDragRef = useRef({ active: false, pointerId: null, startX: 0, scrollLeft: 0, moved: false });
  const suppressCategoryClickRef = useRef(false);

  const startCategoryDrag = event => {
    const strip = categoryStripRef.current;
    if (!strip) return;
    categoryDragRef.current = { active: true, pointerId: event.pointerId, startX: event.clientX, scrollLeft: strip.scrollLeft, moved: false };
  };

  const moveCategoryDrag = event => {
    const strip = categoryStripRef.current;
    const drag = categoryDragRef.current;
    if (!strip || !drag.active) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 5 && !drag.moved) {
      drag.moved = true;
      strip.setPointerCapture(drag.pointerId);
    }
    if (!drag.moved) return;
    strip.scrollLeft = drag.scrollLeft - distance;
  };

  const finishCategoryDrag = event => {
    const strip = categoryStripRef.current;
    const drag = categoryDragRef.current;
    if (!drag.active) return;
    if (strip?.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
    suppressCategoryClickRef.current = drag.moved;
    categoryDragRef.current.active = false;
    window.setTimeout(() => { suppressCategoryClickRef.current = false; }, 0);
  };

  useEffect(() => {
    categoriesApi.getAll()
      .then(response => {
        const rows = response.data.data || [];
        setCategories(rows);
        setSelectedCategoryId(rows[0]?.id ? String(rows[0].id) : '');
      })
      .catch(requestError => setError(requestError.response?.data?.error || 'No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) {
      setGallery(null);
      return;
    }
    setGalleryLoading(true);
    setError('');
    categoriesApi.getGallery(selectedCategoryId)
      .then(response => {
        const nextGallery = response.data.data || null;
        setGallery(nextGallery);
        setCollapsedSeasons(Object.fromEntries(
          (nextGallery?.seasons || []).map(season => [season.id, true])
        ));
      })
      .catch(requestError => {
        setGallery(null);
        setError(requestError.response?.data?.error || 'No se pudo cargar la galería de la categoría.');
      })
      .finally(() => setGalleryLoading(false));
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!selectedImage) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
        return;
      }
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      setSelectedImage(current => {
        if (!current) return null;
        const images = current.season.images || [];
        if (!images.length) return current;
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (current.index + direction + images.length) % images.length;
        return { ...images[nextIndex], season: current.season, index: nextIndex };
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  const moveSelectedImage = direction => {
    setSelectedImage(current => {
      if (!current) return null;
      const images = current.season.images || [];
      if (!images.length) return current;
      const nextIndex = (current.index + direction + images.length) % images.length;
      return { ...images[nextIndex], season: current.season, index: nextIndex };
    });
  };

  return (
    <main className="w-full max-w-none animate-fade-in px-4 py-8 sm:px-6 lg:px-10 2xl:px-12">
      {loading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : !categories.length ? <div className="card-glass p-16 text-center"><TagIcon className="mx-auto mb-4 h-14 w-14 text-gray-600"/><h3 className="font-racing text-xl text-gray-300">Sin categorías</h3><p className="mt-2 text-sm text-gray-500">Todavía no hay categorías cargadas.</p></div> : <>
        <section
          ref={categoryStripRef}
          onPointerDown={startCategoryDrag}
          onPointerMove={moveCategoryDrag}
          onPointerUp={finishCategoryDrag}
          onPointerCancel={finishCategoryDrag}
          className="flex cursor-grab touch-pan-y select-none gap-3 overflow-x-auto border-b border-racing-border pb-5 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map(category => {
            const selected = String(category.id) === selectedCategoryId;
            return <button key={category.id} type="button" onClick={() => { if (!suppressCategoryClickRef.current) setSelectedCategoryId(String(category.id)); }} className={`flex min-w-40 shrink-0 flex-col items-center justify-center gap-2 border px-4 py-4 text-center transition-all ${selected ? 'border-racing-red bg-racing-red/10 shadow-[0_0_24px_rgba(220,38,38,0.12)]' : 'border-racing-border bg-racing-card hover:border-white/30'}`}>
              {category.logo ? <img src={category.logo} alt="" draggable="false" className="h-24 w-32 shrink-0 object-contain"/> : <TagIcon className="h-16 w-16 shrink-0 text-racing-red"/>}
              <span className={`text-[10px] font-bold uppercase tracking-wider ${selected ? 'text-white' : 'text-gray-500'}`}>{category.categoria}</span>
            </button>;
          })}
        </section>

        {error ? <div className="mt-8 border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">{error}</div> : galleryLoading ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-2 border-racing-red border-t-transparent"/></div> : gallery ? <>
          <header className="flex flex-col gap-6 py-9 sm:flex-row sm:items-center">
            {gallery.category.logo ? <img src={gallery.category.logo} alt={`Logo ${gallery.category.categoria}`} className="h-28 w-40 object-contain sm:h-36 sm:w-52"/> : <TagIcon className="h-24 w-24 text-racing-red"/>}
            <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-racing-red">Historia de la categoría</p><h1 className="mt-2 font-racing text-4xl font-bold uppercase text-white sm:text-5xl lg:text-6xl">{gallery.category.categoria}</h1><p className="mt-2 text-sm text-gray-500">{gallery.seasons.length} temporada{gallery.seasons.length === 1 ? '' : 's'} registrada{gallery.seasons.length === 1 ? '' : 's'}</p></div>
          </header>

          <div className="space-y-8">
            {gallery.seasons.map(season => { const collapsed = Boolean(collapsedSeasons[season.id]); return <section key={season.id} className="border border-racing-border bg-racing-card/55">
              <button type="button" onClick={() => setCollapsedSeasons(current => ({ ...current, [season.id]: !current[season.id] }))} className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-racing-border bg-black/20 px-5 py-4 text-left transition-colors hover:bg-white/[0.04] sm:px-7" aria-expanded={!collapsed}><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-racing-red">Temporada</p><h2 className="font-racing text-2xl font-bold uppercase text-white sm:text-3xl">Temporada {season.temporada}</h2></div><span className="flex items-center gap-4"><span className="font-racing text-2xl font-bold text-gray-500">{season.anio}</span><ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform duration-500 ${collapsed ? '-rotate-90' : 'rotate-0'}`}/></span></button>
              <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}><div className="min-h-0 overflow-hidden">{season.images.length ? <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 lg:grid-cols-4 2xl:grid-cols-5">{season.images.map((image, imageIndex) => <button key={`${image.source}-${image.filename}`} type="button" onClick={() => setSelectedImage({ ...image, season, index: imageIndex })} className="group relative aspect-video overflow-hidden bg-black text-left"><img src={image.url} alt={`${gallery.category.categoria} · Temporada ${season.temporada}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-80"/><span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-[10px] font-bold uppercase tracking-wider text-white transition-transform group-hover:translate-y-0">Ver foto</span></button>)}</div> : <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-gray-600"><PhotoIcon className="h-6 w-6"/>Todavía no hay fotos en esta temporada.</div>}</div></div>
            </section>; })}
            {!gallery.seasons.length ? <div className="border border-dashed border-racing-border py-16 text-center text-gray-500">Esta categoría todavía no tiene temporadas cargadas.</div> : null}
          </div>
        </> : null}
      </>}

      {selectedImage ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setSelectedImage(null)}><button type="button" onClick={() => setSelectedImage(null)} className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center border border-white/20 bg-black/70 text-white hover:border-racing-red hover:text-racing-red" aria-label="Cerrar foto"><XMarkIcon className="h-6 w-6"/></button>{selectedImage.season.images.length > 1 ? <><button type="button" onClick={event => { event.stopPropagation(); moveSelectedImage(-1); }} className="absolute left-3 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/75 text-white transition hover:border-racing-red hover:bg-racing-red sm:left-7 sm:h-14 sm:w-14" aria-label="Foto anterior"><ChevronLeftIcon className="h-7 w-7"/></button><button type="button" onClick={event => { event.stopPropagation(); moveSelectedImage(1); }} className="absolute right-3 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/75 text-white transition hover:border-racing-red hover:bg-racing-red sm:right-7 sm:h-14 sm:w-14" aria-label="Foto siguiente"><ChevronRightIcon className="h-7 w-7"/></button></> : null}<div className="flex max-h-full max-w-full flex-col items-center px-10 sm:px-16" onClick={event => event.stopPropagation()}><img src={selectedImage.url} alt="Foto ampliada de la categoría" className="max-h-[82vh] max-w-full object-contain shadow-2xl"/><div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center"><p className="font-racing text-sm font-bold uppercase text-gray-300">Temporada {selectedImage.season.temporada} · {selectedImage.season.anio}</p><span className="text-xs text-gray-600">{selectedImage.index + 1} / {selectedImage.season.images.length}</span></div></div></div> : null}
    </main>
  );
}
