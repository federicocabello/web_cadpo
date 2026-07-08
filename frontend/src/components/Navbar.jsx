import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/eventos', label: 'Eventos' },
  { to: '/campeonatos', label: 'Campeonatos' },
  { to: '/pilotos', label: 'Pilotos' },
  { to: '/inscripcion', label: 'Inscribirme', highlight: true },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-racing-dark/95 backdrop-blur-md border-b border-racing-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-black border border-racing-red/35 rounded-lg flex items-center justify-center shadow-racing group-hover:scale-105 transition-transform duration-300 overflow-hidden">
              <img
                src="/logo.png"
                alt="Logo CADPO"
                className="h-full w-full object-contain p-1"
                onError={event => { event.currentTarget.style.display = 'none' }}
              />
            </div>
            <span className="font-racing text-xl font-bold tracking-wider text-white group-hover:text-racing-red transition-colors duration-300">
              LIGA <span className="gradient-text">CADPO</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, highlight }) =>
              highlight ? (
                <Link
                  key={to}
                  to={to}
                  className="btn-primary ml-4 !py-2 !px-4 !text-xs"
                >
                  {label}
                </Link>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `nav-link px-4 py-2 rounded-lg hover:bg-white/5 ${isActive ? 'text-racing-red' : ''}`
                  }
                >
                  {label}
                </NavLink>
              )
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-racing-card transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-racing-border bg-racing-gray animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ to, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block w-full px-4 py-3 rounded-lg font-racing font-medium tracking-wide transition-all duration-200 ${
                    highlight
                      ? 'bg-gradient-racing text-white text-center mt-2'
                      : isActive
                      ? 'text-racing-red bg-racing-card'
                      : 'text-gray-300 hover:text-white hover:bg-racing-card'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
