const pool = require('../config/db');
const slugify = require('../utils/slugify');

const baseSelect = `
  SELECT cal.idcampeonato, cal.ronda, cal.fecha, cal.especial,
         cal.especialidad, cal.coronacion,
         CONCAT(cal.idcampeonato, '-', cal.ronda) AS id,
         CASE
           WHEN cal.fecha >= NOW() THEN 'upcoming'
           ELSE 'completed'
         END AS status,
         ci.id AS idcircuito, ci.nombre AS circuito,
         ci.localidad, ci.provincia, ci.pais, ci.imagen,
         c.temporada, c.anio,
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
    circuito_foto_url: `/media/circuitos/fotos/${circuitoSlug}.png`,
    circuito_trazado_url: `/media/circuitos/trazados/${circuitoSlug}.png`,
    campeonato_media_path: `/media/campeonatos/${categoriaSlug}/temporada-${slugify(row.temporada)}`,
  };
};

const create = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion } = req.body;
    if (!idcampeonato || !fecha || !ronda || !idcircuito) {
      return res.status(400).json({ error: 'idcampeonato, fecha, ronda e idcircuito son requeridos' });
    }

    await pool.query(
      `INSERT INTO calendario (idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idcampeonato, fecha, ronda, idcircuito, especial ? 1 : 0, especialidad || null, coronacion ? 1 : 0]
    );

    res.status(201).json({ message: 'Fecha agregada al calendario', data: req.body });
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

module.exports = { getAll, getUpcoming, create, remove };
