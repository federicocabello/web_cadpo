import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ClockIcon,
  CalendarDaysIcon,
  FlagIcon,
  TagIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  PlayCircleIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'
import { authApi, championshipsApi, eventsApi } from '../services/api'
import { getLiveTimingEvents } from '../utils/weeklyChampionships'

const InstagramIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
    <defs>
      <linearGradient id="instagram-gradient" x1="4" x2="20" y1="20" y2="4" gradientUnits="userSpaceOnUse">
        <stop stopColor="#feda75" />
        <stop offset="0.3" stopColor="#fa7e1e" />
        <stop offset="0.55" stopColor="#d62976" />
        <stop offset="0.78" stopColor="#962fbf" />
        <stop offset="1" stopColor="#4f5bd5" />
      </linearGradient>
    </defs>
    <rect width="17" height="17" x="3.5" y="3.5" rx="5" stroke="url(#instagram-gradient)" strokeWidth="1.9" />
    <circle cx="12" cy="12" r="3.6" stroke="url(#instagram-gradient)" strokeWidth="1.9" />
    <circle cx="17.1" cy="6.9" r="1.1" fill="url(#instagram-gradient)" />
  </svg>
)

const WhatsAppIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12.04 2.8a8.95 8.95 0 0 0-7.64 13.62L3.2 21l4.7-1.17A8.96 8.96 0 1 0 12.04 2.8Zm0 1.82a7.14 7.14 0 0 1 6.05 10.93 7.14 7.14 0 0 1-9.72 2.65l-.32-.18-2.25.56.58-2.18-.2-.34a7.13 7.13 0 0 1 5.86-11.44Zm-3.1 3.68c-.17 0-.45.06-.69.32-.24.27-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.18 1.78 2.86 4.42 3.9 2.19.87 2.64.7 3.12.65.48-.04 1.55-.63 1.77-1.24.22-.61.22-1.13.15-1.24-.07-.11-.24-.18-.5-.31-.26-.13-1.55-.77-1.79-.85-.24-.09-.42-.13-.6.13-.17.26-.68.85-.83 1.02-.15.17-.31.2-.57.07-.26-.13-1.1-.4-2.09-1.29-.77-.69-1.29-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.31.39-.46.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.58-1.43-.82-1.95-.21-.51-.43-.44-.6-.45h-.51Z" />
  </svg>
)

const DiscordIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M19.54 5.34A17.16 17.16 0 0 0 15.3 4l-.52 1.06a15.5 15.5 0 0 0-5.55 0L8.7 4a17.35 17.35 0 0 0-4.25 1.35C1.76 9.35 1.03 13.25 1.4 17.1a17.1 17.1 0 0 0 5.2 2.63l1.27-1.75a10.7 10.7 0 0 1-1.98-.95l.49-.38c3.81 1.77 7.95 1.77 11.72 0l.5.38c-.64.38-1.3.7-1.99.95l1.27 1.75a17.03 17.03 0 0 0 5.2-2.63c.44-4.46-.76-8.32-3.54-11.76ZM8.68 14.75c-1.15 0-2.1-1.06-2.1-2.36s.92-2.36 2.1-2.36c1.17 0 2.11 1.07 2.09 2.36 0 1.3-.93 2.36-2.09 2.36Zm6.65 0c-1.15 0-2.1-1.06-2.1-2.36s.92-2.36 2.1-2.36c1.17 0 2.11 1.07 2.09 2.36 0 1.3-.92 2.36-2.09 2.36Z" />
  </svg>
)

const FacebookIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M13.75 21v-8h2.78l.42-3.12h-3.2V7.89c0-.9.25-1.52 1.6-1.52h1.71V3.58a22.8 22.8 0 0 0-2.49-.13c-2.46 0-4.14 1.5-4.14 4.26v2.17H7.65V13h2.78v8h3.32Z" />
  </svg>
)

const navLinks = [
  { to: '/', label: 'INICIO', Icon: HomeIcon },
  { to: '/tiempos-en-vivo', label: 'TIEMPOS EN VIVO', Icon: ClockIcon },
  { to: '/resultados', label: 'RESULTADOS', Icon: TrophyIcon },
  { to: '/replays', label: 'REPLAYS', Icon: ArrowDownTrayIcon },
  { to: '/proximas-fechas', label: 'PRÓXIMAS FECHAS', Icon: CalendarDaysIcon },
  { to: '/campeonatos', label: 'CAMPEONATOS', Icon: FlagIcon },
  { to: '/categorias', label: 'CATEGORÍAS', Icon: TagIcon },
  { to: '/estadisticas', label: 'ESTADÍSTICAS', Icon: ChartBarIcon },
]

const resourceLinks = [
  {
    href: '/content-manager.zip',
    label: 'Descargar Content Manager',
    shortLabel: 'CONTENT MANAGER',
    Icon: ArrowDownTrayIcon,
    download: true,
    className: 'border-cyan-300/65 bg-cyan-400/15 text-cyan-200 hover:border-cyan-200 hover:bg-cyan-300 hover:text-black hover:shadow-[0_0_24px_rgba(34,211,238,0.28)]',
  },
  {
    href: '/instructivo-instalacion.mp4',
    label: 'Ver instructivo para instalar el mod',
    shortLabel: 'CÓMO INSTALAR',
    Icon: PlayCircleIcon,
    target: '_blank',
    className: 'border-yellow-300/65 bg-yellow-400/15 text-yellow-200 hover:border-yellow-200 hover:bg-yellow-300 hover:text-black hover:shadow-[0_0_24px_rgba(250,204,21,0.28)]',
  },
]

const socialLinks = [
  {
    href: 'https://www.instagram.com/cadpotorneos',
    label: 'Instagram',
    text: 'Seguinos en Instagram',
    shortText: 'Instagram',
    group: 'social',
    Icon: InstagramIcon,
    accent: 'border-fuchsia-400/45 hover:border-fuchsia-300',
    textClassName: 'text-fuchsia-300',
    iconClassName: 'group-hover:rotate-12',
  },
  {
    href: 'https://www.facebook.com/cadpotorneos',
    label: 'Seguir a CADPO en Facebook',
    text: 'Seguinos en Facebook',
    shortText: 'Facebook',
    group: 'social',
    Icon: FacebookIcon,
    accent: 'border-blue-400/45 hover:border-blue-300',
    textClassName: 'text-blue-300',
    iconClassName: 'text-[#1877f2] group-hover:scale-110',
  },
  {
    href: 'https://chat.whatsapp.com/ITlGu1bs9B14IDpC4MbHfE',
    label: 'Unirse al grupo de WhatsApp',
    text: 'Comunidad de WhatsApp',
    shortText: 'WhatsApp',
    group: 'community',
    Icon: WhatsAppIcon,
    accent: 'border-emerald-400/45 hover:border-emerald-300',
    textClassName: 'text-emerald-300',
    iconClassName: 'text-[#25d366] group-hover:scale-110',
  },
  {
    href: 'https://discord.gg/UxZYQTNe7',
    label: 'Unirse a la comunidad de Discord',
    text: 'Comunidad de Discord',
    shortText: 'Discord',
    group: 'community',
    Icon: DiscordIcon,
    accent: 'border-indigo-400/45 hover:border-indigo-300',
    textClassName: 'text-indigo-300',
    iconClassName: 'text-[#5865f2] group-hover:-rotate-6 group-hover:scale-110',
  },
]

function SocialCarousel({ links }) {
  const carouselLinks = [...links, links[0]]

  return (
    <div className="social-carousel h-10 w-[5.75rem] overflow-hidden rounded-lg border border-white/10 bg-black shadow-racing min-[360px]:w-[6.5rem] sm:w-[10rem] md:w-[12rem] lg:w-[15rem]" aria-label="Redes de CADPO">
      <div className="social-carousel-track-two">
        {carouselLinks.map(({ href, label, text, shortText, Icon, accent, textClassName, iconClassName }, index) => (
          <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer" tabIndex={index === links.length ? -1 : undefined} className={`group flex h-10 w-full items-center justify-center gap-1.5 border-l-2 bg-black/95 px-2 transition-colors hover:bg-racing-card sm:justify-start sm:gap-2.5 sm:px-3 ${accent}`} aria-label={label}>
            <Icon className={`h-5 w-5 shrink-0 transition-transform duration-300 ${iconClassName}`} />
            <span className={`whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.02em] sm:text-[11px] sm:tracking-[0.08em] ${textClassName}`}><span className="sm:hidden">{shortText}</span><span className="hidden sm:inline">{text}</span></span>
          </a>
        ))}
      </div>
    </div>
  )
}

const formatTickerPoints = value => Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })

function ChampionshipTicker() {
  const [championship, setChampionship] = useState(null)

  useEffect(() => {
    let active = true
    championshipsApi.getLatestActiveStandings()
      .then(({ data }) => {
        if (active) setChampionship(data?.data || null)
      })
      .catch(() => {
        if (active) setChampionship(null)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const tickerVisible = Boolean(championship?.standings?.length)
    document.documentElement.style.setProperty('--cadpo-header-height', tickerVisible ? '6.25rem' : '4rem')
    return () => document.documentElement.style.setProperty('--cadpo-header-height', '4rem')
  }, [championship])

  if (!championship?.standings?.length) return null

  const tickerContent = copy => (
    <div key={copy} className="flex shrink-0 items-center gap-5 pr-5" aria-hidden={copy ? 'true' : undefined}>
      <span className="flex items-center gap-2 whitespace-nowrap font-racing text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
        <TrophyIcon className="h-4 w-4 text-yellow-300" />
        Campeonato <span className="text-racing-red">{championship.categoria}</span>
      </span>
      <span className="text-racing-red">•</span>
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-gray-300 sm:text-xs">
        {Number(championship.finalizado) === 1
          ? 'Campeonato finalizado'
          : `${championship.fechas_cumplidas} ${Number(championship.fechas_cumplidas) === 1 ? 'fecha cumplida' : 'fechas cumplidas'}`}
      </span>
      <span className="text-racing-red">•</span>
      {championship.campeon ? <>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap border border-yellow-300/30 bg-yellow-400/10 px-3 py-1 text-xs sm:text-sm">
          <TrophyIcon className="h-4 w-4 text-yellow-300" />
          <strong className="font-racing text-[10px] uppercase tracking-wider text-yellow-300 sm:text-xs">Campeón</strong>
          {championship.campeon.auto_logo ? <img src={championship.campeon.auto_logo} alt={`Logo de ${championship.campeon.marca || 'la marca'}`} className="h-5 w-7 object-contain" /> : null}
          <span className="font-semibold text-white">{championship.campeon.nombre}</span>
        </span>
        <span className="text-racing-red">•</span>
      </> : null}
      {championship.standings.map((standing, index) => (
        <span key={`${copy}-${standing.idpiloto}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-gray-200 sm:text-sm">
          {standing.auto_logo ? <img src={standing.auto_logo} alt={`Logo de ${standing.marca || 'la marca'}`} className="h-5 w-7 object-contain" /> : null}
          <strong className={`font-racing text-base ${standing.posicion === 1 ? 'text-yellow-300' : standing.posicion === 2 ? 'text-gray-200' : standing.posicion === 3 ? 'text-amber-600' : 'text-racing-red'}`}>{standing.posicion}°</strong>
          <span className="font-semibold text-white">{standing.nombre}</span>
          <span className="font-racing font-bold text-yellow-200">{formatTickerPoints(standing.puntos)} pts.</span>
          {index < championship.standings.length - 1 ? <span className="ml-2 text-racing-red">•</span> : null}
        </span>
      ))}
      <span className="mx-8 h-px w-28 shrink-0 bg-gradient-to-r from-transparent via-racing-red/60 to-transparent sm:mx-12 sm:w-40" aria-hidden="true" />
    </div>
  )

  return (
    <div className="championship-ticker overflow-hidden border-t border-racing-border/80 bg-black/95 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.35)]" aria-label={`Top 12 del campeonato ${championship.categoria}`}>
      <div className="championship-ticker-track flex w-max items-center">
        {tickerContent(0)}
        {tickerContent(1)}
      </div>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState([])
  const [calendarLoaded, setCalendarLoaded] = useState(false)
  const [calendarNow, setCalendarNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true

    eventsApi.getAll()
      .then(({ data }) => {
        if (active) setCalendarEvents(data?.data || [])
      })
      .catch(() => {
        if (active) setCalendarEvents([])
      })
      .finally(() => {
        if (active) setCalendarLoaded(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setCalendarNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const showLiveTiming = useMemo(
    () => calendarLoaded
      && getLiveTimingEvents(calendarEvents, new Date(calendarNow)).length > 0,
    [calendarEvents, calendarLoaded, calendarNow],
  )

  const visibleNavLinks = useMemo(
    () => navLinks.filter(link => link.to !== '/tiempos-en-vivo' || showLiveTiming),
    [showLiveTiming],
  )
  const followLinks = socialLinks.filter(link => link.group === 'social')
  const communityLinks = socialLinks.filter(link => link.group === 'community')

  const handleAdminAccess = async event => {
    event.preventDefault()

    const password = window.prompt('Contraseña de administrador')
    if (!password) return

    try {
      const response = await authApi.adminLogin(password)
      localStorage.setItem('cadpo_admin_token', response.data.token)
      localStorage.setItem('cadpo_admin_auth', 'true')
      window.open('/admin', '_blank', 'noopener,noreferrer')
    } catch (err) {
      window.alert(err.response?.data?.error || 'No se pudo iniciar sesión como administrador')
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-racing-dark/95 backdrop-blur-md border-b border-racing-border">
      <div className="w-full px-3 sm:px-5 lg:px-7 2xl:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <a
              href="/"
              onClick={handleAdminAccess}
              className="flex h-12 w-12 shrink-0 items-center justify-center transition-transform duration-300 hover:scale-105 sm:h-14 sm:w-20"
              aria-label="Acceso administrador"
            >
              <img
                src="/logo.png"
                alt="Logo CADPO"
                className="h-full w-full object-contain"
                onError={event => { event.currentTarget.style.display = 'none' }}
              />
            </a>

            <div className="flex items-center gap-1 sm:gap-2">
              <SocialCarousel links={followLinks} />
              <SocialCarousel links={communityLinks} />
            </div>
          </div>

          <div className="ml-6 hidden min-w-0 flex-1 items-center justify-end gap-2 min-[1800px]:flex">
            {visibleNavLinks.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `group inline-flex h-9 items-center gap-1.5 rounded-md border px-2 font-racing text-[11px] font-semibold tracking-wide whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-racing ${
                    isActive
                      ? 'border-racing-red bg-racing-red/12 text-racing-red'
                      : 'border-racing-border bg-racing-card/55 text-gray-300 hover:border-racing-red/60 hover:bg-racing-red/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-racing-red transition-transform duration-200 group-hover:scale-110" />
                <span className="leading-none">{label}</span>
              </NavLink>
            ))}
            <div className="ml-1 flex items-center gap-2 border-l border-white/15 pl-3">
              {resourceLinks.map(({ href, label, shortLabel, Icon, download, target, className }) => (
                <a
                  key={href}
                  href={href}
                  download={download || undefined}
                  target={target}
                  rel={target ? 'noreferrer' : undefined}
                  className={`group inline-flex h-9 w-9 items-center overflow-hidden whitespace-nowrap rounded-md border px-2.5 font-racing text-[10px] font-bold tracking-wide transition-[width,transform,background-color,border-color] duration-300 hover:w-40 hover:-translate-y-0.5 ${className}`}
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                  <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:ml-1 group-hover:max-w-32 group-hover:opacity-100">{shortLabel}</span>
                </a>
              ))}
            </div>
          </div>

          <button
            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-racing-card hover:text-white min-[1800px]:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {location.pathname === '/' ? <ChampionshipTicker /> : null}

      {open && (
        <div className="animate-fade-in border-t border-racing-border bg-racing-gray min-[1800px]:hidden">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-3 space-y-1">
            {visibleNavLinks.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 px-4 py-2.5 rounded-lg font-racing text-sm font-medium tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'text-racing-red bg-racing-card border border-racing-red/35'
                      : 'text-gray-300 hover:text-white hover:bg-racing-card border border-transparent'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0 text-racing-red" />
                {label}
              </NavLink>
            ))}

            <div className="grid grid-cols-1 gap-2 border-t border-racing-border pt-3 min-[420px]:grid-cols-2">
              {resourceLinks.map(({ href, label, shortLabel, Icon, download, target, className }) => (
                <a
                  key={href}
                  href={href}
                  download={download || undefined}
                  target={target}
                  rel={target ? 'noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  className={`group flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 font-racing text-xs font-bold tracking-wide transition-all duration-300 active:scale-[0.98] ${className}`}
                  aria-label={label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {shortLabel}
                </a>
              ))}
            </div>

          </div>
        </div>
      )}
    </nav>
  )
}
