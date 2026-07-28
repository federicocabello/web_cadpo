import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ClockIcon,
  TrophyIcon,
  CalendarDaysIcon,
  FlagIcon,
  UsersIcon,
  TagIcon,
  BookOpenIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { authApi, eventsApi } from '../services/api'
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

const navLinks = [
  { to: '/', label: 'INICIO', Icon: HomeIcon },
  { to: '/tiempos-en-vivo', label: 'TIEMPOS EN VIVO', Icon: ClockIcon },
  { to: '/resultados', label: 'RESULTADOS', Icon: TrophyIcon },
  { to: '/proximas-fechas', label: 'PRÓXIMAS FECHAS', Icon: CalendarDaysIcon },
  { to: '/proximos-campeonatos', label: 'PRÓXIMOS CAMPEONATOS', Icon: FlagIcon },
  { to: '/pilotos', label: 'PILOTOS', Icon: UsersIcon },
  { to: '/categorias', label: 'CATEGORÍAS', Icon: TagIcon },
  { to: '/historico', label: 'HISTÓRICO', Icon: BookOpenIcon },
  { to: '/estadisticas', label: 'ESTADÍSTICAS', Icon: ChartBarIcon },
]

const socialLinks = [
  {
    href: 'https://www.instagram.com/cadpotorneos',
    label: 'Instagram',
    Icon: InstagramIcon,
    iconClassName: 'group-hover:rotate-12',
  },
  {
    href: 'https://wa.me/5492604659499',
    label: 'WhatsApp',
    Icon: WhatsAppIcon,
    iconClassName: 'text-[#25d366] group-hover:scale-110',
  },
]

const socialButtonClass = 'group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-racing-red/35 bg-black shadow-racing transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:border-racing-red hover:shadow-racing-lg active:scale-95'

export default function Navbar() {
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

  const handleAdminAccess = async event => {
    event.preventDefault()

    const password = window.prompt('Contraseña de administrador')
    if (!password) return

    try {
      await authApi.adminLogin(password)
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
              className="w-10 h-10 shrink-0 bg-black border border-racing-red/35 rounded-lg flex items-center justify-center shadow-racing hover:scale-105 transition-transform duration-300 overflow-hidden"
              aria-label="Acceso administrador"
            >
              <img
                src="/logo.png"
                alt="Logo CADPO"
                className="h-full w-full object-contain p-1"
                onError={event => { event.currentTarget.style.display = 'none' }}
              />
            </a>

            <div className="hidden sm:flex items-center gap-2">
              {socialLinks.map(({ href, label, Icon, iconClassName }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={socialButtonClass}
                  aria-label={label}
                  title={label}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-300 ${iconClassName}`} />
                </a>
              ))}
            </div>
          </div>

          <div className="hidden 2xl:flex items-center justify-end gap-2.5 flex-1 ml-6">
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
          </div>

          <button
            className="2xl:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-racing-card transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="2xl:hidden border-t border-racing-border bg-racing-gray animate-fade-in">
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

            <div className="flex gap-2 pt-3">
              {socialLinks.map(({ href, label, Icon, iconClassName }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={socialButtonClass}
                  onClick={() => setOpen(false)}
                  aria-label={label}
                  title={label}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-300 ${iconClassName}`} />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
