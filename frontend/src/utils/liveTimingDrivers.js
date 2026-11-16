// Each snapshot may repeat the same driver/car in connected and stored data.
// Merge those counters with max before adding the laps across different cars.
export const mergeLiveTimingDrivers = (stored = [], connected = []) => {
  const groups = new Map();
  for (const driver of [...stored, ...connected.map(item => ({ ...item, connected: true }))]) {
    const nameKey = String(driver.name || '').normalize('NFD').replace(/\p{M}/gu, '')
      .trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR');
    if (nameKey === 'admin' || nameKey === 'admin cadpo') continue;
    const key = String(driver.guid || '').trim() || `name:${nameKey}`;
    const previous = groups.get(key);
    const counters = Object.keys(driver.lapsByCar || {}).length
      ? driver.lapsByCar
      : { [driver.carModel || driver.car || 'unknown']: driver.laps || 0 };
    const lapsByCar = { ...previous?.lapsByCar };
    for (const [model, laps] of Object.entries(counters)) {
      lapsByCar[model] = Math.max(Number(lapsByCar[model]) || 0, Number(laps) || 0);
    }
    const best = !previous || (Number(driver.bestLap) > 0
      && (!Number(previous.bestLap) || Number(driver.bestLap) < Number(previous.bestLap))) ? driver : previous;
    const current = !previous || driver.connected ? driver : previous;
    groups.set(key, {
      ...previous,
      ...current,
      bestLap: best.bestLap || 0,
      bestSectors: best.bestSectors || [],
      lastLap: current.lastLap || previous?.lastLap || 0,
      topSpeed: Math.max(Number(previous?.topSpeed) || 0, Number(driver.topSpeed) || 0),
      connected: Boolean(previous?.connected || driver.connected),
      lapsByCar,
      laps: Object.values(lapsByCar).reduce((total, laps) => total + laps, 0),
    });
  }
  return [...groups.values()];
};
