const pool = require('../config/db');
const LIVE_TIMING_HOST = process.env.LIVE_TIMING_HOST || 'rh.servegame.com';
const LIVE_TIMING_TIMEOUT_MS = 6000;

const STOP_WORDS = new Set([
  'como', 'cual', 'cuando', 'donde', 'quien', 'para', 'sobre', 'desde', 'hasta', 'esta', 'este',
  'estos', 'estas', 'tiene', 'tienen', 'quiero', 'saber', 'decime', 'dime', 'hay', 'del', 'las',
  'los', 'una', 'uno', 'unos', 'unas', 'que', 'por', 'con', 'sin', 'sus', 'son', 'fue', 'ser',
  'cadpo', 'campeonato', 'campeonatos', 'piloto', 'pilotos', 'fecha', 'fechas', 'resultado', 'resultados',
]);

const foldText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const questionTerms = question => [...new Set(foldText(question).split(' ')
  .filter(term => term.length >= 3 && !STOP_WORDS.has(term)))]
  .slice(0, 8);

const scoreText = (question, values) => {
  const haystack = foldText(values.filter(Boolean).join(' '));
  return questionTerms(question).reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
};

const pointsExpression = `
  COALESCE(r.presentismo, 0) + COALESCE(r.pts_qualy_sprint, 0) + COALESCE(r.pts_sprint, 0)
  + COALESCE(r.pts_qualy_final, 0) + COALESCE(r.pts_final, 0)
`;

const wantsLiveTiming = question => {
  const normalized = foldText(question);
  return /\b(tiempos? en vivo|live timing|api de tiempos|pilotos? conectados?|sesion actual|servidor (?:online|activo|disponible|funcionando)|quien esta primero ahora|tiempo del lider)\b/.test(normalized)
    || (normalized.includes('servidor') && /\b(acceder|acceso|consultar|leer|datos|estado|respuesta)\b/.test(normalized));
};

const getQuestionIntents = question => {
  const normalized = foldText(question);
  const club = /\b(cadpo club|club|servidor gratuito|servidores gratuitos|carreras libres)\b/.test(normalized);
  return {
    club,
    clubLive: club && /\b(estado|sesion|conectados|online|ahora|funcionando)\b/.test(normalized),
    results: /\b(resultado|resultados|posiciones|tabla de puntos|ganador|ganadores)\b/.test(normalized),
    downloads: /\b(descarga|descargar|archivo|archivos|repeticion|repeticiones|replay|replays|plantilla|plantillas|template|templates)\b/.test(normalized),
    projects: /\b(proyecto|proyectos|desarrollo|desarrollando|proximamente)\b/.test(normalized),
  };
};

const formatLapTime = nanoseconds => {
  const value = Number(nanoseconds || 0);
  if (!value) return null;
  const milliseconds = Math.round(value / 1_000_000);
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(remainder).padStart(3, '0')}`;
};

const liveDriver = (driver, connected) => {
  const cars = driver?.Cars || {};
  const car = cars[driver?.CarInfo?.CarModel] || Object.values(cars)[0] || {};
  return {
    position: Number(driver?.Position || 0),
    pilot: driver?.CarInfo?.DriverName || 'Sin nombre',
    car: car.CarName || driver?.CarInfo?.CarName || driver?.CarInfo?.CarModel || '',
    number: car.RaceNumber || driver?.CarInfo?.RaceNumber || 0,
    laps: Number(car.NumLaps ?? driver?.TotalNumLaps ?? 0),
    bestLap: formatLapTime(car.BestLap),
    inPits: Boolean(driver?.IsInPits),
    connected,
  };
};

const loadLiveTiming = async championships => Promise.all(championships
  .filter(championship => Number(championship.puerto) > 0 && Number(championship.n_server) >= 0)
  .slice(0, 2)
  .map(async championship => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVE_TIMING_TIMEOUT_MS);
    try {
      const url = `http://${LIVE_TIMING_HOST}:${Number(championship.puerto)}/api/live-timings/leaderboard.json?server=${Number(championship.n_server)}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const source = await response.json();
      const drivers = [
        ...(Array.isArray(source.ConnectedDrivers) ? source.ConnectedDrivers.map(driver => liveDriver(driver, true)) : []),
        ...(Array.isArray(source.DisconnectedDrivers) ? source.DisconnectedDrivers.map(driver => liveDriver(driver, false)) : []),
      ]
        .filter(driver => foldText(driver.pilot) !== 'admin cadpo' && foldText(driver.pilot) !== 'admin')
        .sort((a, b) => {
          if (a.bestLap && !b.bestLap) return -1;
          if (!a.bestLap && b.bestLap) return 1;
          return a.position - b.position;
        })
        .slice(0, 35);

      return {
        available: true,
        championshipId: championship.id,
        championship: `${championship.categoria} - Temporada ${championship.temporada} (${championship.anio})`,
        serverName: source.ServerName || 'Servidor CADPO',
        track: source.Track || '',
        trackVariant: source.TrackConfig || '',
        session: ({ 1: 'Práctica', 2: 'Clasificación', 3: 'Carrera' }[Number(source.Type)] || source.Name || ''),
        connectedDrivers: drivers.filter(driver => driver.connected).length,
        drivers,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        championshipId: championship.id,
        championship: `${championship.categoria} - Temporada ${championship.temporada} (${championship.anio})`,
        error: error.name === 'AbortError' ? 'El servidor no respondió a tiempo' : error.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }));

const loadBaseKnowledge = async () => {
  const [championshipsResult, eventsResult, formsResult, summaryResult] = await Promise.all([
    pool.query(`
      SELECT c.id, cat.categoria, c.temporada, c.anio, c.plataforma, c.reglamento,
             c.puerto, c.n_server,
             MIN(cal.fecha) AS primera_fecha, MAX(cal.fecha) AS ultima_fecha, COUNT(cal.ronda) AS fechas,
             CASE WHEN MIN(cal.fecha) IS NULL OR NOW() < MIN(cal.fecha) THEN 'próximo'
                  WHEN NOW() > MAX(cal.fecha) THEN 'finalizado' ELSE 'en curso' END AS estado
      FROM campeonatos c
      JOIN categorias cat ON cat.id = c.idcategoria
      LEFT JOIN calendario cal ON cal.idcampeonato = c.id
      GROUP BY c.id, cat.id
      ORDER BY COALESCE(MAX(cal.fecha), CONCAT(c.anio, '-01-01')) DESC, c.id DESC
      LIMIT 30
    `),
    pool.query(`
      SELECT cal.idcampeonato, cal.ronda, cal.fecha, cal.especialidad,
             cat.categoria, c.temporada, c.anio,
             ci.nombre AS circuito, ci.variante, ci.localidad, ci.provincia, ci.pais,
             CASE WHEN cal.fecha >= NOW() THEN 'próxima' ELSE 'disputada' END AS estado
      FROM calendario cal
      JOIN campeonatos c ON c.id = cal.idcampeonato
      JOIN categorias cat ON cat.id = c.idcategoria
      JOIN circuitos ci ON ci.id = cal.idcircuito
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, NOW(), cal.fecha)) ASC
      LIMIT 20
    `),
    pool.query(`
      SELECT cfg.idcampeonato, cat.categoria, c.temporada, c.anio,
             cfg.fecha_apertura, cfg.fecha_cierre, cfg.precio,
             cfg.limite_inscriptos, cfg.preinscriptos,
             (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) AS inscriptos_confirmados,
             CASE WHEN NOW() < cfg.fecha_apertura THEN 'próxima'
                  WHEN NOW() >= cfg.fecha_cierre THEN 'cerrada'
                  WHEN (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) >= cfg.limite_inscriptos THEN 'completa'
                  ELSE 'abierta' END AS estado
      FROM inscripciones_config cfg
      JOIN campeonatos c ON c.id = cfg.idcampeonato
      JOIN categorias cat ON cat.id = c.idcategoria
      WHERE cfg.visible <> 0
      ORDER BY cfg.fecha_apertura DESC
      LIMIT 12
    `),
    pool.query(`
      SELECT (SELECT COUNT(*) FROM pilotos) AS pilotos,
             (SELECT COUNT(*) FROM campeonatos) AS campeonatos,
             (SELECT COUNT(*) FROM calendario WHERE fecha < NOW()) AS fechas_disputadas,
             (SELECT COUNT(DISTINCT idpiloto) FROM resultados WHERE ganador_final = 1 OR TRIM(pos_final) = '1') AS ganadores_distintos
    `),
  ]);

  return {
    championships: championshipsResult[0],
    events: eventsResult[0],
    registrationForms: formsResult[0],
    summary: summaryResult[0][0] || {},
  };
};

const chooseRelevantChampionships = (question, championships) => {
  const scored = championships
    .map(item => ({ item, score: scoreText(question, [item.categoria, item.temporada, item.anio]) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.id) - Number(a.item.id))
    .map(entry => entry.item);

  if (scored.length) return scored.slice(0, 3);
  return championships.filter(item => item.estado !== 'finalizado').slice(0, 2)
    .concat(championships.filter(item => item.estado === 'finalizado').slice(0, 1));
};

const loadStandings = async championshipIds => {
  if (!championshipIds.length) return [];
  const [rows] = await pool.query(`
    SELECT t.idcampeonato, t.posicion, t.puntos, t.victorias, t.apercibimientos, t.campeon,
           p.nombre AS piloto, a.modelo, am.marca
    FROM tablas t
    JOIN pilotos p ON p.id = t.idpiloto
    LEFT JOIN inscriptos i ON i.idcampeonato = t.idcampeonato AND i.idpiloto = t.idpiloto
    LEFT JOIN autos a ON a.id = i.idauto
    LEFT JOIN autos_marcas am ON am.id = a.marca
    WHERE t.idcampeonato IN (?)
    ORDER BY t.idcampeonato DESC, t.posicion ASC
  `, [championshipIds]);

  const counts = new Map();
  return rows.filter(row => {
    const count = counts.get(row.idcampeonato) || 0;
    counts.set(row.idcampeonato, count + 1);
    return count < 15;
  });
};

const loadDriverKnowledge = async question => {
  const terms = questionTerms(question);
  if (!terms.length) return [];
  const conditions = terms.map(() => 'p.nombre LIKE ?').join(' OR ');
  const [drivers] = await pool.query(`
    SELECT p.id, p.nombre, p.localidad, p.provincia, p.nacionalidad, p.ig,
           COUNT(DISTINCT r.idcampeonato, r.ronda) AS carreras,
           COUNT(DISTINCT r.idcampeonato) AS campeonatos,
           SUM(CASE WHEN r.ganador_final = 1 OR TRIM(r.pos_final) = '1' THEN 1 ELSE 0 END) AS victorias,
           SUM(CASE WHEN r.pole_sprint = 1 OR TRIM(r.pos_qualy_sprint) = '1' THEN 1 ELSE 0 END
             + CASE WHEN r.pole_final = 1 OR TRIM(r.pos_qualy_final) = '1' THEN 1 ELSE 0 END) AS poles,
           ROUND(SUM(${pointsExpression}), 2) AS puntos
    FROM pilotos p
    LEFT JOIN resultados r ON r.idpiloto = p.id
    WHERE ${conditions}
    GROUP BY p.id
    ORDER BY carreras DESC, p.nombre ASC
    LIMIT 8
  `, terms.map(term => `%${term}%`));
  return drivers;
};

const loadRecentResults = async championshipIds => {
  if (!championshipIds.length) return [];
  const [rows] = await pool.query(`
    SELECT r.idcampeonato, r.ronda, r.fecha, p.nombre AS piloto,
           r.pos_sprint, r.pos_final, r.pts_sprint, r.pts_final,
           r.pole_sprint, r.ganador_sprint, r.pole_final, r.ganador_final,
           ci.nombre AS circuito, ci.localidad
    FROM resultados r
    JOIN pilotos p ON p.id = r.idpiloto
    JOIN circuitos ci ON ci.id = r.idcircuito
    JOIN calendario cal ON cal.idcampeonato = r.idcampeonato AND cal.ronda = r.ronda
    WHERE r.idcampeonato IN (?)
      AND cal.resultados_visibles = 1
      AND r.ronda = (
        SELECT MAX(r2.ronda)
        FROM resultados r2
        JOIN calendario cal2 ON cal2.idcampeonato = r2.idcampeonato AND cal2.ronda = r2.ronda
        WHERE r2.idcampeonato = r.idcampeonato AND cal2.resultados_visibles = 1
      )
    ORDER BY r.idcampeonato DESC, r.ronda DESC,
             CASE WHEN TRIM(r.pos_final) REGEXP '^[0-9]+$' THEN CAST(r.pos_final AS UNSIGNED) ELSE 9999 END,
             p.nombre ASC
    LIMIT 90
  `, [championshipIds]);
  return rows;
};

const loadClubKnowledge = async includeLiveStatus => {
  const [rows] = await pool.query(`
    SELECT cfg.id, cfg.nombre, cfg.servidor, cfg.enlace_ingreso,
           cat.categoria, cir.nombre AS circuito, cir.variante,
           cir.localidad, cir.provincia, cir.pais,
           GROUP_CONCAT(DISTINCT CONCAT(am.marca, ' ', a.modelo)
             ORDER BY am.marca, a.modelo SEPARATOR ' | ') AS autos
    FROM club_configuracion cfg
    LEFT JOIN categorias cat ON cat.id = cfg.idcategoria
    LEFT JOIN circuitos cir ON cir.id = cfg.idcircuito
    LEFT JOIN club_autos ca ON ca.idconfiguracion = cfg.id
    LEFT JOIN autos a ON a.id = ca.idauto
    LEFT JOIN autos_marcas am ON am.id = a.marca
    WHERE cfg.activo = 1
    GROUP BY cfg.id, cfg.nombre, cfg.servidor, cfg.enlace_ingreso,
             cat.categoria, cir.nombre, cir.variante, cir.localidad, cir.provincia, cir.pais
    ORDER BY cfg.orden ASC, cfg.id ASC
    LIMIT 3
  `);

  return Promise.all(rows.map(async server => {
    const item = {
      ...server,
      format: '7 minutos de clasificación y 7 minutos de carrera, en loop',
      sectionUrl: 'https://cadpotorneos.com/club',
    };
    if (!includeLiveStatus || !server.servidor) return item;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVE_TIMING_TIMEOUT_MS);
    try {
      const publicUrl = new URL(server.servidor);
      const serverNumber = Number(publicUrl.searchParams.get('server'));
      if (!Number.isInteger(serverNumber) || serverNumber < 0) throw new Error('Configuración de servidor inválida');
      const timingUrl = new URL('/api/live-timings/leaderboard.json', publicUrl.origin);
      timingUrl.searchParams.set('server', String(serverNumber));
      const response = await fetch(timingUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const source = await response.json();
      const connected = Array.isArray(source.ConnectedDrivers)
        ? source.ConnectedDrivers.filter(driver => !['admin', 'admin cadpo'].includes(foldText(driver?.CarInfo?.DriverName))).length
        : 0;
      return {
        ...item,
        liveStatus: {
          available: true,
          session: ({ 1: 'Práctica', 2: 'Clasificación', 3: 'Carrera' }[Number(source.Type)] || source.Name || ''),
          inRace: Number(source.Type) === 3,
          canJoin: Number(source.Type) !== 3,
          connectedDrivers: connected,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        ...item,
        liveStatus: {
          available: false,
          error: error.name === 'AbortError' ? 'El servidor no respondió a tiempo' : error.message,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }));
};

const loadResultsCatalog = async () => {
  const [rows] = await pool.query(`
    SELECT cal.idcampeonato, cal.ronda, cal.fecha, cal.resultados_visibles,
           cal.resultados_confirmados, cat.categoria, c.temporada, c.anio,
           ci.nombre AS circuito, ci.variante, ci.localidad,
           COUNT(r.id) AS pilotos_con_resultado
    FROM calendario cal
    JOIN campeonatos c ON c.id = cal.idcampeonato
    JOIN categorias cat ON cat.id = c.idcategoria
    LEFT JOIN circuitos ci ON ci.id = cal.idcircuito
    JOIN resultados r ON r.idcampeonato = cal.idcampeonato AND r.ronda = cal.ronda
    GROUP BY cal.idcampeonato, cal.ronda, cal.fecha, cal.resultados_visibles,
             cal.resultados_confirmados, cat.categoria, c.temporada, c.anio,
             ci.nombre, ci.variante, ci.localidad
    ORDER BY cal.fecha DESC, cal.idcampeonato DESC, cal.ronda DESC
    LIMIT 30
  `);
  return rows.map(row => ({ ...row, sectionUrl: 'https://cadpotorneos.com/resultados' }));
};

const loadDownloadCatalog = async () => {
  const [replaysResult, templatesResult] = await Promise.all([
    pool.query(`
      SELECT rp.id, rp.idcampeonato, rp.ronda, rp.tanda, rp.nombre_original, rp.tamano,
             rp.created_at, cat.categoria, c.temporada, c.anio,
             ci.nombre AS circuito, ci.variante
      FROM replays rp
      JOIN campeonatos c ON c.id = rp.idcampeonato
      JOIN categorias cat ON cat.id = c.idcategoria
      LEFT JOIN calendario cal ON cal.idcampeonato = rp.idcampeonato AND cal.ronda = rp.ronda
      LEFT JOIN circuitos ci ON ci.id = cal.idcircuito
      ORDER BY COALESCE(cal.fecha, rp.created_at) DESC, rp.id DESC
      LIMIT 30
    `),
    pool.query(`
      SELECT pl.id, pl.idcampeonato, pl.nombre_original, pl.tamano, pl.updated_at,
             cat.categoria, c.temporada, c.anio
      FROM plantillas pl
      JOIN campeonatos c ON c.id = pl.idcampeonato
      JOIN categorias cat ON cat.id = c.idcategoria
      ORDER BY pl.updated_at DESC, pl.id DESC
      LIMIT 20
    `),
  ]);

  return {
    replays: replaysResult[0].map(item => ({
      ...item,
      downloadUrl: `https://cadpotorneos.com/api/replays/${item.id}/download`,
      sectionUrl: 'https://cadpotorneos.com/replays',
    })),
    templates: templatesResult[0].map(item => ({
      ...item,
      downloadUrl: `https://cadpotorneos.com/api/templates/${item.id}/download`,
      sectionUrl: 'https://cadpotorneos.com/plantillas',
    })),
  };
};

const loadProjectsKnowledge = async () => {
  const [rows] = await pool.query(`
    SELECT pr.id, pr.tipo, pr.titulo, pr.descripcion, pr.creado, pr.actualizado,
           COUNT(pf.id) AS cantidad_fotos
    FROM proyectos pr
    LEFT JOIN proyecto_fotos pf ON pf.idproyecto = pr.id
    WHERE pr.activo = 1
    GROUP BY pr.id, pr.tipo, pr.titulo, pr.descripcion, pr.creado, pr.actualizado
    ORDER BY pr.creado DESC, pr.id DESC
    LIMIT 30
  `);
  return rows.map(row => ({
    ...row,
    platform: 'Assetto Corsa',
    sectionUrl: 'https://cadpotorneos.com/proyectos',
    imagesDownloadable: false,
  }));
};

const safeOptionalKnowledge = async loader => {
  try {
    return { available: true, data: await loader() };
  } catch (error) {
    return { available: false, data: null, error: error.message };
  }
};

const buildKnowledge = async question => {
  const base = await loadBaseKnowledge();
  const relevantChampionships = chooseRelevantChampionships(question, base.championships);
  const ids = [...new Set(relevantChampionships.map(item => Number(item.id)).filter(Boolean))];
  const intents = getQuestionIntents(question);
  const liveTimingRequested = wantsLiveTiming(question) && !intents.club;
  const [standings, drivers, recentResults, liveTiming, club, resultsCatalog, downloads, projects] = await Promise.all([
    loadStandings(ids),
    loadDriverKnowledge(question),
    loadRecentResults(ids),
    liveTimingRequested ? loadLiveTiming(relevantChampionships) : Promise.resolve([]),
    intents.club ? safeOptionalKnowledge(() => loadClubKnowledge(intents.clubLive)) : Promise.resolve(null),
    intents.results ? safeOptionalKnowledge(loadResultsCatalog) : Promise.resolve(null),
    intents.downloads ? safeOptionalKnowledge(loadDownloadCatalog) : Promise.resolve(null),
    intents.projects ? safeOptionalKnowledge(loadProjectsKnowledge) : Promise.resolve(null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'America/Argentina/Buenos_Aires',
    summary: base.summary,
    relevantChampionships,
    nearbyEvents: base.events,
    visibleRegistrationForms: base.registrationForms,
    standings,
    matchingDrivers: drivers,
    latestResults: recentResults,
    liveTiming: {
      requested: liveTimingRequested,
      source: liveTimingRequested ? 'API en vivo de CADPO Server Manager' : null,
      servers: liveTiming,
    },
    requestedSections: {
      club,
      results: resultsCatalog,
      downloads,
      projects,
    },
    siteSections: {
      club: 'https://cadpotorneos.com/club',
      results: 'https://cadpotorneos.com/resultados',
      replays: 'https://cadpotorneos.com/replays',
      templates: 'https://cadpotorneos.com/plantillas',
      projects: 'https://cadpotorneos.com/proyectos',
    },
  };
};

module.exports = { buildKnowledge };
