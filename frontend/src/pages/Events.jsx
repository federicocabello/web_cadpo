import { useEffect, useState } from 'react';
import { CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';
import EventCard from '../components/EventCard';
import { eventsApi } from '../services/api';

const STATUSES = [
  { value: '', label: 'Todas' },
  { value: 'upcoming', label: 'Proximas' },
  { value: 'completed', label: 'Pasadas' },
];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = statusFilter ? { status: statusFilter } : {};
        const res = await eventsApi.getAll(params);
        setEvents(res.data.data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [statusFilter]);

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Calendario</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Fechas y <span className="gradient-text">Carreras</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Todas las rondas cargadas en la tabla calendario, separadas entre proximas y pasadas.</p>
        </div>
      </div>

      <div className="sticky top-16 z-40 bg-racing-dark/95 backdrop-blur-md border-b border-racing-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-3 items-center">
          <FunnelIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="flex gap-2 flex-wrap">
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-2 border-racing-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length > 0 ? (
          <>
            <p className="text-gray-400 text-sm mb-6">{events.length} fecha{events.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          </>
        ) : (
          <div className="card-glass p-16 text-center">
            <CalendarIcon className="w-14 h-14 mx-auto mb-4 text-gray-600" />
            <h3 className="font-racing text-xl text-gray-300 mb-2">Sin fechas</h3>
            <p className="text-gray-500 text-sm">No hay fechas que coincidan con el filtro seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
