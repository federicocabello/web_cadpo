const positionStyles = {
  1: 'text-racing-red font-bold',
  2: 'text-racing-silver font-bold',
  3: 'text-racing-bronze font-bold',
};

export default function DriverStandingsTable({ drivers = [], loading = false }) {
  if (loading) {
    return (
      <div className="card-glass p-8 text-center">
        <div className="inline-block w-8 h-8 border-2 border-racing-red border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-400">Cargando posiciones...</p>
      </div>
    );
  }

  if (!drivers.length) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-gray-400">No hay datos de posiciones disponibles.</p>
      </div>
    );
  }

  return (
    <div className="card-glass overflow-hidden">
      <div className="overflow-x-auto scrollbar-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-racing-border bg-racing-dark">
              <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider w-14">Pos</th>
              <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Piloto</th>
              <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Localidad</th>
              <th className="px-4 py-3 text-right text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Pts</th>
              <th className="px-4 py-3 text-right text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Victorias</th>
              <th className="px-4 py-3 text-right text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Aperc.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-racing-border">
            {drivers.map(driver => {
              const pos = driver.posicion;
              return (
                <tr
                  key={driver.idpiloto}
                  className={`transition-colors duration-150 hover:bg-racing-card/60 ${pos <= 3 ? 'bg-racing-card/30' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-racing text-base ${positionStyles[pos] || 'text-gray-400'}`}>
                      #{pos}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{driver.nombre}</span>
                    {driver.campeon ? <span className="ml-2 text-racing-red text-xs uppercase">Campeón</span> : null}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-gray-400">{driver.localidad || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-racing font-bold text-base ${positionStyles[pos] || 'text-white'}`}>
                      {driver.puntos}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-gray-400">{driver.victorias}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-gray-400">{driver.apercibimientos}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
