const pool = require('../config/db');
const slugify = require('../utils/slugify');

const baseSelect = `
  SELECT cal.idcampeonato, cal.ronda, cal.fecha, cal.especial,
         cal.especialidad, cal.coronacion, cal.transmision,
         CONCAT(cal.idcampeonato, '-', cal.ronda) AS id,
         CASE
           WHEN cal.fecha >= NOW() THEN 'upcoming'
           ELSE 'completed'
         END AS status,
         ci.id AS idcircuito, ci.nombre AS circuito,
         ci.localidad, ci.provincia, ci.pais, ci.imagen, ci.trazado, ci.variante,
         c.temporada, c.anio, c.plataforma, c.puerto, c.n_server, c.servidor,
         cat.id AS idcategoria, cat.categoria, cat.logo AS categoria_logo
  FROM calendario cal
  JOIN circuitos ci ON cal.idcircuito = ci.id
  JOIN campeonatos c ON cal.idcampeonato = c.id
  JOIN categorias cat ON c.idcategoria = cat.id
`;

const getAll = async (req, res, next) => {
  try {
    const { idcampeonato, status } = req.query;
    const params = [];
    const conditions = [];

    if (idcampeonato) {
      conditions.push('cal.idcampeonato = ?');
      params.push(idcampeonato);
    }
    if (status === 'upcoming') conditions.push('cal.fecha >= NOW()');
    if (status === 'completed') conditions.push('cal.fecha < NOW()');

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const order = status === 'completed' ? ' ORDER BY cal.fecha DESC' : ' ORDER BY cal.fecha ASC';
    const [rows] = await pool.query(`${baseSelect}${where}${order}`, params);

    res.json({ data: rows.map(withMediaFields), total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getUpcoming = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${baseSelect} WHERE cal.fecha >= NOW() ORDER BY cal.fecha ASC LIMIT 10`);
    res.json({ data: rows.map(withMediaFields), total: rows.length });
  } catch (err) {
    next(err);
  }
};

const withMediaFields = row => {
  const circuitoSlug = slugify(row.circuito);
  const categoriaSlug = slugify(row.categoria);

  return {
    ...row,
    circuito_slug: circuitoSlug,
    categoria_slug: categoriaSlug,
    circuito_foto_url: row.imagen || `/media/circuitos/fotos/${circuitoSlug}.png`,
    circuito_trazado_url: row.trazado || `/media/circuitos/trazados/${circuitoSlug}.png`,
    campeonato_media_path: `/media/campeonatos/${categoriaSlug}/temporada-${slugify(row.temporada)}`,
  };
};

const normalizeSpecialty = (especial, especialidad) => {
  if (!especial) return null;

  return String(especialidad || '').trim().toLocaleUpperCase('es-AR') || null;
};

const normalizeTransmissionUrl = value => String(value || '').trim();

const create = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision } = req.body;
    if (!idcampeonato || !fecha || !ronda || !idcircuito) {
      return res.status(400).json({ error: 'idcampeonato, fecha, ronda e idcircuito son requeridos' });
    }

    await pool.query(
      `INSERT INTO calendario (idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idcampeonato, fecha, ronda, idcircuito, especial ? 1 : 0, normalizeSpecialty(especial, especialidad), coronacion ? 1 : 0, normalizeTransmissionUrl(transmision)]
    );

    res.status(201).json({ message: 'Fecha agregada al calendario', data: req.body });
  } catch (err) {
    next(err);
  }
};

const createBatch = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    if (!events.length) {
      return res.status(400).json({ error: 'Agregá al menos una fecha al calendario' });
    }

    const invalidEvent = events.find(event =>
      !event.idcampeonato || !event.fecha || !event.ronda || !event.idcircuito
    );
    if (invalidEvent) {
      return res.status(400).json({ error: 'Todas las fechas deben tener campeonato, fecha, ronda y circuito' });
    }

    await connection.beginTransaction();
    const query = `INSERT INTO calendario
      (idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const event of events) {
      await connection.query(query, [
        event.idcampeonato,
        event.fecha,
        event.ronda,
        event.idcircuito,
        event.especial ? 1 : 0,
        normalizeSpecialty(event.especial, event.especialidad),
        event.coronacion ? 1 : 0,
        normalizeTransmissionUrl(event.transmision),
      ]);
    }

    await connection.commit();
    res.status(201).json({
      message: `${events.length} fechas agregadas al calendario`,
      data: events,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const update = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision } = req.body;
    const { oldIdcampeonato, oldRonda } = req.params;

    if (!idcampeonato || !fecha || !ronda || !idcircuito) {
      return res.status(400).json({ error: 'idcampeonato, fecha, ronda e idcircuito son requeridos' });
    }

    const [result] = await pool.query(
      `UPDATE calendario
       SET idcampeonato=?, fecha=?, ronda=?, idcircuito=?, especial=?, especialidad=?, coronacion=?, transmision=?
       WHERE idcampeonato=? AND ronda=?`,
      [
        idcampeonato,
        fecha,
        ronda,
        idcircuito,
        especial ? 1 : 0,
        normalizeSpecialty(especial, especialidad),
        coronacion ? 1 : 0,
        normalizeTransmissionUrl(transmision),
        oldIdcampeonato,
        oldRonda,
      ]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Fecha no encontrada' });

    res.json({ message: 'Fecha actualizada', data: req.body });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { idcampeonato, ronda } = req.params;
    const [result] = await pool.query(
      'DELETE FROM calendario WHERE idcampeonato = ? AND ronda = ?',
      [idcampeonato, ronda]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Fecha no encontrada' });
    res.json({ message: 'Fecha eliminada del calendario' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getUpcoming, create, createBatch, update, remove };
