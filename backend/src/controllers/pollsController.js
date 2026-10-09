const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const pollsRoot = path.join(publicDir, 'media', 'votaciones');
let schemaPromise;

const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS votaciones (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, titulo VARCHAR(180) NOT NULL, dias VARCHAR(120) NULL,
        descripcion TEXT NULL, imagen VARCHAR(500) NULL, fecha_inicio DATETIME NOT NULL, fecha_cierre DATETIME NOT NULL,
        max_opciones TINYINT UNSIGNED NOT NULL DEFAULT 1, visible TINYINT(1) NOT NULL DEFAULT 1, creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id), KEY idx_votaciones_visible_fechas (visible, fecha_inicio, fecha_cierre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [daysColumn] = await pool.query("SHOW COLUMNS FROM votaciones LIKE 'dias'");
      if (!daysColumn.length) await pool.query('ALTER TABLE votaciones ADD COLUMN dias VARCHAR(120) NULL AFTER titulo');
      const [maxOptionsColumn] = await pool.query("SHOW COLUMNS FROM votaciones LIKE 'max_opciones'");
      if (!maxOptionsColumn.length) await pool.query('ALTER TABLE votaciones ADD COLUMN max_opciones TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER fecha_cierre');
      await pool.query(`CREATE TABLE IF NOT EXISTS votacion_opciones (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, idvotacion INT UNSIGNED NOT NULL, titulo VARCHAR(180) NOT NULL,
        imagen VARCHAR(500) NULL, imagenes LONGTEXT NULL, orden SMALLINT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (id),
        KEY idx_votacion_opciones_votacion (idvotacion, orden)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [imageColumn] = await pool.query("SHOW COLUMNS FROM votacion_opciones LIKE 'imagen'");
      if (!imageColumn.length) await pool.query('ALTER TABLE votacion_opciones ADD COLUMN imagen VARCHAR(500) NULL AFTER titulo');
      const [imagesColumn] = await pool.query("SHOW COLUMNS FROM votacion_opciones LIKE 'imagenes'");
      if (!imagesColumn.length) await pool.query('ALTER TABLE votacion_opciones ADD COLUMN imagenes LONGTEXT NULL AFTER imagen');
      const [descriptionColumn] = await pool.query("SHOW COLUMNS FROM votacion_opciones LIKE 'descripcion'");
      if (!descriptionColumn.length) await pool.query('ALTER TABLE votacion_opciones ADD COLUMN descripcion TEXT NULL AFTER titulo');
      const [manualPercentageColumn] = await pool.query("SHOW COLUMNS FROM votacion_opciones LIKE 'porcentaje_manual'");
      if (!manualPercentageColumn.length) await pool.query('ALTER TABLE votacion_opciones ADD COLUMN porcentaje_manual DECIMAL(5,2) NULL AFTER imagen');
      await pool.query(`CREATE TABLE IF NOT EXISTS votacion_votos (
        idvotacion INT UNSIGNED NOT NULL, idopcion INT UNSIGNED NOT NULL, ip_hash CHAR(64) NOT NULL,
        creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (idvotacion, ip_hash, idopcion),
        KEY idx_votacion_votos_opcion (idopcion)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [voteIndexes] = await pool.query('SHOW INDEX FROM votacion_votos');
      const primaryVoteKey = voteIndexes
        .filter(index => index.Key_name === 'PRIMARY')
        .sort((first, second) => Number(first.Seq_in_index) - Number(second.Seq_in_index));
      if (primaryVoteKey.length === 2) {
        await pool.query('ALTER TABLE votacion_votos DROP PRIMARY KEY, ADD PRIMARY KEY (idvotacion, ip_hash, idopcion)');
      }
    })().catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
};

const cleanText = value => String(value || '').trim();
const safeStoredImage = value => /^\/media\/votaciones\/[^/]+$/.test(String(value || '')) ? String(value) : '';
const parseStoredImages = value => {
  let images = value;
  if (typeof value === 'string') {
    try { images = JSON.parse(value); } catch { images = value ? [value] : []; }
  }
  if (!Array.isArray(images)) return [];
  return [...new Set(images.map(safeStoredImage).filter(Boolean))];
};
const parseImageOrder = value => Array.isArray(value)
  ? value.map(item => String(item || '')).filter(item => /^new:\d+$/.test(item) || Boolean(safeStoredImage(item)))
  : [];
const orderOptionImages = (storedImages, uploadedImages, order) => {
  const stored = parseStoredImages(storedImages);
  const arranged = parseImageOrder(order).map(token => {
    const newMatch = token.match(/^new:(\d+)$/);
    if (newMatch) return uploadedImages[Number(newMatch[1])] || '';
    return stored.includes(token) ? token : '';
  }).filter(Boolean);
  return [...new Set([...arranged, ...stored, ...uploadedImages])];
};
const parseOptions = value => {
  let values = value;
  if (typeof value === 'string') {
    try { values = JSON.parse(value); } catch { values = []; }
  }
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.map(item => ({
    id: Number(item?.id) || null,
    titulo: cleanText(typeof item === 'object' ? item.titulo : item).toLocaleUpperCase('es-AR'),
    descripcion: cleanText(item?.descripcion),
    imagen: safeStoredImage(item?.imagen),
    imagenes: parseStoredImages(item?.imagenes),
    orden_imagenes: parseImageOrder(item?.orden_imagenes),
    porcentaje_manual: item?.porcentaje_manual === '' || item?.porcentaje_manual === null || item?.porcentaje_manual === undefined
      ? null
      : Number(item.porcentaje_manual),
  })).filter(item => item.titulo && !seen.has(item.titulo.toLocaleLowerCase()) && seen.add(item.titulo.toLocaleLowerCase()));
};
const parseVisible = value => !['false', '0', 'off'].includes(String(value).toLowerCase());
const toDate = value => {
  const normalized = cleanText(value).replace('T', ' ');
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalized)
    ? (normalized.length === 16 ? `${normalized}:00` : normalized) : '';
};
const requestIpHash = req => {
  const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();
  const secret = process.env.POLL_IP_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.DB_PASSWORD || 'cadpo-polls';
  return crypto.createHmac('sha256', secret).update(ip || 'unknown').digest('hex');
};
const filesForOption = (files, index) => (files || []).filter(file => file.fieldname === `imagenes_${index}` || file.fieldname === `imagen_${index}`);

const writeImage = async file => {
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `opcion-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  await fs.mkdir(pollsRoot, { recursive: true });
  await fs.writeFile(path.join(pollsRoot, filename), file.buffer);
  return `/media/votaciones/${filename}`;
};
const removeImage = async image => {
  if (!safeStoredImage(image)) return;
  await fs.unlink(path.join(pollsRoot, path.basename(image))).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};
const removeImages = async images => Promise.all([...new Set(images.filter(Boolean))].map(removeImage));

const loadPolls = async ({ includeHidden = false, ipHash = '' } = {}) => {
  await ensureSchema();
  const [polls] = await pool.query(`SELECT id, titulo, dias, descripcion, fecha_inicio, fecha_cierre, max_opciones, visible, creado, actualizado,
    CASE WHEN NOW() < fecha_inicio THEN 'proxima' WHEN NOW() > fecha_cierre THEN 'cerrada' ELSE 'abierta' END AS estado
    FROM votaciones ${includeHidden ? '' : 'WHERE visible = 1'}
    ORDER BY CASE WHEN NOW() BETWEEN fecha_inicio AND fecha_cierre THEN 0 WHEN NOW() < fecha_inicio THEN 1 ELSE 2 END,
    fecha_inicio ASC, id DESC`);
  if (!polls.length) return [];
  const ids = polls.map(poll => poll.id);
  const [options] = await pool.query(`SELECT o.id, o.idvotacion, o.titulo, o.descripcion, o.imagen, o.imagenes, o.porcentaje_manual, o.orden, COUNT(v.idopcion) AS votos
    FROM votacion_opciones o LEFT JOIN votacion_votos v ON v.idopcion = o.id WHERE o.idvotacion IN (?)
    GROUP BY o.id, o.idvotacion, o.titulo, o.descripcion, o.imagen, o.imagenes, o.porcentaje_manual, o.orden ORDER BY o.idvotacion, o.orden, o.id`, [ids]);
  const [ballotCounts] = await pool.query(`SELECT idvotacion, COUNT(DISTINCT ip_hash) AS total_votos
    FROM votacion_votos WHERE idvotacion IN (?) GROUP BY idvotacion`, [ids]);
  const ballotCountByPoll = new Map(ballotCounts.map(row => [String(row.idvotacion), Number(row.total_votos || 0)]));
  let voted = new Map();
  if (ipHash) {
    const [rows] = await pool.query('SELECT idvotacion, idopcion FROM votacion_votos WHERE idvotacion IN (?) AND ip_hash = ?', [ids, ipHash]);
    voted = rows.reduce((map, row) => {
      const key = String(row.idvotacion);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(Number(row.idopcion));
      return map;
    }, new Map());
  }
  const grouped = options.reduce((map, option) => {
    const key = String(option.idvotacion);
    if (!map[key]) map[key] = [];
    map[key].push(option);
    return map;
  }, {});
  return polls.map(poll => {
    const pollOptions = grouped[String(poll.id)] || [];
    const totalSelections = pollOptions.reduce((sum, option) => sum + Number(option.votos || 0), 0);
    const totalVotes = ballotCountByPoll.get(String(poll.id)) || 0;
    const votedOptions = voted.get(String(poll.id)) || [];
    return { ...poll, max_opciones: Math.max(1, Number(poll.max_opciones || 1)), visible: Boolean(poll.visible), total_votos: totalVotes, total_selecciones: totalSelections, ya_voto: votedOptions.length > 0,
      idopcion_votada: votedOptions[0] || null, idopciones_votadas: votedOptions,
      opciones: pollOptions.map(option => {
        const porcentajeReal = totalSelections ? Number(((Number(option.votos || 0) / totalSelections) * 100).toFixed(1)) : 0;
        const porcentajeManual = option.porcentaje_manual === null ? null : Number(option.porcentaje_manual);
        const imagenes = [...new Set([...parseStoredImages(option.imagenes), safeStoredImage(option.imagen)].filter(Boolean))];
        return { ...option, imagen: imagenes[0] || '', imagenes, votos: Number(option.votos || 0), porcentaje_real: porcentajeReal,
          porcentaje_manual: porcentajeManual, porcentaje: porcentajeManual ?? porcentajeReal };
      }) };
  });
};

const validatePayload = body => {
  const titulo = cleanText(body.titulo) || 'VOTACIÓN PRÓXIMO CAMPEONATO';
  const dias = cleanText(body.dias).toLocaleUpperCase('es-AR');
  const descripcion = cleanText(body.descripcion);
  const fechaInicio = toDate(body.fecha_inicio);
  const fechaCierre = toDate(body.fecha_cierre);
  const opciones = parseOptions(body.opciones);
  const maxOpciones = Math.max(1, Math.floor(Number(body.max_opciones) || 1));
  if (!dias || !fechaInicio || !fechaCierre) return { error: 'Completá los días y las fechas de inicio y cierre' };
  if (new Date(fechaCierre.replace(' ', 'T')) <= new Date(fechaInicio.replace(' ', 'T'))) return { error: 'La fecha de cierre debe ser posterior a la apertura' };
  if (opciones.length < 2) return { error: 'La votación necesita al menos dos opciones diferentes' };
  if (opciones.length > 20) return { error: 'La votación admite hasta 20 opciones' };
  if (maxOpciones > opciones.length) return { error: 'El máximo de opciones a elegir no puede superar la cantidad de opciones cargadas' };
  if (opciones.some(option => option.porcentaje_manual !== null && (!Number.isFinite(option.porcentaje_manual) || option.porcentaje_manual < 0 || option.porcentaje_manual > 100))) return { error: 'Los porcentajes manuales deben estar entre 0 y 100' };
  return { titulo, dias, descripcion, fechaInicio, fechaCierre, maxOpciones, opciones, visible: parseVisible(body.visible) ? 1 : 0 };
};

const getPublic = async (req, res, next) => {
  try { const data = await loadPolls({ ipHash: requestIpHash(req) }); res.json({ data, total: data.length }); } catch (error) { next(error); }
};
const getAdmin = async (req, res, next) => {
  try { const data = await loadPolls({ includeHidden: true }); res.json({ data, total: data.length }); } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  const writtenImages = [];
  try {
    await ensureSchema();
    const data = validatePayload(req.body);
    if (data.error) return res.status(400).json({ error: data.error });
    for (let index = 0; index < data.opciones.length; index += 1) {
      const files = filesForOption(req.files, index);
      if (!files.length) { await removeImages(writtenImages); return res.status(400).json({ error: `Agregá al menos una foto para la opción “${data.opciones[index].titulo}”` }); }
      const uploadedImages = [];
      for (const file of files) {
        const image = await writeImage(file);
        writtenImages.push(image);
        uploadedImages.push(image);
      }
      data.opciones[index].imagenes = orderOptionImages([], uploadedImages, data.opciones[index].orden_imagenes);
      data.opciones[index].imagen = data.opciones[index].imagenes[0];
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query('INSERT INTO votaciones (titulo, dias, descripcion, imagen, fecha_inicio, fecha_cierre, max_opciones, visible) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)', [data.titulo, data.dias, data.descripcion, data.fechaInicio, data.fechaCierre, data.maxOpciones, data.visible]);
      for (let index = 0; index < data.opciones.length; index += 1) {
        const option = data.opciones[index];
        await connection.query('INSERT INTO votacion_opciones (idvotacion, titulo, descripcion, imagen, imagenes, porcentaje_manual, orden) VALUES (?, ?, ?, ?, ?, ?, ?)', [result.insertId, option.titulo, option.descripcion, option.imagen, JSON.stringify(option.imagenes), option.porcentaje_manual, index]);
      }
      await connection.commit();
      const poll = (await loadPolls({ includeHidden: true })).find(item => Number(item.id) === Number(result.insertId));
      res.status(201).json({ data: poll, message: 'Votación creada correctamente' });
    } catch (error) { await connection.rollback(); await removeImages(writtenImages); throw error; } finally { connection.release(); }
  } catch (error) { await removeImages(writtenImages); next(error); }
};

const update = async (req, res, next) => {
  const writtenImages = [];
  try {
    await ensureSchema();
    const data = validatePayload(req.body);
    if (data.error) return res.status(400).json({ error: data.error });
    const [[current]] = await pool.query('SELECT * FROM votaciones WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Votación no encontrada' });
    const [currentOptions] = await pool.query('SELECT id, titulo, descripcion, imagen, imagenes, porcentaje_manual FROM votacion_opciones WHERE idvotacion = ? ORDER BY orden, id', [req.params.id]);
    const changedOptions = JSON.stringify(currentOptions.map(item => cleanText(item.titulo).toLocaleUpperCase('es-AR'))) !== JSON.stringify(data.opciones.map(item => item.titulo));
    const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM votacion_votos WHERE idvotacion = ?', [req.params.id]);
    if (changedOptions && Number(count.total) > 0) return res.status(409).json({ error: 'No se pueden cambiar las opciones porque la votación ya recibió votos' });

    const currentById = new Map(currentOptions.map(option => [String(option.id), option]));
    for (let index = 0; index < data.opciones.length; index += 1) {
      const option = data.opciones[index];
      const existing = currentById.get(String(option.id)) || (!changedOptions ? currentOptions[index] : null);
      const existingImages = [...new Set([...parseStoredImages(existing?.imagenes), safeStoredImage(existing?.imagen)].filter(Boolean))];
      const retainedImages = option.imagenes.filter(image => existingImages.includes(image));
      const uploadedImages = [];
      for (const file of filesForOption(req.files, index)) {
        const image = await writeImage(file);
        writtenImages.push(image);
        uploadedImages.push(image);
      }
      option.imagenes = orderOptionImages(retainedImages, uploadedImages, option.orden_imagenes);
      option.imagen = option.imagenes[0] || '';
      if (!option.imagen) { await removeImages(writtenImages); return res.status(400).json({ error: `Agregá al menos una foto para la opción “${option.titulo}”` }); }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE votaciones SET titulo = ?, dias = ?, descripcion = ?, imagen = NULL, fecha_inicio = ?, fecha_cierre = ?, max_opciones = ?, visible = ? WHERE id = ?', [data.titulo, data.dias, data.descripcion, data.fechaInicio, data.fechaCierre, data.maxOpciones, data.visible, req.params.id]);
      if (changedOptions) {
        await connection.query('DELETE FROM votacion_opciones WHERE idvotacion = ?', [req.params.id]);
        for (let index = 0; index < data.opciones.length; index += 1) {
          const option = data.opciones[index];
          await connection.query('INSERT INTO votacion_opciones (idvotacion, titulo, descripcion, imagen, imagenes, porcentaje_manual, orden) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.id, option.titulo, option.descripcion, option.imagen, JSON.stringify(option.imagenes), option.porcentaje_manual, index]);
        }
      } else {
        for (let index = 0; index < currentOptions.length; index += 1) {
          await connection.query('UPDATE votacion_opciones SET titulo = ?, descripcion = ?, imagen = ?, imagenes = ?, porcentaje_manual = ?, orden = ? WHERE id = ? AND idvotacion = ?', [data.opciones[index].titulo, data.opciones[index].descripcion, data.opciones[index].imagen, JSON.stringify(data.opciones[index].imagenes), data.opciones[index].porcentaje_manual, index, currentOptions[index].id, req.params.id]);
        }
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); await removeImages(writtenImages); throw error; } finally { connection.release(); }

    const retained = new Set(data.opciones.flatMap(option => option.imagenes));
    const previousImages = currentOptions.flatMap(option => [...parseStoredImages(option.imagenes), safeStoredImage(option.imagen)]);
    await removeImages([...previousImages, current.imagen].filter(image => image && !retained.has(image)));
    const poll = (await loadPolls({ includeHidden: true })).find(item => Number(item.id) === Number(req.params.id));
    res.json({ data: poll, message: 'Votación actualizada correctamente' });
  } catch (error) { await removeImages(writtenImages); next(error); }
};

const vote = async (req, res, next) => {
  try {
    await ensureSchema();
    const pollId = Number(req.params.id);
    const requestedOptionIds = Array.isArray(req.body.idopciones) ? req.body.idopciones : [req.body.idopcion];
    const optionIds = [...new Set(requestedOptionIds.map(Number).filter(Number.isInteger))];
    const [[poll]] = await pool.query(`SELECT *, CASE WHEN NOW() < fecha_inicio THEN 'proxima' WHEN NOW() > fecha_cierre THEN 'cerrada' ELSE 'abierta' END AS estado FROM votaciones WHERE id = ?`, [pollId]);
    if (!poll || !poll.visible) return res.status(404).json({ error: 'Votación no disponible' });
    if (poll.estado !== 'abierta') return res.status(409).json({ error: poll.estado === 'cerrada' ? 'La votación ya cerró' : 'La votación todavía no abrió' });
    const maxOptions = Math.max(1, Number(poll.max_opciones || 1));
    if (!optionIds.length) return res.status(400).json({ error: 'Elegí al menos una opción' });
    if (optionIds.length > maxOptions) return res.status(400).json({ error: `Podés elegir como máximo ${maxOptions} opción${maxOptions === 1 ? '' : 'es'}` });
    const [validOptions] = await pool.query('SELECT id FROM votacion_opciones WHERE idvotacion = ? AND id IN (?)', [pollId, optionIds]);
    if (validOptions.length !== optionIds.length) return res.status(400).json({ error: 'Una de las opciones elegidas no pertenece a esta votación' });
    const ipHash = requestIpHash(req);
    const [currentVotes] = await pool.query('SELECT idopcion FROM votacion_votos WHERE idvotacion = ? AND ip_hash = ? ORDER BY idopcion', [pollId, ipHash]);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM votacion_votos WHERE idvotacion = ? AND ip_hash = ?', [pollId, ipHash]);
      for (const optionId of optionIds) await connection.query('INSERT INTO votacion_votos (idvotacion, idopcion, ip_hash) VALUES (?, ?, ?)', [pollId, optionId, ipHash]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    const updated = (await loadPolls({ ipHash })).find(item => Number(item.id) === pollId);
    const previousIds = currentVotes.map(row => Number(row.idopcion)).sort((a, b) => a - b);
    const nextIds = [...optionIds].sort((a, b) => a - b);
    const hadVote = previousIds.length > 0;
    const changed = hadVote && JSON.stringify(previousIds) !== JSON.stringify(nextIds);
    res.status(hadVote ? 200 : 201).json({
      data: updated,
      message: changed ? 'Tu voto fue actualizado correctamente' : hadVote ? 'Tu voto ya estaba confirmado con estas opciones' : 'Tu voto fue registrado correctamente',
    });
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[poll]] = await pool.query('SELECT imagen FROM votaciones WHERE id = ?', [req.params.id]);
    if (!poll) return res.status(404).json({ error: 'Votación no encontrada' });
    const [options] = await pool.query('SELECT imagen, imagenes FROM votacion_opciones WHERE idvotacion = ?', [req.params.id]);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM votacion_votos WHERE idvotacion = ?', [req.params.id]);
      await connection.query('DELETE FROM votacion_opciones WHERE idvotacion = ?', [req.params.id]);
      await connection.query('DELETE FROM votaciones WHERE id = ?', [req.params.id]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await removeImages([poll.imagen, ...options.flatMap(option => [...parseStoredImages(option.imagenes), safeStoredImage(option.imagen)])]);
    res.json({ message: 'Votación eliminada correctamente' });
  } catch (error) { next(error); }
};

const resetVotes = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[poll]] = await pool.query('SELECT id FROM votaciones WHERE id = ?', [req.params.id]);
    if (!poll) return res.status(404).json({ error: 'Votación no encontrada' });
    const [[count]] = await pool.query('SELECT COUNT(DISTINCT ip_hash) AS total FROM votacion_votos WHERE idvotacion = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM votacion_votos WHERE idvotacion = ?', [req.params.id]);
    const deletedVotes = Number(count.total || 0);
    res.json({
      message: result.affectedRows
        ? `Votación reiniciada: se eliminaron ${deletedVotes} voto${deletedVotes === 1 ? '' : 's'}`
        : 'La votación ya estaba sin votos',
      votos_eliminados: deletedVotes,
    });
  } catch (error) { next(error); }
};

module.exports = { create, getAdmin, getPublic, remove, resetVotes, update, vote };
