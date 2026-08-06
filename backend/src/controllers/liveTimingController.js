const pool = require('../config/db');
const LIVE_TIMING_HOST = process.env.LIVE_TIMING_HOST || 'rh.servegame.com';
const CACHE_TTL_MS = 10000;
const QUALIFYING_CACHE_TTL_MS = 750;
const INACTIVE_TIMING_MS = 15000;
const TRANSIENT_FAILURE_GRACE_MS = 30000;

const timingCaches = new Map();
const timingActivity = new Map();
const isAdminDriver = driver =>
  String(driver?.CarInfo?.DriverName || '').trim().toLocaleLowerCase() === 'admin';

const timingSignature = source => {
  const connectedDrivers = (Array.isArray(source.ConnectedDrivers) ? source.ConnectedDrivers : [])
    .filter(driver => !isAdminDriver(driver));
  const disconnectedDrivers = (Array.isArray(source.DisconnectedDrivers) ? source.DisconnectedDrivers : [])
    .filter(driver => !isAdminDriver(driver));
  const driverActivity = [...connectedDrivers, ...disconnectedDrivers]
    .map(driver => {
      const cars = Object.values(driver.Cars || {});
      const laps = cars.reduce((total, car) => total + Number(car.NumLaps || 0), 0);
      return `${driver.CarInfo?.DriverGUID || ''}:${driver.LastSeen || ''}:${laps}`;
    })
    .join('|');

  return [
    source.CurrentSessionIndex ?? source.SessionIndex ?? 0,
    source.Type ?? '',
    source.Name || '',
    source.ElapsedMilliseconds || 0,
    connectedDrivers.length,
    driverActivity,
  ].join('::');
};

const isInactiveSnapshot = (championshipId, source) => {
  const signature = timingSignature(source);
  const previous = timingActivity.get(championshipId);
  const now = Date.now();

  // En práctica y clasificación el Server Manager puede entregar el mismo
  // snapshot durante varios minutos aunque la sesión continúe funcionando.
  if (Number(source.Type) !== 3) {
    timingActivity.set(championshipId, { signature, unchangedSince: now });
    return false;
  }

  if (!previous || previous.signature !== signature) {
    timingActivity.set(championshipId, { signature, unchangedSince: now });
    return false;
  }

  return now - previous.unchangedSince >= INACTIVE_TIMING_MS;
};

const getCarTiming = driver => {
  const cars = driver.Cars || {};
  return cars[driver.CarInfo?.CarModel] || Object.values(cars)[0] || {};
};

const normalizeDriver = (driver, connected) => {
  const car = getCarTiming(driver);
  const bestSectors = Object.values(car.BestLapSplits || {})
    .sort((a, b) => a.SplitIndex - b.SplitIndex)
    .map(sector => ({
      index: sector.SplitIndex,
      time: sector.SplitTime || 0,
      cuts: sector.Cuts || 0,
    }));

  return {
    guid: driver.CarInfo?.DriverGUID || '',
    position: driver.Position || 0,
    name: driver.CarInfo?.DriverName || 'Sin nombre',
    initials: driver.CarInfo?.DriverInitials || '',
    team: driver.CarInfo?.TeamName || '',
    car: car.CarName || driver.CarInfo?.CarName || driver.CarInfo?.CarModel || '',
    carModel: driver.CarInfo?.CarModel || '',
    raceNumber: car.RaceNumber || driver.CarInfo?.RaceNumber || 0,
    tyres: driver.CarInfo?.Tyres || car.TyreBestLap || '',
    laps: car.NumLaps ?? driver.TotalNumLaps ?? 0,
    bestLap: car.BestLap || 0,
    lastLap: car.LastLap || 0,
    qualifyingTime: car.QualifyingTime || 0,
    bestSectors,
    topSpeed: car.TopSpeedBestLap || car.TopSpeedThisLap || 0,
    gap: driver.Split || '',
    deltaToBest: driver.DeltaToBest || 0,
    pits: driver.NumPits || 0,
    ballast: Math.max(0, Number(driver.Ballast) || 0),
    inPits: Boolean(driver.IsInPits),
    connected,
    ping: driver.Ping || 0,
    completed: Boolean(driver.HasCompletedSession),
  };
};

const getSessionName = source => {
  const sessionType = Number(source.Type);
  if (sessionType === 1) return 'Práctica';
  if (sessionType === 2) return 'Clasificación';
  if (sessionType === 3) return 'Carrera';
  return source.Name || '';
};

const normalizeResponse = source => ({
  serverName: source.ServerName || 'Servidor CADPO',
  track: source.Track || '',
  trackConfig: source.TrackConfig || '',
  session: getSessionName(source),
  sessionType: source.Type,
  sessionIndex: source.CurrentSessionIndex ?? source.SessionIndex ?? 0,
  sessionCount: source.SessionCount || 0,
  ambientTemp: source.AmbientTemp,
  roadTemp: source.RoadTemp,
  elapsedMilliseconds: source.ElapsedMilliseconds || 0,
  time: source.Time || 0,
  laps: source.Laps || 0,
  connected: (source.ConnectedDrivers || [])
    .filter(driver => !isAdminDriver(driver))
    .map(driver => normalizeDriver(driver, true)),
  stored: (source.DisconnectedDrivers || [])
    .filter(driver => !isAdminDriver(driver))
    .map(driver => normalizeDriver(driver, false)),
  updatedAt: new Date().toISOString(),
});

const getLiveTiming = async (req, res, next) => {
  try {
    const championshipId = Number(req.query.championshipId);
    if (!championshipId) return res.status(400).json({ error: 'championshipId es requerido' });

    const [[championship]] = await pool.query(
      'SELECT id, puerto, n_server FROM campeonatos WHERE id = ?',
      [championshipId]
    );
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });

    const port = Number(championship.puerto);
    const serverNumber = Number(championship.n_server);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(serverNumber) || serverNumber < 0) {
      return res.status(422).json({ error: 'El campeonato no tiene una configuración de tiempos válida' });
    }

    const timingUrl = `http://${LIVE_TIMING_HOST}:${port}/api/live-timings/leaderboard.json?server=${serverNumber}`;
    const cachedTiming = timingCaches.get(championshipId);
    const cacheTtl = /clasificaci[oó]n|qualifying|qualification|qualy/i.test(cachedTiming?.data?.session || '')
      ? QUALIFYING_CACHE_TTL_MS
      : CACHE_TTL_MS;
    if (cachedTiming && Date.now() - cachedTiming.time < cacheTtl) {
      return res.json({ data: cachedTiming.data, cached: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;

    try {
      response = await fetch(timingUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = new Error(`El servidor de tiempos respondió ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    const source = await response.json();
    if (isInactiveSnapshot(championshipId, source)) {
      const error = new Error('El servidor de tiempos no presenta actividad');
      error.statusCode = 503;
      throw error;
    }

    const data = normalizeResponse(source);
    timingCaches.set(championshipId, { data, time: Date.now() });
    res.json({ data, cached: false });
  } catch (err) {
    const championshipId = Number(req.query.championshipId);
    const cachedTiming = timingCaches.get(championshipId);
    if (cachedTiming) {
      const cacheAge = Date.now() - cachedTiming.time;
      if (cacheAge <= TRANSIENT_FAILURE_GRACE_MS) {
        return res.json({ data: cachedTiming.data, cached: true, recovering: true });
      }
      return res.json({ data: cachedTiming.data, cached: true, stale: true });
    }

    err.statusCode = 503;
    err.message = err.name === 'AbortError'
      ? 'El servidor de tiempos no respondió a tiempo'
      : `Tiempos en vivo no disponibles: ${err.message}`;
    next(err);
  }
};

module.exports = { getLiveTiming };
