import { useEffect, useMemo, useState } from 'react';
import { ChartBarIcon, FlagIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { championshipsApi, driversApi, eventsApi } from '../services/api';

export default function Statistics() {
  const [championships, setChampionships] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [championshipsRes, driversRes, eventsRes] = await Promise.all([
          championshipsApi.getAll(),
          driversApi.getAll(),
          eventsApi.getAll(),
        ]);

        setChampionships(championshipsRes.data.data ?? []);
        setDrivers(driversRes.data.data ?? []);
        setEvents(eventsRes.data.data ?? []);
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const stats = useMemo(() => [
    { label: 'Campeonatos', value: championships.length, icon: TrophyIcon },
    { label: 'Fechas cargadas', value: events.length, icon: FlagIcon },
    { label: 'Pilotos registrados', value: drivers.length, icon: UserGroupIcon },
    { label: 'Temporadas históricas', value: championships.filter(item => item.status === 'completed').length, icon: ChartBarIcon },
  ], [championships, drivers, events]);

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Datos de liga</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Estadísticas <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Resumen general de la liga y base para rankings históricos.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map(({ label, value, icon: Icon }) => (
                <article key={label} className="card-glass p-6">
                  <Icon className="w-7 h-7 text-racing-red mb-4" />
                  <p className="font-racing text-4xl font-bold text-white">{value}</p>
                  <p className="text-gray-400 text-sm uppercase tracking-wider mt-1">{label}</p>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
              <section className="card-glass p-6">
                <h2 className="font-racing text-2xl font-bold mb-3">Pilotos más ganadores</h2>
                <p className="text-gray-400 text-sm">Pendiente de endpoint agregado sobre resultados y tablas históricas.</p>
              </section>

              <section className="card-glass p-6">
                <h2 className="font-racing text-2xl font-bold mb-3">Pilotos más rápidos</h2>
                <p className="text-gray-400 text-sm">Pendiente de conectar tiempos de vuelta o datos de clasificación.</p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
