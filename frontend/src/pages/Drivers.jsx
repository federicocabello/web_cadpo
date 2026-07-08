import { useEffect, useState } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { driversApi } from '../services/api';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await driversApi.getAll();
        setDrivers(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDrivers();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Comunidad</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Pilotos <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Listado general de pilotos registrados y cantidad de campeonatos disputados.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length > 0 ? (
          <div className="card-glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-racing-border bg-racing-dark">
                    <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Piloto</th>
                    <th className="px-4 py-3 text-left text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Localidad</th>
                    <th className="px-4 py-3 text-right text-xs font-racing font-semibold text-gray-400 uppercase tracking-wider">Campeonatos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-racing-border">
                  {drivers.map(driver => (
                    <tr key={driver.id} className="hover:bg-racing-card/60 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{driver.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{driver.localidad || '-'}</td>
                      <td className="px-4 py-3 text-right font-racing text-white">{driver.campeonatos_disputados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card-glass p-16 text-center">
            <UserGroupIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">Sin pilotos</h3>
            <p className="text-gray-500 text-sm">Todavia no hay pilotos registrados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
