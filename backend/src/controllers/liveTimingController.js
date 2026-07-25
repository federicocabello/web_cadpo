const pool = require('../config/db');
const LIVE_TIMING_HOST = process.env.LIVE_TIMING_HOST || 'rh.servegame.com';
const CACHE_TTL_MS = 10000;

const timingCaches = new Map();

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
    inPits: Boolean(driver.IsInPits),
    connected,
    ping: driver.Ping || 0,
    completed: Boolean(driver.HasCompletedSession),
  };
};

const normalizeResponse = source => ({
  serverName: source.ServerName || 'Servidor CADPO',
  track: source.Track || '',
  trackConfig: source.TrackConfig || '',
  session: source.Name || '',
  sessionType: source.Type,
  sessionIndex: source.CurrentSessionIndex ?? source.SessionIndex ?? 0,
  sessionCount: source.SessionCount || 0,
  ambientTemp: source.AmbientTemp,
  roadTemp: source.RoadTemp,
  elapsedMilliseconds: source.ElapsedMilliseconds || 0,
  time: source.Time || 0,
  laps: source.Laps || 0,
  connected: (source.ConnectedDrivers || []).map(driver => normalizeDriver(driver, true)),
  stored: (source.DisconnectedDrivers || []).map(driver => normalizeDriver(driver, false)),
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
    if (cachedTiming && Date.now() - cachedTiming.time < CACHE_TTL_MS) {
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
      error.status = 502;
      throw error;
    }

    const data = normalizeResponse(await response.json());
    timingCaches.set(championshipId, { data, time: Date.now() });
    res.json({ data, cached: false });
  } catch (err) {
    const championshipId = Number(req.query.championshipId);
    const cachedTiming = timingCaches.get(championshipId);
    if (cachedTiming) {
      return res.json({ data: cachedTiming.data, cached: true, stale: true });
    }

    err.status = 503;
    err.message = err.name === 'AbortError'
      ? 'El servidor de tiempos no respondió a tiempo'
      : `Tiempos en vivo no disponibles: ${err.message}`;
    next(err);
  }
};

module.exports = { getLiveTiming };
