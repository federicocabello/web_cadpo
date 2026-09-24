const pool = require('../config/db');
const ensureResultAchievements = require('../utils/ensureResultAchievements');

const pointsExpression = alias => `
  COALESCE(${alias}.presentismo, 0)
  + COALESCE(${alias}.pts_qualy_sprint, 0)
  + COALESCE(${alias}.pts_sprint, 0)
  + COALESCE(${alias}.pts_qualy_final, 0)
  + COALESCE(${alias}.pts_final, 0)
`;

const winsExpression = alias => `
  (CASE WHEN ${alias}.ganador_final = 1 OR TRIM(${alias}.pos_final) = '1' THEN 1 ELSE 0 END)
`;

const seriesWinsExpression = alias => `
  (CASE WHEN ${alias}.ganador_sprint = 1 OR TRIM(${alias}.pos_sprint) = '1' THEN 1 ELSE 0 END)
`;

const polesExpression = alias => `
  (CASE WHEN ${alias}.pole_sprint = 1 OR TRIM(${alias}.pos_qualy_sprint) = '1' THEN 1 ELSE 0 END)
  + (CASE WHEN ${alias}.pole_final = 1 OR TRIM(${alias}.pos_qualy_final) = '1' THEN 1 ELSE 0 END)
`;

const podiumsExpression = alias => `
  (CASE WHEN TRIM(${alias}.pos_final) IN ('1', '2', '3') THEN 1 ELSE 0 END)
`;

const getTopChampions = champions => {
  const drivers = new Map();
  champions.forEach(champion => {
    const key = String(champion.idpiloto);
    const current = drivers.get(key) || {
      id: champion.idpiloto,
      nombre: champion.nombre,
      ig: champion.ig,
      titulos: 0,
      categoria: champion.categoria,
      categoria_logo: champion.categoria_logo,
      ultima_fecha: champion.ultima_fecha,
    };
    current.titulos += 1;
    if (new Date(champion.ultima_fecha) > new Date(current.ultima_fecha)) {
      current.categoria = champion.categoria;
      current.categoria_logo = champion.categoria_logo;
      current.ultima_fecha = champion.ultima_fecha;
    }
    drivers.set(key, current);
  });
  return [...drivers.values()]
    .sort((a, b) => b.titulos - a.titulos || new Date(b.ultima_fecha) - new Date(a.ultima_fecha) || a.nombre.localeCompare(b.nombre))
    .slice(0, 10);
};

const getCalculatedChampions = async () => {
  const [scores] = await pool.query(`
    SELECT r.idcampeonato, r.idpiloto, p.nombre, p.ig,
           c.temporada, c.anio, cat.categoria, cat.logo AS categoria_logo,
           ROUND(SUM(${pointsExpression('r')}), 2) AS puntos,
           SUM(${winsExpression('r')}) AS victorias,
           MAX(COALESCE(r.campeon, 0)) AS campeon_marcado,
           dates.ultima_fecha
    FROM resultados r
    JOIN pilotos p ON p.id = r.idpiloto
    JOIN campeonatos c ON c.id = r.idcampeonato
    JOIN categorias cat ON cat.id = c.idcategoria
    JOIN (
      SELECT idcampeonato, MAX(fecha) AS ultima_fecha
      FROM calendario
      GROUP BY idcampeonato
    ) dates ON dates.idcampeonato = r.idcampeonato
    WHERE dates.ultima_fecha < NOW()
    GROUP BY r.idcampeonato, r.idpiloto, p.id, c.id, cat.id, dates.ultima_fecha
    ORDER BY dates.ultima_fecha DESC, puntos DESC, victorias DESC, r.idpiloto ASC
  `);

  const championships = new Map();
  scores.forEach(score => {
    const key = String(score.idcampeonato);
    if (!championships.has(key)) championships.set(key, []);
    championships.get(key).push(score);
  });
  return [...championships.values()].map(entries => entries.find(entry => Number(entry.campeon_marcado) === 1) || entries[0]);
};

const getOverview = async (req, res, next) => {
  try {
    await ensureResultAchievements();
    const [[summary], [topWinners], champions] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM calendario WHERE fecha < NOW()) AS carreras_disputadas,
          (SELECT COUNT(DISTINCT idcampeonato) FROM calendario WHERE fecha < NOW()) AS campeonatos_disputados,
          (SELECT COUNT(*) FROM pilotos) AS pilotos_cargados,
          (SELECT COUNT(DISTINCT idpiloto) FROM resultados
            WHERE ganador_final = 1 OR TRIM(pos_final) = '1') AS pilotos_ganadores,
          (SELECT MIN(fecha) FROM calendario WHERE fecha < NOW()) AS fecha_inicio
      `),
      pool.query(`
        SELECT p.id, p.nombre, p.ig,
               SUM(${winsExpression('r')}) AS victorias,
               SUM(${polesExpression('r')}) AS poles,
               SUM(${podiumsExpression('r')}) AS podios,
               SUM(${seriesWinsExpression('r')}) AS series_ganadas,
               ROUND(SUM(${pointsExpression('r')}), 2) AS puntos,
               COUNT(DISTINCT r.idcampeonato) AS campeonatos
        FROM resultados r
        JOIN pilotos p ON p.id = r.idpiloto
        GROUP BY p.id
        HAVING victorias > 0
        ORDER BY victorias DESC, puntos DESC, p.nombre ASC
        LIMIT 10
      `),
      getCalculatedChampions(),
    ]);

    res.json({
      data: {
        summary: {
          ...summary,
          campeones_distintos: new Set(champions.map(champion => String(champion.idpiloto))).size,
        },
        topWinners,
        topChampions: getTopChampions(champions),
        champions,
      },
    });
  } catch (error) {
    next(error);
  }
};

const searchDrivers = async (req, res, next) => {
  try {
    await ensureResultAchievements();
    const search = String(req.query.search || '').trim();
    if (search.length < 2) return res.json({ data: [] });
    const [rows] = await pool.query(`
      SELECT id, nombre, localidad, provincia, nacionalidad, ig
      FROM pilotos
      WHERE nombre LIKE ? OR ig LIKE ?
      ORDER BY nombre ASC
      LIMIT 10
    `, [`%${search}%`, `%${search.replace(/^@+/, '')}%`]);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

const getDriverStatistics = async (req, res, next) => {
  try {
    await ensureResultAchievements();
    const driverId = Number(req.params.id);
    const [[driver]] = await pool.query(`
      SELECT id, nombre, localidad, provincia, nacionalidad, ig
      FROM pilotos WHERE id = ?
    `, [driverId]);
    if (!driver) return res.status(404).json({ error: 'Piloto no encontrado' });

    const [[totals], [history], champions] = await Promise.all([
      pool.query(`
        SELECT COUNT(DISTINCT idcampeonato, ronda) AS carreras_disputadas,
               COUNT(DISTINCT idcampeonato) AS campeonatos_disputados,
               SUM(${polesExpression('r')}) AS poles,
               SUM(${winsExpression('r')}) AS victorias,
               SUM(${podiumsExpression('r')}) AS podios,
               SUM(${seriesWinsExpression('r')}) AS series_ganadas,
               ROUND(SUM(${pointsExpression('r')}), 2) AS puntos
        FROM resultados r
        WHERE idpiloto = ?
      `, [driverId]),
      pool.query(`
        SELECT r.idcampeonato, c.temporada, c.anio, cat.categoria,
               cat.logo AS categoria_logo, MAX(r.fecha) AS ultima_fecha,
               COUNT(DISTINCT r.ronda) AS carreras,
               SUM(${polesExpression('r')}) AS poles,
               SUM(${winsExpression('r')}) AS victorias,
               SUM(${podiumsExpression('r')}) AS podios,
               SUM(${seriesWinsExpression('r')}) AS series_ganadas,
               ROUND(SUM(${pointsExpression('r')}), 2) AS puntos
        FROM resultados r
        JOIN campeonatos c ON c.id = r.idcampeonato
        JOIN categorias cat ON cat.id = c.idcategoria
        WHERE r.idpiloto = ?
        GROUP BY r.idcampeonato, c.id, cat.id
        ORDER BY ultima_fecha DESC, c.anio DESC
      `, [driverId]),
      getCalculatedChampions(),
    ]);

    const wonChampionships = new Set(
      champions.filter(champion => Number(champion.idpiloto) === driverId).map(champion => String(champion.idcampeonato)),
    );
    res.json({
      data: {
        driver,
        totals: {
          carreras_disputadas: Number(totals.carreras_disputadas || 0),
          campeonatos_disputados: Number(totals.campeonatos_disputados || 0),
          poles: Number(totals.poles || 0),
          victorias: Number(totals.victorias || 0),
          podios: Number(totals.podios || 0),
          series_ganadas: Number(totals.series_ganadas || 0),
          puntos: Number(totals.puntos || 0),
          campeonatos_ganados: wonChampionships.size,
        },
        championships: history.map(item => ({
          ...item,
          campeon: wonChampionships.has(String(item.idcampeonato)),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverview, searchDrivers, getDriverStatistics };
