import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-racing-gray border-t border-racing-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-black border border-racing-red/35 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.png"
                  alt="Logo CADPO"
                  className="h-full w-full object-contain p-1"
                  onError={event => { event.currentTarget.style.display = 'none'; }}
                />
              </div>
              <span className="font-racing text-lg font-bold">LIGA <span className="gradient-text">CADPO</span></span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Liga de simracing con historial de campeonatos, calendario de fechas y pilotos de la comunidad.
            </p>
          </div>

          <div>
            <h3 className="font-racing text-white font-semibold mb-3 uppercase tracking-wider text-sm">Navegacion</h3>
            <ul className="space-y-2">
              {[
                { to: '/', label: 'Inicio' },
                { to: '/eventos', label: 'Proximas fechas' },
                { to: '/campeonatos', label: 'Campeonatos' },
                { to: '/pilotos', label: 'Pilotos' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-400 hover:text-racing-red text-sm transition-colors duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-racing text-white font-semibold mb-3 uppercase tracking-wider text-sm">Participa</h3>
            <p className="text-gray-400 text-sm mb-4">Inscribite a un campeonato activo o proximo de la liga.</p>
            <Link to="/inscripcion" className="btn-primary !text-xs">
              Inscribirme ahora
            </Link>
          </div>
        </div>

        <div className="border-t border-racing-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-gray-500 text-xs">© {year} Liga CADPO. Todos los derechos reservados.</p>
          <p className="text-gray-600 text-xs">Simracing - Competencia y pasion</p>
        </div>
      </div>
    </footer>
  );
}
