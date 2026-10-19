import { useEffect } from 'react';

const siteUrl = 'https://cadpotorneos.com';
const defaultTitle = 'CADPO TORNEOS • Comunidad Argentina De Pilotos Online';
const defaultDescription = 'Sitio oficial de CADPO TORNEOS. Anotate en campeonatos de simracing, consultá próximas fechas, resultados, estadísticas y contenido de la comunidad.';

const pageSeo = {
  '/': {
    title: defaultTitle,
    description: defaultDescription,
    keywords: 'CADPO TORNEOS, Comunidad Argentina De Pilotos Online, simracing Argentina, campeonatos Assetto Corsa',
  },
  '/proximas-fechas': {
    title: 'CADPO TORNEOS • Próximas Fechas',
    description: 'Consultá las próximas fechas de CADPO, circuitos, horarios, transmisiones, reglamentos y actividad de cada campeonato de simracing.',
    keywords: 'próximas fechas CADPO, calendario simracing, carreras Assetto Corsa Argentina, circuitos CADPO',
  },
  '/campeonatos': {
    title: 'CADPO TORNEOS • Campeonatos',
    description: 'Descubrí campeonatos actuales, finalizados y con inscripciones disponibles en CADPO, organizados por categoría y temporada.',
    keywords: 'campeonatos CADPO, inscripciones simracing, torneos Assetto Corsa, automovilismo virtual Argentina',
  },
  '/tiempos-en-vivo': {
    title: 'CADPO TORNEOS • Tiempos en Vivo',
    description: 'Seguí los tiempos en vivo de CADPO: posiciones, vueltas, diferencias, lastres y requisitos de habilitación para cada fecha.',
    keywords: 'tiempos en vivo CADPO, live timing Assetto Corsa, clasificación simracing, vueltas en vivo',
  },
  '/resultados': {
    title: 'CADPO TORNEOS • Resultados',
    description: 'Revisá resultados por fecha, sanciones, apelaciones, puntos acumulados y tablas de posiciones de los campeonatos CADPO.',
    keywords: 'resultados CADPO, tabla de posiciones simracing, puntos campeonato, sanciones automovilismo virtual',
  },
  '/estadisticas': {
    title: 'CADPO TORNEOS • Estadísticas',
    description: 'Consultá estadísticas de pilotos de CADPO: carreras, victorias, poles, podios, campeonatos y trayectoria en la comunidad.',
    keywords: 'estadísticas CADPO, pilotos simracing, victorias poles podios, campeones CADPO',
  },
  '/replays': {
    title: 'CADPO TORNEOS • Repeticiones',
    description: 'Descargá repeticiones de clasificación, sprint y final organizadas por campeonato, fecha y circuito.',
    keywords: 'repeticiones CADPO, replays Assetto Corsa, descargar repetición carrera, simracing Argentina',
  },
  '/plantillas': {
    title: 'CADPO TORNEOS • Plantillas',
    description: 'Descargá las plantillas oficiales disponibles para crear los diseños de los autos de cada campeonato CADPO.',
    keywords: 'plantillas CADPO, templates Assetto Corsa, diseño autos simracing, skins Assetto Corsa',
  },
  '/denuncias': {
    title: 'CADPO TORNEOS • Denuncias',
    description: 'Accedé al formulario de denuncias deportivas habilitado para las fechas de los campeonatos CADPO.',
    keywords: 'denuncias CADPO, comisario deportivo simracing, reglamento CADPO, incidentes de carrera',
  },
  '/proyectos': {
    title: 'CADPO TORNEOS • Proyectos',
    description: 'Conocé los autos, categorías y circuitos para Assetto Corsa que se encuentran en desarrollo dentro de CADPO.',
    keywords: 'mods Assetto Corsa Argentina, circuitos Assetto Corsa, proyectos CADPO, autos argentinos Assetto Corsa',
  },
  '/club': {
    title: 'CADPO TORNEOS • Club',
    description: 'Ingresá gratis a los servidores abiertos de CADPO CLUB, conocé las categorías, autos, circuitos y sesiones disponibles.',
    keywords: 'CADPO CLUB, servidor Assetto Corsa gratis, simracing gratuito Argentina, carreras online Assetto Corsa',
  },
  '/inscripcion': {
    title: 'CADPO TORNEOS • Inscripción',
    description: 'Completá tu inscripción a los campeonatos CADPO, elegí auto, número y modalidad de diseño.',
    keywords: 'inscripción CADPO, anotarse campeonato simracing, inscripción Assetto Corsa, pilotos CADPO',
  },
  '/categorias': {
    title: 'CADPO TORNEOS • Categorías',
    description: 'Explorá las categorías de CADPO, sus temporadas, autos, campeonatos y galerías de imágenes.',
    keywords: 'categorías CADPO, Turismo Nacional Assetto Corsa, autos argentinos simracing, temporadas CADPO',
  },
};

const canonicalAliases = {
  '/eventos': '/proximas-fechas',
  '/proximos-campeonatos': '/campeonatos',
};

const setMetaContent = (selector, content) => {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute('content', content);
};

export default function SeoManager({ pathname }) {
  useEffect(() => {
    const canonicalPath = canonicalAliases[pathname] || pathname;
    const seo = pageSeo[canonicalPath];
    const isAdmin = pathname.startsWith('/admin');
    const indexable = Boolean(seo) && !isAdmin;
    const title = isAdmin ? 'CADPO TORNEOS • Administración' : seo?.title || defaultTitle;
    const description = seo?.description || defaultDescription;
    const canonicalUrl = `${siteUrl}${canonicalPath === '/' ? '/' : canonicalPath}`;

    document.documentElement.lang = 'es-AR';
    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[name="keywords"]', seo?.keywords || 'CADPO TORNEOS, simracing Argentina, Assetto Corsa');
    setMetaContent('meta[name="robots"]', indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow');
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    const canonical = document.head.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', canonicalUrl);
  }, [pathname]);

  return null;
}
