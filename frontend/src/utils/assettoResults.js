const invalidTime = 999999999999;

export const assettoSessionOptions = [
  { key: 'qualy_sprint', label: 'Clasificación Sprint', pilotField: 'piloto', positionField: 'pos_qualy_sprint', sanctionField: 'desc_sancion_qualy_sprint' },
  { key: 'sprint', label: 'Sprint', pilotField: 'piloto_sprint', positionField: 'pos_sprint', sanctionField: 'desc_sancion_sprint' },
  { key: 'qualy_final', label: 'Clasificación Final', pilotField: 'piloto', positionField: 'pos_qualy_final', sanctionField: 'desc_sancion_qualy_final' },
  { key: 'final', label: 'Final', pilotField: 'piloto_final', positionField: 'pos_final', sanctionField: 'desc_sancion_final' },
];

export const normalizeAssettoDriverName = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('es-AR');

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const penaltyNanosecondsToMilliseconds = value => {
  const nanoseconds = toFiniteNumber(value);
  return nanoseconds > 0 ? Math.round(nanoseconds / 1_000_000) : 0;
};

const getValidTime = value => {
  const time = toFiniteNumber(value, -1);
  return time > 0 && time < 999999999 ? time : null;
};

const getEntryKey = (result, index) => {
  if (result?.CarId !== undefined && result?.CarId !== null) return `car:${result.CarId}`;
  if (result?.DriverGuid) return `guid:${result.DriverGuid}`;
  return `driver:${normalizeAssettoDriverName(result?.DriverName)}:${index}`;
};

export const emptyAssettoSanction = () => ({
  type: 'DENUNCIA',
  minute: 0,
  second: 0,
  time: 0,
  positions: 0,
  warnings: 0,
  ballast: 0,
  dq: false,
  noSanction: false,
  description: '',
});

const hasAssettoSanctionValue = sanction => Boolean(sanction?.dq || sanction?.noSanction
  || toFiniteNumber(sanction?.time) > 0
  || toFiniteNumber(sanction?.positions) > 0
  || toFiniteNumber(sanction?.warnings) > 0
  || toFiniteNumber(sanction?.ballast) !== 0
  || String(sanction?.description || '').trim());

const sanctionReplayTime = sanction => (
  Math.max(0, Math.trunc(toFiniteNumber(sanction?.minute))) * 60
  + Math.min(59, Math.max(0, Math.trunc(toFiniteNumber(sanction?.second))))
);

const sortAssettoSanctionsByReplayTime = items => items
  .map((item, index) => ({ item, index }))
  .sort((a, b) => sanctionReplayTime(a.item) - sanctionReplayTime(b.item) || a.index - b.index)
  .map(entry => entry.item);

export const getAssettoSanctionItems = sanction => {
  if (Array.isArray(sanction?.items)) return sortAssettoSanctionsByReplayTime(sanction.items.filter(hasAssettoSanctionValue));
  return hasAssettoSanctionValue(sanction) ? [{ ...emptyAssettoSanction(), ...sanction, items: undefined }] : [];
};

export const aggregateAssettoSanctions = sanction => {
  const items = getAssettoSanctionItems(sanction);
  if (!items.length) return { ...emptyAssettoSanction(), items: [] };
  const activeItems = items.filter(item => !item.noSanction);
  return {
    ...emptyAssettoSanction(),
    time: activeItems.reduce((total, item) => total + Math.max(0, toFiniteNumber(item.time)), 0),
    positions: activeItems.reduce((total, item) => total + Math.max(0, Math.trunc(toFiniteNumber(item.positions))), 0),
    warnings: activeItems.reduce((total, item) => total + Math.max(0, Math.trunc(toFiniteNumber(item.warnings))), 0),
    ballast: activeItems.reduce((total, item) => total + Math.trunc(toFiniteNumber(item.ballast)), 0),
    dq: activeItems.some(item => Boolean(item.dq)),
    noSanction: activeItems.length === 0 && items.some(item => Boolean(item.noSanction)),
    items,
  };
};

export const parseAssettoResultJson = data => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.Result)) {
    throw new Error('El archivo no tiene una lista Result válida de Assetto Corsa.');
  }

  const cars = new Map((Array.isArray(data.Cars) ? data.Cars : [])
    .filter(car => car && car.CarId !== undefined)
    .map(car => [String(car.CarId), car]));

  const entries = data.Result.map((result, index) => {
    const car = cars.get(String(result?.CarId)) || {};
    const driver = car.Driver && typeof car.Driver === 'object' ? car.Driver : {};
    const driverName = String(result?.DriverName || driver.Name || `Piloto ${index + 1}`).trim();
    const automaticPenaltyMs = penaltyNanosecondsToMilliseconds(result?.PenaltyTime);
    const totalTimeMs = getValidTime(result?.TotalTime);
    const bestLapMs = getValidTime(result?.BestLap);
    return {
      key: getEntryKey(result, index),
      sourcePosition: index + 1,
      driverName,
      normalizedName: normalizeAssettoDriverName(driverName),
      driverGuid: String(result?.DriverGuid || driver.Guid || ''),
      carId: result?.CarId ?? '',
      carModel: String(result?.CarModel || car.Model || ''),
      laps: Math.max(0, Math.trunc(toFiniteNumber(result?.NumLaps))),
      totalTimeMs,
      bestLapMs,
      automaticPenaltyMs,
      serverDisqualified: Boolean(result?.Disqualified),
      raw: result,
    };
  });

  return {
    metadata: {
      type: String(data.Type || data.SessionConfig?.session_type || ''),
      date: String(data.Date || ''),
      eventName: String(data.EventName || ''),
      trackName: String(data.TrackName || ''),
      trackConfig: String(data.TrackConfig || ''),
    },
    entries,
  };
};

const getFinalTime = (entry, sanction, qualifying) => {
  const baseTimeMs = qualifying ? entry.bestLapMs : (entry.totalTimeMs ?? entry.bestLapMs);
  if (baseTimeMs === null) return invalidTime;
  return baseTimeMs + entry.automaticPenaltyMs + (Math.max(0, toFiniteNumber(sanction?.time)) * 1000);
};

const buildSingleAssettoSanctionLabel = sanction => {
  if (!sanction) return '';
  const description = String(sanction.description || '').trim();
  const moment = `${Math.max(0, Math.trunc(toFiniteNumber(sanction.minute)))}:${String(Math.min(59, Math.max(0, Math.trunc(toFiniteNumber(sanction.second))))).padStart(2, '0')}`;
  if (sanction.noSanction) {
    return [sanction.type || 'DENUNCIA', `MINUTO ${moment}`, 'NO HAY SANCIÓN', description].filter(Boolean).join(' · ');
  }

  const measures = [];
  if (sanction.dq) measures.push('EXCLUSIÓN PARCIAL');
  if (toFiniteNumber(sanction.warnings) > 0) measures.push(`${Math.trunc(toFiniteNumber(sanction.warnings))} AP`);
  if (toFiniteNumber(sanction.ballast) > 0) measures.push(`${Math.trunc(toFiniteNumber(sanction.ballast))} KG DE LASTRE`);
  if (toFiniteNumber(sanction.time) > 0) measures.push(`${toFiniteNumber(sanction.time)} SEG. DE RECARGO`);
  if (toFiniteNumber(sanction.positions) > 0) measures.push(`${Math.trunc(toFiniteNumber(sanction.positions))} PUESTO${Math.trunc(toFiniteNumber(sanction.positions)) === 1 ? '' : 'S'} DE RECARGO`);
  return [sanction.type || 'DENUNCIA', `MINUTO ${moment}`, ...measures, description].filter(Boolean).join(' · ');
};

export const buildAssettoSanctionLabel = sanction => {
  const items = getAssettoSanctionItems(sanction);
  if (!items.length) return '';
  return items.map(buildSingleAssettoSanctionLabel).join(' | ');
};

export const orderAssettoResults = (entries, sanctions = {}, sessionKey = '') => {
  const qualifying = String(sessionKey).startsWith('qualy');
  const prepared = entries.map(entry => {
    const sanction = aggregateAssettoSanctions(sanctions[entry.key]);
    return {
      ...entry,
      sanction,
      disqualified: entry.serverDisqualified || (sanction.dq && !sanction.noSanction),
      finalTimeMs: getFinalTime(entry, sanction, qualifying),
    };
  });

  const active = prepared
    .filter(entry => !entry.disqualified && (qualifying ? entry.bestLapMs !== null : entry.laps > 0))
    .sort((a, b) => qualifying
      ? a.finalTimeMs - b.finalTimeMs || a.sourcePosition - b.sourcePosition
      : b.laps - a.laps || a.finalTimeMs - b.finalTimeMs || a.sourcePosition - b.sourcePosition);
  const withoutResult = prepared
    .filter(entry => !entry.disqualified && (qualifying ? entry.bestLapMs === null : entry.laps === 0))
    .sort((a, b) => a.sourcePosition - b.sourcePosition);
  const disqualified = prepared
    .filter(entry => entry.disqualified)
    .sort((a, b) => a.sourcePosition - b.sourcePosition);

  [...active].forEach(entry => {
    const places = Math.max(0, Math.trunc(toFiniteNumber(entry.sanction.positions)));
    if (!places || entry.sanction.noSanction) return;
    const origin = active.indexOf(entry);
    const target = Math.min(origin + places, active.length - 1);
    active.splice(origin, 1);
    active.splice(target, 0, entry);
  });

  const ordered = [...active, ...withoutResult, ...disqualified];
  const leaderLaps = Math.max(0, ...ordered.map(entry => entry.laps));
  return ordered.map((entry, index) => ({
    ...entry,
    position: index + 1,
    positionLabel: entry.disqualified
      ? 'DQ'
      : qualifying
        ? entry.bestLapMs === null ? 'S/TIEMPO' : String(index + 1)
        : entry.laps === 0
          ? 'NO LARGÓ'
          : leaderLaps && entry.laps < (leaderLaps / 2)
            ? `(${entry.laps} V)`
            : String(index + 1),
    sanctionLabel: buildAssettoSanctionLabel(entry.sanction),
  }));
};
