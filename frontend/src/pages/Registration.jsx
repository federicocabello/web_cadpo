import { useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { carsApi, championshipsApi, driversApi, registrationsApi } from '../services/api';

export default function Registration() {
  const [championships, setChampionships] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [cars, setCars] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    idcampeonato: '',
    idpiloto: '',
    idauto: '',
    numero: '',
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [champRes, driversRes, carsRes] = await Promise.all([
          championshipsApi.getAll(),
          driversApi.getAll(),
          carsApi.getAll(),
        ]);
        setChampionships(champRes.data.data ?? []);
        setDrivers(driversRes.data.data ?? []);
        setCars(carsRes.data.data ?? []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOptions();
  }, []);

  const availableChampionships = useMemo(
    () => championships.filter(c => c.status !== 'completed'),
    [championships]
  );

  const handleChange = event => {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      await registrationsApi.create({
        ...form,
        pago: 0,
      });
      setMessage('Inscripcion registrada correctamente.');
      setForm({ idcampeonato: '', idpiloto: '', idauto: '', numero: '' });
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo registrar la inscripcion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-racing-gray border-b border-racing-border py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-racing-red text-xs uppercase tracking-widest font-semibold mb-2">Participa</p>
          <h1 className="section-title text-4xl md:text-5xl mb-2">
            Inscripcion <span className="gradient-text">a Campeonato</span>
          </h1>
          <p className="text-gray-400 max-w-xl">Alta simple sobre la tabla inscriptos: campeonato, piloto, auto y numero.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit} className="card-glass p-6 md:p-8 space-y-5">
          <label className="block">
            <span className="text-sm text-gray-300">Campeonato</span>
            <select name="idcampeonato" value={form.idcampeonato} onChange={handleChange} className="input-field mt-2" required>
              <option value="">Seleccionar campeonato</option>
              {availableChampionships.map(championship => (
                <option key={championship.id} value={championship.id}>
                  {championship.categoria} - Temporada {championship.temporada} ({championship.anio})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Piloto</span>
            <select name="idpiloto" value={form.idpiloto} onChange={handleChange} className="input-field mt-2" required>
              <option value="">Seleccionar piloto</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>{driver.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Auto</span>
            <select name="idauto" value={form.idauto} onChange={handleChange} className="input-field mt-2" required>
              <option value="">Seleccionar auto</option>
              {cars.map(car => (
                <option key={car.id} value={car.id}>{car.marca} {car.modelo}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-300">Numero</span>
            <input
              name="numero"
              type="number"
              min="1"
              max="255"
              value={form.numero}
              onChange={handleChange}
              className="input-field mt-2"
              required
            />
          </label>

          {message && (
            <div className="flex items-center gap-2 rounded-lg border border-racing-border bg-racing-dark px-4 py-3 text-sm text-gray-300">
              <CheckCircleIcon className="w-5 h-5 text-racing-red" />
              {message}
            </div>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar inscripcion'}
          </button>
        </form>
      </div>
    </div>
  );
}
