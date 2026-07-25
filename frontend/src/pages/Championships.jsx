import { useEffect, useState } from 'react';
import { TrophyIcon, FunnelIcon } from '@heroicons/react/24/outline';
import ChampionshipCard from '../components/ChampionshipCard';
import { championshipsApi } from '../services/api';

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'En curso' },
  { value: 'completed', label: 'Históricos' },
  { value: 'upcoming', label: 'Próximos' },
];

export default function Championships({ initialStatus = '' }) {
  const [championships, setChampionships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = statusFilter ? { status: statusFilter } : {};
        const res = await championshipsApi.getAll(params);
        setChampionships(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [statusFilter]);

  const active = championships.filter(c => c.status === 'active');
  const historical = championships.filter(c => c.status === 'completed');
  const upcoming = championships.filter(c => c.status === 'upcoming');
  const grouped = statusFilter
    ? [{ title: STATUSES.find(s => s.value === statusFilter)?.label || 'Campeonatos', items: championships }]
    : [
        { title: 'Temporada actual', items: active },
        { title: 'Próximos campeonatos', items: upcoming },
        { title: 'Historial de temporadas', items: historical },
      ];

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Historia</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Campeonatos <span className="gradient-text">CADPO</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Temporadas pasadas, actuales y futuras calculadas desde las fechas del calendario.</p>
        </div>
      </div>

      <div className="sticky top-16 z-40 bg-racing-dark/95 backdrop-blur-md border-b border-racing-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-3 items-center flex-wrap">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          {STATUSES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-all duration-200 ${
                statusFilter === value
                  ? 'bg-racing-red border-racing-red text-white'
                  : 'border-racing-border text-gray-400 hover:border-racing-red/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : championships.length === 0 ? (
          <div className="card-glass p-16 text-center">
            <TrophyIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">Sin campeonatos</h3>
            <p className="text-gray-500 text-sm">No hay campeonatos que coincidan con el filtro.</p>
          </div>
        ) : (
          grouped.map(group => (
            group.items.length > 0 && (
              <section key={group.title}>
                <h2 className="font-racing text-2xl font-bold mb-6">
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map(c => <ChampionshipCard key={c.id} championship={c} />)}
                </div>
              </section>
            )
          ))
        )}
      </div>
    </div>
  );
}
