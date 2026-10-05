import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { carsApi, championshipsApi, driversApi, eventsApi, importerApi, registrationsApi, resultsApi } from '../services/api';

const tabs = [
  { id: 'pilotos', label: 'Pilotos' },
  { id: 'inscriptos', label: 'Inscriptos' },
  { id: 'resultados', label: 'Resultados' },
];

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es-AR');
const capitalize = value => String(value || '').trim().toLocaleLowerCase('es-AR').replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);
const numeric = value => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};
const clipboardRows = text => String(text || '').replace(/\r/g, '').split('\n').filter((line, index, rows) => line || index < rows.length - 1).map(line => line.split('\t'));
const blankDriver = () => ({ nombre: '', localidad: '', provincia: '', telefono: '', nacionalidad: 'ar', steam: '', ig: '' });
const blankRegistration = () => ({ piloto: '', auto: '', numero: '', pago: true });
const resultFields = ['presentismo', 'pos_qualy_sprint', 'pts_qualy_sprint', 'pos_sprint', 'pts_sprint', 'pos_qualy_final', 'pts_qualy_final', 'pos_final', 'pts_final'];
const scoringFields = ['sprint', 'final', 'qualyFinal', 'qualySprint'];
const resultFieldLabels = {
  presentismo: 'P', pos_qualy_sprint: 'POS QS', pts_qualy_sprint: 'PTS QS', pos_sprint: 'POS S', pts_sprint: 'PTS S',
  pos_qualy_final: 'POS QF', pts_qualy_final: 'PTS QF', pos_final: 'POS F', pts_final: 'PTS F',
};
const blankEventResult = () => Object.fromEntries(resultFields.map(field => [field, '']));
const blankResultRow = events => ({ selected: false, piloto: '', auto: '', numero: '', pago: true, events: Object.fromEntries(events.map(event => [String(event.ronda), blankEventResult()])) });

function ImportInput({ value, onChange, onPaste, rowIndex, columnIndex, className = '', list, type = 'text' }) {
  return <input type={type} value={value ?? ''} list={list} onChange={event => onChange(event.target.value)} onPaste={event => {
    const matrix = clipboardRows(event.clipboardData.getData('text/plain'));
    if (matrix.length > 1 || matrix[0]?.length > 1) {
      event.preventDefault();
      onPaste?.(matrix, rowIndex, columnIndex);
    }
  }} className={`h-9 w-full min-w-0 bg-transparent px-2 text-sm text-white outline-none focus:bg-sky-500/10 focus:ring-1 focus:ring-inset focus:ring-sky-400 ${className}`} />;
}

export default function CadpoImporter() {
  const [activeTab, setActiveTab] = useState('pilotos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [championships, setChampionships] = useState([]);
  const [events, setEvents] = useState([]);
  const [cars, setCars] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [savedResults, setSavedResults] = useState([]);

  const [driverRows, setDriverRows] = useState(() => Array.from({ length: 50 }, blankDriver));
  const [driverColumns, setDriverColumns] = useState(['nombre', 'localidad', 'provincia', 'telefono', 'nacionalidad', 'steam', 'ig']);
  const [registrationChampionshipId, setRegistrationChampionshipId] = useState('');
  const [registrationRows, setRegistrationRows] = useState(() => Array.from({ length: 30 }, blankRegistration));
  const [registrationRowCount, setRegistrationRowCount] = useState(30);

  const [resultChampionshipId, setResultChampionshipId] = useState('');
  const [resultRowCount, setResultRowCount] = useState(30);
  const [scoring, setScoring] = useState(() => Array.from({ length: 30 }, () => ({ sprint: '', final: '', qualyFinal: '', qualySprint: '' })));
  const [resultRows, setResultRows] = useState([]);
  const [resultMultipliers, setResultMultipliers] = useState({});
  const [visibleResultFields, setVisibleResultFields] = useState(resultFields);

  const loadData = async () => {
    setLoading(true);
    try {
      const [driversResponse, championshipsResponse, eventsResponse, carsResponse, registrationsResponse, resultsResponse] = await Promise.all([
        driversApi.getAll(), championshipsApi.getAll(), eventsApi.getAll(), carsApi.getAll(), registrationsApi.getAll(), resultsApi.getAll(),
      ]);
      setDrivers(driversResponse.data.data ?? []);
      setChampionships(championshipsResponse.data.data ?? []);
      setEvents(eventsResponse.data.data ?? []);
      setCars(carsResponse.data.data ?? []);
      setRegistrations(registrationsResponse.data.data ?? []);
      setSavedResults(resultsResponse.data.data ?? []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'No se pudieron cargar los datos del importador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const driverStatuses = useMemo(() => {
    const existing = new Set(drivers.map(driver => normalize(driver.nombre)));
    const seen = new Set();
    return driverRows.map(row => {
      const key = normalize(row.nombre);
      if (!key) return { state: 'empty', text: '' };
      if (existing.has(key)) return { state: 'error', text: 'YA EXISTE' };
      if (seen.has(key)) return { state: 'error', text: 'REPETIDO' };
      seen.add(key);
      return { state: 'ready', text: 'LISTO' };
    });
  }, [driverRows, drivers]);

  const updateDriver = (rowIndex, field, value) => setDriverRows(current => current.map((row, index) => index === rowIndex ? {
    ...row,
    [field]: field === 'nombre' || field === 'localidad' || field === 'provincia' ? capitalize(value) : field === 'telefono' ? String(value).replace(/\D/g, '') : field === 'nacionalidad' ? String(value).toLowerCase() : value,
  } : row));
  const pasteDrivers = (matrix, startRow, startColumn) => setDriverRows(current => {
    const next = [...current];
    while (next.length < startRow + matrix.length) next.push(blankDriver());
    matrix.forEach((sourceRow, rowOffset) => sourceRow.forEach((value, columnOffset) => {
      const field = driverColumns[startColumn + columnOffset];
      if (field) next[startRow + rowOffset] = { ...next[startRow + rowOffset], [field]: field === 'telefono' ? value.replace(/\D/g, '') : ['nombre', 'localidad', 'provincia'].includes(field) ? capitalize(value) : field === 'nacionalidad' ? value.toLowerCase() : value };
    }));
    return next;
  });

  const saveDrivers = async () => {
    const payload = driverRows.filter((row, index) => driverStatuses[index].state === 'ready').map(row => ({ ...row, nombre: capitalize(row.nombre), localidad: capitalize(row.localidad), provincia: capitalize(row.provincia) }));
    if (!payload.length) return setMessage('No hay pilotos nuevos listos para guardar.');
    setSaving(true);
    try {
      const response = await importerApi.importDrivers(payload);
      setMessage(`${response.data.data.inserted.length} pilotos agregados · ${response.data.data.skipped.length} omitidos.`);
      setDriverRows(Array.from({ length: 50 }, blankDriver));
      await loadData();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudieron importar los pilotos.'); }
    finally { setSaving(false); }
  };

  const registrationChampionship = championships.find(item => String(item.id) === registrationChampionshipId);
  const registrationCars = useMemo(() => cars.filter(car => registrationChampionship && String(car.idcategoria) === String(registrationChampionship.idcategoria)), [cars, registrationChampionship]);
  const existingRegistrationDrivers = useMemo(() => new Set(registrations.filter(item => String(item.idcampeonato) === registrationChampionshipId).map(item => String(item.idpiloto))), [registrations, registrationChampionshipId]);
  const driverMap = useMemo(() => new Map(drivers.map(driver => [normalize(driver.nombre), driver])), [drivers]);
  const registrationCarMap = useMemo(() => new Map(registrationCars.map(car => [normalize(`${car.marca} ${car.modelo}`), car])), [registrationCars]);
  const registrationStatuses = useMemo(() => {
    const seenDrivers = new Set();
    const seenNumbers = new Set(registrations.filter(item => String(item.idcampeonato) === registrationChampionshipId).map(item => Number(item.numero)).filter(Boolean));
    return registrationRows.map(row => {
      if (!row.piloto && !row.auto) return { state: 'empty', text: '' };
      const driver = driverMap.get(normalize(row.piloto));
      const car = registrationCarMap.get(normalize(row.auto));
      const number = Number(String(row.numero || '').replace(/\D/g, '') || 0);
      if (!driver) return { state: 'error', text: 'PILOTO NO REGISTRADO' };
      if (existingRegistrationDrivers.has(String(driver.id))) return { state: 'error', text: 'YA ESTÁ INSCRIPTO' };
      if (seenDrivers.has(String(driver.id))) return { state: 'error', text: 'PILOTO REPETIDO' };
      if (!car) return { state: 'error', text: 'AUTO NO VÁLIDO' };
      if (number < 0 || number > 255) return { state: 'error', text: 'NÚMERO INVÁLIDO' };
      if (number > 0 && seenNumbers.has(number)) return { state: 'error', text: 'NÚMERO OCUPADO' };
      seenDrivers.add(String(driver.id));
      if (number > 0) seenNumbers.add(number);
      return { state: 'ready', text: 'LISTO' };
    });
  }, [registrationRows, driverMap, registrationCarMap, existingRegistrationDrivers, registrations, registrationChampionshipId]);

  const resizeRegistrationRows = count => {
    const size = Math.min(500, Math.max(1, Number(count) || 1));
    setRegistrationRowCount(size);
    setRegistrationRows(current => Array.from({ length: size }, (_, index) => current[index] || blankRegistration()));
  };
  const updateRegistration = (rowIndex, field, value) => setRegistrationRows(current => current.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row));
  const registrationColumns = ['piloto', 'auto', 'numero', 'pago'];
  const pasteRegistrations = (matrix, startRow, startColumn) => setRegistrationRows(current => {
    const next = [...current];
    while (next.length < startRow + matrix.length && next.length < 500) next.push(blankRegistration());
    matrix.forEach((sourceRow, rowOffset) => sourceRow.forEach((value, columnOffset) => {
      const field = registrationColumns[startColumn + columnOffset];
      const index = startRow + rowOffset;
      if (!field || !next[index]) return;
      next[index] = { ...next[index], [field]: field === 'pago' ? ['1', 'true', 'si', 'sí', 'x'].includes(normalize(value)) : field === 'numero' ? value.replace(/\D/g, '') : value };
    }));
    setRegistrationRowCount(next.length);
    return next;
  });
  const saveRegistrations = async () => {
    if (!registrationChampionshipId) return setMessage('Seleccioná un campeonato.');
    const payload = registrationRows.flatMap((row, index) => {
      if (registrationStatuses[index].state !== 'ready') return [];
      return [{ idpiloto: driverMap.get(normalize(row.piloto)).id, idauto: registrationCarMap.get(normalize(row.auto)).id, numero: Number(row.numero || 0), pago: Boolean(row.pago) }];
    });
    if (!payload.length) return setMessage('No hay inscriptos válidos para guardar.');
    setSaving(true);
    try {
      const response = await importerApi.importRegistrations(registrationChampionshipId, payload);
      setMessage(`${response.data.data.inserted.length} inscriptos agregados · ${response.data.data.skipped.length} omitidos.`);
      setRegistrationRows(Array.from({ length: registrationRowCount }, blankRegistration));
      await loadData();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudieron importar los inscriptos.'); }
    finally { setSaving(false); }
  };

  const availableResultChampionships = championships.filter(championship => !savedResults.some(result => String(result.idcampeonato) === String(championship.id)));
  const resultChampionship = championships.find(item => String(item.id) === resultChampionshipId);
  const resultEvents = events.filter(event => String(event.idcampeonato) === resultChampionshipId).sort((a, b) => Number(a.ronda) - Number(b.ronda));
  const resultRegistrations = registrations.filter(item => String(item.idcampeonato) === resultChampionshipId);
  const resultDrivers = resultRegistrations.map(registration => drivers.find(driver => String(driver.id) === String(registration.idpiloto))).filter(Boolean);
  const resultDriverMap = useMemo(() => new Map(resultDrivers.map(driver => [normalize(driver.nombre), driver])), [resultDrivers]);

  const resizeResultRows = count => {
    const size = Math.min(500, Math.max(1, Number(count) || 1));
    setResultRowCount(size);
    setScoring(current => Array.from({ length: size }, (_, index) => current[index] || { sprint: '', final: '', qualyFinal: '', qualySprint: '' }));
  };
  const pasteScoring = (event, startRow, startColumn) => {
    const matrix = clipboardRows(event.clipboardData.getData('text/plain'));
    if (matrix.length <= 1 && matrix[0]?.length <= 1) return;
    event.preventDefault();
    setScoring(current => {
      const next = current.map(row => ({ ...row }));
      matrix.forEach((sourceRow, rowOffset) => sourceRow.forEach((value, columnOffset) => {
        const rowIndex = startRow + rowOffset;
        const field = scoringFields[startColumn + columnOffset];
        if (next[rowIndex] && field) next[rowIndex][field] = value.trim();
      }));
      return next;
    });
  };
  const initializeResults = () => {
    if (!resultChampionshipId) return setMessage('Seleccioná un campeonato para crear la planilla.');
    if (!resultEvents.length) return setMessage('El campeonato no tiene fechas cargadas.');
    const registrationByDriver = new Map(resultRegistrations.map(registration => [String(registration.idpiloto), registration]));
    const rows = Array.from({ length: Math.max(resultRowCount, resultDrivers.length) }, (_, index) => {
      const driver = resultDrivers[index];
      const registration = driver ? registrationByDriver.get(String(driver.id)) : null;
      return {
        ...blankResultRow(resultEvents),
        piloto: driver?.nombre || '',
        auto: registration ? [registration.marca, registration.modelo].filter(Boolean).join(' ') : '',
        numero: registration?.numero ?? '',
        pago: registration ? Boolean(Number(registration.pago)) : true,
      };
    });
    setResultRows(rows);
    setResultRowCount(rows.length);
    setResultMultipliers(Object.fromEntries(resultEvents.map(event => [String(event.ronda), { sprint: 1, final: 1 }])));
    setMessage('Planilla creada. Podés pegar los puntajes desde Excel.');
  };

  const scorePosition = (field, points, multiplier = 1) => {
    if (!numeric(points) || multiplier <= 0) return '';
    const scoreField = field === 'pts_sprint' ? 'sprint' : field === 'pts_final' ? 'final' : field === 'pts_qualy_final' ? 'qualyFinal' : 'qualySprint';
    const base = numeric(points) / multiplier;
    const index = scoring.findIndex(row => Math.abs(numeric(row[scoreField]) - base) < 0.000001 && String(row[scoreField]).trim() !== '');
    return index >= 0 ? String(index + 1) : '';
  };
  const updateResultMultiplier = (round, field, rawValue) => {
    const value = numeric(rawValue) || 1;
    const roundKey = String(round);
    setResultMultipliers(current => ({ ...current, [roundKey]: { ...current[roundKey], [field]: value } }));
    const pointsField = field === 'sprint' ? 'pts_sprint' : 'pts_final';
    const positionField = field === 'sprint' ? 'pos_sprint' : 'pos_final';
    setResultRows(current => current.map(row => {
      const eventData = row.events[roundKey];
      if (!eventData || !numeric(eventData[pointsField])) return row;
      return { ...row, events: { ...row.events, [roundKey]: { ...eventData, [positionField]: scorePosition(pointsField, eventData[pointsField], value) } } };
    }));
  };
  const updateResultCell = (rowIndex, round, field, value) => setResultRows(current => current.map((row, index) => {
    if (index !== rowIndex) return row;
    const nextEvent = { ...row.events[String(round)], [field]: value };
    const multiplier = resultMultipliers[String(round)] || { sprint: 1, final: 1 };
    const positionField = field === 'pts_sprint' ? 'pos_sprint' : field === 'pts_final' ? 'pos_final' : field === 'pts_qualy_final' ? 'pos_qualy_final' : field === 'pts_qualy_sprint' ? 'pos_qualy_sprint' : '';
    if (positionField && numeric(value)) nextEvent[positionField] = scorePosition(field, value, field === 'pts_sprint' ? multiplier.sprint : field === 'pts_final' ? multiplier.final : 1);
    return { ...row, events: { ...row.events, [String(round)]: nextEvent } };
  }));
  const updateResultIdentity = (rowIndex, field, value) => setResultRows(current => current.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row));
  const flatResultColumns = useMemo(() => ['piloto', 'auto', 'numero', 'pago', ...resultEvents.flatMap(event => visibleResultFields.map(field => `${event.ronda}:${field}`))], [resultEvents, visibleResultFields]);
  const pasteResultGrid = (matrix, startRow, startColumn) => setResultRows(current => {
    const next = [...current];
    while (next.length < startRow + matrix.length && next.length < 500) next.push(blankResultRow(resultEvents));
    matrix.forEach((sourceRow, rowOffset) => sourceRow.forEach((value, columnOffset) => {
      const column = flatResultColumns[startColumn + columnOffset];
      const index = startRow + rowOffset;
      if (!column || !next[index]) return;
      if (!column.includes(':')) next[index] = { ...next[index], [column]: column === 'pago' ? ['1', 'true', 'si', 'sí', 'x'].includes(normalize(value)) : value };
      else {
        const [round, field] = column.split(':');
        const eventData = { ...next[index].events[round], [field]: value === '-' || value === '0' ? '' : value };
        const multiplier = resultMultipliers[round] || { sprint: 1, final: 1 };
        const positionField = field === 'pts_sprint' ? 'pos_sprint' : field === 'pts_final' ? 'pos_final' : field === 'pts_qualy_final' ? 'pos_qualy_final' : field === 'pts_qualy_sprint' ? 'pos_qualy_sprint' : '';
        if (positionField && numeric(value)) eventData[positionField] = scorePosition(field, value, field === 'pts_sprint' ? multiplier.sprint : field === 'pts_final' ? multiplier.final : 1);
        next[index] = { ...next[index], events: { ...next[index].events, [round]: eventData } };
      }
    }));
    setResultRowCount(next.length);
    return next;
  });
  const resultRowSummary = row => ({
    total: Object.values(row.events).reduce((total, event) => total + numeric(event.presentismo) + numeric(event.pts_qualy_sprint) + numeric(event.pts_sprint) + numeric(event.pts_qualy_final) + numeric(event.pts_final), 0),
    victories: Object.values(row.events).filter(event => String(event.pos_final).trim() === '1').length,
  });
  const saveResults = async () => {
    const errors = [];
    const usedDrivers = new Set();
    const changes = [];
    resultRows.forEach((row, rowIndex) => {
      const hasData = Object.values(row.events).some(event => Object.values(event).some(value => String(value).trim() && String(value).trim() !== '0'));
      if (!row.piloto && !hasData) return;
      const driver = resultDriverMap.get(normalize(row.piloto));
      if (!driver) return errors.push(`Fila ${rowIndex + 1}: piloto no encontrado entre los inscriptos.`);
      if (usedDrivers.has(String(driver.id))) return errors.push(`Fila ${rowIndex + 1}: piloto repetido.`);
      usedDrivers.add(String(driver.id));
      resultEvents.forEach(event => {
        const values = row.events[String(event.ronda)] || blankEventResult();
        if (!Object.values(values).some(value => String(value).trim() && String(value).trim() !== '0')) return;
        for (const [field, label, integerOnly] of [
          ['presentismo', 'presentismo', true],
          ['pts_qualy_sprint', 'puntos Qualy Sprint', true],
          ['pts_sprint', 'puntos Sprint', false],
          ['pts_qualy_final', 'puntos Qualy Final', true],
          ['pts_final', 'puntos Final', false],
        ]) {
          const text = String(values[field] ?? '').trim().replace(',', '.');
          if (!text || text === '-') continue;
          const parsed = Number(text);
          if (!Number.isFinite(parsed) || parsed < 0 || (integerOnly && !Number.isInteger(parsed))) {
            errors.push(`Fila ${rowIndex + 1}, F${event.ronda}: ${label} no es válido.`);
          }
        }
        for (const [pointsField, positionField, label] of [['pts_qualy_sprint', 'pos_qualy_sprint', 'Qualy Sprint'], ['pts_sprint', 'pos_sprint', 'Sprint'], ['pts_qualy_final', 'pos_qualy_final', 'Qualy Final'], ['pts_final', 'pos_final', 'Final']]) {
          if (numeric(values[pointsField]) > 0 && !String(values[positionField]).trim()) errors.push(`Fila ${rowIndex + 1}, F${event.ronda}: los puntos de ${label} no coinciden con la escala.`);
        }
        changes.push({ data: {
          idcampeonato: Number(resultChampionshipId), fecha: String(event.fecha).slice(0, 10), ronda: Number(event.ronda), idcircuito: Number(event.idcircuito), idpiloto: Number(driver.id),
          presentismo: numeric(values.presentismo), pos_qualy_sprint: String(values.pos_qualy_sprint || '').toUpperCase(), pts_qualy_sprint: numeric(values.pts_qualy_sprint),
          pos_sprint: String(values.pos_sprint || '').toUpperCase(), pts_sprint: numeric(values.pts_sprint), pos_qualy_final: String(values.pos_qualy_final || '').toUpperCase(), pts_qualy_final: numeric(values.pts_qualy_final),
          pos_final: String(values.pos_final || '').toUpperCase(), pts_final: numeric(values.pts_final),
        }});
      });
    });
    if (errors.length) return setMessage(errors.slice(0, 5).join(' '));
    if (!changes.length) return setMessage('No hay resultados válidos para guardar.');
    setSaving(true);
    try {
      await resultsApi.saveBulk(changes);
      setMessage(`${changes.length} resultados importados correctamente.`);
      setResultRows([]);
      await loadData();
    } catch (error) { setMessage(error.response?.data?.error || 'No se pudieron importar los resultados.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-72 items-center justify-center"><ArrowPathIcon className="h-9 w-9 animate-spin text-racing-red" /></div>;

  return <section className="min-w-0">
    <div className="flex flex-col gap-3 border-b border-racing-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-racing-red">Importador CADPO</p><h2 className="mt-1 font-racing text-3xl font-bold">Cargas masivas</h2><p className="mt-1 text-sm text-gray-500">Pegá directamente desde Excel, validá y guardá todo en una sola operación.</p></div>
      <button type="button" onClick={loadData} className="btn-secondary gap-2"><ArrowPathIcon className="h-4 w-4" />Actualizar datos</button>
    </div>
    <div className="mt-4 flex gap-2 overflow-x-auto">
      {tabs.map(tab => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setMessage(''); }} className={`h-10 shrink-0 border px-5 font-racing text-xs font-bold uppercase ${activeTab === tab.id ? 'border-racing-red bg-racing-red text-white' : 'border-racing-border bg-racing-card text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
    </div>
    {message ? <div className="mt-4 border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div> : null}

    {activeTab === 'pilotos' ? <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{Object.entries({ nombre: 'Nombre', localidad: 'Localidad', provincia: 'Provincia', telefono: 'Teléfono', nacionalidad: 'País', steam: 'Steam', ig: 'Instagram' }).map(([key, label]) => <label key={key} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400"><input type="checkbox" checked={driverColumns.includes(key)} onChange={event => setDriverColumns(current => event.target.checked ? [...current, key] : current.filter(field => field !== key))} className="accent-red-500" />{label}</label>)}</div><button type="button" onClick={saveDrivers} disabled={saving} className="btn-primary disabled:opacity-40">{saving ? 'Guardando...' : `Guardar pilotos (${driverStatuses.filter(status => status.state === 'ready').length})`}</button></div>
      <div className="overflow-x-auto border border-racing-border"><table className="w-full min-w-[900px] border-collapse text-sm"><thead><tr className="bg-racing-dark text-[10px] uppercase text-gray-500"><th className="w-12 border border-racing-border px-2 py-3">#</th>{driverColumns.map(field => <th key={field} className="border border-racing-border px-3 py-3 text-left">{field}</th>)}<th className="border border-racing-border px-3 py-3">Estado</th></tr></thead><tbody>{driverRows.map((row, rowIndex) => <tr key={rowIndex} className={driverStatuses[rowIndex].state === 'ready' ? 'bg-emerald-500/[0.05]' : driverStatuses[rowIndex].state === 'error' ? 'bg-red-500/[0.06]' : 'bg-racing-gray'}><td className="border border-racing-border text-center text-gray-600">{rowIndex + 1}</td>{driverColumns.map((field, columnIndex) => <td key={field} className="min-w-32 border border-racing-border p-0"><ImportInput value={row[field]} onChange={value => updateDriver(rowIndex, field, value)} onPaste={pasteDrivers} rowIndex={rowIndex} columnIndex={columnIndex} /></td>)}<td className={`border border-racing-border px-3 text-center text-[9px] font-bold ${driverStatuses[rowIndex].state === 'ready' ? 'text-emerald-400' : 'text-red-400'}`}>{driverStatuses[rowIndex].text}</td></tr>)}</tbody></table></div>
    </div> : null}

    {activeTab === 'inscriptos' ? <div className="mt-5">
      <div className="mb-3 grid gap-3 md:grid-cols-[minmax(280px,1fr)_120px_auto]"><label><span className="text-xs font-bold uppercase text-gray-500">Campeonato</span><select value={registrationChampionshipId} onChange={event => { setRegistrationChampionshipId(event.target.value); setRegistrationRows(Array.from({ length: registrationRowCount }, blankRegistration)); }} className="input-field mt-1"><option value="">Seleccionar</option>{championships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label><label><span className="text-xs font-bold uppercase text-gray-500">Filas</span><input type="number" min="1" max="500" value={registrationRowCount} onChange={event => resizeRegistrationRows(event.target.value)} className="input-field mt-1 text-center" /></label><button type="button" onClick={saveRegistrations} disabled={saving || !registrationChampionshipId} className="btn-primary self-end disabled:opacity-40">Guardar inscriptos ({registrationStatuses.filter(status => status.state === 'ready').length})</button></div>
      <datalist id="importer-drivers">{drivers.map(driver => <option key={driver.id} value={driver.nombre} />)}</datalist><datalist id="importer-cars">{registrationCars.map(car => <option key={car.id} value={`${car.marca} ${car.modelo}`} />)}</datalist>
      <div className="overflow-x-auto border border-racing-border"><table className="w-full min-w-[900px] border-collapse"><thead><tr className="bg-racing-dark text-[10px] uppercase text-gray-500"><th className="w-12 border border-racing-border">#</th><th className="border border-racing-border px-3 py-3 text-left">Piloto</th><th className="border border-racing-border px-3 py-3 text-left">Auto</th><th className="w-24 border border-racing-border">Número</th><th className="w-20 border border-racing-border">Pago</th><th className="border border-racing-border">Estado</th></tr></thead><tbody>{registrationRows.map((row, rowIndex) => <tr key={rowIndex} className={registrationStatuses[rowIndex].state === 'ready' ? 'bg-emerald-500/[0.05]' : registrationStatuses[rowIndex].state === 'error' ? 'bg-red-500/[0.06]' : 'bg-racing-gray'}><td className="border border-racing-border text-center text-gray-600">{rowIndex + 1}</td><td className="border border-racing-border p-0"><ImportInput value={row.piloto} list="importer-drivers" onChange={value => updateRegistration(rowIndex, 'piloto', value)} onPaste={pasteRegistrations} rowIndex={rowIndex} columnIndex={0} /></td><td className="border border-racing-border p-0"><ImportInput value={row.auto} list="importer-cars" onChange={value => updateRegistration(rowIndex, 'auto', value)} onPaste={pasteRegistrations} rowIndex={rowIndex} columnIndex={1} /></td><td className="border border-racing-border p-0"><ImportInput value={row.numero} onChange={value => updateRegistration(rowIndex, 'numero', value.replace(/\D/g, ''))} onPaste={pasteRegistrations} rowIndex={rowIndex} columnIndex={2} className="text-center" /></td><td className="border border-racing-border text-center"><input type="checkbox" checked={row.pago} onChange={event => updateRegistration(rowIndex, 'pago', event.target.checked)} className="h-5 w-5 accent-red-500" /></td><td className={`border border-racing-border px-3 text-center text-[9px] font-bold ${registrationStatuses[rowIndex].state === 'ready' ? 'text-emerald-400' : 'text-red-400'}`}>{registrationStatuses[rowIndex].text}</td></tr>)}</tbody></table></div>
    </div> : null}

    {activeTab === 'resultados' ? <div className="mt-5">
      {!resultRows.length ? <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.7fr)_minmax(520px,1.3fr)]"><div className="space-y-4"><label className="block"><span className="text-xs font-bold uppercase text-gray-500">Campeonato sin resultados</span><select value={resultChampionshipId} onChange={event => setResultChampionshipId(event.target.value)} className="input-field mt-1"><option value="">Seleccionar</option>{availableResultChampionships.map(item => <option key={item.id} value={item.id}>{item.categoria} · T{item.temporada} · {item.anio}</option>)}</select></label><label className="block"><span className="text-xs font-bold uppercase text-gray-500">Cantidad de pilotos</span><input type="number" min="1" max="500" value={resultRowCount} onChange={event => resizeResultRows(event.target.value)} className="input-field mt-1" /></label><button type="button" onClick={initializeResults} className="btn-primary w-full justify-center">Crear planilla</button></div><div><p className="mb-2 text-xs font-bold uppercase text-gray-400">Puntajes por posición</p><div className="max-h-[430px] overflow-auto border border-racing-border"><table className="w-full border-collapse text-sm"><thead className="sticky top-0 bg-racing-dark text-[9px] uppercase text-gray-500"><tr><th className="border border-racing-border p-2">Pos.</th><th className="border border-racing-border p-2">Sprint</th><th className="border border-racing-border p-2">Final</th><th className="border border-racing-border p-2">Qualy Final</th><th className="border border-racing-border p-2">Qualy Sprint</th></tr></thead><tbody>{scoring.map((row, index) => <tr key={index}><td className="border border-racing-border text-center font-racing text-gray-500">P{index + 1}</td>{scoringFields.map((field, fieldIndex) => <td key={field} className="border border-racing-border p-0"><input value={row[field]} onChange={event => setScoring(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, [field]: event.target.value } : item))} onPaste={event => pasteScoring(event, index, fieldIndex)} className="h-8 w-full bg-transparent px-2 text-center text-white outline-none focus:bg-sky-500/10" /></td>)}</tr>)}</tbody></table></div></div></div> : <>
        <div className="mb-3 flex flex-col gap-3 border border-racing-border bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-racing text-lg font-bold">{resultChampionship?.categoria} · T{resultChampionship?.temporada} · {resultChampionship?.anio}</p><p className="text-xs text-gray-500">{resultEvents.length} fechas · {resultRows.length} filas</p></div><div className="flex gap-2"><button type="button" onClick={() => setResultRows(current => [...current, blankResultRow(resultEvents)])} className="btn-secondary gap-1"><PlusIcon className="h-4 w-4" />Fila</button><button type="button" onClick={() => setResultRows(current => current.filter(row => !row.selected))} className="btn-secondary gap-1"><TrashIcon className="h-4 w-4" />Seleccionadas</button><button type="button" onClick={saveResults} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar todo'}</button></div></div><div className="flex flex-wrap gap-x-3 gap-y-1">{resultFields.map(field => <label key={field} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-gray-500"><input type="checkbox" checked={visibleResultFields.includes(field)} onChange={event => setVisibleResultFields(current => event.target.checked ? [...current, field] : current.filter(item => item !== field))} className="accent-red-500" />{resultFieldLabels[field]}</label>)}</div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{resultEvents.map(event => <div key={event.ronda} className="grid grid-cols-[1fr_70px_70px] items-center gap-2 border border-racing-border px-2 py-1.5"><span className="truncate text-[10px] font-bold uppercase text-gray-400">F{event.ronda} · {event.circuito}</span>{['sprint', 'final'].map(field => <label key={field} className="text-[8px] uppercase text-gray-600">{field}<input type="number" min="0.1" step="0.1" value={resultMultipliers[String(event.ronda)]?.[field] ?? 1} onChange={change => updateResultMultiplier(event.ronda, field, change.target.value)} className="ml-1 w-10 bg-black/30 text-center text-white" /></label>)}</div>)}</div></div>
        <datalist id="importer-result-drivers">{resultDrivers.map(driver => <option key={driver.id} value={driver.nombre} />)}</datalist>
        <div className="overflow-x-auto border border-racing-border"><table className="w-max min-w-full border-collapse text-xs"><thead><tr className="bg-racing-dark text-[9px] uppercase text-gray-500"><th className="sticky left-0 z-20 w-9 border border-racing-border bg-racing-dark"></th><th className="sticky left-9 z-20 min-w-56 border border-racing-border bg-racing-dark px-3 py-3 text-left">Piloto</th><th className="min-w-44 border border-racing-border">Auto</th><th className="w-20 border border-racing-border">N°</th><th className="w-16 border border-racing-border">Pago</th>{resultEvents.flatMap(event => visibleResultFields.map(field => <th key={`${event.ronda}-${field}`} className="min-w-20 border border-racing-border px-2 py-2" title={`Fecha ${event.ronda} · ${field}`}>F{event.ronda}<br/><span className="text-red-400">{resultFieldLabels[field]}</span></th>))}<th className="min-w-20 border border-amber-400/30 text-amber-300">Total</th><th className="min-w-20 border border-emerald-400/30 text-emerald-300">Victorias</th></tr></thead><tbody>{resultRows.map((row, rowIndex) => { const summary = resultRowSummary(row); return <tr key={rowIndex} className={rowIndex % 2 ? 'bg-black/10' : 'bg-racing-gray'}><td className="sticky left-0 z-10 border border-racing-border bg-racing-dark text-center"><input type="checkbox" checked={row.selected} onChange={event => updateResultIdentity(rowIndex, 'selected', event.target.checked)} className="accent-red-500" /></td><td className="sticky left-9 z-10 border border-racing-border bg-racing-gray p-0"><ImportInput value={row.piloto} list="importer-result-drivers" onChange={value => updateResultIdentity(rowIndex, 'piloto', value)} onPaste={pasteResultGrid} rowIndex={rowIndex} columnIndex={0} /></td><td className="border border-racing-border p-0"><ImportInput value={row.auto} onChange={value => updateResultIdentity(rowIndex, 'auto', value)} onPaste={pasteResultGrid} rowIndex={rowIndex} columnIndex={1} /></td><td className="border border-racing-border p-0"><ImportInput value={row.numero} onChange={value => updateResultIdentity(rowIndex, 'numero', value)} onPaste={pasteResultGrid} rowIndex={rowIndex} columnIndex={2} className="text-center" /></td><td className="border border-racing-border text-center"><input type="checkbox" checked={row.pago} onChange={event => updateResultIdentity(rowIndex, 'pago', event.target.checked)} className="accent-red-500" /></td>{resultEvents.flatMap(event => visibleResultFields.map((field, fieldIndex) => <td key={`${event.ronda}-${field}`} className="border border-racing-border p-0"><ImportInput value={row.events[String(event.ronda)]?.[field] || ''} onChange={value => updateResultCell(rowIndex, event.ronda, field, value)} onPaste={pasteResultGrid} rowIndex={rowIndex} columnIndex={4 + (resultEvents.findIndex(item => item.ronda === event.ronda) * visibleResultFields.length) + fieldIndex} className="text-center" /></td>))}<td className="border border-amber-400/30 bg-amber-400/10 text-center font-racing text-base text-amber-300">{summary.total || ''}</td><td className="border border-emerald-400/30 bg-emerald-400/10 text-center font-racing text-base text-emerald-300">{summary.victories || ''}</td></tr>; })}</tbody></table></div>
      </>}</div> : null}
  </section>;
}
